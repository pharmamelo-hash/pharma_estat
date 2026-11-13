// Leitura do projeto (F20): transforma blocos de texto (vindos do Word, PDF ou do Redator) num
// documento com seções reconhecidas e extrai os "sinais" metodológicos. Funções puras e testadas.
import modelos from '../../base/modelos-projeto.json';

export const norm = (s) => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
const SIN = Object.entries(modelos.sinonimos_secoes).map(([chave, lista]) => [chave, lista.map(norm)]);

/** Tira numeração ("3.1", "III -", "a)") e pontuação final de um possível título. */
export function limparTitulo(t) {
  return String(t || '').replace(/^\s*((\d+(\.\d+)*\.?)|([ivxlc]+[.)\-–])|([a-z][).]))\s*[-–—:]?\s*/i, '').replace(/[:.\s]+$/, '').trim();
}
/** Chave canônica de um título de seção, ou null. */
export function chaveDoTitulo(t) {
  const n = norm(limparTitulo(t));
  if (!n || n.length > 70) return null;
  for (const [chave, lista] of SIN) if (lista.includes(n)) return chave;
  for (const [chave, lista] of SIN) if (lista.some((s) => s.length >= 6 && (n.startsWith(`${s} `) || n.startsWith(`${s}:`)))) return chave;
  return null;
}
/** Parece título? Curto, sem ponto final de frase e (reconhecido ou em caixa alta/numerado). */
export function ehTitulo(texto, marcadoComoTitulo = false) {
  const t = String(texto || '').trim();
  if (!t || t.length > 90) return false;
  if (marcadoComoTitulo) return true;
  if (/[.;,]$/.test(t) && !/^\d+(\.\d+)*\.?\s/.test(t)) return false;
  if (chaveDoTitulo(t)) return true;
  const letras = t.replace(/[^A-Za-zÀ-ú]/g, '');
  return letras.length >= 4 && letras === letras.toUpperCase() && t.split(/\s+/).length <= 8;
}

let seq = 0;
const novoUid = () => `s${++seq}`;

/**
 * blocos = [{ texto, titulo?: bool, nivel?: 1|2 }] → documento
 * { titulo, preambulo: [paragrafo], secoes: [{ uid, chave, titulo, nivel, paragrafos: [{ texto, marca? }] }] }
 */
export function montarDocumento(blocos) {
  const doc = { titulo: '', preambulo: [], secoes: [] };
  let atual = null;
  for (const b of blocos) {
    const texto = String(b.texto || '').replace(/\s+/g, ' ').trim();
    if (!texto) continue;
    if (ehTitulo(texto, b.titulo)) {
      const chave = chaveDoTitulo(texto);
      const nivel = b.nivel || (/^\s*\d+\.\d+/.test(texto) ? 2 : ['desenho', 'local', 'populacao', 'criterios', 'amostra', 'coleta', 'variaveis', 'analise'].includes(chave) ? 2 : 1);
      if (!chave && !atual && !doc.titulo) { doc.titulo = limparTitulo(texto); continue; }
      atual = { uid: novoUid(), chave, titulo: limparTitulo(texto), nivel, paragrafos: [] };
      doc.secoes.push(atual);
      continue;
    }
    if (atual) atual.paragrafos.push({ texto });
    else doc.preambulo.push({ texto });
  }
  if (!doc.titulo) {
    const cand = doc.preambulo.find((p) => p.texto.length > 15 && p.texto.length < 220);
    if (cand) doc.titulo = cand.texto;
  }
  return doc;
}

/** Texto corrido: uma seção (por chave), várias, ou o documento inteiro. */
export function textoDe(doc, chaves = null, comTitulos = true) {
  const secs = chaves ? doc.secoes.filter((s) => chaves.includes(s.chave)) : doc.secoes;
  const corpo = secs.map((s) => [comTitulos ? s.titulo : '', ...s.paragrafos.map((p) => p.texto)].join('\n')).join('\n');
  return chaves ? corpo : [doc.titulo, ...doc.preambulo.map((p) => p.texto), corpo].join('\n');
}
export const temSecao = (doc, chave) => doc.secoes.some((s) => s.chave === chave);

