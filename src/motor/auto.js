// Análise automática (F15): a partir das colunas escolhidas, decide a família de análise.
// Regras explícitas (sem IA): a mesma entrada dá sempre a mesma escolha. Testado em testes/auto.test.js.
// O teste final dentro da família (ex.: Welch × Mann-Whitney) é escolhido depois, pelos pressupostos nos dados.

/**
 * desfecho, explicativa: { nome, tipo: 'quantitativo'|'ordinal'|'categorico', nNiveis }
 * pareado: true quando as colunas são medidas repetidas do mesmo participante;
 * medidas: nomes das colunas das medidas repetidas (2 ou mais), todas do mesmo tipo.
 * Devolve { teste, papeis, familia, motivos: [texto], aviso } ou { erro }.
 */
export function escolherAnalise({ desfecho, explicativa = null, pareado = false, medidas = [] }) {
  const motivos = [];
  if (pareado) {
    if (medidas.length < 2) return { erro: 'Escolha pelo menos duas colunas com as medidas repetidas.' };
    const tipos = new Set(medidas.map((m) => m.tipo));
    if (tipos.size > 1) return { erro: 'As medidas repetidas precisam ser do mesmo tipo (todas quantitativas, todas ordinais ou todas categóricas).' };
    const tipo = medidas[0].tipo;
    motivos.push(`As ${medidas.length} colunas são medidas do mesmo participante: a análise precisa ser pareada.`);
    if (tipo === 'categorico') {
      if (medidas.length > 2) return { erro: 'Desfecho categórico em 3 ou mais momentos pede o teste Q de Cochran, que não roda no app. Compare dois momentos por vez (McNemar).' };
      if (medidas.some((m) => m.nNiveis > 2)) return { erro: 'Para desfecho categórico pareado o app roda o McNemar, que exige 2 categorias (ex.: sim/não).' };
      motivos.push('O desfecho é categórico com 2 categorias: compara-se quem mudou de categoria (McNemar).');
      return { teste: 't_mcnemar', familia: 'mcnemar', papeis: { y: medidas[0].nome, y2: medidas[1].nome }, motivos };
    }
    if (medidas.length === 2) {
      motivos.push(tipo === 'ordinal' ? 'O desfecho é ordinal: usa-se o teste de postos para pares (Wilcoxon pareado).' : 'O desfecho é quantitativo em dois momentos: t pareado se as diferenças forem normais, Wilcoxon pareado se não forem.');
      return { teste: tipo === 'ordinal' ? 't_wilcoxon_pareado' : 't_t_pareado', familia: 'pareado', papeis: { y: medidas[0].nome, y2: medidas[1].nome }, motivos, forcar: tipo === 'ordinal' ? 't_wilcoxon_pareado' : null };
    }
    motivos.push('São 3 ou mais momentos: o app usa o teste de Friedman (a ANOVA de medidas repetidas exige apoio de um bioestatístico).');
    return { teste: 't_friedman', familia: 'friedman', papeis: { medidas: medidas.map((m) => m.nome) }, motivos };
  }

  if (!desfecho || !explicativa) return { erro: 'Escolha o desfecho e a variável de comparação.' };
  if (desfecho.nome === explicativa.nome) return { erro: 'O desfecho e a variável de comparação precisam ser colunas diferentes.' };
  const d = desfecho.tipo, e = explicativa.tipo;
  const txt = { quantitativo: 'quantitativo', ordinal: 'ordinal', categorico: 'categórico' };
  motivos.push(`Desfecho "${desfecho.nome}": ${txt[d]}${d === 'categorico' ? ` (${desfecho.nNiveis} categorias)` : ''}.`);
  motivos.push(`Comparação "${explicativa.nome}": ${txt[e]}${e === 'categorico' ? ` (${explicativa.nNiveis} categorias)` : ''}.`);

  // Desfecho numérico (quantitativo ou ordinal) comparado entre grupos
  if (d !== 'categorico' && e === 'categorico') {
    if (explicativa.nNiveis < 2) return { erro: `A coluna "${explicativa.nome}" tem só uma categoria: não há grupos para comparar.` };
    if (explicativa.nNiveis === 2) {
      motivos.push('Dois grupos independentes: t de Welch se a distribuição for aproximadamente normal, Mann-Whitney se não for.');
      if (d === 'ordinal') motivos.push('Como o desfecho é ordinal, vale o teste de postos (Mann-Whitney).');
      return { teste: d === 'ordinal' ? 't_mann_whitney' : 't_t_welch', familia: 'dois_grupos', papeis: { y: desfecho.nome, g: explicativa.nome }, motivos, forcar: d === 'ordinal' ? 't_mann_whitney' : null };
    }
    motivos.push('Três ou mais grupos independentes: ANOVA (com Tukey) se houver normalidade e variâncias parecidas; ANOVA de Welch se as variâncias diferirem; Kruskal-Wallis se não houver normalidade.');
    if (d === 'ordinal') motivos.push('Como o desfecho é ordinal, vale o teste de postos (Kruskal-Wallis).');
    return { teste: d === 'ordinal' ? 't_kruskal_wallis' : 't_anova_um_fator', familia: 'varios', papeis: { y: desfecho.nome, g: explicativa.nome }, motivos, forcar: d === 'ordinal' ? 't_kruskal_wallis' : null };
  }
  // Duas variáveis numéricas
  if (d !== 'categorico' && e !== 'categorico') {
    motivos.push('Duas variáveis numéricas: correlação de Pearson se a relação for linear e os dados normais; Spearman se não.');
    const ordinal = d === 'ordinal' || e === 'ordinal';
    if (ordinal) motivos.push('Há variável ordinal: vale a correlação de postos (Spearman).');
    return { teste: ordinal ? 't_spearman' : 't_pearson', familia: 'correlacao', papeis: { x: explicativa.nome, y: desfecho.nome }, motivos, forcar: ordinal ? 't_spearman' : null };
  }
  // Duas categóricas
  if (d === 'categorico' && e === 'categorico') {
    if (desfecho.nNiveis < 2 || explicativa.nNiveis < 2) return { erro: 'As duas colunas precisam ter pelo menos 2 categorias.' };
    motivos.push('Duas variáveis categóricas: qui-quadrado se as frequências esperadas forem adequadas; exato de Fisher se forem baixas.');
    return { teste: 't_qui_quadrado', familia: 'categoricas', papeis: { g: explicativa.nome, y: desfecho.nome }, motivos };
  }
  // Desfecho categórico explicado por variável numérica
  if (desfecho.nNiveis === 2) {
    motivos.push('Desfecho com 2 categorias explicado por variável numérica: regressão logística (estima a odds ratio por unidade).');
    return { teste: 't_regressao_logistica', familia: 'logistica', papeis: { y: desfecho.nome, x: [explicativa.nome] }, motivos };
  }
  motivos.push(`O desfecho tem ${desfecho.nNiveis} categorias e a outra variável é numérica: a forma direta é comparar "${explicativa.nome}" entre as categorias de "${desfecho.nome}".`);
  return { teste: e === 'ordinal' ? 't_kruskal_wallis' : 't_anova_um_fator', familia: 'varios', papeis: { y: explicativa.nome, g: desfecho.nome }, motivos,
    forcar: e === 'ordinal' ? 't_kruskal_wallis' : null, aviso: 'Os papéis foram invertidos para a comparação. Para prever uma categoria entre 3 ou mais, é preciso regressão multinomial (procure um bioestatístico).' };
}

