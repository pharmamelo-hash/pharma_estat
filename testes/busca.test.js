import { describe, it, expect } from 'vitest';
import { buscar, normalizar } from '../src/ui/busca.js';
describe('busca global', () => {
  it('ignora acentos e caixa', () => expect(normalizar('Análise ÓBITO')).toBe('analise obito'));
  it.each([
    ['anova', 'ANOVA de um fator com teste de Tukey'],
    ['tamanho amostra', 'Calculadora amostral e de poder'],
    ['caso controle', 'Caso-controle'],
    ['odds', 'Odds ratio (OR)'],
    ['cohen', 'Tamanho de efeito'],
  ])('"%s" encontra "%s"', (q, titulo) => expect(buscar(q).map((r) => r.titulo)).toContain(titulo));
  it('título pesa mais: "correlação" traz a aula de correlação entre os primeiros', () => {
    expect(buscar('correlação').slice(0, 4).map((r) => r.titulo)).toContain('Correlação');
  });
  it('termo curto ou vazio não busca', () => { expect(buscar('a')).toEqual([]); expect(buscar('')).toEqual([]); });
  it('sem resultado para palavra inexistente', () => expect(buscar('xylofonema')).toEqual([]));
});
