// Revisão metodológica: casos de projeto escritos à mão com o achado esperado.
import { describe, it, expect } from 'vitest';
import { revisarProjeto, testesCompativeis } from '../src/motor/auditoria.js';
import regras from '../base/regras-revisao.json';
import desenhos from '../base/desenhos.json';
import testes from '../base/testes.json';
import referencias from '../base/referencias.json';

const base = {
  regras: regras.regras,
  desenhos: Object.fromEntries(desenhos.desenhos.map((d) => [d.id, d])),
  testes: Object.fromEntries(testes.testes.map((t) => [t.id, t])),
  listaTestes: testes.testes,
};
const ids = (proj) => revisarProjeto(proj, base).achados.map((a) => a.id);
const proj = (desenho, revisao, extra = {}) => ({ desenho: desenho ? { id: desenho } : null, revisao, ...extra });

describe('regras da base', () => {
  it('toda regra tem texto, gravidade válida e referências existentes', () => {
    const refs = new Set(referencias.referencias.map((r) => r.id));
    for (const r of regras.regras) {
      expect(['alta', 'media', 'baixa', 'info']).toContain(r.gravidade);
      expect(r.achado.length).toBeGreaterThan(10);
      r.refs.forEach((x) => expect(refs.has(x), `${r.id}: ${x}`).toBe(true));
    }
  });
});

describe('casos de projeto', () => {
  it('projeto vazio: falta desenho e desfecho primário', () => {
    expect(ids(proj(null, {}))).toEqual(expect.arrayContaining(['rv_desenho_ausente', 'rv_desfecho_primario']));
  });
  it('caso-controle relatando RR → alta', () => {
    expect(ids(proj('d_caso_controle', { desfecho_primario: 'infecção', medida: 'rr' }))).toContain('rv_cc_medida');
    expect(ids(proj('d_caso_controle', { desfecho_primario: 'infecção', medida: 'or' }))).not.toContain('rv_cc_medida');
  });
  it('transversal com HR → alta; com OR e desfecho comum → média', () => {
    expect(ids(proj('d_transversal_analitico', { desfecho_primario: 'x', medida: 'hr' }))).toContain('rv_transversal_medida');
    expect(ids(proj('d_transversal_analitico', { desfecho_primario: 'x', medida: 'or', freq_desfecho: 'comum' }))).toContain('rv_or_desfecho_comum');
    expect(ids(proj('d_transversal_analitico', { desfecho_primario: 'x', medida: 'or', freq_desfecho: 'raro' }))).not.toContain('rv_or_desfecho_comum');
  });
  it('HR sem desfecho de tempo → alta', () => {
    expect(ids(proj('d_coorte_retrospectiva', { desfecho_primario: 'óbito', medida: 'hr', tipo_desfecho: 'binario' }))).toContain('rv_hr_sem_tempo');
  });
  it('teste incompatível: Mann-Whitney para desfecho categórico', () => {
    const r = revisarProjeto(proj('d_coorte_prospectiva', { desfecho_primario: 'óbito', tipo_desfecho: 'binario', n_grupos: '2', pareado: 'nao', testes_planejados: ['t_mann_whitney'] }), base);
    const a = r.achados.find((x) => x.id === 'rv_teste_incompativel');
    expect(a).toBeTruthy();
    expect(a.recomendacao).toMatch(/qui-quadrado/i);
  });
  it('teste compatível não gera achado', () => {
    expect(ids(proj('d_coorte_prospectiva', { desfecho_primario: 'óbito', tipo_desfecho: 'binario', n_grupos: '2', pareado: 'nao', testes_planejados: ['t_qui_quadrado'] }))).not.toContain('rv_teste_incompativel');
  });
  it('compatibilidade respeita pareamento', () => {
    const c = testesCompativeis(testes.testes, { tipo_desfecho: 'quantitativo', n_grupos: '2', pareado: 'sim' });
    expect(c).toContain('t_t_pareado');
    expect(c).not.toContain('t_t_welch');
  });
  it('sem cálculo amostral em coorte → alta; censo → baixa', () => {
    expect(ids(proj('d_coorte_retrospectiva', { desfecho_primario: 'x', amostra_calculada: 'nao' }))).toContain('rv_sem_amostra');
    expect(ids(proj('d_coorte_retrospectiva', { desfecho_primario: 'x', amostra_calculada: 'censo' }))).toContain('rv_censo');
  });
  it('n planejado menor que o calculado → alta, com os números no texto', () => {
    const r = revisarProjeto(proj('d_ecr_paralelo', { desfecho_primario: 'x', n_planejado: 80 }, { amostra: { resultado: 120 } }), base);
    expect(r.achados.find((a) => a.id === 'rv_n_insuficiente').achado).toMatch(/80.*120/);
  });
  it('EPV abaixo de 10 → alta', () => {
    expect(ids(proj('d_coorte_retrospectiva', { desfecho_primario: 'x', vai_ajustar: 'sim', n_variaveis_modelo: 6, eventos_esperados: 30 }))).toContain('rv_epv');
    expect(ids(proj('d_coorte_retrospectiva', { desfecho_primario: 'x', vai_ajustar: 'sim', n_variaveis_modelo: 3, eventos_esperados: 30 }))).not.toContain('rv_epv');
  });
  it('ECR sem ocultação, cegamento e ITT', () => {
    expect(ids(proj('d_ecr_paralelo', { desfecho_primario: 'x', ocultacao: 'nao', cegamento: 'nao', itt: 'nao' }))).toEqual(expect.arrayContaining(['rv_ecr_ocultacao', 'rv_ecr_cegamento', 'rv_ecr_itt']));
  });
  it('prontuário sem plano de dados faltantes; CEP; múltiplas comparações', () => {
    const a = ids(proj('d_coorte_retrospectiva', { desfecho_primario: 'x', dados_faltantes_plano: 'nao', cep: 'nao', n_grupos: '3+', correcao_multiplas: 'nao' }));
    expect(a).toEqual(expect.arrayContaining(['rv_dados_faltantes', 'rv_cep', 'rv_multiplas']));
  });
  it('revisão sistemática não exige CEP', () => {
    expect(ids(proj('d_revisao_sistematica', { desfecho_primario: 'x', cep: 'nao' }))).not.toContain('rv_cep');
  });
  it('série de casos querendo testar associação → alta', () => {
    expect(ids(proj('d_serie_casos', { desfecho_primario: 'x', objetivo_associacao: 'sim' }))).toContain('rv_descritivo_associacao');
  });
  it('qualitativo: só o aviso de escopo', () => {
    expect(ids(proj('d_qualitativo', {}))).toEqual(['rv_qualitativo']);
  });
  it('projeto bem planejado: nenhum achado alto e várias verificações aprovadas', () => {
    const r = revisarProjeto(proj('d_coorte_prospectiva', {
      desfecho_primario: 'lesão renal aguda em 7 dias', tipo_desfecho: 'binario', n_grupos: '2', pareado: 'nao', medida: 'rr', freq_desfecho: 'comum',
      testes_planejados: ['t_qui_quadrado', 't_poisson_robusta'], amostra_calculada: 'sim', fonte_efeito: 'sim', perdas_previstas: 'sim',
      n_planejado: 200, vai_ajustar: 'sim', n_variaveis_modelo: 4, eventos_esperados: 50, confundidores_listados: 'sim',
      diretriz: 'r_strobe_2007', cep: 'sim', correcao_multiplas: 'nao_se_aplica',
    }, { amostra: { resultado: 180 } }), base);
    expect(r.contagem.alta).toBe(0);
    expect(r.aprovados.length).toBeGreaterThan(8);
  });
});
