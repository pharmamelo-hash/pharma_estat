// Calculadora de tamanho de efeito (F18). Fórmulas clássicas; conferidas à mão em testes/efeito.test.js.
import { qnorm } from './distribuicoes.js';

/** d de Cohen (DP combinado), g de Hedges e IC 95% aproximado de d. */
export function efeitoMedias({ n1, m1, dp1, n2, m2, dp2 }) {
  const sp = Math.sqrt(((n1 - 1) * dp1 ** 2 + (n2 - 1) * dp2 ** 2) / (n1 + n2 - 2));
  const d = (m1 - m2) / sp;
  const J = 1 - 3 / (4 * (n1 + n2) - 9);
  const ep = Math.sqrt((n1 + n2) / (n1 * n2) + d ** 2 / (2 * (n1 + n2)));
  const z = qnorm(0.975);
  return { sp, d, g: J * d, li: d - z * ep, ls: d + z * ep, r: d / Math.sqrt(d ** 2 + 4) };
}
/** h de Cohen para duas proporções, RR, OR e diferença. */
export function efeitoProporcoes({ p1, p2 }) {
  return { h: 2 * Math.asin(Math.sqrt(p1)) - 2 * Math.asin(Math.sqrt(p2)), rr: p1 / p2, or: (p1 / (1 - p1)) / (p2 / (1 - p2)), dif: p1 - p2 };
}
/** Conversões aproximadas entre medidas (grupos de tamanho semelhante). */
export const dParaR = (d) => d / Math.sqrt(d ** 2 + 4);
export const rParaD = (r) => (2 * r) / Math.sqrt(1 - r ** 2);
export const orParaD = (or) => (Math.log(or) * Math.sqrt(3)) / Math.PI;
export const dParaOr = (d) => Math.exp((d * Math.PI) / Math.sqrt(3));

/** Classificação convencional de Cohen (referência, não regra clínica). */
export function rotuloD(d) { const a = Math.abs(d); return a < 0.2 ? 'desprezível' : a < 0.5 ? 'pequeno' : a < 0.8 ? 'médio' : 'grande'; }
export function rotuloR(r) { const a = Math.abs(r); return a < 0.1 ? 'desprezível' : a < 0.3 ? 'pequeno' : a < 0.5 ? 'médio' : 'grande'; }
export const rotuloH = rotuloD;
