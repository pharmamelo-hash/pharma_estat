// Dados do estudo: SÓ NA MEMÓRIA (Doc 5 e 7.2). Nunca vão para IndexedDB, localStorage ou rede.
// Somem ao fechar a aba ou ao tocar em "Limpar dados agora".

let conjunto = null;

export const dadosAtuais = () => conjunto;
export function definirDados(d) { conjunto = d; window.dispatchEvent(new CustomEvent('dados-mudaram')); }
export function limparDados() { conjunto = null; window.dispatchEvent(new CustomEvent('dados-mudaram')); }
if (typeof window !== 'undefined') window.addEventListener('pagehide', () => { conjunto = null; });

// ---------- Conversão e detecção de tipos (funções puras, testadas) ----------
const PADRAO_BR = /^-?\d{1,3}(\.\d{3})+(,\d+)?$/;      // 1.234,56
const PADRAO_SIMPLES = /^-?\d+([.,]\d+)?$/;             // 12,5 ou 12.5
const PADRAO_CIENTIFICO = /^-?\d+(\.\d+)?[eE][-+]?\d+$/;

/** Converte texto em número aceitando vírgula decimal; devolve null se não for número. */
export function paraNumero(v) {
  if (typeof v === 'number') return Number.isFinite(v) ? v : null;
  if (v === null || v === undefined) return null;
  const s = String(v).trim();
  if (s === '') return null;
  if (PADRAO_BR.test(s)) return Number(s.replace(/\./g, '').replace(',', '.'));
  if (PADRAO_SIMPLES.test(s)) return Number(s.replace(',', '.'));
  if (PADRAO_CIENTIFICO.test(s)) return Number(s);
  return null;
}
export const vazio = (v) => v === null || v === undefined || String(v).trim() === '' || /^(na|n\/a|nan|null|-)$/i.test(String(v).trim());

/** Nomes de coluna que parecem identificar pessoas (Doc 7.2). */
export const PADRAO_IDENTIFICADOR = /(^|[^a-z])(nome|paciente|cpf|rg|prontu[aá]rio|registro|cns|cart[aã]o|telefone|celular|e-?mail|endere[cç]o|rua|cep|nascimento|data_nasc|dn|m[aã]e)([^a-z]|$)/i;

/** Detecta o tipo provável de uma coluna. */
export function detectarTipo(valores) {
  const presentes = valores.filter((v) => !vazio(v));
  if (presentes.length === 0) return 'categorico';
  const numeros = presentes.map(paraNumero).filter((n) => n !== null);
  const distintos = new Set(presentes.map((v) => String(v).trim())).size;
  if (numeros.length / presentes.length >= 0.95 && distintos > 6) return 'quantitativo';
  return 'categorico';
}

/** Monta o conjunto a partir de uma matriz [cabeçalho, ...linhas]. */
export function montarConjunto(matriz, nomeArquivo) {
  if (!Array.isArray(matriz) || matriz.length < 2) throw new Error('A planilha precisa de uma linha de cabeçalho e pelo menos uma linha de dados.');
  const cabecalho = matriz[0].map((c, i) => {
    const nome = String(c ?? '').trim();
    return nome === '' ? `coluna_${i + 1}` : nome.slice(0, 120);
  });
  const vistos = new Map();
  const nomes = cabecalho.map((n) => { const k = vistos.get(n) || 0; vistos.set(n, k + 1); return k ? `${n}_${k + 1}` : n; });
  const linhas = matriz.slice(1).filter((l) => Array.isArray(l) && l.some((v) => !vazio(v)));
  const colunas = nomes.map((nome, i) => {
    const valores = linhas.map((l) => (vazio(l[i]) ? null : l[i]));
    const tipo = detectarTipo(valores);
    const distintos = new Set(valores.filter((v) => v !== null).map(String)).size;
    const presentes = valores.filter((v) => v !== null).length;
    const pareceId = PADRAO_IDENTIFICADOR.test(nome) || (tipo === 'categorico' && presentes > 20 && distintos === presentes && valores.some((v) => /[a-zà-ú]{3,}\s+[a-zà-ú]{2,}/i.test(String(v ?? ''))));
    return { nome, tipo, valores, faltantes: valores.length - presentes, distintos, identificador: pareceId, incluir: !pareceId };
  });
  return { nomeArquivo: String(nomeArquivo || 'planilha').slice(0, 120), linhas: linhas.length, colunas };
}

/** Prepara só as colunas pedidas para enviar ao R (números ou textos, null = NA). */
export function colunasParaR(conj, nomes) {
  const saida = {};
  for (const nome of nomes) {
    const c = conj.colunas.find((x) => x.nome === nome);
    if (!c) throw new Error(`Coluna não encontrada: ${nome}`);
    // Ordinal codificado em números (ex.: 0 a 10) vai como número; ordinal em texto vai como texto.
    const ordinalNumerico = c.tipo === 'ordinal' && c.valores.every((v) => v === null || paraNumero(v) !== null);
    saida[nome] = c.tipo === 'quantitativo' || ordinalNumerico ? c.valores.map(paraNumero) : c.valores.map((v) => (v === null ? null : String(v).trim()));
  }
  return saida;
}

/** Níveis (categorias) de uma coluna, em ordem alfabética. */
export function niveis(conj, nome) {
  const c = conj?.colunas.find((x) => x.nome === nome);
  if (!c) return [];
  return [...new Set(c.valores.filter((v) => v !== null).map((v) => String(v).trim()))].sort((a, b) => a.localeCompare(b, 'pt-BR'));
}