/** Nomes de colunas que sugerem medidas repetidas (antes/depois, D0/D7, pré/pós). */
export function pareceRepetida(nomes) {
  const padrao = /(antes|depois|pr[eé]|p[oó]s|basal|final|inicial|d\d+|t\d+|dia_?\d+|semana_?\d+|m[eê]s_?\d+|admiss[aã]o|alta)/i;
  const marcadas = nomes.filter((n) => padrao.test(n));
  const raiz = (n) => n.toLowerCase().replace(padrao, '').replace(/[^a-zà-ú]/g, '');
  const grupos = {};
  marcadas.forEach((n) => { (grupos[raiz(n)] ||= []).push(n); });
  return Object.values(grupos).filter((g) => g.length >= 2);
}

/** Opções de desenho para a análise automática → medida de associação e linguagem. */
export const DESENHOS_RAPIDOS = [
  { id: 'd_transversal_analitico', rotulo: 'Transversal: tudo medido no mesmo momento', medida: 'rp', causal: false },
  { id: 'd_caso_controle', rotulo: 'Caso-controle: parti de quem tinha e de quem não tinha o desfecho', medida: 'or', causal: false },
  { id: 'd_coorte_retrospectiva', rotulo: 'Coorte em prontuários: da exposição até o desfecho, já registrados', medida: 'rr', causal: false },
  { id: 'd_coorte_prospectiva', rotulo: 'Coorte prospectiva: acompanhei os pacientes a partir da exposição', medida: 'rr', causal: false },
  { id: 'd_ecr_paralelo', rotulo: 'Ensaio clínico randomizado: sorteei quem recebeu a intervenção', medida: 'rr', causal: true },
  { id: 'd_quase_antes_depois', rotulo: 'Antes e depois de uma intervenção, sem sorteio', medida: 'rr', causal: false },
];
