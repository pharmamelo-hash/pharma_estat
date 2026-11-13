// Escolha automática da análise e interpretação: casos escritos à mão.
import { describe, it, expect } from 'vitest';
import { escolherAnalise, pareceRepetida, DESENHOS_RAPIDOS } from '../src/motor/auto.js';
import { interpretar, forcaCorrelacao, tamanhoD } from '../src/motor/interpretar.js';
import testes from '../base/testes.json';
import desenhos from '../base/desenhos.json';

const q = (nome) => ({ nome, tipo: 'quantitativo', nNiveis: 40 });
const o = (nome) => ({ nome, tipo: 'ordinal', nNiveis: 5 });
const c = (nome, n) => ({ nome, tipo: 'categorico', nNiveis: n });
const idsTestes = new Set(testes.testes.filter((t) => t.analise_no_app).map((t) => t.id));

describe('escolha automática', () => {
  it.each([
    ['quantitativo × 2 grupos', { desfecho: q('y'), explicativa: c('g', 2) }, 't_t_welch', 'dois_grupos'],
    ['ordinal × 2 grupos', { desfecho: o('y'), explicativa: c('g', 2) }, 't_mann_whitney', 'dois_grupos'],
    ['quantitativo × 4 grupos', { desfecho: q('y'), explicativa: c('g', 4) }, 't_anova_um_fator', 'varios'],
    ['ordinal × 3 grupos', { desfecho: o('y'), explicativa: c('g', 3) }, 't_kruskal_wallis', 'varios'],
    ['quantitativo × quantitativo', { desfecho: q('y'), explicativa: q('x') }, 't_pearson', 'correlacao'],
    ['ordinal × quantitativo', { desfecho: o('y'), explicativa: q('x') }, 't_spearman', 'correlacao'],
    ['categórico × categórico', { desfecho: c('y', 2), explicativa: c('g', 3) }, 't_qui_quadrado', 'categoricas'],
    ['binário × quantitativo', { desfecho: c('y', 2), explicativa: q('x') }, 't_regressao_logistica', 'logistica'],
    ['3 categorias × quantitativo (inverte)', { desfecho: c('y', 3), explicativa: q('x') }, 't_anova_um_fator', 'varios'],
    ['pareado quantitativo', { pareado: true, medidas: [q('a'), q('b')] }, 't_t_pareado', 'pareado'],
    ['pareado ordinal', { pareado: true, medidas: [o('a'), o('b')] }, 't_wilcoxon_pareado', 'pareado'],
    ['pareado binário', { pareado: true, medidas: [c('a', 2), c('b', 2)] }, 't_mcnemar', 'mcnemar'],
    ['3 momentos', { pareado: true, medidas: [q('a'), q('b'), q('c')] }, 't_friedman', 'friedman'],
  ])('%s → %s', (_n, entrada, teste, familia) => {
    const r = escolherAnalise(entrada);
    expect(r.erro).toBeUndefined();
    expect(r.teste).toBe(teste); expect(r.familia).toBe(familia);
    expect(idsTestes.has(r.teste)).toBe(true);
    expect(r.motivos.length).toBeGreaterThan(0);
  });
  it('inverte os papéis quando o desfecho tem 3+ categorias', () => {
    const r = escolherAnalise({ desfecho: c('estadio', 3), explicativa: q('idade') });
    expect(r.papeis).toEqual({ y: 'idade', g: 'estadio' }); expect(r.aviso).toBeTruthy();
  });
  it.each([
    [{ desfecho: q('y'), explicativa: q('y') }], [{ desfecho: q('y'), explicativa: c('g', 1) }], [{ desfecho: q('y') }],
    [{ pareado: true, medidas: [q('a')] }], [{ pareado: true, medidas: [q('a'), c('b', 2)] }], [{ pareado: true, medidas: [c('a', 3), c('b', 3)] }],
  ])('recusa entrada inválida %j', (e) => expect(escolherAnalise(e).erro).toBeTruthy());
  it('reconhece nomes de medidas repetidas', () => {
    expect(pareceRepetida(['idade', 'creat_antes', 'creat_depois', 'dor_d0', 'dor_d7', 'dor_d14', 'grupo'])).toEqual([['creat_antes', 'creat_depois'], ['dor_d0', 'dor_d7', 'dor_d14']]);
    expect(pareceRepetida(['idade', 'sexo'])).toEqual([]);
  });
  it('desenhos rápidos existem na base', () => {
    const ids = new Set(desenhos.desenhos.map((d) => d.id));
    DESENHOS_RAPIDOS.forEach((d) => expect(ids.has(d.id), d.id).toBe(true));
  });
});

