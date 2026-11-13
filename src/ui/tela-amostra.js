// Calculadora amostral e de poder (F4 + F17): dois painéis, recálculo ao digitar.
// Fórmulas em calculo/calculadora.js (conferidas contra o R). Histórico guarda só parâmetros.
import { el, cabecalhoTela, aviso, blocoCodigo, numero } from './componentes.js';
import { BASE, CALCULOS as DEF, TESTES, DESENHOS } from '../base.js';
import { resolver, COM_RAZAO, SO_ESTIMATIVA } from '../calculo/calculadora.js';
import { curvaPoder, figuraInterativa } from './graficos.js';
import { paraNumero } from '../estado/dados.js';
import { projetoAtual, atualizarAtual } from '../estado/projeto.js';
import { listaRefs } from './fichas.js';
import { blocoCitar } from './citar.js';
import { icone } from './icones.js';
import { rotuloD } from '../calculo/efeito.js';
import { NOME_APP, VERSAO_APP } from '../config.js';

const pct = (v) => `${numero(v * 100, v * 100 % 1 === 0 ? 0 : 1)}%`;
const UNIDADE = { a_proporcao: 'participantes', a_duas_medias: 'n do grupo 1', a_media_pareada: 'pares', a_duas_proporcoes: 'n do grupo 1', a_correlacao: 'participantes', a_sobrevivencia: 'eventos' };
const CHAVE_HIST = 'bioestat.amostra.historico';

// Estado da tela (sobrevive à troca de cálculo dentro da sessão).
const estado = { calc: null, modo: 'n', caudas: 2, k: 1, entrada: 'delta', textos: {} };

function sugeridos() {
  const p = projetoAtual();
  return BASE.amostra.calculos.filter((c) => (p?.teste?.id && c.testes_relacionados.includes(p.teste.id)) || (p?.desenho?.id && c.desenhos_relacionados.includes(p.desenho.id))).map((c) => c.id);
}

/** Campos do formulário conforme o cálculo e as opções escolhidas. */
function camposDe(def) {
  const base = def.parametros.filter((p) => p.id !== 'alfa' && p.id !== 'poder');
  let lista = base;
  if ((def.id === 'a_duas_medias' || def.id === 'a_media_pareada') && estado.entrada === 'd') {
    lista = [{ id: 'd', rotulo: 'd de Cohen esperado', tipo: 'positivo', min: 0.01, max: 5, padrao: 0.5,
      ajuda: def.id === 'a_media_pareada' ? 'd = diferença média ÷ DP das diferenças (dz). 0,2 pequeno · 0,5 médio · 0,8 grande.' : 'd = diferença de médias ÷ DP combinado. 0,2 pequeno · 0,5 médio · 0,8 grande.' }];
  }
  if (SO_ESTIMATIVA.has(def.id)) return lista;
  const alfa = def.parametros.find((p) => p.id === 'alfa');
  const extra = [alfa];
  if (estado.modo === 'n') extra.push(def.parametros.find((p) => p.id === 'poder'));
  else extra.push({ id: 'n', rotulo: def.id === 'a_sobrevivencia' ? 'Participantes disponíveis (total)' : (UNIDADE[def.id].startsWith('n ') ? `${UNIDADE[def.id]} disponível` : `Número de ${UNIDADE[def.id]} disponível`), tipo: 'inteiro', min: def.id === 'a_correlacao' ? 4 : 2, max: 1e7, padrao: 50, ajuda: 'Quantos participantes você consegue incluir (ex.: censo do período).' });
  if (COM_RAZAO.has(def.id)) extra.push({ id: 'k', rotulo: 'Razão entre grupos (n₂ / n₁)', tipo: 'positivo', min: 0.1, max: 10, padrao: 1, ajuda: '1 = grupos iguais; 2 = dois controles para cada caso.' });
  return [...lista, ...extra];
}

function segmentado(rotulo, opcoes, atual, aoEscolher, desativado = false) {
  return el('div', { class: 'campo' }, el('span', { class: 'rotulo-campo' }, rotulo),
    el('div', { class: 'segmentado', role: 'group', 'aria-label': rotulo },
      ...opcoes.map(([valor, texto]) => el('button', { type: 'button', 'aria-pressed': String(valor === atual), disabled: desativado || null, onclick: () => aoEscolher(valor) }, texto))));
}

