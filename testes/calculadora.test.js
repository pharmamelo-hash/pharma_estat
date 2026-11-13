import { describe, it, expect } from 'vitest';
import { resolver } from '../src/calculo/calculadora.js';
import { CALCULOS } from '../src/calculo/amostra.js';
import ref from './referencia-r/referencia-poder2.json';

const PADRAO = {
  a_duas_medias: { delta: 5, dp: 10, alfa: 0.05, poder: 0.8 },
  a_media_pareada: { delta: 5, dp: 10, alfa: 0.05, poder: 0.8 },
  a_duas_proporcoes: { p1: 0.3, p2: 0.15, alfa: 0.05, poder: 0.8 },
  a_correlacao: { r: 0.3, alfa: 0.05, poder: 0.8 },
  a_sobrevivencia: { hr: 0.6, p_evento: 0.4, alfa: 0.05, poder: 0.8 },
};
describe('calculadora: bilateral 1:1 reproduz os cálculos já validados', () => {
  it.each(Object.keys(PADRAO))('%s', (id) => {
    const antigo = CALCULOS[id](PADRAO[id]);
    const novo = resolver(id, PADRAO[id]);
    if (id === 'a_sobrevivencia') { expect(novo.eventos).toBe(antigo.eventos); expect(novo.total).toBe(antigo.nTotal); }
    else expect(novo.n1).toBe(antigo.nPorGrupo ?? antigo.nPares ?? antigo.n);
    expect(novo.poder).toBeGreaterThanOrEqual(0.8);
  });
});
describe('calculadora: modos e opções', () => {
  it('d de Cohen equivale a Δ/σ', () => {
    expect(resolver('a_duas_medias', { d: 0.5, alfa: 0.05, poder: 0.8 }).n1).toBe(resolver('a_duas_medias', PADRAO.a_duas_medias).n1);
  });
  it('unilateral precisa de menos participantes', () => {
    expect(resolver('a_duas_medias', PADRAO.a_duas_medias, { caudas: 1 }).n1).toBeLessThan(resolver('a_duas_medias', PADRAO.a_duas_medias).n1);
  });
  it('razão 2:1 aumenta o total e n2 ≈ 2·n1', () => {
    const r = resolver('a_duas_medias', PADRAO.a_duas_medias, { k: 2 });
    expect(r.n2).toBeGreaterThanOrEqual(2 * r.n1 - 2);
    expect(r.total).toBeGreaterThan(resolver('a_duas_medias', PADRAO.a_duas_medias).total);
    expect(r.poder).toBeGreaterThanOrEqual(0.8);
  });
  it('modo poder: n = 64 por grupo, d = 0,5 → 80,1% (power.t.test)', () => {
    expect(resolver('a_duas_medias', { d: 0.5, alfa: 0.05, n: 64 }, { modo: 'poder' }).poder).toBeCloseTo(0.8015, 3);
  });
  it('perdas aplicadas por grupo', () => {
    const r = resolver('a_duas_medias', PADRAO.a_duas_medias, { perdas: 0.1 });
    expect(r.final.n1).toBe(Math.ceil(r.n1 / 0.9)); expect(r.final.total).toBe(2 * Math.ceil(r.n1 / 0.9));
  });
  it('sobrevivência em modo poder usa eventos = n × proporção de eventos', () => {
    const r = resolver('a_sobrevivencia', { hr: 0.6, p_evento: 0.4, alfa: 0.05, n: 300 }, { modo: 'poder' });
    expect(r.eventos).toBe(120); expect(r.poder).toBeCloseTo(0.799, 2); // 121 eventos dariam 80%
  });
  it('erros claros', () => {
    expect(() => resolver('a_duas_proporcoes', { p1: 0.2, p2: 0.2, alfa: 0.05, poder: 0.8 })).toThrow(/diferentes/);
    expect(() => resolver('a_duas_medias', { d: 0, alfa: 0.05, poder: 0.8 })).toThrow(/maior que zero/);
  });
  it('referência R carregada', () => expect(ref).toBeTruthy());
});
describe('calculadora: curva sem buracos', () => {
  it('correlação: poder finito para n pequeno', () => {
    const r = resolver('a_correlacao', { r: 0.3, alfa: 0.05, poder: 0.8 });
    [2, 3, 3.5, 4].forEach((n) => expect(Number.isFinite(r.fPoder(n))).toBe(true));
  });
});
