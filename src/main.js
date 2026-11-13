import './estilo/tema.css';
import { NOME_APP, SUBTITULO_APP, AVISO_FIXO, VERSAO_APP, VERSAO_BASE } from './config.js';
import { el } from './ui/componentes.js';
import { ROTAS, ROTAS_DINAMICAS, TELA_NAO_ENCONTRADA, MENU, MENU_LATERAL, itemAtivo } from './ui/telas.js';
import { resolverRota, caminhoDoHash } from './ui/roteador.js';
import { icone } from './ui/icones.js';
import { buscar } from './ui/busca.js';
import { restaurarAtual } from './estado/projeto.js';

// ---------- Tema (claro/escuro) ----------
// A escolha manual fica no aparelho (é só uma preferência, não é dado pessoal).
const CHAVE_TEMA = 'bioestat.tema';
function lerTemaSalvo() {
  try { return localStorage.getItem(CHAVE_TEMA); } catch { return null; }
}
function aplicarTema(tema) {
  const sistemaEscuro = window.matchMedia?.('(prefers-color-scheme: dark)').matches;
  const final = tema || (sistemaEscuro ? 'escuro' : 'claro');
  document.documentElement.dataset.tema = final;
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', final === 'escuro' ? '#0B2A33' : '#0F4C5C');
}
aplicarTema(lerTemaSalvo());
window.matchMedia?.('(prefers-color-scheme: dark)').addEventListener?.('change', () => aplicarTema(lerTemaSalvo()));
document.getElementById('botao-tema').addEventListener('click', () => {
  const novo = document.documentElement.dataset.tema === 'escuro' ? 'claro' : 'escuro';
  try { localStorage.setItem(CHAVE_TEMA, novo); } catch { /* armazenamento indisponível: só não lembra */ }
  aplicarTema(novo);
});

// ---------- Textos fixos ----------
document.getElementById('nome-app').textContent = NOME_APP;
document.getElementById('subtitulo-app').textContent = SUBTITULO_APP;
document.getElementById('rodape').replaceChildren(
  el('p', {}, AVISO_FIXO),
  el('p', { class: 'mono' }, `app ${VERSAO_APP} · base ${VERSAO_BASE}`),
);

// ---------- Navegação ----------
document.getElementById('botao-tema').replaceChildren(icone('tema'));
document.getElementById('botao-gaveta').replaceChildren(icone('menu'));
document.getElementById('busca-icone').replaceChildren(icone('busca', 18));

// Barra inferior (celular): 4 atalhos grandes.
const navegacao = document.getElementById('navegacao');
const linksMenu = MENU.map((item) => el('a', { href: item.destino, 'data-menu': item.id },
  el('span', { class: 'icone-nav' }, icone(item.icone, 22)),
  el('span', {}, item.rotulo)));
navegacao.replaceChildren(...linksMenu);

// Menu lateral em grupos (PC fixo; celular abre como gaveta).
const lateral = document.getElementById('lateral');
const veu = document.getElementById('veu');
const botaoGaveta = document.getElementById('botao-gaveta');
const linksLaterais = [];
lateral.replaceChildren(
  el('div', { class: 'lateral-topo so-celular' }, el('strong', {}, NOME_APP),
    el('button', { class: 'botao-icone discreto', type: 'button', 'aria-label': 'Fechar menu', onclick: () => gaveta(false) }, icone('fechar'))),
  ...MENU_LATERAL.map((g) => el('div', { class: 'grupo-menu' },
    el('p', { class: 'grupo-titulo' }, g.grupo),
    ...g.itens.map((i) => {
      const a = el('a', { href: i.destino, 'data-destino': i.destino, onclick: () => gaveta(false) }, icone(i.icone, 18), el('span', {}, i.rotulo));
      linksLaterais.push(a);
      return a;
    }))));
function gaveta(abrir) {
  document.body.classList.toggle('gaveta-aberta', abrir);
  botaoGaveta.setAttribute('aria-expanded', String(abrir));
  veu.hidden = !abrir;
  if (abrir) lateral.querySelector('a')?.focus();
}
botaoGaveta.addEventListener('click', () => gaveta(!document.body.classList.contains('gaveta-aberta')));
veu.addEventListener('click', () => gaveta(false));