function lerHistorico() { try { return JSON.parse(localStorage.getItem(CHAVE_HIST)) || []; } catch { return []; } }
function guardarHistorico(item) {
  const h = lerHistorico().filter((x) => x.chave !== item.chave);
  h.unshift(item);
  try { localStorage.setItem(CHAVE_HIST, JSON.stringify(h.slice(0, 10))); } catch { /* sem armazenamento: segue sem histórico */ }
}

function textoProjeto(def, v, r, op) {
  const lado = op.caudas === 1 ? 'unilateral' : 'bilateral';
  const a = `nível de significância de ${pct(v.alfa)} (${lado})`;
  const fonte = ' [citar a fonte do efeito esperado]';
  const efeitoMed = v.d !== undefined ? `tamanho de efeito d de Cohen de ${numero(v.d, 2)}${fonte}` : `diferença de ${numero(v.delta, 2)} com desvio-padrão de ${numero(v.dp, 2)}${fonte} (d = ${numero(v.delta / v.dp, 2)})`;
  const razao = COM_RAZAO.has(def.id) && op.k !== 1 ? ` e alocação ${numero(1, 0)}:${numero(op.k, 2)}` : COM_RAZAO.has(def.id) ? ' e alocação 1:1' : '';
  const perdas = op.perdas > 0 ? ` Prevendo perdas de ${pct(op.perdas)}, ` : ' ';
  const grupos = (f) => (f.n2 !== undefined ? `${f.n1} no grupo 1 e ${f.n2} no grupo 2 (${f.total} no total)` : `${f.total} participantes`);
  if (def.id === 'a_proporcao') return `O tamanho amostral foi calculado para estimar uma proporção esperada de ${pct(v.p)}${fonte}, com margem de erro de ${pct(v.e)} e nível de confiança de ${pct(v.confianca)}${v.N ? `, considerando população finita de ${v.N}` : ''}, resultando em ${r.n1} participantes.${op.perdas > 0 ? `${perdas}serão incluídos ${r.final.total}.` : ''}`;
  const alvo = {
    a_duas_medias: `detectar ${efeitoMed}`,
    a_media_pareada: `detectar, em medidas pareadas, ${efeitoMed.replace('desvio-padrão', 'desvio-padrão das diferenças')}`,
    a_duas_proporcoes: `detectar diferença entre proporções de ${pct(v.p1)} e ${pct(v.p2)}${fonte}`,
    a_correlacao: `detectar correlação de ${numero(v.r, 2)}${fonte}`,
    a_sobrevivencia: `detectar hazard ratio de ${numero(v.hr, 2)}${fonte}`,
  }[def.id];
  if (r.modo === 'poder') {
    return `Com ${def.id === 'a_sobrevivencia' ? `${v.n} participantes (cerca de ${numero(r.eventos, 0)} eventos, para proporção de eventos de ${pct(v.p_evento)})` : grupos(r.final)}, o estudo terá poder de ${pct(Math.floor(r.poder * 1000) / 1000)} para ${alvo}, com ${a}${razao}.`;
  }
  if (def.id === 'a_sobrevivencia') return `O tamanho amostral foi calculado para ${alvo}, com ${a}, poder de ${pct(v.poder)}${razao}, sendo necessários ${r.eventos} eventos; com proporção esperada de eventos de ${pct(v.p_evento)}, resultam ${r.total} participantes.${op.perdas > 0 ? `${perdas}serão incluídos ${r.final.total}.` : ''}`;
  const semPerdas = r.n2 !== undefined ? `${r.n1} participantes no grupo 1 e ${r.n2} no grupo 2 (${r.total} no total)` : `${r.total} ${def.id === 'a_media_pareada' ? 'participantes (pares de medidas)' : 'participantes'}`;
  return `O tamanho amostral foi calculado para ${alvo}, com ${a}, poder de ${pct(v.poder)}${razao}, resultando em ${semPerdas}.${op.perdas > 0 ? `${perdas}serão incluídos ${grupos(r.final)}.` : ''}`;
}

