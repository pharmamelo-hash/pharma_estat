// Análise automática (F15): o aluno aponta o desfecho e a comparação; o app escolhe o teste,
// roda no R e interpreta em linguagem simples. Também aceita dados resumidos (números de um artigo).
import { el, cabecalhoTela, aviso, numero, textoP } from './componentes.js';
import { dadosAtuais, colunasParaR, niveis } from '../estado/dados.js';
import { projetoAtual, atualizarAtual } from '../estado/projeto.js';
import { escolherAnalise, pareceRepetida, DESENHOS_RAPIDOS } from '../motor/auto.js';
import { interpretar } from '../motor/interpretar.js';
import { carregarR, analisar, estadoR } from '../r/motor-r.js';
import { renderizarResultado, definirUltimo } from './tela-analise.js';
import { welchResumo, tabela2x2 } from '../calculo/resumo.js';
import { DESENHOS, TESTES } from '../base.js';
import { paraNumero } from '../estado/dados.js';

const estado = { desenho: '', pareado: false, desfecho: '', explicativa: '', medidas: [] };
const ROT = { quantitativo: 'quantitativo', categorico: 'categórico', ordinal: 'ordinal' };

function seletorDesenho(aoMudar) {
  const p = projetoAtual();
  if (!estado.desenho && p?.desenho?.id && DESENHOS_RAPIDOS.some((d) => d.id === p.desenho.id)) estado.desenho = p.desenho.id;
  return el('div', { class: 'campo' }, el('label', { for: 'auto-desenho' }, 'Como os dados foram obtidos? (tipo de estudo)'),
    el('select', { id: 'auto-desenho', onchange: (e) => { estado.desenho = e.target.value; aoMudar?.(); } },
      el('option', { value: '' }, '— não sei / outro —'),
      DESENHOS_RAPIDOS.map((d) => el('option', { value: d.id, selected: d.id === estado.desenho }, d.rotulo))),
    el('small', { class: 'texto-suave' }, 'O tipo de estudo não dá para adivinhar pela planilha: ele depende de como você coletou. Em dúvida, use o ', el('a', { href: '#/planejar/desenho' }, 'assistente de desenho'), '.'));
}
const contexto = () => {
  const d = DESENHOS_RAPIDOS.find((x) => x.id === estado.desenho);
  return d ? { medida: d.medida, causal: d.causal, nomeDesenho: DESENHOS[d.id]?.nome } : { medida: 'rr', causal: null, nomeDesenho: null };
};
const cartaoInterpretacao = (blocos) => el('section', { class: 'cartao interpretacao' },
  el('span', { class: 'etiqueta' }, 'Interpretação em linguagem simples'),
  blocos.map((b) => el('div', { class: 'bloco-interp' }, el('h3', {}, b.titulo), el('p', {}, b.texto))));

