// Poder e tamanho amostral generalizados (F17): uni ou bilateral e razão entre grupos (n2 = k·n1).
// Com k = 1 e bilateral, coincide com power.t.test / power.prop.test do R. Conferido em testes/poder.test.js.
import { qnorm, pnorm, qt, ptNaoCentral, raiz } from './distribuicoes.js';

const zAlfa = (alfa, caudas) => qnorm(1 - alfa / caudas);

/** Teste t. tipo 'duas_amostras' (n = n1; n2 = k·n1) ou 'pareado' (n = pares). d = Δ/σ. */
export function poderT({ n, d, alfa = 0.05, caudas = 2, k = 1, tipo = 'duas_amostras' }) {
  let gl, ncp;
  if (tipo === 'pareado') { gl = n - 1; ncp = Math.sqrt(n) * Math.abs(d); } else { const n2 = k * n; gl = n + n2 - 2; ncp = Math.abs(d) * Math.sqrt((n * n2) / (n + n2)); }
  return 1 - ptNaoCentral(qt(1 - alfa / caudas, gl), gl, ncp);
}

/** Duas proporções (Fleiss, sem correção de continuidade), n = n1 e n2 = k·n1. */
export function poderProporcoes({ n, p1, p2, alfa = 0.05, caudas = 2, k = 1 }) {
  const pm = (p1 + k * p2) / (1 + k), qm = 1 - pm;
  const z = (Math.abs(p1 - p2) * Math.sqrt(n) - zAlfa(alfa, caudas) * Math.sqrt(pm * qm * (1 + 1 / k))) / Math.sqrt(p1 * (1 - p1) + (p2 * (1 - p2)) / k);
  return pnorm(z);
}

/** Correlação (z de Fisher). */
export function poderCorrelacaoG({ n, r, alfa = 0.05, caudas = 2 }) {
  return pnorm(0.5 * Math.log((1 + Math.abs(r)) / (1 - Math.abs(r))) * Math.sqrt(n - 3) - zAlfa(alfa, caudas));
}

/** Sobrevida (Schoenfeld): n = eventos totais; alocação 1:k. */
export function poderSobrevidaG({ n, hr, alfa = 0.05, caudas = 2, k = 1 }) {
  const pi = 1 / (1 + k);
  return pnorm(Math.sqrt(n * pi * (1 - pi)) * Math.abs(Math.log(hr)) - zAlfa(alfa, caudas));
}

const FUNCOES = {
  a_duas_medias: (v) => (n) => poderT({ ...v, n, tipo: 'duas_amostras' }),
  a_media_pareada: (v) => (n) => poderT({ ...v, n, tipo: 'pareado', k: 1 }),
  a_duas_proporcoes: (v) => (n) => poderProporcoes({ ...v, n }),
  a_correlacao: (v) => (n) => poderCorrelacaoG({ ...v, n }),
  a_sobrevivencia: (v) => (n) => poderSobrevidaG({ ...v, n }),
};
export const temPoder = (id) => Boolean(FUNCOES[id]);
export function funcaoPoderG(id, v) { return FUNCOES[id] ? FUNCOES[id](v) : null; }

/** Menor n (contínuo) que atinge o poder. Mínimos: 2 (t), 4 (correlação), 1 (demais). */
export function nParaPoder(id, v, poder) {
  const f = funcaoPoderG(id, v);
  const min = id === 'a_correlacao' ? 4 : 2;
  if (f(1e7) < poder) throw new RangeError('Efeito pequeno demais para atingir este poder com um tamanho de amostra viável.');
  if (f(min) >= poder) return min;
  return raiz((n) => f(n) - poder, min, 1e7, 1e-10);
}
