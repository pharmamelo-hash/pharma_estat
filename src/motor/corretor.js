// Corretor do projeto (F20): regras sobre o TEXTO do projeto. Cada achado traz o porquê (tutor),
// a correção proposta e, quando precisa, uma pergunta. Nada é aplicado sem o OK do usuário.
import modelos from '../../base/modelos-projeto.json';
import testes from '../../base/testes.json';
import { temSecao, textoDe, norm, extrairSinais } from './leitor-projeto.js';
import {
  textoDesenho, textoAmostra, textoAnalise, fraseTeste, textoEtica, textoRiscos, textoCriterios, textoDesfechos,
  textoDiretriz, textoCronograma, textoOrcamento, FRASES, refsDoTexto, citacaoRef, nomeDesenho,
  PRECISA_AMOSTRA, COM_SEGUIMENTO, ECR, precisaEtica, usaRegistros,
} from './modelos-texto.js';

const OBS_ANALITICOS = ['d_transversal_analitico', 'd_caso_controle', 'd_coorte_prospectiva', 'd_coorte_retrospectiva'];
const ANALITICOS = [...OBS_ANALITICOS, ...ECR, 'd_quase_antes_depois', 'd_serie_temporal_interrompida', 'd_acuracia_diagnostica', 'd_modelo_predicao'];
const PARAMETRICOS = ['t_t_welch', 't_t_pareado', 't_anova_um_fator', 't_welch_anova', 't_anova_medidas_repetidas', 't_pearson', 't_regressao_linear'];
const OPCOES_TESTE = testes.testes.filter((t) => t.objetivo !== 'pressuposto').map((t) => [t.id, t.nome]);
const ORDEM_GRAV = { alta: 0, media: 1, baixa: 2, info: 3 };

const PERGUNTA_ALFA = { campo: 'alfa', rotulo: 'Nível de significância (α, em %)', tipo: 'numero', padrao: 5 };
const PERGUNTA_PODER = { campo: 'poder', rotulo: 'Poder (%)', tipo: 'numero', padrao: 80 };
const pct = (v, padrao) => { const n = Number(String(v ?? '').replace(',', '.')); return Number.isFinite(n) && n > 0 ? (n > 1 ? n / 100 : n) : padrao; };

/**
 * Analisa o documento. ctx = { desenho, modelo: 'cep'|'abnt', textoAmostraSalvo? }.
 * Devolve { sinais, achados }.
 */