// ---------- Com planilha ----------
function comPlanilha(conj) {
  const cols = conj.colunas.filter((c) => c.incluir);
  const info = (nome) => { const c = cols.find((x) => x.nome === nome); return c ? { nome, tipo: c.tipo, nNiveis: niveis(conj, nome).length } : null; };
  const form = el('div'); const saida = el('div', { 'aria-live': 'polite' });
  const opcoes = (sel) => [el('option', { value: '' }, '— escolha —'), ...cols.map((c) => el('option', { value: c.nome, selected: c.nome === sel }, `${c.nome} (${ROT[c.tipo]})`))];
  const repetidas = pareceRepetida(cols.map((c) => c.nome));

  const desenhar = () => {
    form.replaceChildren(el('section', { class: 'cartao' },
      el('h2', {}, `1. Conte sobre o trabalho — ${conj.nomeArquivo}`),
      seletorDesenho(),
      el('label', { class: 'lab-chave claro', for: 'auto-par' }, el('input', { id: 'auto-par', type: 'checkbox', checked: estado.pareado, onchange: (e) => { estado.pareado = e.target.checked; desenhar(); } }),
        el('span', {}, 'As colunas são medidas repetidas do mesmo paciente (antes/depois, D0/D7…)')),
      !estado.pareado && repetidas.length ? aviso(`Pelos nomes, estas colunas parecem medidas repetidas: ${repetidas.map((g) => g.join(' → ')).join(' · ')}. Se for o caso, marque a opção acima.`, 'info') : null,
      estado.pareado
        ? el('div', { class: 'campo' }, el('label', {}, 'Colunas das medidas, na ordem do tempo (2 ou mais)'),
          el('div', { class: 'lista-marcar' }, cols.map((c) => el('label', {}, el('input', { type: 'checkbox', checked: estado.medidas.includes(c.nome), onchange: (e) => {
            estado.medidas = e.target.checked ? [...estado.medidas, c.nome] : estado.medidas.filter((n) => n !== c.nome);
          } }), ` ${c.nome} (${ROT[c.tipo]})`))))
        : el('div', { class: 'grade grade-2' },
          el('div', { class: 'campo' }, el('label', { for: 'auto-y' }, 'Desfecho: o que você quer explicar'), el('select', { id: 'auto-y', onchange: (e) => { estado.desfecho = e.target.value; } }, opcoes(estado.desfecho)),
            el('small', { class: 'texto-suave' }, 'Ex.: óbito, tempo de internação, creatinina.')),
          el('div', { class: 'campo' }, el('label', { for: 'auto-x' }, 'Comparar ou relacionar com'), el('select', { id: 'auto-x', onchange: (e) => { estado.explicativa = e.target.value; } }, opcoes(estado.explicativa)),
            el('small', { class: 'texto-suave' }, 'Ex.: grupo de tratamento, exposição, idade.'))),
      el('button', { class: 'botao grande', type: 'button', onclick: rodar }, '✦ Interpretar e analisar'),
      el('p', { class: 'texto-suave' }, 'Quer escolher o teste você mesmo? ', el('a', { href: '#/analisar/resultado' }, 'Análise manual'), ' · Tipos das colunas errados? ', el('a', { href: '#/analisar/dados' }, 'Corrigir no dicionário'))));
  };

  async function rodar() {
    const esc = estado.pareado
      ? escolherAnalise({ pareado: true, medidas: estado.medidas.map(info).filter(Boolean) })
      : escolherAnalise({ desfecho: info(estado.desfecho), explicativa: info(estado.explicativa) });
    if (esc.erro) { saida.replaceChildren(aviso(esc.erro, 'erro')); return; }
    const leitura = el('section', { class: 'cartao leitura' },
      el('span', { class: 'etiqueta' }, '2. Leitura do seu trabalho'),
      el('ul', {}, esc.motivos.map((m) => el('li', {}, m))),
      esc.aviso ? aviso(esc.aviso, 'atencao') : null,
      estado.desenho ? el('p', {}, el('strong', {}, 'Tipo de estudo: '), DESENHOS[estado.desenho].nome, '. ', el('a', { href: '#/aprender/desenhos' }, 'ver ficha')) : el('p', { class: 'texto-suave' }, 'Tipo de estudo não informado: a interpretação fica mais cautelosa.'));
    saida.replaceChildren(leitura, el('div', { class: 'cartao carregando' }, el('p', {}, estadoR() === 'pronto' ? 'Rodando no R…' : 'Carregando o R no seu aparelho (só na primeira vez; cerca de 45 MB, prefira Wi-Fi)…')));
    try {
      const { versao } = await carregarR();
      const nomes = [...new Set(Object.values(esc.papeis).flat())];
      const papeis = { ...esc.papeis, tipos: Object.fromEntries(nomes.map((n) => [n, cols.find((c) => c.nome === n)?.tipo])) };
      const r = await analisar(esc.teste, colunasParaR(conj, nomes), papeis);
      if (!r.ok) { saida.replaceChildren(leitura, aviso(r.erro, 'erro', 'Não foi possível analisar:')); return; }
      r.principal = esc.forcar || r.sugerido || esc.teste;
      const ultimo = { ...r, pedido: esc.teste, papeis, versaoR: versao, arquivo: conj.nomeArquivo, quando: new Date().toISOString() };
      definirUltimo(ultimo);
      const t = TESTES[r.principal];
      const escolhido = el('section', { class: 'cartao escolhido' },
        el('span', { class: 'etiqueta' }, '3. Ferramenta estatística escolhida'),
        el('h2', {}, t?.nome || r.principal), el('p', {}, t?.porque || ''),
        el('a', { href: `#/aprender/teste/${r.principal}` }, 'Abrir a ficha do teste'), ' · ', el('a', { href: '#/aprender/trilha' }, 'Aprender na trilha'));
      saida.replaceChildren(leitura, escolhido, cartaoInterpretacao(interpretar(r, contexto())), ...renderizarResultado(ultimo));
      if (estado.desenho && !projetoAtual()?.desenho) atualizarAtual({ desenho: { id: estado.desenho, caminho: [] } }).catch(() => {});
    } catch (e) {
      console.error(e);
      saida.replaceChildren(leitura, aviso('O R não pôde ser carregado. Na prévia do Claude a análise não roda; no app publicado (GitHub Pages) funciona. Verifique também a conexão.', 'erro'));
    }
  }
  desenhar();
  return [form, saida];
}

