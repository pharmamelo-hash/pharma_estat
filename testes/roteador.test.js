import { describe, it, expect } from 'vitest';
import { caminhoDoHash, resolverRota } from '../src/ui/roteador.js';

describe('caminhoDoHash', () => {
  it.each([
    ['', '/inicio'],
    ['#', '/inicio'],
    ['#/', '/inicio'],
    ['#/planejar/teste', '/planejar/teste'],
    ['#/planejar/teste/', '/planejar/teste'],
    ['#planejar', '/planejar'],
    ['#/analisar/dados?x=1', '/analisar/dados'],
  ])('%s → %s', (hash, esperado) => expect(caminhoDoHash(hash)).toBe(esperado));
});

describe('resolverRota', () => {
  const rotas = { '/inicio': 'A', '/sobre': 'B' };
  it('acha a rota existente', () => expect(resolverRota('#/sobre', rotas, 'X').rota).toBe('B'));
  it('cai na tela não encontrada', () => expect(resolverRota('#/nada', rotas, 'X').rota).toBe('X'));
  const din = [{ prefixo: '/aprender/teste/', rota: 'T' }];
  it('resolve rota dinâmica com parâmetro válido', () => {
    expect(resolverRota('#/aprender/teste/t_t_welch', rotas, 'X', din)).toMatchObject({ rota: 'T', parametro: 't_t_welch' });
  });
  it.each(['#/aprender/teste/', '#/aprender/teste/<script>', '#/aprender/teste/A%20B', '#/aprender/teste/../x'])('recusa parâmetro inválido %s', (h) => {
    expect(resolverRota(h, rotas, 'X', din).rota).toBe('X');
  });
});