function codigoR(def, v, r, op) {
  const alt = op.caudas === 1 ? ', alternative = "one.sided"' : '';
  const delta = v.d !== undefined ? v.d : v.delta, sd = v.d !== undefined ? 1 : v.dp;
  const conferePoder = r.modo === 'poder' ? `n = ${r.n1}, ` : '';
  const alvoPoder = r.modo === 'poder' ? '' : `, power = ${v.poder}`;
  const za = `qnorm(1 - ${v.alfa}${op.caudas === 2 ? ' / 2' : ''})`;
  switch (def.id) {
    case 'a_duas_medias':
      if (op.k !== 1) return `# Grupos desiguais: confira o poder com o pacote pwr\n# install.packages("pwr")\npwr::pwr.t2n.test(n1 = ${r.n1}, n2 = ${r.n2}, d = ${numero(delta / sd, 4).replace(',', '.')}, sig.level = ${v.alfa}${op.caudas === 1 ? ', alternative = "greater"' : ''})`;
      return `power.t.test(${conferePoder}delta = ${delta}, sd = ${sd}, sig.level = ${v.alfa}${alvoPoder}${alt})`;
    case 'a_media_pareada': return `power.t.test(${conferePoder}delta = ${delta}, sd = ${sd}, sig.level = ${v.alfa}${alvoPoder}, type = "paired"${alt})`;
    case 'a_duas_proporcoes':
      if (op.k !== 1) return `# Grupos desiguais (fórmula de Fleiss sem correção de continuidade)\np1 <- ${v.p1}; p2 <- ${v.p2}; k <- ${op.k}; n1 <- ${r.n1}\npm <- (p1 + k * p2) / (1 + k)\nz <- (abs(p1 - p2) * sqrt(n1) - ${za} * sqrt(pm * (1 - pm) * (1 + 1 / k))) /\n     sqrt(p1 * (1 - p1) + p2 * (1 - p2) / k)\npnorm(z)  # poder`;
      return `power.prop.test(${conferePoder}p1 = ${v.p1}, p2 = ${v.p2}, sig.level = ${v.alfa}${alvoPoder}${alt})`;
    case 'a_proporcao': return `z <- qnorm(1 - (1 - ${v.confianca}) / 2)\nn0 <- z^2 * ${v.p} * (1 - ${v.p}) / ${v.e}^2${v.N ? `\nn <- n0 / (1 + (n0 - 1) / ${v.N})` : '\nn <- n0'}\nceiling(n)`;
    case 'a_correlacao': return r.modo === 'poder'
      ? `C <- 0.5 * log((1 + ${v.r}) / (1 - ${v.r}))\npnorm(C * sqrt(${r.n1} - 3) - ${za})  # poder`
      : `C <- 0.5 * log((1 + ${v.r}) / (1 - ${v.r}))\nceiling(((${za} + qnorm(${v.poder})) / C)^2 + 3)`;
    case 'a_sobrevivencia': {
      const pi = `${numero(1 / (1 + op.k), 4).replace(',', '.')}`;
      return r.modo === 'poder'
        ? `eventos <- ${v.n} * ${v.p_evento}\npnorm(sqrt(eventos * ${pi} * (1 - ${pi})) * abs(log(${v.hr})) - ${za})  # poder`
        : `eventos <- ceiling((${za} + qnorm(${v.poder}))^2 / (${pi} * (1 - ${pi}) * log(${v.hr})^2))\nceiling(eventos / ${v.p_evento})`;
    }
    default: return '';
  }
}

