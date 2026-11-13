// Progresso do aluno na trilha: fica só neste aparelho (preferência, não é dado pessoal).
const CHAVE = 'bioestat.trilha';
let cache = null;
function ler() {
  if (cache) return cache;
  try { cache = JSON.parse(localStorage.getItem(CHAVE)) || {}; } catch { cache = {}; }
  if (typeof cache !== 'object' || Array.isArray(cache)) cache = {};
  return cache;
}
export const progresso = () => ler();
export function concluirAula(id, acertos, total) {
  const p = ler();
  p[id] = { acertos: Math.max(acertos, p[id]?.acertos ?? 0), total, quando: new Date().toISOString().slice(0, 10) };
  try { localStorage.setItem(CHAVE, JSON.stringify(p)); } catch { /* sem armazenamento: vale só nesta sessão */ }
}
export function zerarProgresso() { cache = {}; try { localStorage.removeItem(CHAVE); } catch { /* ignore */ } }
/** Resumo: { feitas, total, porNivel: { id: [feitas, total] }, proxima } */
export function resumoTrilha(trilha) {
  const p = ler(), porNivel = {};
  trilha.aulas.forEach((a) => { const r = (porNivel[a.nivel] ||= [0, 0]); r[1]++; if (p[a.id]) r[0]++; });
  return { feitas: trilha.aulas.filter((a) => p[a.id]).length, total: trilha.aulas.length, porNivel, proxima: trilha.aulas.find((a) => !p[a.id]) || null };
}
