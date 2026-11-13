// Trilha de aprendizado (F16): aulas animadas com narração, legenda, quiz e progresso.
import { el, cabecalhoTela, aviso } from './componentes.js';
import { svg } from './graficos.js';
import { desenharQuadro, LARGURA, ALTURA } from './animacoes.js';
import TRILHA from '../../base/trilha.json';
import { progresso, concluirAula, resumoTrilha, zerarProgresso } from '../estado/progresso.js';
import { citacao } from '../base.js';

const duracaoCena = (c) => Math.max(6, 3 + c.legenda.length * 0.06); // segundos
const duracaoAula = (a) => Math.round(a.cenas.reduce((s, c) => s + duracaoCena(c), 0) / 60 * 10) / 10;
const minutos = (a) => { const m = duracaoAula(a); return m < 1 ? 'menos de 1 min' : `${String(m).replace('.', ',')} min`; };

// ---------- Player ----------
function player(aula, aoTerminar) {
  const tela = svg('svg', { viewBox: `0 0 ${LARGURA} ${ALTURA}`, class: 'aula-svg', role: 'img', 'aria-label': `Animação da aula: ${aula.titulo}` });
  const legenda = el('p', { class: 'aula-legenda', 'aria-live': 'polite' });
  const barra = el('div', { class: 'aula-barra' }, aula.cenas.map(() => el('span', {}, el('i'))));
  const semMovimento = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
  const s = { cena: 0, t: 0, tocando: false, voz: false, vel: 1, ultimo: 0, raf: 0, falando: false, fim: false };
  const temVoz = 'speechSynthesis' in window && typeof SpeechSynthesisUtterance !== 'undefined';

  const pintar = () => {
    const c = aula.cenas[s.cena];
    desenharQuadro(tela, c.anim, s.t, c.p);
    legenda.textContent = c.legenda;
    [...barra.children].forEach((b, i) => { b.firstChild.style.width = `${i < s.cena ? 100 : i === s.cena ? s.t * 100 : 0}%`; });
    btPlay.textContent = s.tocando ? '⏸ Pausar' : s.fim ? '↻ Rever' : '▶ Assistir';
    contador.textContent = `${s.cena + 1} / ${aula.cenas.length}`;
  };
  const calar = () => { if (temVoz) try { speechSynthesis.cancel(); } catch { /* ignore */ } s.falando = false; };
  const falar = () => {
    if (!s.voz || !temVoz) return;
    calar();
    try {
      const u = new SpeechSynthesisUtterance(aula.cenas[s.cena].legenda);
      u.lang = 'pt-BR'; u.rate = s.vel;
      const voz = speechSynthesis.getVoices().find((v) => /pt[-_]BR/i.test(v.lang)); if (voz) u.voice = voz;
      u.onend = () => { s.falando = false; }; u.onerror = () => { s.falando = false; };
      s.falando = true; speechSynthesis.speak(u);
    } catch { s.falando = false; }
  };
  const irPara = (i, tocar) => {
    s.cena = Math.max(0, Math.min(aula.cenas.length - 1, i)); s.t = semMovimento ? 1 : 0; s.fim = false; calar();
    if (tocar) falar();
    pintar();
  };
  const quadro = (agora) => {
    if (!s.tocando) return;
    const dt = Math.min(0.1, (agora - s.ultimo) / 1000); s.ultimo = agora;
    s.t = Math.min(1, s.t + (dt * s.vel) / duracaoCena(aula.cenas[s.cena]));
    if (s.t >= 1 && !s.falando) {
      if (s.cena < aula.cenas.length - 1) irPara(s.cena + 1, true);
      else { s.tocando = false; s.fim = true; pintar(); aoTerminar?.(); return; }
    }
    pintar();
    s.raf = requestAnimationFrame(quadro);
  };
  const tocar = () => {
    if (s.fim) irPara(0, false);
    s.tocando = true; s.ultimo = performance.now(); falar(); pintar(); s.raf = requestAnimationFrame(quadro);
  };
  const pausar = () => { s.tocando = false; cancelAnimationFrame(s.raf); calar(); pintar(); };
  const parar = () => { pausar(); window.removeEventListener('hashchange', parar); };
  window.addEventListener('hashchange', parar);

  const btPlay = el('button', { class: 'botao', type: 'button', onclick: () => (s.tocando ? pausar() : tocar()) });
  const contador = el('span', { class: 'aula-contador' });
  const btVoz = el('button', { class: 'botao secundario pequeno', type: 'button', 'aria-pressed': 'false', onclick: () => {
    s.voz = !s.voz; btVoz.setAttribute('aria-pressed', String(s.voz)); btVoz.textContent = s.voz ? '🔊 Narração ligada' : '🔈 Narração';
    if (s.voz && s.tocando) falar(); else calar();
  } }, '🔈 Narração');
  const btVel = el('button', { class: 'botao secundario pequeno', type: 'button', onclick: () => { s.vel = s.vel === 1 ? 1.5 : s.vel === 1.5 ? 0.75 : 1; btVel.textContent = `Velocidade ${String(s.vel).replace('.', ',')}×`; } }, 'Velocidade 1×');
  pintar();
  return el('div', { class: 'aula-player' },
    el('div', { class: 'aula-tela' }, tela, barra),
    legenda,
    el('div', { class: 'aula-controles' },
      el('button', { class: 'botao secundario pequeno', type: 'button', 'aria-label': 'Cena anterior', onclick: () => { irPara(s.cena - 1, s.tocando); } }, '⏮'),
      btPlay,
      el('button', { class: 'botao secundario pequeno', type: 'button', 'aria-label': 'Próxima cena', onclick: () => { if (s.cena === aula.cenas.length - 1) { s.t = 1; pausar(); s.fim = true; pintar(); aoTerminar?.(); } else irPara(s.cena + 1, s.tocando); } }, '⏭'),
      contador),
    el('div', { class: 'aula-controles' }, temVoz ? btVoz : null, btVel),
    temVoz ? null : el('p', { class: 'texto-suave' }, 'Este navegador não tem voz para narração; acompanhe pela legenda.'));
}

