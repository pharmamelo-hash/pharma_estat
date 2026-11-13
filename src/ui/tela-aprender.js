// Aprender: catálogos e glossário (tudo lido da base).
import { el, cabecalhoTela, cartaoAtalho, aviso } from './componentes.js';
import { BASE, TESTES } from '../base.js';
import { fichaTeste, fichaDesenho } from './fichas.js';

export function telaAprender() {
  return [
    cabecalhoTela('Aprender', 'Consulte os tipos de estudo, os testes e os conceitos com exemplos da área da saúde.'),
    el('div', { class: 'grade grade-2' },
      cartaoAtalho({ etiqueta: 'Trilha · aulas animadas', titulo: 'Do básico ao avançado', texto: '18 aulas curtas com animação, narração opcional e quiz: de tipos de variáveis a regressão, poder e sobrevida.', destino: '#/aprender/trilha' }),
      cartaoAtalho({ etiqueta: 'Laboratório', titulo: 'Armadilhas da evidência', texto: '9 simulações interativas com exemplos do hospital: confundimento, perdas, regressão à média, significância, amostra pequena, prevalência, média, Simpson e risco.', destino: '#/aprender/laboratorio' }),
      cartaoAtalho({ etiqueta: 'Catálogo', titulo: 'Tipos de estudo', texto: `${BASE.desenhos.desenhos.length} desenhos com definição, medidas, vieses e diretriz de relato.`, destino: '#/aprender/desenhos' }),
      cartaoAtalho({ etiqueta: 'Catálogo', titulo: 'Testes estatísticos', texto: `${BASE.testes.testes.length} testes com quando usar, pressupostos e como relatar.`, destino: '#/aprender/testes' }),
      cartaoAtalho({ etiqueta: 'Glossário', titulo: 'Conceitos', texto: `${BASE.glossario.termos.length} termos, do valor-p ao NNT, com exemplos.`, destino: '#/aprender/glossario' }),
      cartaoAtalho({ etiqueta: 'Fontes', titulo: 'Referências da base', texto: `${BASE.referencias.referencias.length} referências usadas nas recomendações.`, destino: '#/sobre' }),
    ),
  ];
}

const avisoRascunho = () => {
  const pend = BASE.referencias.referencias.filter((r) => r.conferida === 'pendente').length;
  return aviso(`Base ${BASE.desenhos.versao_base}: conteúdo em revisão. ${pend} referências marcadas "conferir".`, 'atencao', 'Rascunho:');
};

export function telaCatalogoDesenhos() {
  return [
    cabecalhoTela('Tipos de estudo', `${BASE.desenhos.categorias.length} categorias, do relato de caso à validação de método.`, ['Aprender', 'Desenhos']),
    avisoRascunho(),
    BASE.desenhos.categorias.map((c) => el('section', { class: 'categoria' },
      el('h2', {}, c.nome),
      el('p', { class: 'texto-suave' }, c.pergunta_guia),
      BASE.desenhos.desenhos.filter((d) => d.categoria === c.id).map((d) =>
        el('details', { class: 'item-catalogo', id: d.id }, el('summary', {}, d.nome), fichaDesenho(d.id, { etiqueta: c.nome }))))),
  ];
}

export function telaCatalogoTestes() {
  return [
    cabecalhoTela('Testes estatísticos', 'Agrupados pelo objetivo da análise. Toque para abrir a ficha.', ['Aprender', 'Testes']),
    avisoRascunho(),
    Object.entries(BASE.testes.objetivos).map(([obj, nome]) => el('section', { class: 'categoria' },
      el('h2', {}, nome),
      el('ul', { class: 'lista-links' }, BASE.testes.testes.filter((t) => t.objetivo === obj).map((t) =>
        el('li', {}, el('a', { href: `#/aprender/teste/${t.id}` }, t.nome), t.analise_no_app ? el('span', { class: 'selo' }, 'analisável no app') : null))))),
  ];
}

export function telaFichaTeste(id) {
  if (!TESTES[id]) return [cabecalhoTela('Teste não encontrado', null), el('a', { class: 'botao', href: '#/aprender/testes' }, 'Ver catálogo')];
  return [
    cabecalhoTela(TESTES[id].nome, null, ['Aprender', 'Testes']),
    fichaTeste(id, { etiqueta: BASE.testes.objetivos[TESTES[id].objetivo] }),
    el('a', { class: 'botao secundario', href: '#/aprender/testes' }, '← Todos os testes'),
  ];
}

const semAcento = (s) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
export function telaGlossario() {
  const lista = el('dl', { class: 'glossario' });
  const contador = el('p', { class: 'texto-suave', role: 'status' });
  const filtrar = (q) => {
    const termo = semAcento(q.trim());
    const itens = BASE.glossario.termos.filter((t) => !termo || semAcento(`${t.termo} ${t.definicao}`).includes(termo));
    lista.replaceChildren(...itens.flatMap((t) => [
      el('dt', { id: t.id }, t.termo),
      el('dd', {}, t.definicao, el('br'), el('span', { class: 'texto-suave' }, `Ex.: ${t.exemplo}`)),
    ]));
    contador.textContent = `${itens.length} de ${BASE.glossario.termos.length} termos`;
  };
  const busca = el('input', { type: 'search', placeholder: 'Buscar termo (ex.: odds, poder, censura)', 'aria-label': 'Buscar no glossário', oninput: (e) => filtrar(e.target.value) });
  filtrar('');
  return [cabecalhoTela('Glossário', 'Definições curtas com exemplos da área da saúde.', ['Aprender', 'Glossário']), el('div', { class: 'cartao' }, busca, contador, lista)];
}
