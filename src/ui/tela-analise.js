// Análise dos dados com R (F5) e relatório (F6).
import { blocoCitar } from './citar.js';
import { el, cabecalhoTela, aviso, semaforo, numero, valorP, textoP, blocoCodigo, botaoBaixar } from './componentes.js';
import { BASE, TESTES, DESENHOS } from '../base.js';
import { dadosAtuais, colunasParaR, niveis } from '../estado/dados.js';
import { projetoAtual } from '../estado/projeto.js';
import { carregarR, analisar, estadoR } from '../r/motor-r.js';
import { NOME_APP, VERSAO_APP, VERSAO_BASE } from '../config.js';
import * as G from './graficos.js';

const finito = (v) => typeof v === 'number' && Number.isFinite(v);
function retaMinimosQuadrados(xs, ys) {
  const p = xs.map((x, i) => [x, ys[i]]).filter(([a, b]) => finito(a) && finito(b));
  const mx = p.reduce((s, [a]) => s + a, 0) / p.length, my = p.reduce((s, [, b]) => s + b, 0) / p.length;
  const b = p.reduce((s, [a, c]) => s + (a - mx) * (c - my), 0) / p.reduce((s, [a]) => s + (a - mx) ** 2, 0);
  return { a: my - b * mx, b };
}
/** Gráfico do resultado, desenhado no navegador a partir das colunas que estão na memória. */
function graficoPara(r) {
  const conj = dadosAtuais();
  const p = r.papeis; const t = TIPO_ANALISE[r.pedido];
  try {
    const col = (n) => colunasParaR(conj, [n])[n];
    switch (t) {
      case 'dois_grupos': case 'varios': {
        const y = col(p.y), g = col(p.g);
        const niv = [...new Set(g.filter((v) => v !== null))].sort((a, b) => String(a).localeCompare(String(b), 'pt-BR', { numeric: true }));
        return G.boxplot(niv.map((n) => ({ rotulo: String(n), valores: y.filter((v, i) => g[i] === n && finito(v)) })), p.g, p.y);
      }
      case 'pareado': { const a = col(p.y), b = col(p.y2); return G.linhasPareadas(a.map((v, i) => [v, b[i]]).filter((s) => s.every(finito)), [p.y, p.y2], 'Valor'); }
      case 'friedman': { const cs = p.medidas.map(col); return G.linhasPareadas(cs[0].map((_, i) => cs.map((c) => c[i])).filter((s) => s.every(finito)), p.medidas, 'Valor'); }
      case 'categoricas': return r.tabela?.percentuais_linha ? G.barras(r.tabela.linhas, r.tabela.colunas, r.tabela.percentuais_linha, p.g, p.y) : null;
      case 'correlacao': { const x = col(p.x), y = col(p.y); return G.dispersao(x, y, p.x, p.y, { reta: retaMinimosQuadrados(x, y) }); }
      case 'linear': return r.dados_grafico ? G.dispersao(r.dados_grafico.ajustados, r.dados_grafico.residuos, 'Valores ajustados', 'Resíduos', { horizontais: [{ y: 0, tracejado: true }] }) : null;
      case 'logistica': return G.floresta(r.resultados[0].coeficientes || []);
      case 'bland': {
        const a = col(p.y), b = col(p.y2); const ok = a.map((v, i) => finito(v) && finito(b[i]));
        const media = a.map((v, i) => (ok[i] ? (v + b[i]) / 2 : null)), dif = a.map((v, i) => (ok[i] ? v - b[i] : null));
        const res = r.resultados[0];
        return G.dispersao(media, dif, 'Média dos dois métodos', `Diferença (${p.y} − ${p.y2})`, { horizontais: [
          { y: res.efeito.valor, rotulo: 'viés médio' },
          { y: res.limites.inferior, tracejado: true, cor: 'var(--erro)', rotulo: 'limite inferior' },
          { y: res.limites.superior, tracejado: true, cor: 'var(--erro)', rotulo: 'limite superior' }] });
      }
      case 'acuracia': return r.dados_grafico ? G.roc(r.dados_grafico.fpr, r.dados_grafico.tpr) : null;
      default: return null;
    }
  } catch (e) { console.warn('Gráfico indisponível', e); return null; }
}

