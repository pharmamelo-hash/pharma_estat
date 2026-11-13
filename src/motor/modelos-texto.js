// Textos-modelo para o projeto (F19/F20). Usados pelo Redator (preencher seções) e pelo
// Corretor (trechos propostos). Trechos que só o autor sabe ficam entre [colchetes].
import desenhos from '../../base/desenhos.json';
import testes from '../../base/testes.json';
import referencias from '../../base/referencias.json';

const D = Object.fromEntries(desenhos.desenhos.map((x) => [x.id, x]));
const T = Object.fromEntries(testes.testes.map((x) => [x.id, x]));
const R = Object.fromEntries(referencias.referencias.map((x) => [x.id, x]));

export const minuscula = (s) => (s ? s.charAt(0).toLowerCase() + s.slice(1) : s);
const semPonto = (s) => String(s || '').trim().replace(/[.;]\s*$/, '');
const pctBr = (v) => `${String(Math.round(v * 1000) / 10).replace('.', ',')}%`;
export const nomeDesenho = (id) => D[id]?.nome ?? null;
export const nomeTeste = (id) => T[id]?.nome ?? id;
export const citacaoRef = (id) => R[id]?.citacao ?? null;

/** Marca de lacuna que o autor precisa preencher (destacada no app e no arquivo exportado). */
export const LACUNA = /\[[^\]]{2,200}\]/g;

const RETROSPECTIVOS = ['d_coorte_retrospectiva', 'd_caso_controle', 'd_serie_casos', 'd_relato_caso'];
const SEM_SERES_HUMANOS = ['d_revisao_sistematica', 'd_revisao_escopo', 'd_ecologico', 'd_validacao_analitica'];
export const ECR = ['d_ecr_paralelo', 'd_ecr_cruzado', 'd_ecr_cluster'];
export const COM_SEGUIMENTO = ['d_coorte_prospectiva', ...ECR];
export const PRECISA_AMOSTRA = ['d_transversal_descritivo', 'd_transversal_analitico', 'd_caso_controle', 'd_coorte_prospectiva', 'd_coorte_retrospectiva', ...ECR, 'd_quase_antes_depois', 'd_acuracia_diagnostica'];
export const precisaEtica = (d) => !SEM_SERES_HUMANOS.includes(d);
export const usaRegistros = (d) => RETROSPECTIVOS.includes(d);

export function textoDesenho(d) {
  const x = D[d];
  if (!x) return 'Trata-se de estudo do tipo [informar o desenho: ex.: coorte retrospectiva], escolhido porque [justificar a escolha em relação à pergunta de pesquisa].';
  return `Trata-se de estudo com desenho do tipo ${minuscula(x.nome)}. ${x.definicao} Esse desenho foi escolhido porque [justificar em uma frase como ele responde à pergunta de pesquisa].`;
}

export function textoCriterios() {
  return 'Critérios de inclusão: [ex.: pacientes com 18 anos ou mais, internados no setor X no período do estudo, com o diagnóstico Y].\nCritérios de exclusão: [ex.: prontuários com dados incompletos para o desfecho principal, transferências para outra instituição antes de 48 horas, gestantes].';
}

export function textoDesfechos(desfecho) {
  const prim = String(desfecho || '').trim();
  return `Desfecho primário: ${prim || '[definir um único desfecho principal, com a forma de medida e o momento da avaliação (ex.: óbito em 30 dias, sim/não)]'}.\nDesfechos secundários: [listar até 3 a 5, com a forma de medida].\nVariáveis explicativas: [exposição ou intervenção principal e covariáveis (idade, sexo, gravidade), com unidade ou categorias].`;
}

/** Amostra: usa o cálculo salvo no projeto (texto já gerado pela calculadora) ou deixa a estrutura. */
export function textoAmostra(textoCalculo, d) {
  if (textoCalculo) return textoCalculo;
  if (d && !PRECISA_AMOSTRA.includes(d)) return 'Por se tratar de [desenho], não se aplica cálculo de tamanho amostral para teste de hipótese; serão incluídos [descrever o critério de inclusão do material ou dos participantes].';
  return 'O tamanho amostral foi calculado para [objetivo: estimar uma proporção / comparar duas médias / comparar duas proporções], considerando [efeito esperado] com base em [citar a fonte: estudo prévio ou piloto], nível de significância de 5% (bilateral) e poder de 80%, resultando em [n] participantes. Prevendo perdas de [10–20]%, serão incluídos [n final]. Cálculo realizado no Pharma_estat (calculadora "Amostra e poder").';
}

