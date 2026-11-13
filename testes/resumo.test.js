// Dados resumidos conferidos contra o R (chisq.test, fisher.test e t.test), 10 casos cada.
import { describe, it, expect } from 'vitest';
import ref from './referencia-r/referencia-resumo.json';
import { welchResumo, tabela2x2 } from '../src/calculo/resumo.js';

const perto = (o, e, tol) => expect(Math.abs(o - e) / Math.max(1e-300, Math.abs(e)), `${o} vs ${e}`).toBeLessThan(tol);

describe('tabela 2×2 contra o R', () => {
  it.each(ref.tabelas)('[$a, $b; $c, $d]', ({ a, b, c, d, qui, pQui, pFisher }) => {
    const r = tabela2x2({ a, b, c, d });
    perto(r.qui, qui, 1e-10); perto(r.pQui, pQui, 1e-8); perto(r.pFisher, pFisher, 1e-7);
  });
  it('medidas conferidas à mão: 12/17 × 20/51', () => {
    const r = tabela2x2({ a: 12, b: 5, c: 20, d: 31 });
    expect(r.rr.valor).toBeCloseTo((12 / 17) / (20 / 51), 12);
    expect(r.or.valor).toBeCloseTo((12 * 31) / (5 * 20), 12);
    expect(r.nnt).toBe(Math.ceil(1 / (12 / 17 - 20 / 51)));
  });
});
describe('t de Welch por resumo contra o R', () => {
  it.each(ref.welch)('n=$n1/$n2 médias $m1 × $m2', (c) => {
    const r = welchResumo(c);
    perto(r.t, c.t, 1e-9); perto(r.gl, c.gl, 1e-9); perto(r.p, c.p, 1e-7); perto(r.li, c.li, 1e-7); perto(r.ls, c.ls, 1e-7);
  });
});
