import { describe, it, expect } from 'vitest';
import { resumoColeta, serie, paraDia, doDia, dataValida } from '../src/calculo/coleta.js';
import { importarProjeto, exportarProjeto, novoProjeto } from '../src/estado/projeto.js';

const REG = [
  { data: '2026-03-31', incluidos: { A: 10, B: 10 }, perdas: 1 },
  { data: '2026-03-01', incluidos: { A: 0, B: 0 }, perdas: 0 },
  { data: '2026-04-30', incluidos: { A: 22, B: 18 }, perdas: 4 },
];

describe('datas', () => {
  it('converte ida e volta', () => expect(doDia(paraDia('2026-11-03'))).toBe('2026-11-03'));
  it('valida', () => { expect(dataValida('2026-02-30x')).toBe(false); expect(dataValida('2026-02-10')).toBe(true); });
});

describe('resumo da coleta', () => {
  it('ordena por data e soma os grupos', () => {
    const s = serie(REG);
    expect(s.map((r) => r.total)).toEqual([0, 20, 40]);
  });
  it('ritmo, previsão e progresso (conferidos à mão)', () => {
    // 40 inclusões em 60 dias (01/03 → 30/04) = 0,667/dia; faltam 80 para a meta 120 → 120 dias → 28/08/2026
    const r = resumoColeta({ registros: REG, meta: 120 });
    expect(r.ritmo).toBeCloseTo(40 / 60, 10);
    expect(r.diasRestantes).toBe(120);
    expect(r.previsao).toBe('2026-08-28');
    expect(r.percentualMeta).toBeCloseTo(1 / 3, 10);
    expect(r.efetivos).toBe(36);
  });
  it('alerta de atraso, perdas acima do previsto e desbalanço', () => {
    const r = resumoColeta({ registros: [...REG, { data: '2026-05-30', incluidos: { A: 40, B: 20 }, perdas: 9 }], meta: 120, fimPrevisto: '2026-07-31', perdasPrevistas: 0.1 });
    const tipos = r.alertas.map((a) => a.tipo);
    expect(tipos).toEqual(expect.arrayContaining(['atraso', 'perdas', 'desbalanco']));
  });
  it('sem inclusões novas: não prevê término', () => {
    const r = resumoColeta({ registros: [REG[1], { data: '2026-04-01', incluidos: { A: 0, B: 0 }, perdas: 0 }], meta: 50 });
    expect(r.previsao).toBeNull();
    expect(r.alertas[0].tipo).toBe('parado');
  });
  it('sem registros', () => expect(resumoColeta({ registros: [] }).vazio).toBe(true));
});

describe('coleta no projeto exportado/importado', () => {
  it('mantém só contagens e datas válidas', () => {
    const p = novoProjeto('X');
    p.coleta = { meta: 120, inicio: '2026-03-01', fim_previsto: 'lixo', perdas_previstas: 0.1, grupos: ['A', 'B'],
      registros: [{ data: '2026-03-31', incluidos: { A: 10, B: '<script>' }, perdas: 1, nome_paciente: 'Fulano' }] };
    const i = importarProjeto(exportarProjeto(p));
    expect(i.coleta.meta).toBe(120);
    expect(i.coleta.fim_previsto).toBeNull();
    expect(i.coleta.registros[0]).toEqual({ data: '2026-03-31', incluidos: { A: 10, B: 0 }, perdas: 1 });
  });
});