export function fraseTeste(id) {
  const t = T[id];
  if (!t) return '';
  let s = `Será utilizado o procedimento "${t.nome}", indicado para ${minuscula(semPonto(t.usar_quando))}.`;
  const parametrico = (t.pressupostos || []).some((p) => /normal/i.test(p.nome));
  if (parametrico && T[t.alternativa]) s += ` Caso o pressuposto de normalidade não seja atendido, será usado o procedimento "${T[t.alternativa].nome}".`;
  if (t.efeito) s += ` Será relatado: ${minuscula(semPonto(t.efeito))}.`;
  return s;
}

export const FRASES = {
  descritiva: 'As variáveis categóricas serão descritas por frequências absolutas e relativas; as quantitativas, por média e desvio-padrão ou mediana e intervalo interquartil, conforme a distribuição.',
  normalidade: 'A normalidade das variáveis quantitativas será avaliada pelo teste de Shapiro-Wilk e por inspeção de histogramas e gráficos Q-Q.',
  significancia: (alfa = 0.05) => `Será adotado nível de significância de ${pctBr(alfa)} (p < ${String(alfa).replace('.', ',')}), com testes bilaterais.`,
  efeitoIC: 'Além do valor-p, as medidas de efeito serão apresentadas com intervalo de confiança de 95% (IC 95%).',
  software: (s = 'R') => `As análises serão realizadas no software ${s === 'R' ? 'R (R Core Team), por meio do Pharma_estat' : s}.`,
  multiplas: 'Nas comparações entre três ou mais grupos, as comparações múltiplas (post hoc) serão ajustadas [Tukey após ANOVA; Dunn com correção de Holm após Kruskal-Wallis].',
  faltantes: 'Os dados faltantes serão descritos por variável; se a perda no desfecho ou nas variáveis principais ultrapassar 5%, será feita análise de sensibilidade [ex.: imputação múltipla ou comparação entre casos completos e incompletos].',
  confundidores: 'Para controlar o confundimento, as variáveis [listar, por exemplo idade, sexo e gravidade na admissão] serão incluídas no modelo ajustado, escolhidas a priori por plausibilidade clínica, respeitando cerca de 10 eventos por variável.',
  perdas: (p = 0.1) => `O tamanho amostral foi acrescido de ${pctBr(p)} para compensar perdas de seguimento e recusas.`,
  fonteEfeito: 'O efeito esperado utilizado no cálculo foi obtido de [citar o estudo prévio ou o piloto, com referência].',
  alfaPoder: (alfa = 0.05, poder = 0.8) => `O cálculo considerou nível de significância de ${pctBr(alfa)} (bilateral) e poder de ${pctBr(poder)}.`,
  randomizacao: 'A sequência de alocação será gerada por computador [ex.: blocos de tamanho variável, estratificada por X], por pessoa não envolvida no recrutamento.',
  ocultacao: 'A ocultação da alocação será garantida por [ex.: envelopes opacos, selados e numerados sequencialmente ou central de randomização].',
  cegamento: 'Serão mantidos cegos para a alocação [participantes / avaliadores do desfecho / analistas de dados]; quando o cegamento não for possível, a avaliação do desfecho será feita por avaliador independente.',
  itt: 'A análise principal seguirá o princípio da intenção de tratar (todos os randomizados analisados no grupo para o qual foram alocados), com análise por protocolo como sensibilidade.',
};

export function textoAnalise({ testesIds = [], alfa = 0.05, software = 'R', grupos3 = false, ajuste = false } = {}) {
  const partes = [FRASES.descritiva, FRASES.normalidade];
  const lista = testesIds.filter((id) => T[id] && T[id].objetivo !== 'pressuposto');
  if (lista.length) lista.forEach((id) => partes.push(fraseTeste(id)));
  else partes.push('Para [objetivo principal], será utilizado o teste [indicar o teste — use "Qual teste usar?" no Pharma_estat], escolhido pelo tipo de desfecho, número de grupos e pareamento.');
  if (grupos3) partes.push(FRASES.multiplas);
  if (ajuste) partes.push(FRASES.confundidores);
  partes.push(FRASES.efeitoIC, FRASES.significancia(alfa), FRASES.software(software));
  return partes.join('\n');
}

