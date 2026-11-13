// Integridade da trilha: toda aula completa, animações existentes, gabarito válido, referências reais.
import { describe, it, expect } from 'vitest';
import trilha from '../base/trilha.json';
import referencias from '../base/referencias.json';
import testes from '../base/testes.json';
import { TIPOS_ANIMACAO } from '../src/ui/animacoes.js';

const refs = new Set(referencias.referencias.map((r) => r.id));
const idsTestes = new Set(testes.testes.map((t) => t.id));
const ROTAS = /^#\/(aprender\/(glossario|laboratorio|trilha)|planejar\/(desenho|teste|amostra)|analisar\/auto)$/;

describe('trilha', () => {
  it('18 aulas em 3 níveis, na ordem básico → avançado, com ids únicos', () => {
    expect(trilha.aulas).toHaveLength(18);
    expect(new Set(trilha.aulas.map((a) => a.id)).size).toBe(18);
    const ordem = trilha.aulas.map((a) => trilha.niveis.findIndex((n) => n.id === a.nivel));
    expect(ordem).toEqual([...ordem].sort((a, b) => a - b));
    trilha.aulas.forEach((a) => expect(a.id).toMatch(/^[a-z0-9_]+$/));
  });
  it.each(trilha.aulas.map((a) => [a.id, a]))('aula %s está completa', (_id, a) => {
    expect(a.cenas.length).toBeGreaterThanOrEqual(3);
    a.cenas.forEach((c) => { expect(TIPOS_ANIMACAO, c.anim).toContain(c.anim); expect(c.legenda.length).toBeGreaterThan(40); expect(c.legenda.length).toBeLessThan(330); });
    expect(a.quiz.length).toBeGreaterThanOrEqual(2);
    a.quiz.forEach((q) => { expect(q.opcoes.length).toBe(3); expect(q.correta).toBeGreaterThanOrEqual(0); expect(q.correta).toBeLessThan(3); expect(q.explicacao.length).toBeGreaterThan(20); });
    a.refs.forEach((r) => expect(refs.has(r), r).toBe(true));
    const d = a.pratica.destino, ficha = /^#\/aprender\/teste\/(\w+)$/.exec(d);
    expect(ficha ? idsTestes.has(ficha[1]) : ROTAS.test(d), d).toBe(true);
  });
  it('o gabarito não fica sempre na mesma posição', () => {
    const pos = new Set(trilha.aulas.flatMap((a) => a.quiz.map((q) => q.correta)));
    expect(pos.size).toBe(3);
  });
  it('números citados nas aulas conferem', () => {
    expect(1 - 0.95 ** 3).toBeCloseTo(0.1426, 3);          // "cerca de 14%" na aula de ANOVA
    expect((8 * 16) / (12 * 4)).toBeCloseTo(2.667, 3);     // OR da aula de qui-quadrado
    expect((8 / 20) / (4 / 20)).toBe(2);                   // RR da mesma aula
  });
});
