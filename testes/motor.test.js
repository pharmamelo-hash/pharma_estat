// Motor de regras e árvores (Doc 7.4): todo caminho tem um resultado esperado escrito à mão.
// Se alguém mudar a árvore, este teste quebra e obriga a revisar o caso esperado.
import { describe, it, expect } from 'vitest';
import { iniciar, responder, voltar, reproduzir, todosOsCaminhos, validarArvore, noAtual, profundidadeMaxima } from '../src/motor/arvore.js';
import arvoreDesenho from '../base/arvore-desenho.json';
import arvoreTeste from '../base/arvore-teste.json';
import desenhos from '../base/desenhos.json';
import testes from '../base/testes.json';
import referencias from '../base/referencias.json';

const ESPERADO_DESENHO = [
  [['dados', 'sim', 'sim', 'individuo'], 'd_ecr_paralelo'],
  [['dados', 'sim', 'sim', 'sequencia'], 'd_ecr_cruzado'],
  [['dados', 'sim', 'sim', 'grupo'], 'd_ecr_cluster'],
  [['dados', 'sim', 'nao', 'serie'], 'd_serie_temporal_interrompida'],
  [['dados', 'sim', 'nao', 'antes_depois'], 'd_quase_antes_depois'],
  [['dados', 'nao', 'descrever', 'um'], 'd_relato_caso'],
  [['dados', 'nao', 'descrever', 'serie'], 'd_serie_casos'],
  [['dados', 'nao', 'descrever', 'prevalencia'], 'd_transversal_descritivo'],
  [['dados', 'nao', 'associar', 'individual', 'mesmo_tempo'], 'd_transversal_analitico'],
  [['dados', 'nao', 'associar', 'individual', 'do_desfecho'], 'd_caso_controle'],
  [['dados', 'nao', 'associar', 'individual', 'da_exposicao', 'futuro'], 'd_coorte_prospectiva'],
  [['dados', 'nao', 'associar', 'individual', 'da_exposicao', 'passado'], 'd_coorte_retrospectiva'],
  [['dados', 'nao', 'associar', 'agregado'], 'd_ecologico'],
  [['dados', 'nao', 'diagnostico'], 'd_acuracia_diagnostica'],
  [['dados', 'nao', 'predicao'], 'd_modelo_predicao'],
  [['sintese', 'focada'], 'd_revisao_sistematica'],
  [['sintese', 'ampla'], 'd_revisao_escopo'],
  [['validacao', 'analitico'], 'd_validacao_analitica'],
  [['validacao', 'instrumento'], 'd_validacao_instrumento'],
  [['qualitativo'], 'd_qualitativo'],
];

const ESPERADO_TESTE = [
  [['comparar', 'quantitativo', '2', 'independente', 'sim'], 't_t_welch'],
  [['comparar', 'quantitativo', '2', 'independente', 'nao'], 't_mann_whitney'],
  [['comparar', 'quantitativo', '2', 'pareado', 'sim'], 't_t_pareado'],
  [['comparar', 'quantitativo', '2', 'pareado', 'nao'], 't_wilcoxon_pareado'],
  [['comparar', 'quantitativo', '3+', 'independente', 'sim', 'sim'], 't_anova_um_fator'],
  [['comparar', 'quantitativo', '3+', 'independente', 'sim', 'nao'], 't_welch_anova'],
  [['comparar', 'quantitativo', '3+', 'independente', 'nao'], 't_kruskal_wallis'],
  [['comparar', 'quantitativo', '3+', 'pareado', 'sim'], 't_anova_medidas_repetidas'],
  [['comparar', 'quantitativo', '3+', 'pareado', 'nao'], 't_friedman'],
  [['comparar', 'ordinal', '2i'], 't_mann_whitney'],
  [['comparar', 'ordinal', '2p'], 't_wilcoxon_pareado'],
  [['comparar', 'ordinal', '3i'], 't_kruskal_wallis'],
  [['comparar', 'ordinal', '3p'], 't_friedman'],
  [['comparar', 'categorico', 'independente', 'nao'], 't_qui_quadrado'],
  [['comparar', 'categorico', 'independente', 'sim'], 't_fisher_exato'],
  [['comparar', 'categorico', 'pareado2'], 't_mcnemar'],
  [['comparar', 'categorico', 'pareado3'], 't_cochran_q'],
  [['relacionar', 'sim'], 't_pearson'],
  [['relacionar', 'nao'], 't_spearman'],
  [['ajustar', 'quantitativo'], 't_regressao_linear'],
  [['ajustar', 'binario', 'caso_controle'], 't_regressao_logistica'],
  [['ajustar', 'binario', 'raro'], 't_regressao_logistica'],
  [['ajustar', 'binario', 'comum'], 't_poisson_robusta'],
  [['ajustar', 'tempo'], 't_cox'],
  [['tempo', 'comparar'], 't_kaplan_meier_logrank'],
  [['tempo', 'ajustar'], 't_cox'],
  [['concordancia', 'kappa'], 't_kappa'],
  [['concordancia', 'icc'], 't_icc'],
  [['concordancia', 'metodos'], 't_bland_altman'],
  [['concordancia', 'diagnostico'], 't_acuracia_roc'],
];

