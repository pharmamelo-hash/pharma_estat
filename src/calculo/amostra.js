// Cálculos de tamanho amostral (Doc 1, F4). Fórmulas e referências em base/amostra.json.
// Todos bilaterais, grupos de igual tamanho. Conferidos contra o R em testes/amostra.test.js.
import { qnorm, qt, ptNaoCentral, raiz, pnorm } from './distribuicoes.js';

/** Aplica perdas previstas: n / (1 − perdas), arredondado para cima. */
export function comPerdas(n, perdas = 0) {
  if (!(perdas >= 0 && perdas < 1)) throw new RangeError('Perdas devem estar entre 0 e 0,99.');
  return Math.ceil(n / (1 - perdas));
}

/** Estimar uma proporção com margem de erro absoluta (com correção para população finita opcional). */
export function amostraProporcao({ p, e, confianca = 0.95, N = null }) {
  const z = qnorm(1 - (1 - confianca) / 2);
  const n0 = (z * z * p * (1 - p)) / (e * e);
  const n = N ? n0 / (1 + (n0 - 1) / N) : n0;
  return { nContinuo: n, n: Math.ceil(n), z, n0 };
}

/** Poder para duas proporções com n por grupo (mesma fórmula de power.prop.test, strict = FALSE). */
export function poderDuasProporcoes(n, p1, p2, alfa = 0.05) {
  const q1 = 1 - p1, q2 = 1 - p2;
  const z = (Math.sqrt(n) * Math.abs(p1 - p2) - qnorm(1 - alfa / 2) * Math.sqrt(((p1 + p2) * (q1 + q2)) / 2)) / Math.sqrt(p1 * q1 + p2 * q2);
  return pnorm(z);
}

/** Comparar duas proporções (por grupo). Mesma fórmula de power.prop.test do R. */
export function amostraDuasProporcoes({ p1, p2, alfa = 0.05, poder = 0.8 }) {
  if (p1 === p2) throw new RangeError('As proporções precisam ser diferentes.');
  const za = qnorm(1 - alfa / 2), zb = qnorm(poder);
  const pm = (p1 + p2) / 2;
  const n = (za * Math.sqrt(2 * pm * (1 - pm)) + zb * Math.sqrt(p1 * (1 - p1) + p2 * (1 - p2))) ** 2 / (p1 - p2) ** 2;
  return { nContinuo: n, nPorGrupo: Math.ceil(n), nTotal: 2 * Math.ceil(n) };
}

/** Poder do teste t (bilateral, strict = FALSE, como no R). */
export function poderTesteT(n, delta, dp, alfa, tipo = 'duas_amostras') {
  const gl = tipo === 'pareado' ? n - 1 : 2 * (n - 1);
  const ncp = tipo === 'pareado' ? Math.sqrt(n) * delta / dp : Math.sqrt(n / 2) * delta / dp;
  const tCritico = qt(1 - alfa / 2, gl);
  return 1 - ptNaoCentral(tCritico, gl, ncp);
}

/** Comparar médias (t não central exato; equivale a power.t.test do R). */
export function amostraMedias({ delta, dp, alfa = 0.05, poder = 0.8, tipo = 'duas_amostras' }) {
  const n = raiz((x) => poderTesteT(x, delta, dp, alfa, tipo) - poder, 2, 1e7, 1e-10);
  const inteiro = Math.ceil(n);
  return tipo === 'pareado'
    ? { nContinuo: n, nPares: inteiro }
    : { nContinuo: n, nPorGrupo: inteiro, nTotal: 2 * inteiro };
}

/** Detectar correlação r ≠ 0 (transformação z de Fisher). */
export function amostraCorrelacao({ r, alfa = 0.05, poder = 0.8 }) {
  const C = 0.5 * Math.log((1 + r) / (1 - r));
  const n = ((qnorm(1 - alfa / 2) + qnorm(poder)) / C) ** 2 + 3;
  return { nContinuo: n, n: Math.ceil(n) };
}

/** Sobrevida: eventos de Schoenfeld (alocação 1:1) e n total pela proporção de eventos. */
export function amostraSobrevivencia({ hr, p_evento, alfa = 0.05, poder = 0.8 }) {
  if (hr === 1) throw new RangeError('O hazard ratio precisa ser diferente de 1.');
  const eventos = (qnorm(1 - alfa / 2) + qnorm(poder)) ** 2 / (0.25 * Math.log(hr) ** 2);
  const ev = Math.ceil(eventos);
  return { eventosContinuo: eventos, eventos: ev, nTotal: Math.ceil(ev / p_evento) };
}

/** Poder para detectar correlação r com n participantes (inverso da fórmula de Fisher). */
export function poderCorrelacao(n, r, alfa = 0.05) {
  const C = 0.5 * Math.log((1 + r) / (1 - r));
  return pnorm(C * Math.sqrt(n - 3) - qnorm(1 - alfa / 2));
}
/** Poder do log-rank/Cox (Schoenfeld) com um número de eventos e alocação 1:1. */
export function poderSobrevivencia(eventos, hr, alfa = 0.05) {
  return pnorm(Math.sqrt(0.25 * eventos) * Math.abs(Math.log(hr)) - qnorm(1 - alfa / 2));
}

/**
 * Poder em função do n (por grupo, pares, participantes ou eventos), para a curva interativa.
 * Devolve null quando o cálculo não tem poder (estimativa de proporção).
 */
export function funcaoPoder(idCalculo, v) {
  switch (idCalculo) {
    case 'a_duas_medias': return (n) => poderTesteT(n, v.delta, v.dp, v.alfa);
    case 'a_media_pareada': return (n) => poderTesteT(n, v.delta, v.dp, v.alfa, 'pareado');
    case 'a_duas_proporcoes': return (n) => poderDuasProporcoes(n, v.p1, v.p2, v.alfa);
    case 'a_correlacao': return (n) => poderCorrelacao(n, v.r, v.alfa);
    case 'a_sobrevivencia': return (eventos) => poderSobrevivencia(eventos, v.hr, v.alfa);
    default: return null;
  }
}

/** Despacha pelo id da base (a_*). */
export const CALCULOS = {
  a_proporcao: amostraProporcao,
  a_duas_proporcoes: amostraDuasProporcoes,
  a_duas_medias: (v) => amostraMedias({ ...v, tipo: 'duas_amostras' }),
  a_media_pareada: (v) => amostraMedias({ ...v, tipo: 'pareado' }),
  a_correlacao: amostraCorrelacao,
  a_sobrevivencia: amostraSobrevivencia,
};
