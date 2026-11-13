import { describe, it, expect } from 'vitest';
import { paraNumero, detectarTipo, montarConjunto, colunasParaR, niveis, PADRAO_IDENTIFICADOR } from '../src/estado/dados.js';

describe('conversão de números (padrão brasileiro e internacional)', () => {
  it.each([
    ['12,5', 12.5], ['12.5', 12.5], ['1.234,56', 1234.56], ['-3', -3], [' 7 ', 7], [42, 42], ['1e-3', 0.001],
    ['', null], ['abc', null], ['12,5 mg', null], [null, null], [NaN, null],
  ])('%j → %j', (entrada, esperado) => expect(paraNumero(entrada)).toBe(esperado));
});

describe('detecção de tipo', () => {
  it('quantitativo com muitos valores distintos', () => expect(detectarTipo(['1,2', '3', '4,5', '6', '7', '8', '9.1', null])).toBe('quantitativo'));
  it('0/1 é categórico (poucos valores)', () => expect(detectarTipo([0, 1, 1, 0, 1])).toBe('categorico'));
  it('texto é categórico', () => expect(detectarTipo(['sim', 'não', 'sim'])).toBe('categorico'));
});

describe('identificadores', () => {
  it.each(['Nome', 'nome_paciente', 'CPF', 'Prontuário', 'data_nasc', 'Telefone', 'e-mail'])('%s é identificador', (n) => expect(PADRAO_IDENTIFICADOR.test(n)).toBe(true));
  it.each(['idade', 'creatinina', 'grupo', 'desfecho', 'sexo'])('%s não é identificador', (n) => expect(PADRAO_IDENTIFICADOR.test(n)).toBe(false));
});

describe('montagem do conjunto', () => {
  const m = [['Nome', 'idade', 'grupo', ''], ['Ana Souza', '34', 'A', 'x'], ['', '', '', ''], ['Rui Lima', '41,5', 'B', 'y']];
  const c = montarConjunto(m, 'teste.csv');
  it('ignora linhas vazias, nomeia colunas sem cabeçalho e marca identificador fora da análise', () => {
    expect(c.linhas).toBe(2);
    expect(c.colunas.map((x) => x.nome)).toEqual(['Nome', 'idade', 'grupo', 'coluna_4']);
    expect(c.colunas[0]).toMatchObject({ identificador: true, incluir: false });
  });
  it('prepara colunas para o R com NA como null', () => {
    c.colunas[1].tipo = 'quantitativo';
    expect(colunasParaR(c, ['idade', 'grupo'])).toEqual({ idade: [34, 41.5], grupo: ['A', 'B'] });
    expect(niveis(c, 'grupo')).toEqual(['A', 'B']);
  });
  it('recusa planilha sem dados', () => expect(() => montarConjunto([['a']], 'x')).toThrow());
});
