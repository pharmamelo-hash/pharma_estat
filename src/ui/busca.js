// Busca global (F19): desenhos, testes, glossário, aulas, laboratório e ferramentas. Função pura testável.
import desenhos from '../../base/desenhos.json';
import testes from '../../base/testes.json';
import glossario from '../../base/glossario.json';
import trilha from '../../base/trilha.json';
import lab from '../../base/laboratorio.json';

export const normalizar = (s) => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

export const FERRAMENTAS = [
  { titulo: 'Analisar meu trabalho', texto: 'Análise automática com interpretação', destino: '#/analisar/auto', chaves: 'automatico planilha dados resumidos interpretar' },
  { titulo: 'Calculadora amostral e de poder', texto: 'Tamanho da amostra, poder, curva de poder', destino: '#/planejar/amostra', chaves: 'tamanho amostra n poder power calculo' },
  { titulo: 'Tamanho de efeito', texto: 'd de Cohen, g de Hedges, h, OR, RR, conversões', destino: '#/ferramentas/efeito', chaves: 'cohen hedges efeito d conversao' },
  { titulo: 'Qual teste usar?', texto: 'Assistente de escolha do teste', destino: '#/planejar/teste', chaves: 'classificador escolha teste estatistico' },
  { titulo: 'Qual é o meu tipo de estudo?', texto: 'Assistente de desenho', destino: '#/planejar/desenho', chaves: 'desenho delineamento estudo' },
  { titulo: 'Revisão metodológica', texto: 'Parecer sobre o projeto', destino: '#/projeto/revisao', chaves: 'parecer projeto revisao banca' },
  { titulo: 'Acompanhar a coleta', texto: 'Recrutamento, perdas, poder atingido', destino: '#/projeto/coleta', chaves: 'coleta recrutamento meta' },
];

let indice = null;
export function construirIndice() {
  if (indice) return indice;
  indice = [
    ...FERRAMENTAS.map((f) => ({ tipo: 'Ferramenta', ...f })),
    ...trilha.aulas.map((a) => ({ tipo: 'Aula', titulo: a.titulo, texto: a.resumo, destino: `#/aprender/aula/${a.id}`, chaves: a.cenas.map((c) => c.legenda).join(' ') })),
    ...testes.testes.map((t) => ({ tipo: 'Teste', titulo: t.nome, texto: t.usar_quando, destino: `#/aprender/teste/${t.id}`, chaves: `${t.porque} ${t.efeito}` })),
    ...desenhos.desenhos.map((d) => ({ tipo: 'Tipo de estudo', titulo: d.nome, texto: d.definicao, destino: '#/aprender/desenhos', chaves: `${(d.sinonimos || []).join(' ')} ${d.quando_usar}` })),
    ...glossario.termos.map((g) => ({ tipo: 'Glossário', titulo: g.termo, texto: g.definicao, destino: '#/aprender/glossario', chaves: g.exemplo })),
    ...lab.cartoes.map((c) => ({ tipo: 'Laboratório', titulo: c.titulo, texto: c.licao, destino: '#/aprender/laboratorio', chaves: c.texto })),
  ].map((i) => ({ ...i, _t: normalizar(i.titulo), _c: normalizar(`${i.texto} ${i.chaves || ''}`) }));
  return indice;
}

/** Busca por palavras (todas precisam aparecer); título pesa mais. */
export function buscar(termo, limite = 12) {
  const palavras = normalizar(termo).split(/\s+/).filter((p) => p.length >= 2);
  if (!palavras.length) return [];
  return construirIndice()
    .map((i) => {
      if (!palavras.every((p) => i._t.includes(p) || i._c.includes(p))) return null;
      let pontos = 0;
      for (const p of palavras) pontos += i._t.startsWith(p) ? 6 : i._t.includes(p) ? 4 : 1;
      if (i.tipo === 'Ferramenta' || i.tipo === 'Aula') pontos += 0.5;
      return { ...i, pontos };
    })
    .filter(Boolean)
    .sort((a, b) => b.pontos - a.pontos || a.titulo.localeCompare(b.titulo, 'pt-BR'))
    .slice(0, limite);
}