export function corrigirProjeto(doc, ctx = {}) {
  const s = extrairSinais(doc);
  const d = ctx.desenho || null;
  const modelo = ctx.modelo || 'cep';
  const A = [];
  const add = (a) => A.push({ refs: [], ...a });
  const analitico = ANALITICOS.includes(d);
  const testesReais = s.testes.filter((t) => !['t_shapiro_wilk', 't_levene'].includes(t));

  // ---------- Estrutura ----------
  if (!temSecao(doc, 'objetivos')) add({ id: 'tx_objetivos', gravidade: 'alta', titulo: 'Seção de objetivos não encontrada',
    porque: 'O objetivo primário é a âncora do projeto: dele saem o desenho, o desfecho principal, o cálculo amostral e o teste estatístico.',
    correcao: { acao: 'secao', alvo: 'objetivos', gerar: () => 'Objetivo primário: [verbo no infinitivo + desfecho principal + população; ex.: comparar a mortalidade em 30 dias entre infusão estendida e intermitente de meropeném em pacientes críticos].\nObjetivos secundários: [até 3 a 5, cada um ligado a um desfecho secundário].' } });

  // ---------- Desenho ----------
  if (!d) {
    add({ id: 'tx_desenho_indefinido', gravidade: 'alta', titulo: 'Tipo de estudo não definido',
      porque: 'Sem o desenho não dá para saber qual medida de associação usar, quais testes cabem nem qual diretriz de relato seguir.',
      refs: ['r_grimes_2002_overview'],
      correcao: { acao: 'acrescentar', alvo: 'desenho', pergunta: [{ campo: 'desenho', rotulo: 'Qual é o desenho?', tipo: 'desenho' }], gerar: (r) => textoDesenho(r.desenho) } });
  } else {
    if (s.desenhos.length && !s.desenhos.includes(d)) add({ id: 'tx_desenho_divergente', gravidade: 'alta',
      titulo: `O texto descreve "${nomeDesenho(s.desenhos[0])}", mas você confirmou "${nomeDesenho(d)}"`,
      porque: 'O desenho escrito no projeto precisa ser o mesmo que guia a análise; a banca e o CEP leem o texto.',
      correcao: { acao: 'acrescentar', alvo: 'desenho', gerar: () => textoDesenho(d), nota: 'Depois de aplicar, apague no arquivo a menção ao desenho antigo.' } });
    else if (!s.desenhos.length) add({ id: 'tx_desenho_sem_nome', gravidade: 'media', titulo: 'O desenho não está nomeado no texto',
      porque: 'Nomear o desenho (e justificar) é o primeiro item do método em todas as diretrizes de relato.',
      correcao: { acao: 'acrescentar', alvo: 'desenho', gerar: () => textoDesenho(d) } });
  }
  if (d === 'd_caso_controle' && s.medidas.includes('rr')) add({ id: 'tx_cc_rr', gravidade: 'alta', titulo: 'Caso-controle com "risco relativo"',
    porque: 'No caso-controle você escolhe quantos casos e controles entram, então o risco (incidência) não pode ser calculado. A medida correta é a odds ratio (OR).',
    refs: ['r_schulz_2002_casocontrole'],
    correcao: { acao: 'trocar', trocas: [[/risco relativo/gi, 'odds ratio'], [/\bRR\b/g, 'OR']] } });
  if (d?.startsWith('d_transversal') && (s.medidas.includes('rr') || s.medidas.includes('incidencia'))) add({ id: 'tx_transv_rr', gravidade: 'alta', titulo: 'Estudo transversal com risco relativo ou incidência',
    porque: 'O transversal mede exposição e desfecho no mesmo momento: estima prevalência, não incidência. A medida é a razão de prevalência (RP).',
    correcao: { acao: 'trocar', trocas: [[/risco relativo/gi, 'razão de prevalência'], [/\bincid[eê]ncia\b/gi, 'prevalência'], [/\bRR\b/g, 'RP']] } });
  if (['d_relato_caso', 'd_serie_casos'].includes(d) && s.associacao) add({ id: 'tx_descritivo_associacao', gravidade: 'media', titulo: 'Estudo descritivo com objetivo de associação',
    porque: 'Relato e série de casos não têm grupo de comparação: descrevem, mas não testam associação. Reescreva o objetivo como descrição ou mude o desenho.', correcao: null });
  if (d === 'd_qualitativo') add({ id: 'tx_qualitativo', gravidade: 'info', titulo: 'Estudo qualitativo',
    porque: 'O Pharma_estat cobre métodos quantitativos. Para o qualitativo, confira o método de análise (ex.: análise de conteúdo) e a diretriz COREQ.', refs: ['r_coreq_2007'], correcao: null });

  // ---------- Critérios e desfecho ----------
  if (d && precisaEtica(d) && (!s.inclusao || !s.exclusao)) add({ id: 'tx_criterios', gravidade: 'media',
    titulo: !s.inclusao && !s.exclusao ? 'Critérios de inclusão e exclusão ausentes' : `Faltam os critérios de ${!s.inclusao ? 'inclusão' : 'exclusão'}`,
    porque: 'Critérios verificáveis definem a população e permitem que outro pesquisador reproduza a seleção.',
    correcao: { acao: 'acrescentar', alvo: 'criterios', gerar: () => (!s.inclusao && !s.exclusao ? textoCriterios() : textoCriterios().split('\n')[s.inclusao ? 1 : 0]) } });
  if (analitico && !s.desfechoPrimario) add({ id: 'tx_desfecho', gravidade: 'media', titulo: 'Desfecho primário não declarado',
    porque: 'Um único desfecho principal, definido antes da coleta, evita "pescar" resultados e é a base do cálculo amostral.',
    correcao: { acao: 'acrescentar', alvo: 'variaveis', gerar: () => textoDesfechos() } });

  // ---------- Amostra ----------
  const precisaN = PRECISA_AMOSTRA.includes(d);
  if (precisaN && !s.temCalculo && !s.censo) add({ id: 'tx_sem_amostra', gravidade: 'alta', titulo: 'Sem cálculo do tamanho amostral',
    porque: 'Sem o cálculo não se sabe se o estudo tem poder para detectar o efeito: um resultado "não significativo" pode ser só falta de participantes. O CEP também costuma pedir.',
    refs: ['r_chow_2017', 'r_hulley_2013'],
    correcao: { acao: 'acrescentar', alvo: 'amostra', gerar: () => textoAmostra(ctx.textoAmostraSalvo, d),
      nota: ctx.textoAmostraSalvo ? 'Texto vindo do cálculo salvo no seu projeto.' : 'Calcule em "Amostra e poder" e substitua os colchetes (ou salve o cálculo no projeto e analise de novo).' } });
  if (precisaN && s.censo && !s.temCalculo) add({ id: 'tx_censo', gravidade: 'media', titulo: 'Amostra por censo ou conveniência sem poder estimado',
    porque: 'Incluir todos do período é legítimo, mas mostre o poder que esse n garante para o efeito esperado; senão um resultado negativo fica sem interpretação.',
    correcao: { acao: 'acrescentar', alvo: 'amostra', gerar: () => 'Por se tratar de amostra por censo do período, estima-se incluir [n] participantes; com esse número, o estudo terá poder de [x]% para detectar [efeito esperado], com nível de significância de 5% (calculado no Pharma_estat, modo "Poder do estudo").' } });
  if (precisaN && s.temCalculo && !s.censo) {
    if (s.alfa === null || s.poder === null) add({ id: 'tx_alfa_poder', gravidade: 'media', titulo: 'Cálculo amostral sem α ou poder declarados',
      porque: 'Sem α e poder o cálculo não pode ser conferido. O usual é α = 5% (bilateral) e poder de 80% ou 90%.',
      correcao: { acao: 'acrescentar', alvo: 'amostra', pergunta: [PERGUNTA_ALFA, PERGUNTA_PODER], gerar: (r) => FRASES.alfaPoder(pct(r.alfa, 0.05), pct(r.poder, 0.8)) } });
    if (!s.fonteEfeito) add({ id: 'tx_fonte_efeito', gravidade: 'media', titulo: 'Efeito esperado sem fonte',
      porque: 'O efeito usado no cálculo precisa vir de estudo prévio, piloto ou da diferença mínima clinicamente importante, com referência.',
      correcao: { acao: 'acrescentar', alvo: 'amostra', gerar: () => FRASES.fonteEfeito } });
    if (COM_SEGUIMENTO.includes(d) && !s.mencionaPerdas) add({ id: 'tx_perdas', gravidade: 'media', titulo: 'Perdas de seguimento não previstas',
      porque: 'Em estudos com seguimento, parte dos participantes se perde. Sem acréscimo, o n final fica abaixo do calculado e o poder cai.',
      correcao: { acao: 'acrescentar', alvo: 'amostra', pergunta: [{ campo: 'perdas', rotulo: 'Perdas previstas (%)', tipo: 'numero', padrao: 10 }], gerar: (r) => FRASES.perdas(pct(r.perdas, 0.1)) } });
  }

  // ---------- Análise estatística ----------
  const temAnalise = temSecao(doc, 'analise') || testesReais.length > 0;
  if (!temAnalise && (analitico || precisaN)) {
    add({ id: 'tx_sem_analise', gravidade: 'alta', titulo: 'Seção de análise estatística ausente',
      porque: 'A análise precisa ser definida antes da coleta: descritiva, normalidade, teste principal, significância, efeito com IC 95% e software.',
      correcao: { acao: 'secao', alvo: 'analise', pergunta: [{ campo: 'teste', rotulo: 'Teste principal (use "Qual teste usar?" se tiver dúvida)', tipo: 'teste' }],
        gerar: (r) => textoAnalise({ testesIds: r.teste ? [r.teste] : [], grupos3: ['t_anova_um_fator', 't_welch_anova', 't_kruskal_wallis'].includes(r.teste), ajuste: OBS_ANALITICOS.includes(d), software: 'R' }) } });
  } else if (temAnalise) {
    if (!testesReais.length && (analitico || precisaN)) add({ id: 'tx_sem_teste', gravidade: 'alta', titulo: 'Nenhum teste estatístico nomeado',
      porque: 'Escrever só "os dados serão analisados estatisticamente" não basta: o teste depende do tipo de desfecho, do número de grupos e do pareamento.',
      correcao: { acao: 'acrescentar', alvo: 'analise', pergunta: [{ campo: 'teste', rotulo: 'Teste principal', tipo: 'teste' }], gerar: (r) => fraseTeste(r.teste) || '[Indicar o teste principal.]' } });
    if (testesReais.some((t) => PARAMETRICOS.includes(t)) && !s.normalidade) add({ id: 'tx_normalidade', gravidade: 'media', titulo: 'Teste paramétrico sem verificação de normalidade',
      porque: `O ${testesReais.filter((t) => PARAMETRICOS.includes(t)).map((t) => testes.testes.find((x) => x.id === t)?.nome).join(', ')} supõe distribuição aproximadamente normal. Diga como isso será verificado e qual a alternativa.`,
      refs: ['r_field_2012'],
      correcao: { acao: 'acrescentar', alvo: 'analise', gerar: () => FRASES.normalidade } });
    if (!s.significancia) add({ id: 'tx_significancia', gravidade: 'media', titulo: 'Nível de significância não informado',
      porque: 'O leitor precisa saber o limiar usado para decidir (geralmente 5%, bilateral).',
      correcao: { acao: 'acrescentar', alvo: 'analise', pergunta: [PERGUNTA_ALFA], gerar: (r) => FRASES.significancia(pct(r.alfa, 0.05)) } });
    if (!s.efeitoIC) add({ id: 'tx_efeito_ic', gravidade: 'media', titulo: 'Sem medida de efeito com intervalo de confiança',
      porque: 'O valor-p diz se há diferença; a medida de efeito com IC 95% diz quanto e com que precisão. As diretrizes de relato exigem as duas.', refs: ['r_wasserstein_2016'],
      correcao: { acao: 'acrescentar', alvo: 'analise', gerar: () => FRASES.efeitoIC } });
    if (!s.software) add({ id: 'tx_software', gravidade: 'baixa', titulo: 'Software estatístico não informado',
      porque: 'Informar o software (e a versão) permite reproduzir a análise.', refs: ['r_r_core'],
      correcao: { acao: 'acrescentar', alvo: 'analise', pergunta: [{ campo: 'software', rotulo: 'Software', tipo: 'select', opcoes: [['R', 'R, pelo Pharma_estat'], ['SPSS (IBM)', 'SPSS'], ['Stata (StataCorp)', 'Stata'], ['Jamovi', 'Jamovi'], ['JASP', 'JASP'], ['GraphPad Prism', 'GraphPad Prism']], padrao: 'R' }], gerar: (r) => FRASES.software(r.software || 'R') } });
    if (s.grupos3 && !s.multiplas) add({ id: 'tx_multiplas', gravidade: 'media', titulo: 'Três ou mais grupos sem plano de comparações múltiplas',
      porque: 'Depois de uma ANOVA ou Kruskal-Wallis significativa, comparar os grupos dois a dois sem ajuste infla o erro tipo I.',
      correcao: { acao: 'acrescentar', alvo: 'analise', gerar: () => FRASES.multiplas } });
    if (OBS_ANALITICOS.includes(d) && !s.listaConfundidores) add({ id: 'tx_confundidores', gravidade: 'media', titulo: 'Confundidores não descritos',
      porque: 'Em estudo observacional, grupos diferem em mais do que a exposição. Liste as variáveis de ajuste e o critério de escolha.', refs: ['r_peduzzi_1996'],
      correcao: { acao: 'acrescentar', alvo: 'analise', gerar: () => FRASES.confundidores } });
    if (usaRegistros(d) && !s.faltantes) add({ id: 'tx_faltantes', gravidade: 'baixa', titulo: 'Sem plano para dados faltantes',
      porque: 'Prontuários quase sempre têm lacunas. Diga como serão tratadas para evitar viés.',
      correcao: { acao: 'acrescentar', alvo: 'analise', gerar: () => FRASES.faltantes } });
  }

  // ---------- Ensaio clínico ----------
  if (ECR.includes(d)) {
    if (!s.randomizacao) add({ id: 'tx_randomizacao', gravidade: 'alta', titulo: 'Geração da sequência de randomização não descrita', porque: 'É o que distingue o ensaio randomizado e protege contra viés de seleção.', refs: ['r_consort_2025'], correcao: { acao: 'acrescentar', alvo: 'coleta', gerar: () => FRASES.randomizacao } });
    if (!s.ocultacao) add({ id: 'tx_ocultacao', gravidade: 'alta', titulo: 'Ocultação da alocação não descrita', porque: 'Sem ocultação, quem recruta pode prever o grupo e escolher quem entra, desfazendo a randomização.', refs: ['r_consort_2025'], correcao: { acao: 'acrescentar', alvo: 'coleta', gerar: () => FRASES.ocultacao } });
    if (!s.cegamento) add({ id: 'tx_cegamento', gravidade: 'media', titulo: 'Cegamento não descrito', porque: 'Informe quem fica cego; se não for possível, avaliação independente do desfecho reduz viés.', refs: ['r_consort_2025'], correcao: { acao: 'acrescentar', alvo: 'coleta', gerar: () => FRASES.cegamento } });
    if (!s.itt) add({ id: 'tx_itt', gravidade: 'media', titulo: 'Sem análise por intenção de tratar', porque: 'Analisar cada participante no grupo sorteado preserva a comparabilidade criada pela randomização.', refs: ['r_consort_2025'], correcao: { acao: 'acrescentar', alvo: 'analise', gerar: () => FRASES.itt } });
  }

  // ---------- Ética ----------
  if (d && precisaEtica(d)) {
    const registros = s.registros || usaRegistros(d);
    if (!temSecao(doc, 'etica') && !s.res466 && !s.tcle && !s.dispensa) {
      add({ id: 'tx_etica', gravidade: 'alta', titulo: 'Aspectos éticos ausentes', porque: 'Pesquisa com seres humanos (inclusive prontuários) precisa de aprovação do CEP antes da coleta, conforme a Resolução CNS 466/2012.', refs: ['r_cns_466_2012'],
        correcao: { acao: 'secao', alvo: 'etica', gerar: () => textoEtica({ d, criancas: s.criancas, registros }) } });
    } else {
      if (!s.res466 && !s.res510) add({ id: 'tx_466', gravidade: 'alta', titulo: 'Resolução CNS 466/2012 não citada', porque: 'É a norma que rege a pesquisa com seres humanos no Brasil; o CEP confere.', refs: ['r_cns_466_2012'], correcao: { acao: 'acrescentar', alvo: 'etica', gerar: () => textoEtica({ d, registros }).split('\n')[0] } });
      if (!s.tcle && !s.dispensa) add({ id: 'tx_tcle', gravidade: 'alta', titulo: registros ? 'Sem pedido de dispensa do TCLE' : 'TCLE não mencionado', porque: registros ? 'Mesmo usando só prontuários, é preciso pedir ao CEP a dispensa do TCLE, com justificativa, e assinar o termo de uso dos dados (TCUD).' : 'O consentimento livre e esclarecido é obrigatório para participantes contatados diretamente.', refs: ['r_cns_466_2012'],
        correcao: { acao: 'acrescentar', alvo: 'etica', gerar: () => textoEtica({ d, registros }).split('\n')[1] } });
      else if (registros && s.dispensa && !s.tcud) add({ id: 'tx_tcud', gravidade: 'baixa', titulo: 'Dispensa de TCLE sem termo de uso dos dados', porque: 'Com a dispensa, a maioria dos CEP pede o Termo de Compromisso de Utilização de Dados (TCUD) assinado pelos pesquisadores.', correcao: { acao: 'acrescentar', alvo: 'etica', gerar: () => 'Os pesquisadores assinarão o Termo de Compromisso de Utilização de Dados (TCUD), comprometendo-se com o sigilo e o uso exclusivo das informações para este estudo.' } });
      if (s.criancas && !s.tale && !registros) add({ id: 'tx_tale', gravidade: 'alta', titulo: 'Participantes menores de idade sem TALE', porque: 'Crianças e adolescentes que podem compreender devem assentir (TALE), além do TCLE do responsável.', refs: ['r_cns_466_2012'], correcao: { acao: 'acrescentar', alvo: 'etica', gerar: () => 'Para participantes menores de 18 anos, o TCLE será assinado pelo responsável legal e será aplicado o Termo de Assentimento Livre e Esclarecido (TALE), em linguagem adequada à idade.' } });
      if (!s.lgpd) add({ id: 'tx_lgpd', gravidade: 'media', titulo: s.sigilo ? 'Sigilo descrito sem citar a LGPD' : 'Proteção dos dados não descrita', porque: 'Dados de saúde são dados pessoais sensíveis (Lei 13.709/2018): descreva codificação, acesso restrito e uso exclusivo.', refs: ['r_lgpd_2018'], correcao: { acao: 'acrescentar', alvo: 'etica', gerar: () => textoEtica({ d, registros }).split('\n').at(-1) } });
    }
    if (modelo === 'cep' && !(s.riscos && s.beneficios)) add({ id: 'tx_riscos', gravidade: 'alta', titulo: 'Riscos e benefícios não descritos', porque: 'A Plataforma Brasil tem campo obrigatório de riscos e benefícios. Todo estudo tem algum risco; no mínimo, o de quebra de sigilo.', refs: ['r_cns_466_2012'],
      correcao: { acao: 'secao', alvo: 'riscos', gerar: () => textoRiscos({ d: registros ? 'd_coorte_retrospectiva' : d }) } });
  }

  // ---------- Relato, cronograma, orçamento ----------
  const dir = textoDiretriz(d);
  if (dir && !s.diretriz) add({ id: 'tx_diretriz', gravidade: 'baixa', titulo: 'Diretriz de relato não indicada', porque: 'Seguir a diretriz do desenho (rede EQUATOR) garante que nada essencial falte no artigo.', correcao: { acao: 'acrescentar', alvo: 'desenho', gerar: () => dir } });
  if (!temSecao(doc, 'cronograma')) add({ id: 'tx_cronograma', gravidade: modelo === 'cep' ? 'media' : 'baixa', titulo: 'Cronograma ausente', porque: 'O CEP e a banca conferem se a coleta começa só depois da aprovação ética.', correcao: { acao: 'secao', alvo: 'cronograma', gerar: () => textoCronograma() } });
  if (!temSecao(doc, 'orcamento')) add({ id: 'tx_orcamento', gravidade: modelo === 'cep' ? 'media' : 'baixa', titulo: 'Orçamento ausente', porque: 'É campo obrigatório na Plataforma Brasil, mesmo quando o custo é coberto pelo pesquisador.', correcao: { acao: 'secao', alvo: 'orcamento', gerar: () => textoOrcamento() } });

  // ---------- Referências das normas e diretrizes citadas ----------
  const refsTexto = norm(textoDe(doc, ['referencias']));
  const chaveRef = (id) => norm((citacaoRef(id) || '').match(/\b(466|510|13\.709|STROBE|RECORD|CONSORT|STARD|PRISMA|TRIPOD|CARE|COREQ|TREND|COSMIN|R Core)\b/)?.[0] || citacaoRef(id)?.slice(0, 20));
  const faltam = refsDoTexto({ d, testesIds: ['x'] }).filter((id) => !refsTexto.includes(chaveRef(id)));
  if (faltam.length) add({ id: 'tx_referencias', gravidade: 'baixa', titulo: `${faltam.length} referência${faltam.length > 1 ? 's' : ''} de normas e diretrizes a acrescentar`, porque: 'Tudo o que é citado no método (resolução, LGPD, diretriz de relato, software) precisa estar nas referências.',
    correcao: { acao: temSecao(doc, 'referencias') ? 'acrescentar' : 'secao', alvo: 'referencias', gerar: () => faltam.map(citacaoRef).join('\n'), nota: 'Em formato Vancouver; ajuste se o seu programa usa ABNT.' } });

  A.sort((a, b) => ORDEM_GRAV[a.gravidade] - ORDEM_GRAV[b.gravidade]);
  return { sinais: s, achados: A };
}