function painel(def) {
  const salvo = projetoAtual()?.amostra?.calculo === def.id ? projetoAtual().amostra : null;
  if (salvo?.opcoes && !estado.textos[def.id]) Object.assign(estado, salvo.opcoes);
  const textos = (estado.textos[def.id] ||= {});
  const config = el('section', { class: 'cartao calc-config', 'aria-label': 'Configuração do cálculo' });
  const resultado = el('section', { class: 'calc-resultado', 'aria-label': 'Resultado', 'aria-live': 'polite' });
  const erros = el('div', { role: 'alert' });
  // Celular: resumo flutuante do resultado enquanto se digita no formulário.
  const flutuante = el('button', { type: 'button', class: 'resumo-flutuante', onclick: () => resultado.scrollIntoView({ behavior: 'smooth', block: 'start' }) });
  let entradas = {};

  const montarConfig = () => {
    const campos = camposDe(def);
    const inputs = {};
    const linhas = campos.map((p) => {
      const inicial = textos[p.id] ?? (salvo?.parametros?.[p.id] ?? (p.id === 'k' ? estado.k : p.id === 'n' ? (salvo?.resultado ?? p.padrao) : p.padrao));
      const input = el('input', { id: `par-${p.id}`, type: 'text', inputmode: 'decimal', autocomplete: 'off',
        value: inicial === null || inicial === undefined ? '' : String(inicial).replace('.', ','), 'aria-describedby': p.ajuda ? `ajuda-${p.id}` : null,
        oninput: (e) => { textos[p.id] = e.target.value; calcular(); } });
      inputs[p.id] = input;
      return el('div', { class: 'campo' }, el('label', { for: `par-${p.id}` }, p.rotulo), input,
        p.ajuda ? el('small', { id: `ajuda-${p.id}`, class: 'texto-suave' }, p.ajuda) : null);
    });
    const perdas = el('input', { id: 'par-perdas', type: 'text', inputmode: 'decimal', value: textos.perdas ?? String((salvo?.perdas ?? 0.1) * 100).replace('.', ','),
      oninput: (e) => { textos.perdas = e.target.value; calcular(); } });
    inputs.perdas = perdas;
    const teste = !SO_ESTIMATIVA.has(def.id);
    const medias = def.id === 'a_duas_medias' || def.id === 'a_media_pareada';
    config.replaceChildren(...[
      el('h2', { class: 'titulo-painel' }, icone('amostra', 18), 'Configuração'),
      segmentado('O que calcular', [['n', 'Tamanho da amostra'], ['poder', 'Poder do estudo']], teste ? estado.modo : 'n', (m) => { estado.modo = m; montarConfig(); }, !teste),
      !teste ? el('small', { class: 'texto-suave' }, 'Estimativa de proporção não tem poder: o alvo é a margem de erro.') : null,
      teste ? segmentado('Hipótese', [[2, 'Bilateral'], [1, 'Unilateral']], estado.caudas, (c) => { estado.caudas = c; montarConfig(); }) : null,
      teste && estado.caudas === 1 ? aviso('Unilateral só se um efeito no sentido oposto for impossível ou irrelevante, e com justificativa escrita antes da coleta.', 'atencao') : null,
      medias ? segmentado('Efeito informado como', [['delta', 'Diferença e DP'], ['d', 'd de Cohen']], estado.entrada, (e) => { estado.entrada = e; montarConfig(); }) : null,
      el('form', { class: 'formulario', novalidate: true, onsubmit: (e) => e.preventDefault() },
        el('div', { class: 'grade grade-2 grade-campos' }, linhas,
          el('div', { class: 'campo' }, el('label', { for: 'par-perdas' }, 'Perdas previstas (%)'), perdas,
            el('small', { class: 'texto-suave' }, 'Recusas, perdas de seguimento ou prontuários incompletos.')))),
      erros,
      el('details', {}, el('summary', {}, 'Fórmula e referências'),
        el('p', { class: 'formula mono' }, def.formula_texto),
        def.observacao ? el('p', { class: 'texto-suave' }, def.observacao) : null,
        estado.caudas === 1 || estado.k !== 1 || estado.modo === 'poder' ? el('p', { class: 'texto-suave' }, 'Com unilateral, razão diferente de 1 ou cálculo de poder, o app usa a mesma família de fórmulas (t não central para médias; Fleiss para proporções; Fisher z para correlação; Schoenfeld para sobrevida), resolvidas numericamente.') : null,
        listaRefs(def.refs))].filter(Boolean));
    entradas = inputs;
    calcular();
  };

  const ler = () => {
    const valores = {}; const problemas = [];
    for (const p of camposDe(def)) {
      const bruto = entradas[p.id].value.trim();
      if (bruto === '' && p.padrao === null) { valores[p.id] = null; continue; }
      let n = paraNumero(bruto.replace('%', ''));
      if (n === null) { problemas.push(`${p.rotulo}: informe um número.`); continue; }
      if (p.tipo === 'proporcao' && n > 1 && n <= 100) n /= 100; // 30 ou 30% → 0,30
      if (n < p.min || n > p.max) { problemas.push(`${p.rotulo}: use um valor entre ${numero(p.min, p.tipo === 'inteiro' ? 0 : 3)} e ${numero(p.max, p.tipo === 'inteiro' ? 0 : 3)}.`); continue; }
      valores[p.id] = p.tipo === 'inteiro' ? Math.round(n) : n;
    }
    const perdasN = paraNumero(entradas.perdas.value);
    if (perdasN === null || perdasN < 0 || perdasN > 90) problemas.push('Perdas: use um valor entre 0 e 90%.');
    return { valores, problemas, perdas: (perdasN ?? 0) / 100 };
  };

  function calcular() {
    const { valores, problemas, perdas } = ler();
    erros.replaceChildren(...problemas.map((m) => aviso(m, 'erro')));
    if (problemas.length) { resultado.classList.add('desatualizado'); flutuante.replaceChildren(el('small', {}, 'Confira os campos')); return; }
    const op = { modo: SO_ESTIMATIVA.has(def.id) ? 'n' : estado.modo, caudas: estado.caudas, k: COM_RAZAO.has(def.id) ? (valores.k ?? 1) : 1, perdas };
    estado.k = op.k;
    let r;
    try { r = resolver(def.id, valores, op); } catch (e) { erros.replaceChildren(aviso(e.message, 'erro')); resultado.classList.add('desatualizado'); return; }
    resultado.classList.remove('desatualizado');
    desenharResultado(def, valores, op, r);
  }

  function desenharResultado(def, v, op, r) {
    const dois = r.n2 !== undefined;
    const alvo = v.poder ?? 0.8;
    const chips = [
      v.alfa !== undefined ? `α ${pct(v.alfa)}` : null,
      r.modo === 'n' && v.poder !== undefined ? `poder ${pct(v.poder)}` : null,
      !SO_ESTIMATIVA.has(def.id) ? (op.caudas === 1 ? 'unilateral' : 'bilateral') : null,
      COM_RAZAO.has(def.id) ? `razão 1:${numero(op.k, 2)}` : null,
      (v.d ?? (v.delta && v.dp ? v.delta / v.dp : null)) ? `d = ${numero(v.d ?? v.delta / v.dp, 2)} (${rotuloD(v.d ?? v.delta / v.dp)})` : null,
      op.perdas > 0 ? `perdas ${pct(op.perdas)}` : null,
    ].filter(Boolean);

    let destaque;
    if (r.modo === 'poder') {
      const ok = r.poder >= 0.8;
      destaque = el('div', { class: `calc-destaque ${ok ? 'ok' : 'baixo'}` },
        el('span', { class: 'etiqueta' }, 'Poder estatístico'),
        el('p', { class: 'numero-grande' }, `${numero(r.poder * 100, 1)}%`),
        el('div', { class: 'medidor', role: 'img', 'aria-label': `Poder de ${Math.round(r.poder * 100)}%` }, el('span', { style: `width:${Math.min(100, r.poder * 100)}%` }), el('i', { style: 'left:80%' })),
        el('p', {}, ok ? 'Atinge o mínimo usual de 80%.' : `Abaixo de 80%: chance de ${Math.round((1 - r.poder) * 100)}% de não detectar o efeito, mesmo que ele exista.`),
        def.id === 'a_sobrevivencia' ? el('p', { class: 'texto-suave' }, `Eventos esperados: ${numero(r.eventos, 0)}.`) : null);
    } else {
      const principal = def.id === 'a_sobrevivencia' ? r.final.total : dois ? r.final.total : r.final.total;
      destaque = el('div', { class: 'calc-destaque' },
        el('span', { class: 'etiqueta' }, 'Tamanho da amostra'),
        el('p', { class: 'numero-grande' }, String(principal), el('small', {}, def.id === 'a_media_pareada' ? ' participantes (pares)' : ' participantes no total')),
        dois ? el('div', { class: 'grupos-n' },
          el('div', {}, el('small', {}, 'Grupo 1'), el('strong', {}, String(r.final.n1))),
          el('div', {}, el('small', {}, 'Grupo 2'), el('strong', {}, String(r.final.n2)))) : null,
        el('p', { class: 'texto-suave' }, [
          `Sem perdas: ${dois ? `${r.n1} + ${r.n2} = ${r.total}` : r.total}`,
          r.eventos ? `eventos necessários: ${r.eventos}` : null,
          r.nContinuo ? `valor exato: ${numero(r.nContinuo, 2)}` : null,
          r.poder ? `poder real com o n arredondado: ${numero(r.poder * 100, 1)}%` : null].filter(Boolean).join(' · ')),
        el('p', { class: 'texto-suave' }, 'Arredonda-se sempre para cima; as perdas entram depois: n final = n ÷ (1 − perdas).'));
    }

    const alertas = [];
    if (v.poder !== undefined && r.modo === 'n' && v.poder < 0.8) alertas.push('Poder abaixo de 80%: aumenta o risco de não detectar um efeito real.');
    if (v.alfa !== undefined && v.alfa > 0.05) alertas.push('α acima de 5%: justifique no projeto (ex.: estudo piloto).');
    if (def.id === 'a_duas_medias') alertas.push('Se a análise prevista for Mann-Whitney, uma regra conservadora é acrescentar cerca de 15% ao n.');
    if (def.id === 'a_duas_proporcoes' && Math.min(v.p1, v.p2) * r.n1 < 5) alertas.push('Poucos eventos esperados por grupo: a análise deverá usar o teste exato de Fisher.');
    if (COM_RAZAO.has(def.id) && op.k > 4) alertas.push('Acima de 4 controles por caso, o ganho de poder é pequeno para o custo extra.');

    const curva = r.fPoder ? (() => {
      const rot = UNIDADE[def.id];
      const nMax = Math.max(20, Math.ceil(r.xCurva * 2.2));
      const area = el('div'), leitura = el('p', { class: 'texto-suave' });
      const desenhar = (n) => {
        const p = r.fPoder(n);
        area.replaceChildren(figuraInterativa(curvaPoder(r.fPoder, nMax, r.xCurva, n, alvo, rot)));
        leitura.replaceChildren(`Com ${rot} = ${n}, o poder seria `, el('strong', { style: `color:var(${p >= alvo ? '--sucesso' : '--erro'})` }, `${Math.round(p * 100)}%`), '.');
      };
      const id = `poder-n-${def.id}`;
      const slider = el('input', { id, type: 'range', min: 2, max: nMax, step: 1, value: r.xCurva, oninput: (e) => desenhar(Number(e.target.value)) });
      desenhar(r.xCurva);
      return el('div', { class: 'cartao painel-poder' }, el('h3', {}, 'Curva de poder'),
        el('label', { for: id }, `Arraste para simular outro valor (${rot})`), slider, area, leitura);
    })() : null;

    flutuante.replaceChildren(el('small', {}, r.modo === 'poder' ? 'Poder' : 'Amostra'), el('strong', {}, r.modo === 'poder' ? `${numero(r.poder * 100, 1)}%` : `n = ${r.final.total}`), el('span', {}, 'ver resultado ↓'));
    flutuante.classList.toggle('baixo', r.modo === 'poder' && r.poder < 0.8);
    const texto = textoProjeto(def, v, r, op);
    const status = el('p', { class: 'texto-suave', role: 'status' });
    const resumoHist = r.modo === 'poder' ? `poder ${numero(r.poder * 100, 1)}%` : `n = ${r.final.total}`;
    resultado.replaceChildren(...[
      el('div', { class: 'cartao calc-cartao-resultado' }, destaque,
        el('div', { class: 'chips' }, ...chips.map((c) => el('span', { class: 'chip' }, c))),
        ...alertas.map((m) => aviso(m, 'atencao')),
        el('div', { class: 'acoes' },
          el('button', { class: 'botao', type: 'button', onclick: async () => {
            await atualizarAtual({ amostra: { calculo: def.id, parametros: v, perdas: op.perdas, resultado: r.modo === 'poder' ? r.final.total : r.final.total, poder: r.poder ?? null, opcoes: { modo: estado.modo, caudas: estado.caudas, k: op.k, entrada: estado.entrada } } });
            status.textContent = `Salvo no projeto "${projetoAtual().titulo}".`;
          } }, icone('salvar', 16), 'Salvar no projeto'),
          el('button', { class: 'botao secundario', type: 'button', onclick: () => {
            guardarHistorico({ chave: `${def.id}|${JSON.stringify(v)}|${JSON.stringify(op)}`, calc: def.id, nome: def.nome, resumo: resumoHist, valores: v, op, opcoes: { modo: estado.modo, caudas: estado.caudas, entrada: estado.entrada }, quando: Date.now() });
            desenharHistorico();
            status.textContent = 'Guardado no histórico deste aparelho.';
          } }, icone('historico', 16), 'Guardar no histórico'),
          el('button', { class: 'botao secundario', type: 'button', onclick: () => {
            try { window.print(); } catch { status.textContent = 'A impressão foi bloqueada aqui. No app publicado, use Imprimir → Salvar como PDF.'; }
          } }, icone('pdf', 16), 'Imprimir / PDF')),
        status),
      curva,
      el('div', { class: 'cartao' }, el('h3', {}, 'Texto para o projeto'),
        blocoCodigo(`${texto} Cálculo realizado no ${NOME_APP} (versão ${VERSAO_APP}).`, 'Copiar texto'),
        el('h3', {}, 'Conferir no R'), blocoCodigo(codigoR(def, v, r, op))),
      historico,
      blocoCitar()].filter(Boolean));
  }

  const historico = el('details', { class: 'cartao historico' });
  function desenharHistorico() {
    const h = lerHistorico();
    historico.replaceChildren(...[el('summary', {}, el('strong', {}, `Histórico deste aparelho (${h.length})`)),
      h.length ? el('ul', { class: 'lista-historico' }, ...h.map((x) => el('li', {},
        el('button', { type: 'button', class: 'linha-historico', onclick: () => {
          estado.calc = x.calc; Object.assign(estado, x.opcoes, { k: x.op.k });
          estado.textos[x.calc] = Object.fromEntries([...Object.entries(x.valores).filter(([, val]) => val !== null).map(([c, val]) => [c, String(val).replace('.', ',')]), ['k', String(x.op.k).replace('.', ',')], ['perdas', String(x.op.perdas * 100).replace('.', ',')]]);
          redesenharTela?.();
        } }, el('strong', {}, x.resumo), el('span', {}, x.nome), el('small', {}, new Date(x.quando).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' })))))) : el('p', { class: 'texto-suave' }, 'Nenhum cálculo guardado. Só os parâmetros ficam aqui, nunca dados de pacientes.'),
      h.length ? el('button', { class: 'botao secundario pequeno', type: 'button', onclick: () => { try { localStorage.removeItem(CHAVE_HIST); } catch { /* nada */ } desenharHistorico(); } }, 'Limpar histórico') : null].filter(Boolean));
  }
  desenharHistorico();
  montarConfig();
  return el('div', { class: 'calc-layout' }, config, flutuante, resultado);
}

/** Texto do cálculo salvo no projeto (usado pelo Redator e pelo Corretor). */
export function textoAmostraSalva(p) {
  const a = p?.amostra;
  const def = a?.calculo && DEF[a.calculo];
  if (!def || !a.parametros) return null;
  const op = { modo: a.opcoes?.modo === 'poder' && !SO_ESTIMATIVA.has(def.id) ? 'poder' : 'n', caudas: a.opcoes?.caudas ?? 2, k: a.opcoes?.k ?? 1, perdas: a.perdas ?? 0 };
  try {
    const r = resolver(def.id, a.parametros, op);
    return `${textoProjeto(def, a.parametros, r, op)} Cálculo realizado no ${NOME_APP} (versão ${VERSAO_APP}).`;
  } catch { return null; }
}

let redesenharTela = null;
export function telaAmostra() {
  const sug = new Set(sugeridos());
  const p = projetoAtual();
  if (!estado.calc) estado.calc = p?.amostra?.calculo || [...sug][0] || 'a_duas_medias';
  const area = el('div');
  const desenhar = () => {
    const opcoes = BASE.amostra.calculos.map((c) => el('button', {
      class: 'chip-calculo', type: 'button', 'aria-pressed': String(c.id === estado.calc), title: c.quando_usar,
      onclick: () => { estado.calc = c.id; desenhar(); },
    }, c.nome, sug.has(c.id) ? el('span', { class: 'selo-sugerido' }, 'sugerido') : null));
    const def = DEF[estado.calc];
    area.replaceChildren(
      el('div', { class: 'faixa-calculos', role: 'group', 'aria-label': 'Tipo de cálculo' }, opcoes),
      el('p', { class: 'texto-suave quando-usar' }, def.quando_usar),
      painel(def));
  };
  redesenharTela = desenhar;
  desenhar();
  const contexto = p?.teste?.id || p?.desenho?.id
    ? aviso(`Projeto "${p.titulo}": ${[p.desenho?.id && DESENHOS[p.desenho.id]?.nome, p.teste?.id && TESTES[p.teste.id]?.nome].filter(Boolean).join(' · ')}.`, 'info')
    : null;
  return [
    cabecalhoTela('Amostra e poder', 'Calcule o tamanho da amostra ou o poder que o seu n já garante. O resultado atualiza enquanto você digita.', ['Dimensionar']),
    contexto,
    area,
  ];
}