export function textoEtica({ d, criancas = false, registros = null } = {}) {
  if (d && !precisaEtica(d)) return 'Por não envolver seres humanos diretamente [revisão de literatura / dados agregados públicos / ensaio laboratorial], o estudo dispensa apreciação pelo Comitê de Ética em Pesquisa, conforme a Resolução CNS nº 510/2016, art. 1º, parágrafo único [conferir o inciso aplicável].';
  const usaReg = registros ?? usaRegistros(d);
  const partes = ['O projeto será submetido ao Comitê de Ética em Pesquisa (CEP) [nome da instituição] por meio da Plataforma Brasil, em conformidade com a Resolução CNS nº 466/2012, e a coleta só será iniciada após a aprovação.'];
  if (usaReg) partes.push('Por se tratar de estudo com dados secundários de prontuários, será solicitada a dispensa do Termo de Consentimento Livre e Esclarecido (TCLE), com justificativa [ex.: pacientes que receberam alta ou faleceram, inviabilidade de contato], e os pesquisadores assinarão o Termo de Compromisso de Utilização de Dados (TCUD).');
  else partes.push('Os participantes serão convidados a assinar o Termo de Consentimento Livre e Esclarecido (TCLE), em duas vias, após explicação dos objetivos, riscos e benefícios.');
  if (criancas) partes.push('Para participantes menores de 18 anos, o TCLE será assinado pelo responsável legal e será aplicado o Termo de Assentimento Livre e Esclarecido (TALE), em linguagem adequada à idade.');
  partes.push('Os dados serão codificados, sem identificação nominal, armazenados com acesso restrito aos pesquisadores e utilizados apenas para os fins deste estudo, em conformidade com a Lei Geral de Proteção de Dados (Lei nº 13.709/2018).');
  return partes.join('\n');
}

export function textoRiscos({ d } = {}) {
  const reg = usaRegistros(d);
  return [
    `Riscos: ${reg ? 'o principal risco é a quebra de sigilo das informações dos prontuários' : 'desconforto ou constrangimento ao responder às perguntas e risco de quebra de sigilo'}. Para minimizá-los, ${reg ? 'os dados serão codificados na coleta, sem nome ou registro, e mantidos em arquivo protegido por senha' : 'a coleta será feita em local reservado, o participante poderá recusar qualquer pergunta ou desistir a qualquer momento sem prejuízo, e os dados serão codificados'}.`,
    'Benefícios: [diretos, se houver; e indiretos, como a produção de conhecimento para melhorar o cuidado no serviço X].',
  ].join('\n');
}

export function textoDiretriz(d) {
  const ref = D[d]?.diretriz;
  if (!ref) return null;
  const nome = (R[ref]?.citacao || '').match(/\b(STROBE|RECORD|CONSORT|STARD|PRISMA(-ScR)?|TRIPOD\+AI|TRIPOD|CARE|COREQ|TREND|COSMIN|ICH Q2\(R2\)|SPIRIT)\b/)?.[0] || 'da rede EQUATOR';
  return `O relato do estudo seguirá as recomendações da diretriz ${nome}.`;
}

export function textoCronograma() {
  return 'Etapa | Mês 1 | Mês 2 | Mês 3 | Mês 4 | Mês 5 | Mês 6\nSubmissão ao CEP | X | X | | | |\nColeta de dados (após aprovação) | | | X | X | |\nAnálise dos dados | | | | X | X |\nRedação e apresentação | | | | | X | X\n[Ajustar as etapas e os meses ao seu calendário.]';
}
export function textoOrcamento() {
  return 'Item | Quantidade | Valor (R$)\n[Material de escritório / impressão de fichas] | [ ] | [ ]\n[Outros] | [ ] | [ ]\nTotal | | [ ]\nFonte: [recursos próprios do pesquisador / financiamento X]. Não haverá custos para os participantes nem para a instituição [ajustar].';
}

/** Referências que as seções automáticas citam. */
export function refsDoTexto({ d, testesIds = [], etica = true } = {}) {
  const ids = [];
  if (etica && (!d || precisaEtica(d))) ids.push('r_cns_466_2012', 'r_lgpd_2018');
  if (d && !precisaEtica(d)) ids.push('r_cns_510_2016');
  if (D[d]?.diretriz) ids.push(D[d].diretriz);
  if (testesIds.length) ids.push('r_r_core');
  return [...new Set(ids)].filter((id) => R[id]);
}