// ---------- Dados resumidos ----------
function campoNum(id, rotulo, valor = '') {
  return el('div', { class: 'campo' }, el('label', { for: id }, rotulo), el('input', { id, type: 'text', inputmode: 'decimal', value: valor, autocomplete: 'off' }));
}
const ler = (id) => paraNumero(document.getElementById(id).value);

function resumido() {
  const saida = el('div', { 'aria-live': 'polite' });
  let modo = '2x2';
  const area = el('div');
  const desenhar = () => {
    const abas = el('div', { class: 'opcoes opcoes-2' },
      [['2x2', 'Desfecho sim/não em dois grupos', 'Ex.: óbitos em expostos e não expostos'], ['medias', 'Médias de dois grupos', 'Ex.: média, DP e n de cada grupo']].map(([id, t, d]) =>
        el('button', { class: 'opcao', type: 'button', 'aria-pressed': String(modo === id), onclick: () => { modo = id; saida.replaceChildren(); desenhar(); } }, t, el('small', {}, d))));
    const campos = modo === '2x2'
      ? el('div', { class: 'grade grade-2' }, campoNum('rs-a', 'Grupo exposto/tratado: COM o desfecho'), campoNum('rs-b', 'Grupo exposto/tratado: SEM o desfecho'), campoNum('rs-c', 'Grupo de comparação: COM o desfecho'), campoNum('rs-d', 'Grupo de comparação: SEM o desfecho'))
      : el('div', { class: 'grade grade-2' }, campoNum('rs-n1', 'Grupo 1: n'), campoNum('rs-n2', 'Grupo 2: n'), campoNum('rs-m1', 'Grupo 1: média'), campoNum('rs-m2', 'Grupo 2: média'), campoNum('rs-s1', 'Grupo 1: desvio-padrão'), campoNum('rs-s2', 'Grupo 2: desvio-padrão'));
    area.replaceChildren(abas, seletorDesenho(), campos, el('button', { class: 'botao grande', type: 'button', onclick: calcular }, '✦ Interpretar e analisar'));
  };
  const calcular = () => {
    const ctx = contexto();
    if (modo === '2x2') {
      const v = { a: ler('rs-a'), b: ler('rs-b'), c: ler('rs-c'), d: ler('rs-d') };
      if (Object.values(v).some((x) => x === null || x < 0 || !Number.isInteger(x))) { saida.replaceChildren(aviso('Preencha as quatro contagens com números inteiros.', 'erro')); return; }
      if (v.a + v.b === 0 || v.c + v.d === 0 || v.a + v.c === 0 || v.b + v.d === 0) { saida.replaceChildren(aviso('Cada grupo precisa ter participantes, e o desfecho precisa ter ocorrido e não ocorrido ao menos uma vez.', 'erro')); return; }
      const t = tabela2x2(v);
      const p = t.usarFisher ? t.pFisher : t.pQui;
      const temZero = [v.a, v.b, v.c, v.d].includes(0);
      const r = { tipo: 'categoricas', n: t.n, principal: t.usarFisher ? 't_fisher_exato' : 't_qui_quadrado', nivel_exposto: 'exposto/tratado', nivel_evento: 'O desfecho',
        pressupostos: [{ nome: 'Frequências esperadas ≥ 5', estado: t.usarFisher ? 'violado' : 'ok' }],
        medidas_2x2: { risco_expostos: t.r1, risco_nao_expostos: t.r0, rr: t.rr, or: t.or, dif: t.dif },
        resultados: [{ teste: t.usarFisher ? 't_fisher_exato' : 't_qui_quadrado', nome: t.usarFisher ? 'Teste exato de Fisher' : 'Qui-quadrado de independência', p, efeito: { valor: 0 } }] };
      saida.replaceChildren(
        el('section', { class: 'cartao escolhido' }, el('span', { class: 'etiqueta' }, 'Ferramenta estatística escolhida'), el('h2', {}, r.resultados[0].nome),
          el('p', {}, `Desfecho categórico em dois grupos independentes. Menor frequência esperada: ${numero(t.menorEsperada, 1)}${t.usarFisher ? ' (abaixo de 5: usa-se Fisher).' : ' (adequada para o qui-quadrado).'}`),
          el('p', { class: 'mono' }, `χ² = ${numero(t.qui, 3)}; ${textoP(t.pQui)} · Fisher: ${textoP(t.pFisher)}`),
          el('p', { class: 'mono' }, `RR = ${numero(t.rr.valor)} (${numero(t.rr.li)} a ${numero(t.rr.ls)}) · OR = ${numero(t.or.valor)} (${numero(t.or.li)} a ${numero(t.or.ls)}) · diferença de riscos = ${numero(t.dif.valor * 100, 1)} pontos${Number.isFinite(t.nnt) ? ` · NNT/NNH = ${t.nnt}` : ''}`),
          temZero ? aviso('Há célula com zero: RR e OR ficam indefinidos ou instáveis. Relate as proporções e a diferença de riscos.', 'atencao') : null),
        temZero ? null : cartaoInterpretacao(interpretar(r, ctx)));
    } else {
      const v = { n1: ler('rs-n1'), m1: ler('rs-m1'), dp1: ler('rs-s1'), n2: ler('rs-n2'), m2: ler('rs-m2'), dp2: ler('rs-s2') };
      if (Object.values(v).some((x) => x === null) || v.n1 < 2 || v.n2 < 2 || v.dp1 <= 0 || v.dp2 <= 0) { saida.replaceChildren(aviso('Preencha n (2 ou mais), média e desvio-padrão (maior que zero) dos dois grupos.', 'erro')); return; }
      const t = welchResumo(v);
      const r = { tipo: 'dois_grupos', n: v.n1 + v.n2, principal: 't_t_welch', pressupostos: [],
        descritivas: [{ grupo: 'Grupo 1', media: v.m1 }, { grupo: 'Grupo 2', media: v.m2 }],
        resultados: [{ teste: 't_t_welch', nome: 'Teste t de Welch', p: t.p, efeito: { valor: t.dif, li: t.li, ls: t.ls, nota: `d de Cohen = ${numero(t.d)}` } }] };
      saida.replaceChildren(
        el('section', { class: 'cartao escolhido' }, el('span', { class: 'etiqueta' }, 'Ferramenta estatística escolhida'), el('h2', {}, 'Teste t de Welch'),
          el('p', {}, 'Desfecho quantitativo em dois grupos independentes. Com dados resumidos não dá para verificar a normalidade: se o artigo relatou mediana e IIQ, a distribuição provavelmente é assimétrica e este teste não é o indicado.'),
          el('p', { class: 'mono' }, `t = ${numero(t.t, 3)}; gl = ${numero(t.gl, 1)}; ${textoP(t.p)} · diferença = ${numero(t.dif)} (IC 95% ${numero(t.li)} a ${numero(t.ls)})`)),
        cartaoInterpretacao(interpretar(r, ctx)));
    }
  };
  desenhar();
  return el('section', { class: 'cartao' }, el('h2', {}, 'Digitar os números do resumo'),
    el('p', { class: 'texto-suave' }, 'Para quando você só tem os números de um artigo, relatório ou tabela pronta. Cálculos conferidos contra o R.'), area, saida);
}

export function telaAuto() {
  const conj = dadosAtuais();
  return [
    cabecalhoTela('Analisar meu trabalho', 'Você diz o que quer saber; o app identifica a análise, escolhe o teste pelos pressupostos, roda e explica o resultado.', ['Analisar', 'Automático']),
    conj ? comPlanilha(conj) : el('section', { class: 'cartao destaque' }, el('h2', {}, 'Tenho a planilha dos dados'),
      el('p', {}, 'Importe o CSV ou Excel (sem nomes de pacientes). O arquivo não sai do seu aparelho.'), el('a', { class: 'botao grande', href: '#/analisar/dados' }, 'Importar planilha')),
    el('details', { class: 'cartao-detalhe', open: !conj }, el('summary', {}, 'Não tenho a planilha, só os números (dados resumidos)'), resumido()),
  ];
}
