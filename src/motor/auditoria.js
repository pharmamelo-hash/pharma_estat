// Revisão metodológica do projeto (F11). As CONDIÇÕES ficam aqui; os TEXTOS e referências
// ficam em base/regras-revisao.json. Testado em testes/auditoria.test.js.

const OBS_ANALITICOS = ['d_transversal_analitico', 'd_caso_controle', 'd_coorte_prospectiva', 'd_coorte_retrospectiva'];
const EXPERIMENTAIS = ['d_ecr_paralelo', 'd_ecr_cruzado', 'd_ecr_cluster', 'd_quase_antes_depois', 'd_serie_temporal_interrompida'];
const ECR = ['d_ecr_paralelo', 'd_ecr_cruzado', 'd_ecr_cluster'];
const DESCRITIVOS = ['d_relato_caso', 'd_serie_casos'];
const COM_SEGUIMENTO = ['d_coorte_prospectiva', 'd_ecr_paralelo', 'd_ecr_cruzado', 'd_ecr_cluster'];
const COM_REGISTROS = ['d_coorte_retrospectiva', 'd_caso_controle', 'd_serie_casos'];
const SEM_SERES_HUMANOS = ['d_revisao_sistematica', 'd_revisao_escopo', 'd_ecologico', 'd_validacao_analitica'];
const PRECISA_AMOSTRA = [...OBS_ANALITICOS, ...EXPERIMENTAIS, 'd_acuracia_diagnostica', 'd_transversal_descritivo'];

/** Testes compatíveis com o tipo de desfecho, nº de grupos e pareamento informados. */
export function testesCompativeis(testes, r) {
  const desf = {
    quantitativo: ['quantitativo', 'quantitativo_ou_ordinal'],
    ordinal: ['quantitativo_ou_ordinal'],
    categorico: ['categorico'],
    binario: ['categorico', 'binario'],
    tempo: ['tempo_ate_evento'],
  }[r.tipo_desfecho];
  if (!desf) return [];
  return testes.filter((t) => {
    if (t.objetivo === 'pressuposto') return false;
    if ((r.n_grupos === '2' || r.n_grupos === '3+') && !['comparar', 'modelar', 'sobrevivencia'].includes(t.objetivo)) return false;
    if (!desf.includes(t.desfecho)) return false;
    if (r.n_grupos === '2' && !['2', '2+', 'nao_se_aplica'].includes(t.grupos)) return false;
    if (r.n_grupos === '3+' && !['3+', '2+', 'nao_se_aplica'].includes(t.grupos)) return false;
    if ((r.n_grupos === '2' || r.n_grupos === '3+') && t.grupos !== 'nao_se_aplica' && r.pareado && (r.pareado === 'sim') !== t.pareado) return false;
    return true;
  }).map((t) => t.id);
}

/**
 * Avalia o projeto. Devolve { achados: [{id, gravidade, achado, recomendacao, refs}], aprovados: [id], aplicaveis }.
 * projeto = { desenho: {id}, amostra: {resultado}, revisao: {...respostas do formulário} }
 */
