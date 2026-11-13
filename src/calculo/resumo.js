// Análise a partir de dados RESUMIDOS (F15): quando só se tem os números de um artigo ou relatório.
// Conferido contra o R em testes/resumo.test.js.
import { pnorm, qnorm, pt, qt, lgama } from './distribuicoes.js';

/** Teste t de Welch a partir de n, média e DP de dois grupos. */
export function welchResumo({ n1, m1, dp1, n2, m2, dp2 }) {
  const v1 = dp1 ** 2 / n1, v2 = dp2 ** 2 / n2, ep = Math.sqrt(v1 + v2);
  const t = (m1 - m2) / ep;
  const gl = (v1 + v2) ** 2 / (v1 ** 2 / (n1 - 1) + v2 ** 2 / (n2 - 1));
  const p = 2 * pt(-Math.abs(t), gl);
  const q = qt(0.975, gl);
  const dpComb = Math.sqrt(((n1 - 1) * dp1 ** 2 + (n2 - 1) * dp2 ** 2) / (n1 + n2 - 2));
  return { t, gl, p, dif: m1 - m2, li: m1 - m2 - q * ep, ls: m1 - m2 + q * ep, d: (m1 - m2) / dpComb };
}

const lnComb = (n, k) => lgama(n + 1) - lgama(k + 1) - lgama(n - k + 1);

/**
 * Tabela 2×2: a = expostos com evento, b = expostos sem, c = não expostos com evento, d = não expostos sem.
 * Qui-quadrado sem correção, exato de Fisher bilateral (como fisher.test do R) e medidas de associação.
 */
export function tabela2x2({ a, b, c, d }) {
  const n = a + b + c + d, l1 = a + b, l2 = c + d, c1 = a + c, c2 = b + d;
  const esp = [l1 * c1 / n, l1 * c2 / n, l2 * c1 / n, l2 * c2 / n];
  const obs = [a, b, c, d];
  const qui = obs.reduce((s, o, i) => s + (o - esp[i]) ** 2 / esp[i], 0);
  const pQui = 2 * pnorm(-Math.sqrt(qui));
  // Fisher: soma das probabilidades hipergeométricas menores ou iguais à da tabela observada
  const lnP = (x) => lnComb(l1, x) + lnComb(l2, c1 - x) - lnComb(n, c1);
  const pObs = lnP(a);
  let pFisher = 0;
  for (let x = Math.max(0, c1 - l2); x <= Math.min(l1, c1); x++) if (lnP(x) <= pObs + 1e-7) pFisher += Math.exp(lnP(x));
  const r1 = a / l1, r0 = c / l2, z = qnorm(0.975);
  const ic = (est, ep) => [Math.exp(Math.log(est) - z * ep), Math.exp(Math.log(est) + z * ep)];
  const rr = r1 / r0, or = (a * d) / (b * c), dif = r1 - r0;
  const epDif = Math.sqrt(r1 * (1 - r1) / l1 + r0 * (1 - r0) / l2);
  const [rrLi, rrLs] = ic(rr, Math.sqrt(1 / a - 1 / l1 + 1 / c - 1 / l2));
  const [orLi, orLs] = ic(or, Math.sqrt(1 / a + 1 / b + 1 / c + 1 / d));
  return {
    n, qui, pQui, pFisher: Math.min(1, pFisher), menorEsperada: Math.min(...esp), usarFisher: Math.min(...esp) < 5,
    r1, r0, rr: { valor: rr, li: rrLi, ls: rrLs }, or: { valor: or, li: orLi, ls: orLs }, dif: { valor: dif, li: dif - z * epDif, ls: dif + z * epDif },
    nnt: dif !== 0 ? Math.ceil(1 / Math.abs(dif)) : Infinity,
  };
}
