// Cálculos conferidos contra o R 4.6 (valores gerados por testes/referencia-r/gerar-referencia.R).
// Regra do projeto (Doc 7.4): pelo menos 10 casos por cálculo, incluindo extremos.
import { describe, it, expect } from 'vitest';
import ref from './referencia-r/referencia-amostra.json';
import refPoder from './referencia-r/referencia-poder.json';
import { pnorm, qnorm, pt, qt, ptNaoCentral } from '../src/calculo/distribuicoes.js';
import { funcaoPoder, poderTesteT, poderDuasProporcoes, amostraProporcao, amostraDuasProporcoes, amostraMedias, amostraCorrelacao, amostraSobrevivencia, comPerdas } from '../src/calculo/amostra.js';

const perto = (obtido, esperado, tolRel) =>
  expect(Math.abs(obtido - esperado) / Math.max(1e-300, Math.abs(esperado)), `${obtido} vs ${esperado}`).toBeLessThan(tolRel);

describe('distribuições contra o R', () => {
  it.each(ref.pnorm)('pnorm($x)', ({ x, p }) => perto(pnorm(x), p, 1e-12));
  it.each(ref.qnorm)('qnorm($p)', ({ p, q }) => perto(qnorm(p), q, 1e-10));
  it.each(ref.pt)('pt($t, $gl)', ({ t, gl, p }) => perto(pt(t, gl), p, 1e-10));
  it.each(ref.qt)('qt($p, $gl)', ({ p, gl, q }) => perto(qt(p, gl), q, 1e-9));
  it.each(ref.pt_ncp)('pt($t, $gl, ncp=$ncp)', ({ t, gl, ncp, p }) => perto(ptNaoCentral(t, gl, ncp), p, 1e-8));
});

describe('tamanho amostral contra o R', () => {
  it.each(ref.proporcao)('proporção p=$p e=$e conf=$confianca N=$N', ({ p, e, confianca, N, n }) => {
    const r = amostraProporcao({ p, e, confianca, N });
    perto(r.nContinuo, n, 1e-10);
    expect(r.n).toBe(Math.ceil(n));
  });
  it.each(ref.duas_proporcoes)('duas proporções $p1 × $p2 (α=$alfa, poder=$poder)', ({ p1, p2, alfa, poder, n, n_r }) => {
    const r = amostraDuasProporcoes({ p1, p2, alfa, poder });
    perto(r.nContinuo, n, 1e-8);
    expect(r.nPorGrupo).toBe(Math.ceil(n_r));
  });
  it.each(ref.duas_medias)('duas médias Δ=$delta σ=$dp (α=$alfa, poder=$poder)', ({ delta, dp, alfa, poder, n, n_r }) => {
    const r = amostraMedias({ delta, dp, alfa, poder });
    perto(r.nContinuo, n, 1e-7);
    expect(r.nPorGrupo).toBe(Math.ceil(n_r));
  });
  it.each(ref.media_pareada)('pareado Δ=$delta σd=$dp (α=$alfa, poder=$poder)', ({ delta, dp, alfa, poder, n, n_r }) => {
    const r = amostraMedias({ delta, dp, alfa, poder, tipo: 'pareado' });
    perto(r.nContinuo, n, 1e-7);
    expect(r.nPares).toBe(Math.ceil(n_r));
  });
  it.each(ref.correlacao)('correlação r=$r (α=$alfa, poder=$poder)', ({ r, alfa, poder, n }) => {
    const res = amostraCorrelacao({ r, alfa, poder });
    perto(res.nContinuo, n, 1e-10);
    expect(res.n).toBe(Math.ceil(n));
  });
  it.each(ref.sobrevivencia)('sobrevida HR=$hr eventos=$p_evento', ({ hr, p_evento, alfa, poder, eventos }) => {
    const r = amostraSobrevivencia({ hr, p_evento, alfa, poder });
    perto(r.eventosContinuo, eventos, 1e-10);
    expect(r.nTotal).toBe(Math.ceil(Math.ceil(eventos) / p_evento));
  });
});

describe('regras de arredondamento e perdas', () => {
  it('acrescenta perdas e arredonda para cima', () => {
    expect(comPerdas(100, 0.1)).toBe(112);
    expect(comPerdas(100, 0)).toBe(100);
    expect(() => comPerdas(100, 1)).toThrow();
  });
  it('recusa entradas impossíveis', () => {
    expect(() => amostraDuasProporcoes({ p1: 0.3, p2: 0.3 })).toThrow();
    expect(() => amostraSobrevivencia({ hr: 1, p_evento: 0.5 })).toThrow();
  });
});

describe('poder dado n (curva de poder) contra o R', () => {
  it.each(refPoder.poder_t)('t: n=$n Δ=$delta σ=$dp', ({ n, delta, dp, alfa, poder }) => perto(poderTesteT(n, delta, dp, alfa), poder, 1e-8));
  it.each(refPoder.poder_pareado)('pareado: n=$n Δ=$delta', ({ n, delta, dp, alfa, poder }) => perto(poderTesteT(n, delta, dp, alfa, 'pareado'), poder, 1e-8));
  it.each(refPoder.poder_prop)('proporções: n=$n $p1 × $p2', ({ n, p1, p2, alfa, poder }) => perto(poderDuasProporcoes(n, p1, p2, alfa), poder, 1e-10));
});

describe('curva de poder: no n calculado o poder atinge o alvo', () => {
  it.each(ref.correlacao)('correlação r=$r', ({ r, alfa, poder, n }) => perto(funcaoPoder('a_correlacao', { r, alfa })(n), poder, 1e-10));
  it.each(ref.sobrevivencia)('sobrevida HR=$hr', ({ hr, alfa, poder, eventos }) => perto(funcaoPoder('a_sobrevivencia', { hr, alfa })(eventos), poder, 1e-10));
  it.each(ref.duas_medias)('médias Δ=$delta', ({ delta, dp, alfa, poder, n }) => perto(funcaoPoder('a_duas_medias', { delta, dp, alfa })(n), poder, 1e-7));
  it('proporção única não tem curva de poder', () => expect(funcaoPoder('a_proporcao', {})).toBeNull());
});
