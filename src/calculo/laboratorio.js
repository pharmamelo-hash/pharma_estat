// Matemática dos cartões do laboratório "Armadilhas da evidência".
// Tudo determinístico (gerador com semente): a mesma tela mostra sempre os mesmos dados.
import { pnorm, qnorm } from './distribuicoes.js';

/** Gerador pseudoaleatório com semente (mulberry32). */
export function gerador(semente = 1) {
  let a = semente >>> 0;
  const unif = () => {
    a = (a + 0x6D2B79F5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  const normal = () => Math.sqrt(-2 * Math.log(unif() || 1e-12)) * Math.cos(2 * Math.PI * unif());
  return { unif, normal };
}

const media = (v) => v.reduce((s, x) => s + x, 0) / v.length;
export function mediana(v) {
  const o = [...v].sort((a, b) => a - b), m = Math.floor(o.length / 2);
  return o.length % 2 ? o[m] : (o[m - 1] + o[m]) / 2;
}
export function correlacao(x, y) {
  const mx = media(x), my = media(y);
  let sxy = 0, sxx = 0, syy = 0;
  for (let i = 0; i < x.length; i++) { sxy += (x[i] - mx) * (y[i] - my); sxx += (x[i] - mx) ** 2; syy += (y[i] - my) ** 2; }
  return sxy / Math.sqrt(sxx * syy);
}
/** Correlação parcial de x e y controlando z. */
export function correlacaoParcial(x, y, z) {
  const rxy = correlacao(x, y), rxz = correlacao(x, z), ryz = correlacao(y, z);
  return (rxy - rxz * ryz) / Math.sqrt((1 - rxz ** 2) * (1 - ryz ** 2));
}

// 1. Confundimento: a gravidade (SOFA) aumenta tanto o nº de medicamentos quanto os dias de internação (80 pacientes de UTI).
export function dadosGravidade(semente = 7, n = 80) {
  const g = gerador(semente);
  const sofa = Array.from({ length: n }, () => Math.round(g.unif() * 15));
  const medicamentos = sofa.map((s) => Math.max(1, Math.round(5 + 0.9 * s + g.normal() * 1.5)));
  const dias = sofa.map((s) => Math.max(1, Math.round(3 + 1.1 * s + g.normal() * 2)));
  return { sofa, medicamentos, dias, r: correlacao(medicamentos, dias), rParcial: correlacaoParcial(medicamentos, dias, sofa) };
}

// 2. Seleção: o tratamento não funciona, mas os mais graves saem do grupo tratado.
// gravidade de 0 (leve) a 1 (grave); chance de melhora = 1 − gravidade (igual nos dois grupos).
export function selecao(fracaoPerdasGraves, nPorGrupo = 50) {
  const gravidade = Array.from({ length: nPorGrupo }, (_, i) => (i + 0.5) / nPorGrupo);
  const fica = gravidade.map((_, i) => i < Math.round(nPorGrupo * (1 - fracaoPerdasGraves)));
  const melhoraControle = media(gravidade.map((x) => 1 - x));
  const restantes = gravidade.filter((_, i) => fica[i]);
  const melhoraTratado = restantes.length ? media(restantes.map((x) => 1 - x)) : NaN;
  return { gravidade, fica, melhoraControle, melhoraTratado, efeitoAparente: melhoraTratado - melhoraControle, efeitoReal: 0 };
}

// 3. Regressão à média: pressão medida duas vezes, sem nenhum tratamento.
export function regressaoMedia(fracaoSelecionada, semente = 11, n = 60) {
  const g = gerador(semente);
  const verdadeira = Array.from({ length: n }, () => 140 + g.normal() * 10);
  const m1 = verdadeira.map((v) => v + g.normal() * 8);
  const m2 = verdadeira.map((v) => v + g.normal() * 8);
  const k = Math.max(1, Math.round(n * fracaoSelecionada));
  const corte = [...m1].sort((a, b) => b - a)[k - 1];
  const sel = m1.map((v) => v >= corte);
  const idx = sel.map((s, i) => (s ? i : -1)).filter((i) => i >= 0);
  return { m1, m2, sel, corte, media1: media(idx.map((i) => m1[i])), media2: media(idx.map((i) => m2[i])), queda: media(idx.map((i) => m1[i])) - media(idx.map((i) => m2[i])) };
}

// 4. Significância × relevância: teste z para duas proporções (bilateral, variância combinada).
export function testeDuasProporcoes(p1, p2, nPorGrupo) {
  const pm = (p1 + p2) / 2;
  const ep = Math.sqrt(pm * (1 - pm) * (2 / nPorGrupo));
  const z = (p2 - p1) / ep;
  const epDif = Math.sqrt(p1 * (1 - p1) / nPorGrupo + p2 * (1 - p2) / nPorGrupo);
  return { z, p: 2 * pnorm(-Math.abs(z)), dif: p2 - p1, li: p2 - p1 - qnorm(0.975) * epDif, ls: p2 - p1 + qnorm(0.975) * epDif };
}

// 5. Amostra: 30 hospitais com a MESMA taxa real de infecção de cateter (5%); só muda o nº de pacientes.
export function hospitais(nPacientes, semente = 3, k = 30, taxaReal = 0.05) {
  const g = gerador(semente);
  const taxas = Array.from({ length: k }, () => {
    let casos = 0;
    for (let i = 0; i < nPacientes; i++) if (g.unif() < taxaReal) casos++;
    return casos / nPacientes;
  });
  return { taxas, min: Math.min(...taxas), max: Math.max(...taxas), taxaReal };
}

// 6. Taxa de base: valor preditivo positivo e negativo.
export function valoresPreditivos(prevalencia, sensibilidade, especificidade, populacao = 1000) {
  const doentes = prevalencia * populacao, sadios = populacao - doentes;
  const vp = sensibilidade * doentes, fp = (1 - especificidade) * sadios;
  const vn = especificidade * sadios, fn = doentes - vp;
  return { vp, fp, vn, fn, vpp: vp / (vp + fp), vpn: vn / (vn + fn) };
}

// 7. Média × mediana: tempo de internação com um caso extremo.
export const INTERNACOES = [3, 4, 4, 5, 5, 6, 6, 7, 8, 9];
export function mediaMediana(extremo) {
  const v = extremo > 0 ? [...INTERNACOES, extremo] : INTERNACOES;
  return { valores: v, media: media(v), mediana: mediana(v) };
}

// 8. Paradoxo de Simpson — cálculos renais (Charig et al., BMJ 1986).
export const SIMPSON = {
  rotulos: { A: 'Cirurgia aberta', B: 'Nefrolitotomia percutânea' },
  estratos: [
    { nome: 'Cálculos pequenos', A: [81, 87], B: [234, 270] },
    { nome: 'Cálculos grandes', A: [192, 263], B: [55, 80] },
  ],
};
export function simpson() {
  const tot = (k) => SIMPSON.estratos.reduce((s, e) => [s[0] + e[k][0], s[1] + e[k][1]], [0, 0]);
  const A = tot('A'), B = tot('B');
  return {
    geral: { A: A[0] / A[1], B: B[0] / B[1] },
    estratos: SIMPSON.estratos.map((e) => ({ nome: e.nome, A: e.A[0] / e.A[1], B: e.B[0] / e.B[1], nA: e.A[1], nB: e.B[1] })),
  };
}

// 9. Risco relativo × absoluto.
export function riscos(riscoBase, rr) {
  const tratado = riscoBase * rr;
  const rar = riscoBase - tratado;
  return { tratado, rrr: 1 - rr, rar, nnt: rar > 0 ? Math.ceil(1 / rar) : Infinity };
}