describe('interpretação', () => {
  it('rótulos de magnitude', () => {
    expect(forcaCorrelacao(-0.45)).toBe('moderada'); expect(forcaCorrelacao(0.85)).toBe('muito forte'); expect(tamanhoD(0.79)).toBe('médio');
  });
  const doisGrupos = { tipo: 'dois_grupos', n: 60, principal: 't_t_welch',
    descritivas: [{ grupo: 'Estendida', media: 1.2, mediana: 1.1, q1: 1, q3: 1.4 }, { grupo: 'Intermitente', media: 1.6, mediana: 1.5, q1: 1.3, q3: 1.9 }],
    pressupostos: [{ nome: 'Normalidade: Estendida', estado: 'ok' }],
    resultados: [{ teste: 't_t_welch', nome: 'Teste t de Welch', p: 0.003, efeito: { valor: -0.4, li: -0.66, ls: -0.14, nota: 'd de Cohen = -0,79' } }] };
  it('dois grupos: orienta a diferença, cita o efeito e não fala em causa fora de ensaio', () => {
    const t = interpretar(doisGrupos, { nomeDesenho: 'Coorte retrospectiva (histórica)', causal: false }).map((b) => b.texto).join(' ');
    expect(t).toMatch(/"Intermitente" teve média maior \(1,60\) que "Estendida" \(1,20\)/);
    expect(t).toMatch(/0,40 \(IC 95% 0,14 a 0,66\)/);
    expect(t).toMatch(/efeito é médio/); expect(t).toMatch(/estatisticamente significativo \(p = 0,003\)/);
    expect(t).toMatch(/associação, não causa/);
  });
  it('não significativo: não afirma igualdade; ensaio: permite causalidade', () => {
    const r = { ...doisGrupos, n: 20, resultados: [{ ...doisGrupos.resultados[0], p: 0.31, efeito: { valor: -0.1, li: -0.4, ls: 0.2 } }] };
    const t = interpretar(r, { causal: true }).map((b) => b.texto).join(' ');
    expect(t).toMatch(/não prova que os grupos são iguais/); expect(t).toMatch(/inclui o zero/); expect(t).toMatch(/amostra é pequena/); expect(t).toMatch(/sorteio/);
  });
  it('correlação desprezível não descreve direção; Mann-Whitney não cita d de Cohen', () => {
    const c = { tipo: 'correlacao', n: 60, principal: 't_pearson', pressupostos: [], resultados: [{ teste: 't_pearson', nome: 'Pearson', p: 0.46, efeito: { valor: -0.08 } }] };
    expect(interpretar(c)[1].texto).toMatch(/Praticamente não há correlação/);
    const mw = { ...doisGrupos, principal: 't_mann_whitney', resultados: [doisGrupos.resultados[0], { teste: 't_mann_whitney', nome: 'Mann-Whitney', p: 0.01, efeito: { valor: -0.4, li: -0.6, ls: -0.1 } }] };
    expect(interpretar(mw)[1].texto).not.toMatch(/Cohen/);
  });
  it('2×2: usa OR no caso-controle e RR nos demais', () => {
    const r = { tipo: 'categoricas', n: 68, principal: 't_qui_quadrado', nivel_exposto: 'sim', nivel_evento: 'óbito', pressupostos: [],
      medidas_2x2: { risco_expostos: 0.7059, risco_nao_expostos: 0.3922, rr: { valor: 1.8, li: 1.14, ls: 2.84 }, or: { valor: 3.72, li: 1.14, ls: 12.1 }, dif: { valor: 0.3137 } },
      resultados: [{ teste: 't_qui_quadrado', nome: 'Qui-quadrado', p: 0.025, efeito: { valor: 0.27 } }] };
    expect(interpretar(r, { medida: 'or' })[1].texto).toMatch(/OR = 3,72/);
    expect(interpretar(r, { medida: 'rr' })[1].texto).toMatch(/risco relativo de 1,80 \(RR = 1,80.*31,4 pontos percentuais/);
    expect(interpretar(r, { medida: 'rp' })[1].texto).toMatch(/razão de prevalências de 1,80 \(RP/);
    expect(interpretar(r, { medida: 'or' }).at(-1).texto).toMatch(/odds ratio não é risco/);
  });
});