// ---------- Papéis de cada análise ----------
const QN = ['quantitativo', 'ordinal'];
const CT = ['categorico', 'ordinal'];
const TODOS = ['quantitativo', 'categorico', 'ordinal'];
const P = {
  dois_grupos: [{ id: 'y', rotulo: 'Desfecho', tipos: QN }, { id: 'g', rotulo: 'Grupo (2 categorias)', tipos: CT }],
  pareado: [{ id: 'y', rotulo: 'Primeira medida (antes)', tipos: QN }, { id: 'y2', rotulo: 'Segunda medida (depois)', tipos: QN }],
  varios: [{ id: 'y', rotulo: 'Desfecho', tipos: QN }, { id: 'g', rotulo: 'Grupo (3 ou mais categorias)', tipos: CT }],
  friedman: [{ id: 'medidas', rotulo: 'Medidas em cada momento (3 ou mais colunas)', tipos: QN, multiplo: true }],
  categoricas: [{ id: 'g', rotulo: 'Exposição / grupo', tipos: CT, nivel: { id: 'nivel_exposto', rotulo: 'Categoria "exposto"' } }, { id: 'y', rotulo: 'Desfecho', tipos: CT, nivel: { id: 'nivel_evento', rotulo: 'Categoria do evento' } }],
  mcnemar: [{ id: 'y', rotulo: 'Desfecho no 1º momento', tipos: CT, nivel: { id: 'nivel_evento', rotulo: 'Categoria do evento' } }, { id: 'y2', rotulo: 'Desfecho no 2º momento', tipos: CT }],
  correlacao: [{ id: 'x', rotulo: 'Variável X', tipos: QN }, { id: 'y', rotulo: 'Variável Y', tipos: QN }],
  linear: [{ id: 'y', rotulo: 'Desfecho (quantitativo)', tipos: ['quantitativo'] }, { id: 'x', rotulo: 'Variáveis explicativas', tipos: TODOS, multiplo: true }],
  logistica: [{ id: 'y', rotulo: 'Desfecho (2 categorias)', tipos: CT, nivel: { id: 'nivel_evento', rotulo: 'Categoria do evento' } }, { id: 'x', rotulo: 'Variáveis explicativas', tipos: TODOS, multiplo: true }],
  kappa: [{ id: 'y', rotulo: 'Avaliador 1', tipos: CT }, { id: 'y2', rotulo: 'Avaliador 2', tipos: CT }],
  bland: [{ id: 'y', rotulo: 'Método A', tipos: ['quantitativo'] }, { id: 'y2', rotulo: 'Método B', tipos: ['quantitativo'] }],
  acuracia: [{ id: 'y', rotulo: 'Padrão de referência', tipos: CT, nivel: { id: 'nivel_evento', rotulo: 'Categoria "doente"' } }, { id: 'g', rotulo: 'Teste avaliado (binário ou quantitativo)', tipos: TODOS, nivel: { id: 'nivel_teste_positivo', rotulo: 'Resultado "positivo" do teste', soCategorico: true } }],
};
const TIPO_ANALISE = {
  t_t_welch: 'dois_grupos', t_mann_whitney: 'dois_grupos', t_t_pareado: 'pareado', t_wilcoxon_pareado: 'pareado',
  t_anova_um_fator: 'varios', t_welch_anova: 'varios', t_kruskal_wallis: 'varios', t_friedman: 'friedman',
  t_qui_quadrado: 'categoricas', t_fisher_exato: 'categoricas', t_mcnemar: 'mcnemar',
  t_pearson: 'correlacao', t_spearman: 'correlacao', t_regressao_linear: 'linear', t_regressao_logistica: 'logistica',
  t_kappa: 'kappa', t_bland_altman: 'bland', t_acuracia_roc: 'acuracia',
};

const ROTULO_TIPO = { quantitativo: 'quantitativo', categorico: 'categórico', ordinal: 'ordinal' };
let selecao = { teste: null, papeis: {} };
let ultimo = null; // último resultado (só na memória) para o relatório
export const ultimoResultado = () => ultimo;
export function definirUltimo(r) { ultimo = r; }

