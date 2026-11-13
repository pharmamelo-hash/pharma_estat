// Acompanhamento da coleta (F14): só contagens agregadas, nunca dados de participantes.
// registros = [{ data: 'AAAA-MM-DD', incluidos: { grupo: n acumulado }, perdas: n acumulado }]

const DIA = 86400000;
export const paraDia = (iso) => Math.floor(Date.parse(`${iso}T00:00:00Z`) / DIA);
export const doDia = (d) => new Date(d * DIA).toISOString().slice(0, 10);
export const dataValida = (iso) => typeof iso === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(iso) && Number.isFinite(paraDia(iso));

/** Ordena por data e calcula totais de cada registro. */
export function serie(registros) {
  return [...registros].filter((r) => dataValida(r.data)).sort((a, b) => a.data.localeCompare(b.data)).map((r) => {
    const total = Object.values(r.incluidos || {}).reduce((s, n) => s + (Number(n) || 0), 0);
    return { ...r, dia: paraDia(r.data), total, perdas: Number(r.perdas) || 0 };
  });
}

/**
 * Resumo da coleta: progresso, ritmo, previsão de término, perdas e alertas.
 * inicio = data de início da coleta (opcional; se ausente, usa o 1º registro com total zero implícito).
 */
export function resumoColeta({ registros = [], meta = 0, inicio = null, fimPrevisto = null, perdasPrevistas = 0, grupos = [] }) {
  const s = serie(registros);
  if (!s.length) return { vazio: true };
  const ult = s.at(-1);
  const dia0 = inicio && dataValida(inicio) ? paraDia(inicio) : s[0].dia;
  const total0 = inicio && dataValida(inicio) ? 0 : s[0].total;
  const dias = Math.max(1, ult.dia - dia0);
  const ritmo = (ult.total - total0) / dias; // inclusões por dia
  const faltam = Math.max(0, meta - ult.total);
  const diasRestantes = ritmo > 0 ? Math.ceil(faltam / ritmo) : Infinity;
  const previsao = Number.isFinite(diasRestantes) ? doDia(ult.dia + diasRestantes) : null;
  const perdasPct = ult.total > 0 ? ult.perdas / ult.total : 0;
  const efetivos = ult.total - ult.perdas;
  const porGrupo = (grupos.length ? grupos : Object.keys(ult.incluidos || {})).map((g) => ({ grupo: g, n: Number(ult.incluidos?.[g]) || 0 }));
  const alertas = [];
  if (meta > 0 && fimPrevisto && dataValida(fimPrevisto) && previsao && previsao > fimPrevisto) {
    alertas.push({ tipo: 'atraso', texto: `No ritmo atual, a meta será atingida em ${previsao}, depois do fim previsto (${fimPrevisto}).` });
  }
  if (ritmo <= 0 && faltam > 0) alertas.push({ tipo: 'parado', texto: 'Não houve inclusões no período: não é possível prever o término.' });
  if (perdasPrevistas > 0 && perdasPct > perdasPrevistas) alertas.push({ tipo: 'perdas', texto: `Perdas de ${(perdasPct * 100).toFixed(1).replace('.', ',')}%, acima das ${(perdasPrevistas * 100).toFixed(0)}% previstas no cálculo amostral.` });
  if (porGrupo.length >= 2) {
    const ns = porGrupo.map((g) => g.n), max = Math.max(...ns), min = Math.min(...ns);
    if (max > 0 && (max - min) / max > 0.25) alertas.push({ tipo: 'desbalanco', texto: 'Grupos desbalanceados (diferença acima de 25%): confira o recrutamento de cada grupo.' });
  }
  return {
    vazio: false, serie: s, total: ult.total, perdas: ult.perdas, efetivos, perdasPct, ritmo, ritmoSemanal: ritmo * 7,
    percentualMeta: meta > 0 ? ult.total / meta : null, faltam, diasRestantes, previsao, porGrupo, alertas, ultimaData: ult.data, dia0,
  };
}