// ---------- Sinais metodológicos ----------
const PADROES_DESENHO = [
  ['d_ecr_cluster', /ensaio[^.]{0,40}(conglomerado|cluster)/],
  ['d_ecr_cruzado', /ensaio[^.]{0,40}(cruzado|crossover)|\bcrossover\b/],
  ['d_ecr_paralelo', /ensaio clinico[^.]{0,30}(randomizado|aleatorizado)|ensaio (randomizado|aleatorizado)|randomi[sz]ed controlled|\becr\b/],
  ['d_serie_temporal_interrompida', /serie temporal interrompida|interrupted time series/],
  ['d_quase_antes_depois', /quase[- ]experimental|estudo (do tipo )?antes e depois|pre[- ]?(e )?pos[- ]interven/],
  ['d_caso_controle', /caso[s]?[- ]controle|case[- ]control/],
  ['d_coorte_retrospectiva', /coorte (retrospectiva|historica|nao concorrente)|(retrospectiv\w+[^.]{0,40}coorte)/],
  ['d_coorte_prospectiva', /coorte (prospectiva|concorrente)|(prospectiv\w+[^.]{0,40}coorte)/],
  ['d_acuracia_diagnostica', /acuracia diagnostica|estudo de (teste )?diagnostico|sensibilidade e (a )?especificidade/],
  ['d_modelo_predicao', /modelo (de predicao|preditivo|prognostico)|escore de risco/],
  ['d_revisao_escopo', /revisao de escopo|scoping review/],
  ['d_revisao_sistematica', /revisao sistematica|metanalise|meta-analise/],
  ['d_ecologico', /estudo ecologico|desenho ecologico/],
  ['d_relato_caso', /relato de caso/],
  ['d_serie_casos', /serie de casos/],
  ['d_validacao_instrumento', /validacao (de|do) (instrumento|questionario|escala)|adaptacao transcultural|psicometric/],
  ['d_validacao_analitica', /validacao (de|do) metodo (analitico|bioanalitico)?/],
  ['d_qualitativo', /(pesquisa|estudo|abordagem) qualitativ|grupo focal/],
  ['d_transversal_analitico', /(estudo|desenho|delineamento|carater|corte) (\w+ )?(transversal|seccional)|cross[- ]sectional/],
];