// ---------- Busca global (F19) ----------
const caixaBusca = document.getElementById('busca');
const campoBusca = el('input', { type: 'search', id: 'campo-busca', placeholder: 'Ex.: ANOVA, caso-controle, poder, odds ratio…', autocomplete: 'off', 'aria-label': 'Buscar', 'aria-controls': 'resultados-busca' });
const listaBusca = el('ul', { class: 'resultados-busca', id: 'resultados-busca', role: 'listbox' });
const dicaBusca = el('p', { class: 'texto-suave' }, 'Busque em testes, tipos de estudo, glossário, aulas, laboratório e ferramentas.');
let realce = -1;
function mostrarResultados() {
  const r = buscar(campoBusca.value);
  realce = r.length ? 0 : -1;
  listaBusca.replaceChildren(...r.map((i, k) => el('li', { role: 'option', 'aria-selected': String(k === 0) },
    el('a', { href: i.destino, onclick: () => fecharBusca() }, el('span', { class: 'chip-tipo' }, i.tipo), el('strong', {}, i.titulo), el('small', {}, i.texto || '')))));
  dicaBusca.textContent = campoBusca.value.trim().length < 2 ? 'Busque em testes, tipos de estudo, glossário, aulas, laboratório e ferramentas.' : r.length ? `${r.length} resultado${r.length > 1 ? 's' : ''}.` : 'Nada encontrado. Tente outra palavra (ex.: "média", "risco", "amostra").';
}
function moverRealce(passo) {
  const itens = [...listaBusca.children];
  if (!itens.length) return;
  realce = (realce + passo + itens.length) % itens.length;
  itens.forEach((li, k) => li.setAttribute('aria-selected', String(k === realce)));
  itens[realce].scrollIntoView({ block: 'nearest' });
}
campoBusca.addEventListener('input', mostrarResultados);
campoBusca.addEventListener('keydown', (e) => {
  if (e.key === 'ArrowDown') { e.preventDefault(); moverRealce(1); }
  else if (e.key === 'ArrowUp') { e.preventDefault(); moverRealce(-1); }
  else if (e.key === 'Enter' && realce >= 0) { e.preventDefault(); listaBusca.children[realce]?.querySelector('a')?.click(); }
});
caixaBusca.replaceChildren(el('div', { class: 'busca-painel' },
  el('div', { class: 'busca-campo' }, icone('busca', 20), campoBusca,
    el('button', { class: 'botao-icone discreto', type: 'button', 'aria-label': 'Fechar busca', onclick: () => fecharBusca() }, icone('fechar'))),
  dicaBusca, listaBusca));
caixaBusca.addEventListener('click', (e) => { if (e.target === caixaBusca) fecharBusca(); });
function abrirBusca() { caixaBusca.hidden = false; campoBusca.value = ''; mostrarResultados(); campoBusca.focus(); }
function fecharBusca() { caixaBusca.hidden = true; }
document.getElementById('botao-busca').addEventListener('click', abrirBusca);
document.addEventListener('keydown', (e) => {
  const digitando = /^(INPUT|TEXTAREA|SELECT)$/.test(document.activeElement?.tagName);
  if (e.key === '/' && !digitando && caixaBusca.hidden) { e.preventDefault(); abrirBusca(); }
  if (e.key === 'Escape') { if (!caixaBusca.hidden) fecharBusca(); else gaveta(false); }
});

const conteudo = document.getElementById('conteudo');
let geracao = 0;
async function renderizar() {
  const minha = ++geracao;
  const { rota, parametro } = resolverRota(location.hash, ROTAS, TELA_NAO_ENCONTRADA, ROTAS_DINAMICAS);
  let nos;
  try {
    nos = await rota.tela(parametro); // algumas telas leem o IndexedDB (assíncronas)
  } catch (e) {
    nos = [el('div', { class: 'aviso erro', role: 'alert' }, 'Erro ao abrir esta tela. Recarregue a página.')];
    console.error(e);
  }
  if (minha !== geracao) return; // o usuário já mudou de tela
  // flat: telas podem devolver listas aninhadas (ex.: categorias → desenhos).
  conteudo.replaceChildren(...[nos].flat(Infinity).filter(Boolean));
  document.title = `${rota.titulo} · ${NOME_APP}`;
  const ativo = itemAtivo(caminhoDoHash(location.hash));
  linksLaterais.forEach((a) => (a.dataset.destino === ativo ? a.setAttribute('aria-current', 'page') : a.removeAttribute('aria-current')));
  linksMenu.forEach((link) => {
    if (link.dataset.menu === rota.menu) link.setAttribute('aria-current', 'page');
    else link.removeAttribute('aria-current');
  });
  window.scrollTo(0, 0);
  conteudo.focus({ preventScroll: true });
}
window.addEventListener('hashchange', renderizar);
restaurarAtual().catch(() => null).finally(renderizar);

// ---------- Offline (Service Worker) ----------
// Só registra em produção, para não atrapalhar o desenvolvimento.
if ('serviceWorker' in navigator && import.meta.env.PROD) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./sw.js').catch(() => { /* sem offline, o app segue funcionando */ });
  });
}