// ---------- Aplicar correções ----------
const clonar = (doc) => ({ ...doc, preambulo: doc.preambulo.map((p) => ({ ...p })), secoes: doc.secoes.map((x) => ({ ...x, paragrafos: x.paragrafos.map((p) => ({ ...p })) })) });
let uidNovo = 0;

function posicaoNova(doc, chave, modelo) {
  const ordem = modelos.modelos[modelo]?.secoes.map((x) => x.id) || [];
  const alvo = ordem.indexOf(chave);
  let pos = -1;
  doc.secoes.forEach((sec, i) => { const o = ordem.indexOf(sec.chave); if (o !== -1 && o <= alvo) pos = i; });
  if (pos === -1) {
    const iRef = doc.secoes.findIndex((x) => x.chave === 'referencias');
    return iRef === -1 ? doc.secoes.length : iRef;
  }
  // Pula as subseções sem chave que seguem a seção escolhida (pertencem a ela).
  let i = pos + 1;
  while (i < doc.secoes.length && !doc.secoes[i].chave && doc.secoes[i].nivel > 1) i += 1;
  return i;
}
function secaoModelo(chave, modelo) {
  const m = modelos.modelos[modelo]?.secoes.find((x) => x.id === chave) || modelos.modelos.cep.secoes.find((x) => x.id === chave);
  return { titulo: m?.titulo || chave, nivel: m?.nivel || 1 };
}