// ---------- Tela de análise ----------
export function telaAnalise() {
  const conj = dadosAtuais();
  if (!conj) {
    return [cabecalhoTela('Análise', null, ['Analisar', 'Resultado']),
      aviso('Nenhuma planilha carregada nesta sessão. Os dados não ficam salvos: importe de novo para analisar.', 'info'),
      el('a', { class: 'botao', href: '#/analisar/dados' }, 'Importar planilha')];
  }
  const disponiveis = BASE.testes.testes.filter((t) => t.analise_no_app && TIPO_ANALISE[t.id]);
  if (!selecao.teste) {
    const doProjeto = projetoAtual()?.teste?.id;
    selecao.teste = TIPO_ANALISE[doProjeto] ? doProjeto : disponiveis[0].id;
  }
  const colunas = conj.colunas.filter((c) => c.incluir);
  const formArea = el('div');
  const saida = el('div', { 'aria-live': 'polite' });

  const desenharForm = () => {
    const tipo = TIPO_ANALISE[selecao.teste];
    const seletorTeste = el('select', { id: 'sel-teste', onchange: (e) => { selecao = { teste: e.target.value, papeis: {} }; desenharForm(); } },
      Object.entries(BASE.testes.objetivos).filter(([o]) => o !== 'pressuposto').map(([o, nome]) =>
        el('optgroup', { label: nome }, disponiveis.filter((t) => t.objetivo === o).map((t) => el('option', { value: t.id, selected: t.id === selecao.teste }, t.nome)))));
    const campos = P[tipo].map((papel) => {
      const opcoes = colunas.filter((c) => papel.tipos.includes(c.tipo));
      let controle;
      if (papel.multiplo) {
        const marcados = new Set(selecao.papeis[papel.id] || []);
        controle = el('div', { class: 'lista-marcar' }, opcoes.length ? opcoes.map((c) => el('label', {},
          el('input', { type: 'checkbox', checked: marcados.has(c.nome), onchange: (e) => {
            const s = new Set(selecao.papeis[papel.id] || []); if (e.target.checked) s.add(c.nome); else s.delete(c.nome);
            selecao.papeis[papel.id] = [...s];
          } }), ` ${c.nome}`)) : el('p', { class: 'texto-suave' }, 'Nenhuma coluna compatível.'));
      } else {
        controle = el('select', { id: `papel-${papel.id}`, onchange: (e) => { selecao.papeis[papel.id] = e.target.value; delete selecao.papeis[papel.nivel?.id]; desenharForm(); } },
          el('option', { value: '' }, '— escolha —'),
          opcoes.map((c) => el('option', { value: c.nome, selected: c.nome === selecao.papeis[papel.id] }, `${c.nome} (${ROTULO_TIPO[c.tipo]})`)));
      }
      let nivel = null;
      const col = colunas.find((c) => c.nome === selecao.papeis[papel.id]);
      if (papel.nivel && col && !(papel.nivel.soCategorico && col.tipo === 'quantitativo')) {
        const nv = niveis(conj, col.nome);
        nivel = el('div', { class: 'campo' }, el('label', { for: `nivel-${papel.nivel.id}` }, papel.nivel.rotulo),
          el('select', { id: `nivel-${papel.nivel.id}`, onchange: (e) => { selecao.papeis[papel.nivel.id] = e.target.value; } },
            nv.map((n, i) => el('option', { value: n, selected: (selecao.papeis[papel.nivel.id] ?? nv.at(-1)) === n }, n))));
        if (!selecao.papeis[papel.nivel.id]) selecao.papeis[papel.nivel.id] = nv.at(-1);
      }
      return el('div', { class: 'campo' }, el('label', { for: `papel-${papel.id}` }, papel.rotulo), controle, nivel);
    });
    formArea.replaceChildren(el('section', { class: 'cartao' },
      el('div', { class: 'campo' }, el('label', { for: 'sel-teste' }, 'Teste'), seletorTeste,
        el('small', { class: 'texto-suave' }, projetoAtual()?.teste?.id ? `Teste salvo no projeto: ${TESTES[projetoAtual().teste.id]?.nome}.` : 'Dica: use o assistente "Qual teste usar?" antes de analisar.')),
      el('div', { class: 'grade grade-2' }, campos),
      el('button', { class: 'botao', type: 'button', onclick: rodar }, estadoR() === 'pronto' ? 'Rodar análise' : 'Carregar o R e rodar')));
  };

  async function rodar() {
    const tipo = TIPO_ANALISE[selecao.teste];
    const faltando = P[tipo].filter((p) => (p.multiplo ? !(selecao.papeis[p.id]?.length) : !selecao.papeis[p.id]));
    if (faltando.length) { saida.replaceChildren(aviso(`Escolha: ${faltando.map((p) => p.rotulo).join(', ')}.`, 'erro')); return; }
    const nomes = [...new Set(P[tipo].flatMap((p) => [].concat(selecao.papeis[p.id])))];
    const papeis = { ...selecao.papeis, tipos: Object.fromEntries(nomes.map((n) => [n, colunas.find((c) => c.nome === n)?.tipo])) };
    saida.replaceChildren(el('div', { class: 'cartao carregando' },
      el('p', {}, estadoR() === 'pronto' ? 'Rodando a análise no R…' : 'Carregando o R no seu aparelho. Na primeira vez são cerca de 45 MB (use Wi-Fi); depois fica guardado e funciona offline.')));
    let versao;
    try {
      ({ versao } = await carregarR());
    } catch (e) {
      console.error(e);
      saida.replaceChildren(aviso(`O R não pôde ser carregado (${e?.message || e}). Verifique a conexão e tente de novo.`, 'erro'));
      return;
    }
    try {
      const r = await analisar(selecao.teste, colunasParaR(conj, nomes), papeis);
      if (!r.ok) { saida.replaceChildren(aviso(r.erro, 'erro', 'Não foi possível analisar:')); return; }
      ultimo = { ...r, pedido: selecao.teste, papeis, versaoR: versao, arquivo: conj.nomeArquivo, quando: new Date().toISOString() };
      saida.replaceChildren(...renderizarResultado(ultimo));
      desenharForm();
    } catch (e) {
      console.error(e);
      saida.replaceChildren(aviso(`Erro ao executar a análise${e?.message ? `: ${e.message}` : ''}. Recarregue a página e tente de novo.`, 'erro'));
    }
  }

  desenharForm();
  if (ultimo && ultimo.arquivo === conj.nomeArquivo) saida.replaceChildren(...renderizarResultado(ultimo));
  return [cabecalhoTela('Análise', 'Escolha o teste e as colunas. O R roda no seu aparelho.', ['Analisar', 'Resultado']), formArea, saida];
}