const idsDesenhos = new Set(desenhos.desenhos.map((d) => d.id));
const idsTestes = new Set(testes.testes.map((t) => t.id));
const idsRefs = new Set(referencias.referencias.map((r) => r.id));

describe.each([
  ['desenho', arvoreDesenho, ESPERADO_DESENHO, idsDesenhos],
  ['teste', arvoreTeste, ESPERADO_TESTE, idsTestes],
])('árvore de %s', (_nome, arvore, esperado, validos) => {
  it('é íntegra (sem destinos inexistentes, órfãos ou ciclos)', () => {
    expect(validarArvore(arvore, validos)).toEqual([]);
  });
  it('cada caminho tem um caso esperado escrito, e nenhum a mais', () => {
    const reais = todosOsCaminhos(arvore).map((c) => JSON.stringify([c.valores, c.resultado])).sort();
    const escritos = esperado.map((e) => JSON.stringify(e)).sort();
    expect(reais).toEqual(escritos);
  });
  it.each(esperado)('caminho %j → %s', (valores, resultado) => {
    expect(reproduzir(arvore, valores).resultado).toBe(resultado);
  });
  it('as referências da árvore existem', () => {
    arvore.refs.forEach((r) => expect(idsRefs.has(r), r).toBe(true));
  });
});

describe('motor', () => {
  it('começa na raiz e anda, volta e chega ao resultado', () => {
    let e = iniciar(arvoreTeste);
    expect(noAtual(arvoreTeste, e).pergunta).toMatch(/objetivo/i);
    e = responder(arvoreTeste, e, 'comparar');
    e = responder(arvoreTeste, e, 'categorico');
    e = voltar(arvoreTeste, e);
    expect(e.no).toBe('n_desfecho');
    e = responder(arvoreTeste, e, 'quantitativo');
    expect(e.caminho).toHaveLength(2);
    e = reproduzir(arvoreTeste, ['comparar', 'quantitativo', '2', 'independente', 'sim']);
    expect(e.resultado).toBe('t_t_welch');
    expect(noAtual(arvoreTeste, e)).toBeNull();
  });
  it('não altera o estado anterior (imutável)', () => {
    const a = iniciar(arvoreTeste);
    responder(arvoreTeste, a, 'comparar');
    expect(a.caminho).toHaveLength(0);
  });
  it('rejeita opção inexistente', () => {
    expect(() => responder(arvoreTeste, iniciar(arvoreTeste), 'xpto')).toThrow();
  });
  it('detecta defeitos numa árvore quebrada', () => {
    const ruim = { raiz: 'a', nos: { a: { pergunta: 'p', opcoes: [{ valor: '1', rotulo: 'x', proximo: 'b' }, { valor: '2', rotulo: 'y', resultado: 'zz' }] }, b: { pergunta: 'q', opcoes: [{ valor: '1', rotulo: 'x', proximo: 'a' }, { valor: '2', rotulo: 'y', resultado: 'ok' }] }, solto: { pergunta: 'r', opcoes: [] } } };
    const erros = validarArvore(ruim, new Set(['ok'])).join(' | ');
    expect(erros).toMatch(/Ciclo/);
    expect(erros).toMatch(/zz não existe/);
    expect(erros).toMatch(/solto nunca/);
  });
  it('calcula a profundidade para a barra de progresso', () => {
    expect(profundidadeMaxima(arvoreTeste)).toBe(6);
    expect(profundidadeMaxima(arvoreDesenho)).toBe(6);
  });
});

describe('base de testes', () => {
  it('ids únicos, alternativas e referências existentes, campos completos', () => {
    const ids = testes.testes.map((t) => t.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const t of testes.testes) {
      expect(t.id).toMatch(/^t_/);
      expect(Object.keys(testes.objetivos)).toContain(t.objetivo);
      ['nome', 'usar_quando', 'nao_usar_quando', 'porque', 'efeito', 'funcao_r', 'como_relatar'].forEach((c) => expect(t[c]?.length > 3, `${t.id}.${c}`).toBe(true));
      expect(t.pressupostos.length, t.id).toBeGreaterThan(0);
      expect(idsTestes.has(t.alternativa), `${t.id} alternativa`).toBe(true);
      t.refs.forEach((r) => expect(idsRefs.has(r), `${t.id}: ${r}`).toBe(true));
      expect(typeof t.analise_no_app).toBe('boolean');
    }
  });
  it('todo teste indicado pela árvore existe e todo teste não-pressuposto é alcançável', () => {
    const alcancaveis = new Set(todosOsCaminhos(arvoreTeste).map((c) => c.resultado));
    testes.testes.filter((t) => t.objetivo !== 'pressuposto').forEach((t) => expect(alcancaveis.has(t.id), t.id).toBe(true));
  });
  it('todo desenho é alcançável pela árvore', () => {
    const alcancaveis = new Set(todosOsCaminhos(arvoreDesenho).map((c) => c.resultado));
    desenhos.desenhos.forEach((d) => expect(alcancaveis.has(d.id), d.id).toBe(true));
  });
});