// ---------- Quiz ----------
function quiz(aula, aoConcluir) {
  const respostas = Array(aula.quiz.length).fill(null);
  const placar = el('p', { class: 'aula-placar', role: 'status' });
  const blocos = aula.quiz.map((q, i) => {
    const retorno = el('div', { 'aria-live': 'polite' });
    const botoes = q.opcoes.map((op, j) => el('button', { class: 'opcao', type: 'button', onclick: () => {
      if (respostas[i] !== null) return;
      respostas[i] = j;
      botoes.forEach((b, k) => { b.disabled = true; if (k === q.correta) b.classList.add('certa'); else if (k === j) b.classList.add('errada'); });
      retorno.replaceChildren(el('p', { class: j === q.correta ? 'retorno certo' : 'retorno errado' }, el('strong', {}, j === q.correta ? '✓ Correto. ' : '✗ Não é essa. '), q.explicacao));
      if (respostas.every((r) => r !== null)) {
        const acertos = respostas.filter((r, k) => r === aula.quiz[k].correta).length;
        concluirAula(aula.id, acertos, aula.quiz.length);
        placar.textContent = `Aula concluída: ${acertos} de ${aula.quiz.length} acertos.`;
        aoConcluir?.();
      }
    } }, op));
    return el('div', { class: 'aula-pergunta' }, el('p', {}, el('strong', {}, `${i + 1}. ${q.pergunta}`)), el('div', { class: 'opcoes' }, botoes), retorno);
  });
  return el('section', { class: 'cartao', id: 'quiz' }, el('span', { class: 'etiqueta' }, 'Teste o que aprendeu'), blocos, placar);
}