// ---------- Apresentação do resultado ----------
function linhaEfeito(ef) {
  if (!ef) return null;
  const ic = ef.li !== null && ef.li !== undefined ? ` (IC 95% ${numero(ef.li, 3)} a ${numero(ef.ls, 3)})` : '';
  return el('p', { class: 'efeito' }, el('strong', {}, `${ef.nome}: `), `${numero(ef.valor, 3)}${ic}`, ef.nota ? el('span', { class: 'texto-suave' }, ` — ${ef.nota}`) : null);
}
function tabelaSimples(cabecalho, linhas) {
  return el('div', { class: 'tabela-rolavel' }, el('table', { class: 'tabela' },
    el('thead', {}, el('tr', {}, cabecalho.map((h) => el('th', { scope: 'col' }, h)))),
    el('tbody', {}, linhas.map((l) => el('tr', {}, l.map((c, i) => (i === 0 ? el('th', { scope: 'row' }, c) : el('td', { class: 'num' }, c))))))));
}
function tabelaDescritivas(desc) {
  return tabelaSimples(['', 'n', 'Média (DP)', 'Mediana (IIQ)', 'Mín–máx'], desc.map((d) => [d.grupo, String(d.n),
    `${numero(d.media)} (${numero(d.dp)})`, `${numero(d.mediana)} (${numero(d.q1)}–${numero(d.q3)})`, `${numero(d.min)}–${numero(d.max)}`]));
}
function blocoResultado(res) {
  const est = res.estatistica !== null && res.estatistica !== undefined && res.nome_estatistica ? `${res.nome_estatistica} = ${numero(res.estatistica, 3)}${res.gl !== null && res.gl !== undefined && res.gl !== '' ? `; gl = ${typeof res.gl === 'number' ? numero(res.gl, Number.isInteger(res.gl) ? 0 : 2) : res.gl}` : ''}; ` : '';
  return el('div', { class: 'bloco-resultado' },
    el('p', {}, `${est}${textoP(res.p)}`),
    linhaEfeito(res.efeito),
    res.nota ? el('p', { class: 'texto-suave' }, res.nota) : null,
    res.medidas ? tabelaSimples(['Medida', 'Valor', 'IC 95%'], res.medidas.map((m) => [m.nome, `${numero(m.valor * 100, 1)}%`, m.li === null ? '—' : `${numero(m.li * 100, 1)}% a ${numero(m.ls * 100, 1)}%`])) : null,
    res.coeficientes ? tabelaSimples(['Termo', res.coeficientes[0]?.or !== undefined ? 'OR' : 'β', 'IC 95%', 'p'], res.coeficientes.map((c) => [c.termo, numero(c.or ?? c.beta, 3), `${numero(c.li, 3)} a ${numero(c.ls, 3)}`, valorP(c.p)])) : null,
    res.pares?.length ? el('details', {}, el('summary', {}, `Comparações par a par — ${res.nome_pares}`),
      tabelaSimples(['Par', ...(res.pares[0].diferenca !== undefined ? ['Diferença', 'IC 95%'] : []), 'p ajustado'],
        res.pares.map((x) => [x.par, ...(x.diferenca !== undefined ? [numero(x.diferenca, 3), `${numero(x.li, 3)} a ${numero(x.ls, 3)}`] : []), valorP(x.p)]))) : null);
}
function medidaPreferida() {
  const d = projetoAtual()?.desenho?.id;
  if (d === 'd_caso_controle') return 'or';
  return 'rr';
}
export function renderizarResultado(r) {
  const principal = r.resultados.find((x) => x.teste === r.principal) || r.resultados[0];
  const sugerido = r.resultados.find((x) => x.teste === r.sugerido);
  const outros = r.resultados.filter((x) => x !== principal);
  const d = projetoAtual()?.desenho?.id;
  const nodos = [
    el('section', { class: 'cartao ficha' },
      el('span', { class: 'etiqueta' }, `Resultado · n = ${r.n}`),
      el('h2', {}, principal.nome),
      sugerido && sugerido !== principal ? aviso(`Pelos pressupostos dos seus dados, o teste mais adequado é ${sugerido.nome}. O resultado dele está logo abaixo; justifique no trabalho qual foi usado.`, 'atencao', 'Atenção:') : null,
      el('h3', {}, 'Pressupostos'),
      semaforo(r.pressupostos),
      el('h3', {}, 'Resultado'),
      blocoResultado(principal),
      r.medidas_2x2 ? el('div', {},
        el('h3', {}, 'Medidas de associação (tabela 2×2)'),
        el('p', { class: 'texto-suave' }, `Exposto = "${r.nivel_exposto}"; evento = "${r.nivel_evento}". ${d ? `Para ${DESENHOS[d]?.nome.toLowerCase()}, a medida indicada é ${medidaPreferida() === 'or' ? 'a odds ratio' : (d.startsWith('d_transversal') ? 'a razão de prevalências' : 'o risco relativo')}.` : 'A medida indicada depende do desenho: OR no caso-controle, RP no transversal, RR na coorte e no ensaio.'}`),
        linhaEfeito(medidaPreferida() === 'or' ? r.medidas_2x2.or : r.medidas_2x2.rr),
        linhaEfeito(medidaPreferida() === 'or' ? r.medidas_2x2.rr : r.medidas_2x2.or),
        linhaEfeito(r.medidas_2x2.dif)) : null,
      r.tabela ? el('div', {}, el('h3', {}, 'Tabela'), tabelaSimples(['', ...r.tabela.colunas], r.tabela.linhas.map((l, i) => [l, ...r.tabela.contagens[i].map((c, j) => (r.tabela.percentuais_linha ? `${c} (${numero(r.tabela.percentuais_linha[i][j], 1)}%)` : String(c)))]))) : null,
      r.descritivas ? el('div', {}, el('h3', {}, 'Descritivas'), tabelaDescritivas(r.descritivas)) : null,
      (() => { const g = dadosAtuais() ? graficoPara(r) : null; return g ? [G.figuraInterativa(g), el('p', { class: 'texto-suave legenda' }, 'Toque num ponto ou numa caixa para ver o valor.')] : null; })(),
      r.alerta ? aviso(r.alerta, 'info') : null,
      el('p', { class: 'caixa-valor-p' }, 'Valor-p sozinho não basta: interprete a medida de efeito e o IC 95% e pergunte se a diferença é clinicamente relevante.'),
      el('div', { class: 'acoes' }, el('a', { class: 'botao', href: '#/analisar/relatorio' }, 'Gerar relatório e script R →'))),
  ];
  if (outros.length) nodos.push(el('details', { class: 'cartao' }, el('summary', {}, 'Outros testes calculados (para comparação)'),
    outros.map((o) => el('div', {}, el('h3', {}, o.nome), blocoResultado(o)))));
  return nodos;
}

