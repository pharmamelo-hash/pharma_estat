// Calculadora amostral/poder (F17): junta as fórmulas validadas num único resolvedor puro.
import { CALCULOS, comPerdas } from './amostra.js';
import { funcaoPoderG, nParaPoder } from './poder.js';

export const COM_RAZAO = new Set(['a_duas_medias', 'a_duas_proporcoes', 'a_sobrevivencia']);
export const SO_ESTIMATIVA = new Set(['a_proporcao']);

/** Parâmetros do efeito no formato de poder.js. */
export function paramsPoder(id, v, { caudas = 2, k = 1 } = {}) {
  const base = { alfa: v.alfa, caudas };
  switch (id) {
    case 'a_duas_medias': return { ...base, k, d: v.d ?? v.delta / v.dp };
    case 'a_media_pareada': return { ...base, d: v.d ?? v.delta / v.dp };
    case 'a_duas_proporcoes': return { ...base, k, p1: v.p1, p2: v.p2 };
    case 'a_correlacao': return { ...base, r: v.r };
    case 'a_sobrevivencia': return { ...base, k, hr: v.hr };
    default: return null;
  }
}

/**
 * Resolve o cálculo.
 * modo 'n': devolve os tamanhos; modo 'poder': usa v.n (n do grupo 1, pares, participantes) e devolve o poder.
 * Retorno: { modo, n1, n2, total, nContinuo, eventos, poder, fPoder, xCurva, final:{n1,n2,total} }
 */
export function resolver(id, v, { modo = 'n', caudas = 2, k = 1, perdas = 0 } = {}) {
  if (SO_ESTIMATIVA.has(id)) {
    const r = CALCULOS[id](v);
    return { modo: 'n', n1: r.n, total: r.n, nContinuo: r.nContinuo, final: { n1: comPerdas(r.n, perdas), total: comPerdas(r.n, perdas) } };
  }
  if (id === 'a_duas_proporcoes' && v.p1 === v.p2) throw new RangeError('As proporções precisam ser diferentes.');
  if (id === 'a_sobrevivencia' && v.hr === 1) throw new RangeError('O hazard ratio precisa ser diferente de 1.');
  if ((id === 'a_duas_medias' || id === 'a_media_pareada') && !(paramsPoder(id, v).d > 0)) throw new RangeError('O efeito precisa ser maior que zero.');
  const razao = COM_RAZAO.has(id) ? k : 1;
  const pp = paramsPoder(id, v, { caudas, k: razao });
  const bruta = funcaoPoderG(id, pp);
  // Para n abaixo do mínimo da fórmula (ex.: correlação com n ≤ 3) o poder é tratado como 0.
  const f = (n) => { const p = bruta(n); return Number.isFinite(p) ? p : 0; };
  const dois = id === 'a_duas_medias' || id === 'a_duas_proporcoes';
  const fin = (n1, n2) => ({ n1: comPerdas(n1, perdas), n2: n2 ? comPerdas(n2, perdas) : undefined, total: comPerdas(n1, perdas) + (n2 ? comPerdas(n2, perdas) : 0) });

  if (id === 'a_sobrevivencia') {
    if (modo === 'n') {
      const evC = nParaPoder(id, pp, v.poder);
      const eventos = Math.ceil(evC);
      const total = Math.ceil(eventos / v.p_evento);
      const n1 = Math.ceil(total / (1 + razao)), n2 = total - n1;
      return { modo, eventos, nContinuo: evC, n1, n2, total, poder: f(eventos), fPoder: f, xCurva: eventos, final: { total: comPerdas(total, perdas) } };
    }
    const eventos = v.n * v.p_evento;
    return { modo, eventos, total: v.n, poder: f(eventos), fPoder: f, xCurva: Math.max(1, Math.round(eventos)), final: { total: v.n } };
  }
  if (modo === 'n') {
    const nC = nParaPoder(id, pp, v.poder);
    const n1 = Math.ceil(nC);
    const n2 = dois ? Math.ceil(razao * nC - 1e-9) : undefined;
    return { modo, n1, n2, total: n1 + (n2 || 0), nContinuo: nC, poder: f(n1), fPoder: f, xCurva: n1, final: dois ? fin(n1, n2) : { n1: comPerdas(n1, perdas), total: comPerdas(n1, perdas) } };
  }
  const n1 = v.n;
  const n2 = dois ? Math.round(razao * n1) : undefined;
  return { modo, n1, n2, total: n1 + (n2 || 0), poder: f(n1), fPoder: f, xCurva: n1, final: { n1, n2, total: n1 + (n2 || 0) } };
}