// ---------- Telas ----------
export function telaAula(id) {
  const i = TRILHA.aulas.findIndex((a) => a.id === id);
  if (i < 0) return [cabecalhoTela('Aula não encontrada', null), el('a', { class: 'botao', href: '#/aprender/trilha' }, 'Ver a trilha')];
  const aula = TRILHA.aulas[i], prox = TRILHA.aulas[i + 1];
  const nivel = TRILHA.niveis.find((n) => n.id === aula.nivel);
  const depois = el('div', { class: 'acoes' });
  const mostrarProxima = () => depois.replaceChildren(
    el('a', { class: 'botao secundario', href: aula.pratica.destino }, `Praticar: ${aula.pratica.rotulo}`),
    prox ? el('a', { class: 'botao', href: `#/aprender/aula/${prox.id}` }, `Próxima aula: ${prox.titulo} →`) : el('a', { class: 'botao', href: '#/aprender/trilha' }, 'Trilha concluída: ver o progresso'));
  if (progresso()[aula.id]) mostrarProxima();
  return [
    cabecalhoTela(`${i + 1}. ${aula.titulo}`, `${aula.resumo} · ${minutos(aula)} · nível ${nivel.nome.toLowerCase()}`, ['Aprender', 'Trilha']),
    el('section', { class: 'cartao cartao-aula' }, player(aula, () => document.getElementById('quiz')?.scrollIntoView({ behavior: 'smooth', block: 'start' }))),
    quiz(aula, mostrarProxima),
    depois,
    el('details', { class: 'cartao-detalhe' }, el('summary', {}, 'Texto da aula e referências'),
      el('ol', {}, aula.cenas.map((c) => el('li', {}, c.legenda))),
      el('ul', { class: 'lista-refs' }, aula.refs.map((r) => el('li', {}, citacao(r))))),
    el('a', { class: 'botao secundario', href: '#/aprender/trilha' }, '← Todas as aulas'),
  ];
}

export function barraProgresso(feitas, total) {
  return el('div', { class: 'progresso', role: 'progressbar', 'aria-valuemin': 0, 'aria-valuemax': total, 'aria-valuenow': feitas, 'aria-label': `${feitas} de ${total} aulas concluídas` },
    el('span', { style: `width:${total ? (feitas / total) * 100 : 0}%` }));
}

export function telaTrilha() {
  const area = el('div');
  const desenhar = () => {
    const r = resumoTrilha(TRILHA), p = progresso();
    let n = 0;
    area.replaceChildren(...[
      el('section', { class: 'cartao destaque' },
        el('span', { class: 'etiqueta' }, 'Seu progresso'),
        el('p', { class: 'numero-grande' }, `${r.feitas}`, el('small', {}, ` de ${r.total} aulas`)),
        barraProgresso(r.feitas, r.total),
        r.proxima ? el('a', { class: 'botao grande', href: `#/aprender/aula/${r.proxima.id}` }, `${r.feitas ? 'Continuar' : 'Começar'}: ${r.proxima.titulo}`) : aviso('Você concluiu todas as aulas. Reveja quando quiser.', 'info')),
      TRILHA.niveis.map((nv) => el('section', { class: 'categoria' },
        el('h2', {}, `${nv.nome} `, el('span', { class: 'selo' }, `${r.porNivel[nv.id][0]}/${r.porNivel[nv.id][1]}`)),
        el('p', { class: 'texto-suave' }, nv.descricao),
        el('div', { class: 'grade grade-2' }, TRILHA.aulas.filter((a) => a.nivel === nv.id).map((a) => {
          n += 1; const feito = p[a.id];
          return el('a', { class: `cartao cartao-licao ${feito ? 'feita' : ''}`, href: `#/aprender/aula/${a.id}` },
            el('span', { class: 'licao-num' }, feito ? '✓' : String(n)),
            el('span', { class: 'licao-corpo' }, el('strong', {}, a.titulo), el('small', {}, `${a.resumo} · ${minutos(a)}${feito ? ` · ${feito.acertos}/${feito.total} no quiz` : ''}`)),
            el('span', { class: 'licao-play', 'aria-hidden': 'true' }, '▶'));
        })))),
      r.feitas ? el('button', { class: 'botao secundario pequeno', type: 'button', onclick: () => { zerarProgresso(); desenhar(); } }, 'Zerar meu progresso') : null].flat().filter(Boolean));
  };
  desenhar();
  return [cabecalhoTela('Trilha de bioestatística', 'Do básico ao avançado em aulas animadas curtas, com narração opcional, legenda e quiz. Funciona sem internet.', ['Aprender', 'Trilha']), area];
}
