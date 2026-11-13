// Matemática do Laboratório: valores conferidos à mão e propriedades que a lição precisa mostrar.
import { describe, it, expect } from 'vitest';
import * as L from '../src/calculo/laboratorio.js';
import lab from '../base/laboratorio.json';
import referencias from '../base/referencias.json';

describe('gerador com semente', () => {
  it('é determinístico', () => {
    const a = L.gerador(5), b = L.gerador(5);
    expect([a.unif(), a.unif()]).toEqual([b.unif(), b.unif()]);
  });
});

describe('cartões', () => {
  it('1 confundimento: medicamentos × dias de internação é forte e some ao controlar o SOFA', () => {
    const d = L.dadosGravidade();
    expect(d.r).toBeGreaterThan(0.7);
    expect(Math.abs(d.rParcial)).toBeLessThan(0.3);
  });
  it('correlação conhecida', () => {
    expect(L.correlacao([1, 2, 3, 4], [2, 4, 6, 8])).toBeCloseTo(1, 12);
    expect(L.correlacao([1, 2, 3, 4], [8, 6, 4, 2])).toBeCloseTo(-1, 12);
  });
  it('02 seleção: sem perdas não há efeito; com perdas dos graves aparece efeito falso', () => {
    expect(L.selecao(0).efeitoAparente).toBeCloseTo(0, 12);
    expect(L.selecao(0.3).efeitoAparente).toBeGreaterThan(0.1);
  });
  it('03 regressão à média: os selecionados pelo valor alto caem na 2ª medida', () => {
    const r = L.regressaoMedia(0.2);
    expect(r.queda).toBeGreaterThan(2);
    expect(Math.abs(L.regressaoMedia(1).queda)).toBeLessThan(3);
  });
  it('4 significância: reinternação 12,0% × 11,7% só fica significativa com amostras enormes', () => {
    expect(L.testeDuasProporcoes(0.12, 0.117, 1000).p).toBeGreaterThan(0.5);
    expect(L.testeDuasProporcoes(0.12, 0.117, 500000).p).toBeLessThan(0.001);
    // conferido à mão: z = 0,001 / sqrt(0,0505·0,9495·2/10⁶) = 0,001 / 3,0968e-4 ≈ 3,2292
    expect(L.testeDuasProporcoes(0.05, 0.051, 1e6).z).toBeCloseTo(3.2292, 3);
  });
  it('5 amostra: hospitais pequenos espalham as taxas; grandes ficam perto dos 5% reais', () => {
    const peq = L.hospitais(20), gra = L.hospitais(2000);
    expect(peq.max - peq.min).toBeGreaterThanOrEqual(0.15); // com 20 pacientes: de 0% a 15%
    expect(gra.max - gra.min).toBeLessThan(0.03);
  });
  it('06 taxa de base: prevalência 1%, sens 99%, esp 95% → VPP ≈ 16,7%', () => {
    expect(L.valoresPreditivos(0.01, 0.99, 0.95).vpp).toBeCloseTo(9.9 / (9.9 + 49.5), 10);
  });
  it('07 média × mediana: um extremo puxa a média, não a mediana', () => {
    const sem = L.mediaMediana(0), com = L.mediaMediana(120);
    expect(sem.media).toBeCloseTo(5.7, 10);
    expect(com.media).toBeCloseTo(177 / 11, 10);
    expect(com.mediana).toBe(6);
  });
  it('08 Simpson (Charig 1986): A vence em cada estrato, B vence no total', () => {
    const s = L.simpson();
    expect(s.estratos.every((e) => e.A > e.B)).toBe(true);
    expect(s.geral.B).toBeGreaterThan(s.geral.A);
    expect(s.geral.A).toBeCloseTo(273 / 350, 12);
    expect(s.geral.B).toBeCloseTo(289 / 350, 12);
  });
  it('09 risco: 2% → 1% é redução relativa de 50%, absoluta de 1 ponto, NNT 100', () => {
    const r = L.riscos(0.02, 0.5);
    expect(r.rrr).toBeCloseTo(0.5);
    expect(r.rar).toBeCloseTo(0.01);
    expect(r.nnt).toBe(100);
  });
});

describe('conteúdo do laboratório', () => {
  it('9 cartões completos, com referências existentes', () => {
    const ids = new Set(referencias.referencias.map((r) => r.id));
    expect(lab.cartoes).toHaveLength(9);
    for (const c of lab.cartoes) {
      ['id', 'titulo', 'licao', 'pergunta', 'no_projeto', 'cor'].forEach((k) => expect(c[k], `${c.id}.${k}`).toBeTruthy());
      c.refs.forEach((r) => expect(ids.has(r), `${c.id}: ${r}`).toBe(true));
    }
  });
});
