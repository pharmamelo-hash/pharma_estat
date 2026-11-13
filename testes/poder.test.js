import { describe, it, expect } from 'vitest';
import ref from './referencia-r/referencia-poder2.json';
import { poderT, poderProporcoes, poderCorrelacaoG, poderSobrevidaG, nParaPoder, funcaoPoderG } from '../src/calculo/poder.js';
import { amostraCorrelacao, amostraSobrevivencia, poderDuasProporcoes } from '../src/calculo/amostra.js';
import { efeitoMedias, efeitoProporcoes, dParaR, rParaD, orParaD, dParaOr, rotuloD } from '../src/calculo/efeito.js';

const perto = (o, e, tol) => expect(Math.abs(o - e) / Math.max(1e-300, Math.abs(e)), `${o} vs ${e}`).toBeLessThan(tol);

describe('poder generalizado contra o R', () => {
  it.each(ref.t)('t n=$n d=$d caudas=$caudas k=$k pareado=$pareado', (c) => perto(poderT({ ...c, tipo: c.pareado ? 'pareado' : 'duas_amostras' }), c.poder, 1e-8));
  it.each(ref.t_r)('power.t.test $tipo $alt n=$n', (c) => perto(poderT({ n: c.n, d: c.d, alfa: c.alfa, caudas: c.alt === 'one.sided' ? 1 : 2, tipo: c.tipo === 'paired' ? 'pareado' : 'duas_amostras' }), c.poder, 1e-8));
  it.each(ref.prop_r)('power.prop.test $alt n=$n', (c) => perto(poderProporcoes({ n: c.n, p1: c.p1, p2: c.p2, alfa: c.alfa, caudas: c.alt === 'one.sided' ? 1 : 2 }), c.poder, 1e-10));
  it.each(ref.n_razao)('n1 com razão k=$k', (c) => perto(nParaPoder('a_duas_medias', { d: c.d, alfa: c.alfa, caudas: c.caudas, k: c.k }, c.poder), c.n1, 1e-7));
});
describe('coerência com as funções já validadas', () => {
  it('proporções k=1 = função antiga', () => perto(poderProporcoes({ n: 80, p1: 0.3, p2: 0.15 }), poderDuasProporcoes(80, 0.3, 0.15, 0.05), 1e-12));
  it('correlação: n calculado atinge 80%', () => { const r = amostraCorrelacao({ r: 0.3 }); perto(poderCorrelacaoG({ n: r.nContinuo, r: 0.3 }), 0.8, 1e-10); });
  it('sobrevida: eventos calculados atingem 80% (k=1)', () => { const r = amostraSobrevivencia({ hr: 0.6, p_evento: 0.4 }); perto(poderSobrevidaG({ n: r.eventosContinuo, hr: 0.6 }), 0.8, 1e-10); });
  it('unilateral exige menos que bilateral; k≠1 exige mais total', () => {
    const v = { d: 0.5, alfa: 0.05 };
    expect(nParaPoder('a_duas_medias', { ...v, caudas: 1, k: 1 }, 0.8)).toBeLessThan(nParaPoder('a_duas_medias', { ...v, caudas: 2, k: 1 }, 0.8));
    const n1 = nParaPoder('a_duas_medias', { ...v, caudas: 2, k: 2 }, 0.8), nEq = nParaPoder('a_duas_medias', { ...v, caudas: 2, k: 1 }, 0.8);
    expect(n1 * 3).toBeGreaterThan(nEq * 2);
  });
  it('efeito minúsculo é recusado', () => expect(() => nParaPoder('a_duas_medias', { d: 1e-5, alfa: 0.05, caudas: 2, k: 1 }, 0.9)).toThrow());
  it('funcaoPoderG devolve null para estimar proporção', () => expect(funcaoPoderG('a_proporcao', {})).toBeNull());
});
describe('tamanho de efeito (conferido à mão)', () => {
  it('d, g e r', () => {
    // sp = sqrt((29·15² + 29·14²)/58) = sqrt(210,5) = 14,5086; d = 8/14,5086 = 0,55139
    const e = efeitoMedias({ n1: 30, m1: 120, dp1: 15, n2: 30, m2: 112, dp2: 14 });
    expect(e.sp).toBeCloseTo(14.5086, 4); expect(e.d).toBeCloseTo(0.55139, 4);
    expect(e.g).toBeCloseTo(0.55139 * (1 - 3 / 231), 4);
    expect(rotuloD(e.d)).toBe('médio');
  });
  it('proporções: h, RR e OR', () => {
    const e = efeitoProporcoes({ p1: 0.4, p2: 0.2 });
    expect(e.rr).toBeCloseTo(2, 12); expect(e.or).toBeCloseTo((0.4 / 0.6) / (0.2 / 0.8), 12);
    expect(e.h).toBeCloseTo(2 * Math.asin(Math.sqrt(0.4)) - 2 * Math.asin(Math.sqrt(0.2)), 12);
  });
  it('conversões ida e volta', () => {
    expect(rParaD(dParaR(0.7))).toBeCloseTo(0.7, 12); expect(orParaD(dParaOr(0.5))).toBeCloseTo(0.5, 12);
    expect(orParaD(Math.E)).toBeCloseTo(Math.sqrt(3) / Math.PI, 12);
  });
});