// ---------- Relatório ----------
const crase = (n) => `\`${String(n).replace(/`/g, "'")}\``;
export function scriptR(r) {
  const p = r.papeis; const t = TIPO_ANALISE[r.pedido];
  const cab = `# Análise gerada pelo ${NOME_APP} ${VERSAO_APP} (base ${VERSAO_BASE}) em ${r.quando.slice(0, 10)}\n# ${r.versaoR}\n# Arquivo original: ${r.arquivo}\nd <- read.csv2("seus_dados.csv")   # CSV com ; e vírgula decimal. Para CSV com vírgula: read.csv()\n`;
  const v = (k) => `d$${crase(p[k])}`;
  const corpo = {
    dois_grupos: `y <- ${v('y')}; g <- factor(${v('g')})\ntapply(y, g, summary)\nby(y, g, function(x) shapiro.test(x))\nt.test(y ~ g)                          # t de Welch\nwilcox.test(y ~ g, conf.int = TRUE)    # Mann-Whitney`,
    pareado: `a <- ${v('y')}; b <- ${v('y2')}\nshapiro.test(b - a)\nt.test(b, a, paired = TRUE)\nwilcox.test(b, a, paired = TRUE, conf.int = TRUE)`,
    varios: `y <- ${v('y')}; g <- factor(${v('g')})\nmodelo <- aov(y ~ g)\nshapiro.test(residuals(modelo))\nsummary(modelo); TukeyHSD(modelo)\noneway.test(y ~ g)                     # ANOVA de Welch\nkruskal.test(y ~ g)\npairwise.wilcox.test(y, g, p.adjust.method = "holm")`,
    friedman: `m <- as.matrix(d[, c(${(p.medidas || []).map((x) => `"${String(x).replace(/"/g, '\\"')}"`).join(', ')})])\nm <- m[complete.cases(m), ]\nfriedman.test(m)`,
    categoricas: `tab <- table(${v('g')}, ${v('y')})\ntab; prop.table(tab, 1)\nchisq.test(tab, correct = FALSE)$expected\nchisq.test(tab, correct = FALSE)\nfisher.test(tab)`,
    mcnemar: `tab <- table(${v('y')}, ${v('y2')})\nmcnemar.test(tab)`,
    correlacao: `x <- ${v('x')}; y <- ${v('y')}\ncor.test(x, y, method = "pearson")\ncor.test(x, y, method = "spearman", exact = FALSE)`,
    linear: `modelo <- lm(${crase(p.y)} ~ ${(p.x || []).map(crase).join(' + ')}, data = d)\nsummary(modelo); confint(modelo)\nplot(modelo, which = 1:2)`,
    logistica: `d$evento <- as.numeric(${v('y')} == "${String(p.nivel_evento ?? '').replace(/"/g, '\\"')}")\nmodelo <- glm(evento ~ ${(p.x || []).map(crase).join(' + ')}, family = binomial, data = d)\nsummary(modelo)\nexp(cbind(OR = coef(modelo), confint.default(modelo)))`,
    kappa: `tab <- table(${v('y')}, ${v('y2')})\npo <- sum(diag(tab)) / sum(tab); pe <- sum(rowSums(tab) * colSums(tab)) / sum(tab)^2\n(po - pe) / (1 - pe)   # kappa`,
    bland: `dif <- ${v('y')} - ${v('y2')}; media <- (${v('y')} + ${v('y2')}) / 2\nmean(dif, na.rm = TRUE) + c(-1.96, 0, 1.96) * sd(dif, na.rm = TRUE)\nplot(media, dif); abline(h = mean(dif, na.rm = TRUE))`,
    acuracia: `tab <- table(teste = ${v('g')}, referencia = ${v('y')})\ntab   # calcule sensibilidade e especificidade a partir da tabela`,
  }[t];
  return `${cab}\n${corpo}\n`;
}
function textoMetodos(r) {
  const p = projetoAtual();
  const des = p?.desenho?.id ? DESENHOS[p.desenho.id]?.nome : '[desenho do estudo]';
  const t = TESTES[r.principal]?.nome || r.principal;
  const quant = r.descritivas ? 'As variáveis quantitativas foram descritas por média e desvio-padrão ou mediana e intervalo interquartil, conforme a distribuição. ' : '';
  const norm = r.pressupostos.some((x) => /Normalidade/.test(x.nome)) ? 'A normalidade foi avaliada por histogramas, gráficos Q-Q e teste de Shapiro-Wilk. ' : '';
  return `Trata-se de estudo do tipo ${des.toLowerCase()}. ${quant}${norm}Para a análise do desfecho foi utilizado o ${t.charAt(0).toLowerCase()}${t.slice(1)}, com nível de significância de 5% (bilateral) e intervalos de confiança de 95%. As análises foram realizadas no R (${r.versaoR}) executado pelo aplicativo ${NOME_APP} versão ${VERSAO_APP}.`;
}
function textoResultados(r) {
  const res = r.resultados.find((x) => x.teste === r.principal) || r.resultados[0];
  const ef = res.efeito;
  const efTxt = ef ? `${ef.nome} de ${numero(ef.valor, 2)}${ef.li !== null && ef.li !== undefined ? ` (IC 95% ${numero(ef.li, 2)} a ${numero(ef.ls, 2)})` : ''}` : '';
  const desc = r.descritivas?.length ? ` ${r.descritivas.map((d) => `${d.grupo}: média ${numero(d.media)} (DP ${numero(d.dp)}), mediana ${numero(d.mediana)} (IIQ ${numero(d.q1)}–${numero(d.q3)})`).join('; ')}.` : '';
  return `Foram analisadas ${r.n} observações.${desc} Observou-se ${efTxt}; ${res.nome.charAt(0).toLowerCase()}${res.nome.slice(1)}${res.p !== null && res.p !== undefined ? `, ${textoP(res.p)}` : ''}. [Interprete a relevância clínica do efeito.]`;
}
export function telaRelatorio() {
  const r = ultimo;
  if (!r) return [cabecalhoTela('Relatório', null, ['Relatar']), aviso('Rode uma análise primeiro.', 'info'), el('a', { class: 'botao', href: '#/analisar/resultado' }, 'Ir para a análise')];
  const p = projetoAtual();
  const diretriz = p?.desenho?.id ? DESENHOS[p.desenho.id]?.diretriz : null;
  const script = scriptR(r);
  return [
    cabecalhoTela('Relatório', 'Textos-modelo para adaptar ao seu trabalho, com a reprodução no R.', ['Relatar']),
    el('section', { class: 'cartao' }, el('h2', {}, 'Métodos (análise estatística)'), blocoCodigo(textoMetodos(r), 'Copiar texto')),
    el('section', { class: 'cartao' }, el('h2', {}, 'Resultados'), blocoCodigo(textoResultados(r), 'Copiar texto'),
      el('p', { class: 'texto-suave' }, 'Revise os números e a redação; o texto é um ponto de partida, não a versão final.')),
    el('section', { class: 'cartao' }, el('h2', {}, 'Resultado completo'), ...renderizarResultado(r).slice(0, 1).map((n) => { n.querySelector('.acoes')?.remove(); return n; })),
    el('section', { class: 'cartao' }, el('h2', {}, 'Script R reprodutível'),
      el('p', {}, 'Rode no R ou no RStudio com a mesma planilha para obter os mesmos resultados.'),
      blocoCodigo(script), botaoBaixar('analise-pharma_estat.R', script, 'text/plain', 'Baixar script .R')),
    diretriz ? el('section', { class: 'cartao' }, el('h2', {}, 'Checklist de relato'), el('p', {}, `Para o desenho do seu projeto, siga: ${BASE.referencias.referencias.find((x) => x.id === diretriz)?.citacao}`),
      el('p', {}, el('a', { href: 'https://www.equator-network.org/', target: '_blank', rel: 'noopener' }, 'Checklists na rede EQUATOR'))) : null,
    blocoCitar(),
  ];
}