const PADROES_TESTE = [
  ['t_t_pareado', /teste t pareado|t (de student )?para amostras (pareadas|dependentes|relacionadas)/],
  ['t_welch_anova', /anova de welch/],
  ['t_anova_medidas_repetidas', /anova (de|para) medidas repetidas/],
  ['t_anova_um_fator', /\banova\b|analise de variancia/],
  ['t_t_welch', /teste t\b|t de student|t-student|t de welch|teste de student/],
  ['t_mann_whitney', /mann[- ]?whitney|teste u\b/],
  ['t_wilcoxon_pareado', /wilcoxon(?![- ]mann)(?! rank[- ]sum)/],
  ['t_kruskal_wallis', /kruskal/],
  ['t_friedman', /friedman/],
  ['t_qui_quadrado', /qui[- ]?quadrado|chi[- ]?square|χ\s?2|χ²/],
  ['t_fisher_exato', /exato de fisher|fisher'?s exact|teste de fisher/],
  ['t_mcnemar', /mcnemar/],
  ['t_cochran_q', /q de cochran|cochran'?s q/],
  ['t_pearson', /correlacao (linear )?de pearson|coeficiente de (correlacao de )?pearson|r de pearson/],
  ['t_spearman', /spearman/],
  ['t_regressao_linear', /regressao linear/],
  ['t_regressao_logistica', /regressao logistica/],
  ['t_poisson_robusta', /poisson/],
  ['t_kaplan_meier_logrank', /kaplan|log[- ]?rank/],
  ['t_cox', /\bcox\b/],
  ['t_kappa', /\bkappa\b/],
  ['t_icc', /correlacao intraclasse|\bicc\b|\bcci\b/],
  ['t_bland_altman', /bland[- ]altman/],
  ['t_acuracia_roc', /curva roc|\broc\b/],
  ['t_shapiro_wilk', /shapiro/],
  ['t_levene', /levene/],
];

const tem = (re, s) => re.test(s);
function primeiroNumero(re, s) {
  const m = s.match(re);
  return m ? m.slice(1).find((x) => x !== undefined) : null;
}
const paraFracao = (x) => {
  if (x === null || x === undefined) return null;
  const v = Number(String(x).replace('%', '').replace(',', '.'));
  if (!Number.isFinite(v)) return null;
  return v > 1 ? v / 100 : v;
};

/** Extrai os sinais do documento (tudo por regras e palavras-chave; nada sai do aparelho). */
export function extrairSinais(doc) {
  // Só o corpo do texto: um título vazio ("Cálculo amostral") não conta como conteúdo.
  const todo = norm(textoDe(doc, null, false));
  const metodo = norm(textoDe(doc, ['metodologia', 'desenho', 'populacao', 'amostra', 'coleta', 'variaveis', 'analise', 'criterios', 'local'], false)) || todo;
  const secAmostra = norm(textoDe(doc, ['amostra', 'populacao'], false)).trim();
  const secAnalise = norm(textoDe(doc, ['analise'], false)).trim();
  const contar = (re, s) => (s.match(new RegExp(re.source, 'g')) || []).length;

  // Desenhos: pontua por ocorrências, com peso maior na seção "Tipo de estudo".
  const secDesenho = norm(textoDe(doc, ['desenho', 'metodologia'], false));
  const pontos = {};
  for (const [id, re] of PADROES_DESENHO) {
    const p = contar(re, todo) + 3 * contar(re, secDesenho);
    if (p) pontos[id] = p;
  }
  if (pontos.d_transversal_analitico && !/associa|fatores? (de risco|associados)|comparar|relacao entre/.test(todo) && /prevalencia|frequencia|perfil/.test(todo)) {
    pontos.d_transversal_descritivo = pontos.d_transversal_analitico; delete pontos.d_transversal_analitico;
  }
  // "coorte" sem adjetivo: decide pelo sentido da coleta.
  if (!pontos.d_coorte_retrospectiva && !pontos.d_coorte_prospectiva && /\bcoorte\b/.test(todo)) {
    if (/retrospectiv|prontuario/.test(todo)) pontos.d_coorte_retrospectiva = 1; else pontos.d_coorte_prospectiva = 1;
  }
  const desenhos = Object.entries(pontos).sort((a, b) => b[1] - a[1]).map(([id]) => id);

  const testes = [];
  const alvoTestes = secAnalise || metodo;
  for (const [id, re] of PADROES_TESTE) {
    if (!re.test(alvoTestes)) continue;
    if (id === 't_anova_um_fator' && (testes.includes('t_welch_anova') || testes.includes('t_anova_medidas_repetidas')) && contar(/\banova\b/, alvoTestes) <= 1) continue;
    if (id === 't_t_welch' && testes.includes('t_t_pareado') && contar(/teste t\b|t de student/, alvoTestes) <= 1) continue;
    testes.push(id);
  }

  const alfa = paraFracao(primeiroNumero(/(?:significancia|alfa|α)[^.\d]{0,40}?(\d{1,2}(?:[.,]\d+)?\s*%|0[.,]\d{1,3})|p\s*[<≤]\s*(0[.,]\d{1,3})/, todo));
  const poder = paraFracao(primeiroNumero(/poder[^.\d]{0,30}?(\d{2}(?:[.,]\d+)?\s*%|0[.,]\d{1,2})/, todo));
  const n = Number(primeiroNumero(/\bn\s*=\s*(\d{2,6})|(\d{2,6})\s+(?:participantes|pacientes|prontuarios|individuos|criancas|gestantes|voluntarios)/, metodo)) || null;
  const perdasN = paraFracao(primeiroNumero(/(?:perdas?|recusas?)[^.\d]{0,40}?(\d{1,2}(?:[.,]\d+)?\s*%)|(\d{1,2}(?:[.,]\d+)?\s*%)[^.%]{0,30}(?:perdas?|recusas?)/, todo));

  return {
    desenhos,
    testes,
    alfa, poder, n, perdas: perdasN,
    temCalculo: tem(/calculo (do tamanho )?(amostral|da amostra)|tamanho (da )?amostra(l)?[^.]{0,30}(calculad|estimad|determinad)|g\*?power|openepi|epi ?info|\bpoder\b[^.]{0,20}\d|tera poder|poder (do estudo|estatistico)|amostra[^.]{0,40}formula/, todo),
    censo: tem(/\bcenso\b|todos os (pacientes|prontuarios|individuos)[^.]{0,60}(periodo|internados|atendidos)|amostra(gem)? (por|de) conveniencia|nao probabilistica/, todo),
    fonteEfeito: tem(/\(\s*[a-z][^()]{1,80}\d{4}\s*\)|\[\d+(?:[,–-]\d+)*\]|estudo piloto|segundo [a-z]+|de acordo com|conforme [a-z]+ et al|et al/, secAmostra),
    mencionaPerdas: tem(/perdas?|recusas?|reposicao|acrescid|acrescimo/, secAmostra || todo),
    normalidade: tem(/shapiro|kolmogorov|lilliefors|normalidade|anderson[- ]darling|distribuicao normal/, todo),
    significancia: tem(/significancia|p\s*[<≤]\s*0[.,]0\d|alfa|α\s*=/, secAnalise || todo),
    software: tem(/software|programa estatistico|\bspss\b|\bstata\b|jamovi|\bjasp\b|graphpad|prism|\bsas\b|excel|epi ?info|bioestat|minitab|python|rstudio|\br core\b|linguagem r\b|\bpacote r\b|\bsoftware r\b|pharma_estat/, todo),
    efeitoIC: tem(/intervalo de confianca|\bic ?95|95\s?% ?(ic|ci)|\bic\b|confidence interval/, secAnalise || todo),
    multiplas: tem(/bonferroni|tukey|post[- ]?hoc|holm|\bdunn\b|benjamini|comparacoes multiplas|games[- ]howell|sidak|scheffe/, todo),
    faltantes: tem(/dados (faltantes|ausentes|perdidos|incompletos)|missing|imputac/, todo),
    ajuste: tem(/confundi|ajustad|multivariad|analise multipla|regressao (logistica|linear|de poisson|de cox)/, todo),
    listaConfundidores: tem(/confundi\w*[^.]{0,80}(idade|sexo|gravidade|comorbidade)|ajustad\w* (por|para)[^.]{0,80}(idade|sexo|gravidade)/, todo),
    res466: tem(/466\s*\/?\s*(de )?(2012|12)|resolucao (cns )?(n[o.º°]*\s*)?466/, todo),
    res510: tem(/510\s*\/?\s*(de )?(2016)|resolucao (cns )?(n[o.º°]*\s*)?510/, todo),
    cep: tem(/comite de etica|\bcep\b|plataforma brasil|\bcaae\b/, todo),
    tcle: tem(/\btcle\b|termo de consentimento/, todo),
    tale: tem(/\btale\b|termo de assentimento/, todo),
    dispensa: tem(/dispensa (do |de )?(tcle|termo)|isencao (do |de )?(tcle|termo)|dispensa do consentimento/, todo),
    tcud: tem(/\btcud\b|termo de compromisso (de|para) (uso|utilizacao)/, todo),
    lgpd: tem(/\blgpd\b|13\.?709|protecao de dados/, todo),
    sigilo: tem(/sigilo|confidencialidade|anonimat|codificad|anonimizad/, todo),
    riscos: tem(/\briscos?\b/, todo),
    beneficios: tem(/beneficios?/, todo),
    criancas: tem(/criancas?|pediatric|neonat|recem[- ]nascid|adolescen|menores de (18|idade)|lactentes/, todo),
    registros: tem(/prontuario|registros? (medicos|hospitalares|clinicos)|banco de dados|dados secundarios|sistema (de informac|mv|aghu)/, todo),
    randomizacao: tem(/randomiza|aleatoriza|sorteio|sequencia de alocacao/, todo),
    ocultacao: tem(/ocultacao (da )?alocacao|envelopes? (opacos|lacrados|selados)|central de randomizacao|allocation concealment/, todo),
    cegamento: tem(/\bceg(o|a|os|as|amento)\b|mascaramento|duplo[- ]cego|simples[- ]cego/, todo),
    itt: tem(/intencao de tratar|intention[- ]to[- ]treat|\bitt\b/, todo),
    medidas: ['rr', 'or', 'rp', 'hr', 'incidencia'].filter((m) => tem({ rr: /risco relativo|\brr\b/, or: /odds ratio|razao de chances|\bor\b(?= ?[=(\d])/, rp: /razao de prevalencia|\brp\b/, hr: /hazard|\bhr\b(?= ?[=(\d])/, incidencia: /\bincidencia\b/ }[m], todo)),
    diretriz: (todo.match(/\b(strobe|record|consort|stard|prisma(-scr)?|tripod|care|coreq|spirit|trend|cosmin|equator)\b/) || [])[1] || null,
    desfechoPrimario: tem(/desfecho (primario|principal)|variavel (dependente|resposta|desfecho)|desfecho de interesse/, todo),
    inclusao: tem(/criterios? de inclusao|serao incluid|foram incluid|incluidos (os|as|todos)/, todo),
    exclusao: tem(/criterios? de exclusao|serao excluid|foram excluid/, todo),
    grupos3: testes.some((t) => ['t_anova_um_fator', 't_welch_anova', 't_kruskal_wallis'].includes(t)),
    associacao: tem(/associa|fatores (de risco|associados)|comparar/, norm(textoDe(doc, ['objetivos', 'hipotese'], false)).trim() || todo),
  };
}