export function revisarProjeto(projeto, base) {
  const r = projeto.revisao || {};
  const d = projeto.desenho?.id || r.desenho || null;
  const textos = Object.fromEntries(base.regras.map((x) => [x.id, x]));
  const achados = [];
  const aprovados = [];
  const checar = (id, aplica, falhou, valores = {}) => {
    if (!aplica) return;
    if (falhou) {
      const t = textos[id];
      const preencher = (s) => s.replace(/\{(\w+)\}/g, (_, k) => (valores[k] ?? '—'));
      achados.push({ id, gravidade: t.gravidade, achado: preencher(t.achado), recomendacao: preencher(t.recomendacao), refs: t.refs });
    } else aprovados.push(id);
  };
  const desenhoInfo = d ? base.desenhos[d] : null;
  const diretrizIndicada = desenhoInfo?.diretriz;
  const nomeDiretriz = diretrizIndicada ? (base.nomeRef?.(diretrizIndicada) ?? diretrizIndicada) : '—';

  checar('rv_desenho_ausente', true, !d);
  if (d === 'd_qualitativo') { checar('rv_qualitativo', true, true); return resumo(achados, aprovados); }
  checar('rv_desfecho_primario', true, !String(r.desfecho_primario || '').trim());

  checar('rv_cc_medida', d === 'd_caso_controle' && r.medida, ['rr', 'rp', 'prevalencia'].includes(r.medida));
  checar('rv_transversal_medida', d?.startsWith('d_transversal') && r.medida, ['rr', 'hr'].includes(r.medida));
  checar('rv_or_desfecho_comum', ['d_transversal_analitico', 'd_coorte_prospectiva', 'd_coorte_retrospectiva', ...ECR].includes(d) && r.medida === 'or',
    r.freq_desfecho === 'comum');
  checar('rv_hr_sem_tempo', r.medida === 'hr', r.tipo_desfecho !== 'tempo');

  const planejados = Array.isArray(r.testes_planejados) ? r.testes_planejados : [];
  const analitico = [...OBS_ANALITICOS, ...EXPERIMENTAIS, 'd_acuracia_diagnostica', 'd_modelo_predicao', 'd_ecologico'].includes(d);
  checar('rv_sem_teste', analitico, planejados.length === 0);
  if (planejados.length && r.tipo_desfecho && r.n_grupos) {
    const compat = testesCompativeis(base.listaTestes, r);
    const ok = planejados.some((t) => compat.includes(t) || base.testes[t]?.objetivo === 'modelar');
    checar('rv_teste_incompativel', true, !ok, { sugestoes: compat.map((t) => base.testes[t]?.nome).join('; ') || 'nenhum na base' });
  }

  const precisa = PRECISA_AMOSTRA.includes(d);
  checar('rv_sem_amostra', precisa && r.amostra_calculada !== undefined, r.amostra_calculada === 'nao');
  checar('rv_censo', precisa && r.amostra_calculada === 'censo', true);
  checar('rv_sem_fonte_efeito', r.amostra_calculada === 'sim', r.fonte_efeito === 'nao');
  checar('rv_sem_perdas', COM_SEGUIMENTO.includes(d) && r.amostra_calculada === 'sim', r.perdas_previstas === 'nao');
  const nCalc = Number(r.n_calculado || projeto.amostra?.resultado || 0);
  const nPlan = Number(r.n_planejado || 0);
  checar('rv_n_insuficiente', nCalc > 0 && nPlan > 0, nPlan < nCalc, { n_planejado: nPlan, n_calculado: nCalc });

  const vars = Number(r.n_variaveis_modelo || 0), eventos = Number(r.eventos_esperados || 0);
  checar('rv_epv', r.vai_ajustar === 'sim' && vars > 0 && eventos > 0, eventos / vars < 10, { epv: (eventos / vars).toFixed(1).replace('.', ',') });
  checar('rv_confundidores', OBS_ANALITICOS.includes(d) && r.confundidores_listados, r.confundidores_listados === 'nao');

  checar('rv_ecr_ocultacao', ECR.includes(d) && r.ocultacao, r.ocultacao === 'nao');
  checar('rv_ecr_cegamento', ECR.includes(d) && r.cegamento, r.cegamento === 'nao');
  checar('rv_ecr_itt', ECR.includes(d) && r.itt, r.itt === 'nao');
  checar('rv_quase_controle', d === 'd_quase_antes_depois' && r.grupo_controle, r.grupo_controle === 'nao');
  checar('rv_dados_faltantes', COM_REGISTROS.includes(d) && r.dados_faltantes_plano, r.dados_faltantes_plano === 'nao');
  checar('rv_multiplas', (r.n_grupos === '3+' || planejados.length > 2) && r.correcao_multiplas && r.correcao_multiplas !== 'nao_se_aplica', r.correcao_multiplas === 'nao');

  if (diretrizIndicada) {
    checar('rv_diretriz_ausente', r.diretriz !== undefined, !r.diretriz || r.diretriz === 'nenhuma', { diretriz: nomeDiretriz });
    if (r.diretriz && r.diretriz !== 'nenhuma') {
      const aceitas = new Set([diretrizIndicada, 'r_strobe_2007', 'r_record_2015'].filter((x) => x === diretrizIndicada || OBS_ANALITICOS.includes(d)));
      checar('rv_diretriz_diferente', true, !aceitas.has(r.diretriz), { diretriz: nomeDiretriz });
    }
  }
  checar('rv_cep', d && !SEM_SERES_HUMANOS.includes(d) && r.cep, r.cep === 'nao');
  checar('rv_ecologico_individual', d === 'd_ecologico' && r.interpretacao_individual, r.interpretacao_individual === 'sim');
  checar('rv_descritivo_associacao', DESCRITIVOS.includes(d) && r.objetivo_associacao, r.objetivo_associacao === 'sim');
  checar('rv_predicao', d === 'd_modelo_predicao', true);
  return resumo(achados, aprovados);
}

const ORDEM = { alta: 0, media: 1, baixa: 2, info: 3 };
function resumo(achados, aprovados) {
  achados.sort((a, b) => ORDEM[a.gravidade] - ORDEM[b.gravidade]);
  const contagem = { alta: 0, media: 0, baixa: 0, info: 0 };
  achados.forEach((a) => { contagem[a.gravidade] += 1; });
  return { achados, aprovados, contagem };
}