/** Aplica um achado ao documento e devolve um NOVO documento (o original não muda). */
export function aplicarCorrecao(doc, achado, respostas = {}, modelo = 'cep') {
  const c = achado.correcao;
  if (!c) return doc;
  const novo = clonar(doc);
  if (c.acao === 'trocar') {
    for (const sec of [{ paragrafos: novo.preambulo }, ...novo.secoes]) for (const p of sec.paragrafos) {
      let t = p.texto;
      for (const [re, para] of c.trocas) t = t.replace(re, para);
      if (t !== p.texto) { p.texto = t; p.marca = 'alterado'; }
    }
    return novo;
  }
  const paragrafos = String(c.gerar(respostas) || '').split('\n').map((t) => t.trim()).filter(Boolean).map((texto) => ({ texto, marca: 'novo' }));
  if (!paragrafos.length) return novo;
  const existentes = novo.secoes.filter((x) => x.chave === c.alvo);
  if (existentes.length && c.acao !== 'secao') existentes.at(-1).paragrafos.push(...paragrafos);
  else if (existentes.length) existentes.at(-1).paragrafos.push(...paragrafos);
  else {
    const { titulo, nivel } = secaoModelo(c.alvo, modelo);
    novo.secoes.splice(posicaoNova(novo, c.alvo, modelo), 0, { uid: `n${++uidNovo}`, chave: c.alvo, titulo, nivel, paragrafos, nova: true });
  }
  return novo;
}

/** Valores-padrão das perguntas de um achado. */
export function respostasPadrao(achado, ctx = {}) {
  const r = {};
  for (const q of achado.correcao?.pergunta || []) r[q.campo] = q.tipo === 'desenho' ? (ctx.desenho || '') : q.tipo === 'teste' ? (ctx.teste || '') : q.padrao ?? '';
  return r;
}
export { OPCOES_TESTE };
