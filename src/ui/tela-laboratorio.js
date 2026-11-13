// Laboratório "Armadilhas da evidência": 9 simulações interativas com exemplos do hospital.
// Textos e referências: base/laboratorio.json. Matemática: src/calculo/laboratorio.js (testada).
import { el } from './componentes.js';
import { svg, figuraInterativa } from './graficos.js';
import * as L from '../calculo/laboratorio.js';
import LAB from '../../base/laboratorio.json';
import { citacao } from '../base.js';

const W = 360, H = 210;
const pct = (v, c = 1) => `${(v * 100).toLocaleString('pt-BR', { minimumFractionDigits: c, maximumFractionDigits: c })}%`;
const num = (v, c = 1) => Number(v).toLocaleString('pt-BR', { minimumFractionDigits: c, maximumFractionDigits: c });
const NEON = { azul: '#4C8DFF', coral: '#FF6B6B', ambar: '#F5A623', verde: '#4ADE80', agua: '#2EE6C9', roxo: '#B05CFF', cinza: '#6B7A90', texto: '#E6EEF1', suave: '#93A4B8' };

function tela() { return svg('svg', { viewBox: `0 0 ${W} ${H}`, class: 'lab-svg', role: 'img' }); }
function texto(g, x, y, t, attrs = {}) { g.append(svg('text', { x, y, fill: NEON.suave, 'font-size': 10, ...attrs }, t)); }
function controleDeslizante({ id, rotulo, min, max, passo, valor, formatar, aoMudar }) {
  const saida = el('output', { for: id }, formatar(valor));
  const input = el('input', { id, type: 'range', min, max, step: passo, value: valor, oninput: (e) => { const v = Number(e.target.value); saida.textContent = formatar(v); aoMudar(v); } });
  return el('div', { class: 'lab-controle' }, el('label', { for: id }, rotulo, ' ', saida), input);
}
function chave({ id, rotulo, aoMudar }) {
  return el('label', { class: 'lab-chave', for: id }, el('input', { id, type: 'checkbox', role: 'switch', onchange: (e) => aoMudar(e.target.checked) }), el('span', {}, rotulo));
}
const leitura = () => el('div', { class: 'lab-leitura', 'aria-live': 'polite' });
const grande = (t, cor) => el('span', { class: 'lab-grande', style: `color:${cor}` }, t);

// ---------- 1. Confundimento ----------
function cartaoCorrelacao(cor) {
  const d = L.dadosGravidade();
  const area = el('div'); const out = leitura();
  const residuo = (y) => { // o que sobra de y depois de descontar o SOFA (regressão linear simples)
    const mx = d.sofa.reduce((a, x) => a + x, 0) / d.sofa.length, my = y.reduce((a, v) => a + v, 0) / y.length;
    const b = d.sofa.reduce((a, x, i) => a + (x - mx) * (y[i] - my), 0) / d.sofa.reduce((a, x) => a + (x - mx) ** 2, 0);
    return y.map((v, i) => v - (my + b * (d.sofa[i] - mx)));
  };
  const desenhar = (ajustar) => {
    const g = tela();
    const xs = ajustar ? residuo(d.medicamentos) : d.medicamentos, ys = ajustar ? residuo(d.dias) : d.dias;
    const ex = [Math.min(...xs), Math.max(...xs)], ey = [Math.min(...ys), Math.max(...ys)];
    const X = (v) => 30 + ((v - ex[0]) / (ex[1] - ex[0] || 1)) * 315, Y = (v) => 180 - ((v - ey[0]) / (ey[1] - ey[0] || 1)) * 150;
    xs.forEach((v, i) => g.append(svg('circle', { cx: X(v), cy: Y(ys[i]), r: 4.5, fill: `hsl(${200 - d.sofa[i] * 13}, 85%, 60%)`, 'fill-opacity': 0.85,
      'data-dica': `Paciente ${i + 1}: SOFA ${d.sofa[i]} · ${d.medicamentos[i]} medicamentos · ${d.dias[i]} dias internado` })));
    texto(g, 30, 200, ajustar ? 'medicamentos (descontada a gravidade) →' : 'nº de medicamentos →', { fill: NEON.texto });
    texto(g, 30, 22, ajustar ? '↑ dias (descontada a gravidade)' : '↑ dias de internação', { fill: NEON.texto });
    texto(g, 168, 22, 'verde = SOFA baixo · vermelho = alto', { 'font-size': 8 });
    area.replaceChildren(figuraInterativa(g, 'lab-figura'));
    out.replaceChildren(ajustar
      ? el('p', {}, 'Ajustando pela gravidade: r = ', grande(num(d.rParcial, 2), NEON.verde), ' — a associação desaparece.')
      : el('p', {}, 'Medicamentos × dias de internação: r = ', grande(num(d.r, 2), cor), ' — parece forte.'));
  };
  desenhar(false);
  return [chave({ id: 'lab-cor', rotulo: 'Ajustar pela gravidade (SOFA)', aoMudar: desenhar }), area, out];
}

// ---------- 02. Seleção ----------
function cartaoSelecao(cor) {
  const area = el('div'); const out = leitura();
  const desenhar = (perda) => {
    const r = L.selecao(perda);
    const g = tela();
    const grade = (x0, titulo, fica) => {
      texto(g, x0, 16, titulo, { fill: NEON.texto, 'font-size': 11 });
      r.gravidade.forEach((gr, i) => {
        const cx = x0 + 8 + (i % 10) * 15, cy = 34 + Math.floor(i / 10) * 18;
        const ok = fica ? fica[i] : true;
        const c = `hsl(${120 - gr * 120}, 75%, 55%)`;
        g.append(svg('circle', { cx, cy, r: 5.5, fill: ok ? c : 'none', stroke: c, 'stroke-opacity': ok ? 1 : 0.35, 'data-dica': `Gravidade ${num(gr * 100, 0)}% · chance de melhorar ${num((1 - gr) * 100, 0)}%${ok ? '' : ' · TRANSFERIDO (saiu da análise)'}` }));
      });
    };
    grade(10, 'Protocolo usual', null); grade(190, 'Protocolo novo', r.fica);
    texto(g, 10, 140, 'verde = leve · vermelho = grave · vazio = transferido');
    const bar = (y, rot, v, c) => { g.append(svg('rect', { x: 90, y, width: v * 220, height: 14, fill: c, rx: 3 })); texto(g, 10, y + 11, rot, { fill: NEON.texto }); texto(g, 95 + v * 220, y + 11, pct(v, 0), { fill: NEON.texto }); };
    bar(152, 'Alta melhorada', r.melhoraControle, NEON.cinza); bar(174, 'Alta melhorada', r.melhoraTratado, cor); texto(g, 10, 200, 'cinza = usual · roxo = novo', { 'font-size': 9 });
    area.replaceChildren(figuraInterativa(g, 'lab-figura'));
    out.replaceChildren(el('p', {}, 'Efeito aparente: ', grande(`${r.efeitoAparente >= 0 ? '+' : ''}${num(r.efeitoAparente * 100, 0)} pontos`, perda > 0 ? NEON.coral : NEON.verde), ' · efeito real: 0.'));
  };
  desenhar(0);
  return [controleDeslizante({ id: 'lab-sel', rotulo: 'Graves transferidos no grupo do protocolo novo:', min: 0, max: 0.6, passo: 0.05, valor: 0, formatar: (v) => pct(v, 0), aoMudar: desenhar }), area, out];
}

// ---------- 03. Regressão à média ----------
function cartaoRegressao(cor) {
  const area = el('div'); const out = leitura();
  const desenhar = (fr) => {
    const r = L.regressaoMedia(fr);
    const g = tela();
    const todos = [...r.m1, ...r.m2], a = Math.min(...todos), b = Math.max(...todos);
    const y = (v) => 180 - ((v - a) / (b - a)) * 160;
    r.m1.forEach((v, i) => {
      const s = r.sel[i];
      g.append(svg('line', { x1: 90, x2: 270, y1: y(v), y2: y(r.m2[i]), stroke: s ? cor : NEON.cinza, 'stroke-opacity': s ? 0.8 : 0.15, 'stroke-width': s ? 1.6 : 1, 'stroke-dasharray': s ? null : '3 3' }));
      if (s) g.append(svg('circle', { cx: 90, cy: y(v), r: 4, fill: cor, 'data-dica': `Paciente ${i + 1}: triagem ${num(v, 0)} → retorno ${num(r.m2[i], 0)} mmHg` }));
    });
    g.append(svg('line', { x1: 60, x2: 300, y1: y(r.corte), y2: y(r.corte), stroke: NEON.coral, 'stroke-dasharray': '4 4' }));
    texto(g, 302, y(r.corte) + 3, 'corte', { fill: NEON.coral });
    texto(g, 70, 205, 'Triagem', { fill: NEON.texto }); texto(g, 252, 205, 'Retorno', { fill: NEON.texto });
    area.replaceChildren(figuraInterativa(g, 'lab-figura'));
    out.replaceChildren(el('p', {}, `Selecionados: média ${num(r.media1, 0)} → ${num(r.media2, 0)} mmHg. Queda sem tratamento: `, grande(`${num(r.queda, 1)} mmHg`, cor)));
  };
  desenhar(0.2);
  return [controleDeslizante({ id: 'lab-reg', rotulo: 'Selecionar quem teve a pressão mais alta na triagem:', min: 0.05, max: 1, passo: 0.05, valor: 0.2, formatar: (v) => `${pct(v, 0)} do grupo`, aoMudar: desenhar }), area, out];
}

// ---------- 04. Significância ----------
function cartaoSignificancia(cor) {
  const area = el('div'); const out = leitura();
  const desenhar = (exp) => {
    const n = Math.round(10 ** exp);
    const t = L.testeDuasProporcoes(0.12, 0.117, n);
    const g = tela();
    const y = (v) => 180 - (v / 0.14) * 160;
    [['Protocolo atual', 0.12, NEON.cinza, 100], ['Protocolo novo', 0.117, cor, 210]].forEach(([rot, v, c, x]) => {
      g.append(svg('rect', { x, y: y(v), width: 60, height: 180 - y(v), fill: c, rx: 3, 'data-dica': `${rot}: ${pct(v)} de reinternação em 30 dias (n = ${n.toLocaleString('pt-BR')} por grupo)` }));
      texto(g, x + 12, y(v) - 6, pct(v), { fill: NEON.texto, 'font-size': 12 });
      texto(g, x - 4, 198, rot, { fill: NEON.texto });
    });
    texto(g, 10, 20, `diferença: −0,3 ponto (IC 95% ${num(t.li * 100, 2)} a ${num(t.ls * 100, 2)})`, { fill: NEON.texto });
    area.replaceChildren(figuraInterativa(g, 'lab-figura'));
    const sig = t.p < 0.05;
    out.replaceChildren(el('p', {}, `n = ${n.toLocaleString('pt-BR')} por grupo · `, grande(t.p < 0.001 ? 'p < 0,001' : `p = ${num(t.p, 3)}`, sig ? NEON.ambar : NEON.suave),
      sig ? ' — "significativo", mas a reinternação só caiu 0,3 ponto.' : ' — não significativo.'));
  };
  desenhar(3);
  return [controleDeslizante({ id: 'lab-sig', rotulo: 'Pacientes em cada grupo:', min: 2, max: 6.7, passo: 0.05, valor: 3, formatar: (v) => Math.round(10 ** v).toLocaleString('pt-BR'), aoMudar: desenhar }), area, out];
}

// ---------- 5. Amostra pequena ----------
function cartaoAmostra(cor) {
  const area = el('div'); const out = leitura();
  let semente = 3, nAtual = 20;
  const desenhar = () => {
    const r = L.hospitais(nAtual, semente);
    const g = tela();
    const y = (t) => 180 - (t / 0.3) * 160;
    g.append(svg('line', { x1: 20, x2: 350, y1: y(0.05), y2: y(0.05), stroke: NEON.suave, 'stroke-dasharray': '4 4' }));
    texto(g, 300, y(0.05) - 5, 'real: 5%');
    [...r.taxas].sort((a, b) => a - b).forEach((t, i) => {
      const extremo = t === r.min || t === r.max;
      g.append(svg('circle', { cx: 28 + i * 11, cy: y(t), r: 5, fill: extremo ? NEON.coral : cor, 'data-dica': `Hospital: ${pct(t)} de infecção (${Math.round(t * nAtual)} de ${nAtual} pacientes)` }));
    });
    [0, 0.1, 0.2, 0.3].forEach((t) => texto(g, 2, y(t) + 3, `${t * 100}%`, { 'font-size': 8 }));
    texto(g, 30, 205, '30 hospitais, ordenados da menor para a maior taxa');
    area.replaceChildren(figuraInterativa(g, 'lab-figura'));
    out.replaceChildren(el('p', {}, `Com ${nAtual} pacientes por hospital, as taxas vão de `, grande(pct(r.min, 0), NEON.coral), ' a ', grande(pct(r.max, 0), NEON.coral), ' — todos têm 5% de verdade.'));
  };
  desenhar();
  return [
    controleDeslizante({ id: 'lab-amo', rotulo: 'Pacientes com cateter por hospital:', min: 1, max: 3.3, passo: 0.05, valor: Math.log10(20), formatar: (v) => Math.round(10 ** v).toLocaleString('pt-BR'), aoMudar: (v) => { nAtual = Math.round(10 ** v); desenhar(); } }),
    el('button', { class: 'lab-botao', type: 'button', onclick: () => { semente += 1; desenhar(); } }, '↻ Sortear outro ano'),
    area, out,
  ];
}

// ---------- 06. Taxa de base ----------
function cartaoTaxaBase(cor) {
  const area = el('div'); const out = leitura();
  const v = { prev: 0.02, sens: 0.9, esp: 0.95 };
  const desenhar = () => {
    const r = L.valoresPreditivos(v.prev, v.sens, v.esp);
    const g = tela();
    const doentes = Math.round(r.vpp * 100);
    texto(g, 10, 16, 'De cada 100 testes rápidos positivos:', { fill: NEON.texto, 'font-size': 11 });
    for (let i = 0; i < 100; i++) {
      const cx = 22 + (i % 20) * 16.5, cy = 38 + Math.floor(i / 20) * 26, doente = i < doentes;
      g.append(svg('circle', { cx, cy: cy - 6, r: 4, fill: doente ? cor : NEON.cinza, 'data-dica': doente ? 'Tem dengue (verdadeiro positivo)' : 'Não tem dengue (falso positivo)' }));
      g.append(svg('path', { d: `M${cx - 6} ${cy + 8} q6 -10 12 0 z`, fill: doente ? cor : NEON.cinza }));
    }
    texto(g, 10, 200, '● tem dengue', { fill: cor, 'font-size': 11 }); texto(g, 110, 200, '● falso positivo', { fill: NEON.suave, 'font-size': 11 });
    area.replaceChildren(figuraInterativa(g, 'lab-figura'));
    out.replaceChildren(el('p', {}, grande(`${doentes}`, cor), ` de cada 100 positivos têm dengue (VPP ${pct(r.vpp)}; VPN ${pct(r.vpn, 2)}).`));
  };
  desenhar();
  return [
    controleDeslizante({ id: 'lab-prev', rotulo: 'Prevalência de dengue entre os testados:', min: -3, max: -0.3, passo: 0.05, valor: Math.log10(0.02), formatar: (x) => pct(10 ** x, 10 ** x < 0.01 ? 2 : 1), aoMudar: (x) => { v.prev = 10 ** x; desenhar(); } }),
    controleDeslizante({ id: 'lab-sens', rotulo: 'Sensibilidade:', min: 0.5, max: 0.999, passo: 0.001, valor: 0.9, formatar: (x) => pct(x), aoMudar: (x) => { v.sens = x; desenhar(); } }),
    controleDeslizante({ id: 'lab-esp', rotulo: 'Especificidade:', min: 0.5, max: 0.999, passo: 0.001, valor: 0.95, formatar: (x) => pct(x), aoMudar: (x) => { v.esp = x; desenhar(); } }),
    area, out,
  ];
}

// ---------- 07. Média ----------
function cartaoMedia(cor) {
  const area = el('div'); const out = leitura();
  const desenhar = (extra) => {
    const r = L.mediaMediana(extra);
    const g = tela();
    const max = Math.max(20, ...r.valores) * 1.05;
    const x = (v) => 20 + (v / max) * 320;
    g.append(svg('line', { x1: 20, x2: 340, y1: 120, y2: 120, stroke: NEON.suave }));
    r.valores.forEach((v, i) => {
      const extremo = extra > 0 && i === r.valores.length - 1;
      const repet = r.valores.slice(0, i).filter((w) => w === v).length;
      g.append(svg('circle', { cx: x(v), cy: 110 - repet * 12, r: 5, fill: extremo ? NEON.coral : NEON.texto, 'data-dica': `${extremo ? 'Paciente extra' : `Paciente ${i + 1}`}: ${v} dias` }));
    });
    g.append(svg('path', { d: `M${x(r.media)} 132 l-7 12 h14 z`, fill: cor, 'data-dica': `Média: ${num(r.media)} dias` }));
    texto(g, x(r.media) - 14, 160, `média ${num(r.media)}`, { fill: cor, 'font-size': 11 });
    g.append(svg('line', { x1: x(r.mediana), x2: x(r.mediana), y1: 40, y2: 125, stroke: NEON.agua, 'stroke-width': 2.5, 'data-dica': `Mediana: ${num(r.mediana)} dias` }));
    texto(g, x(r.mediana) + 4, 40, `mediana ${num(r.mediana)}`, { fill: NEON.agua, 'font-size': 11 });
    [0, Math.round(max / 2), Math.round(max)].forEach((t) => texto(g, x(t) - 6, 185, `${t}`));
    texto(g, 140, 205, 'dias de internação');
    area.replaceChildren(figuraInterativa(g, 'lab-figura'));
    out.replaceChildren(el('p', {}, 'Média ', grande(num(r.media), cor), ' dias · mediana ', grande(num(r.mediana), NEON.agua), ' dias.'));
  };
  desenhar(0);
  return [controleDeslizante({ id: 'lab-med', rotulo: 'Paciente de longa permanência (dias):', min: 0, max: 200, passo: 5, valor: 0, formatar: (v) => (v === 0 ? 'nenhum' : `${v} dias`), aoMudar: desenhar }), area, out];
}

// ---------- 08. Simpson ----------
function cartaoSimpson(cor) {
  const area = el('div'); const out = leitura();
  const s = L.simpson();
  const desenhar = (separar) => {
    const g = tela();
    const grupos = separar ? s.estratos.map((e) => ({ nome: e.nome, A: e.A, B: e.B, nA: e.nA, nB: e.nB })) : [{ nome: 'Todos os pacientes', A: s.geral.A, B: s.geral.B, nA: 350, nB: 350 }];
    const y = (v) => 175 - ((v - 0.5) / 0.5) * 150;
    const largura = 320 / grupos.length;
    grupos.forEach((gr, i) => {
      const x0 = 30 + i * largura + largura / 2 - 50;
      [['A', gr.A, cor, gr.nA], ['B', gr.B, NEON.cinza, gr.nB]].forEach(([k, v, c, n], j) => {
        g.append(svg('rect', { x: x0 + j * 52, y: y(v), width: 44, height: 175 - y(v), fill: c, rx: 3, 'data-dica': `${L.SIMPSON.rotulos[k]} · ${gr.nome}: ${pct(v)} de sucesso (n = ${n})` }));
        texto(g, x0 + j * 52 + 4, y(v) - 5, pct(v, 0), { fill: NEON.texto, 'font-size': 11 });
      });
      texto(g, x0, 195, gr.nome, { fill: NEON.texto });
    });
    texto(g, 10, 16, `■ ${L.SIMPSON.rotulos.A}`, { fill: cor }); texto(g, 190, 16, `■ ${L.SIMPSON.rotulos.B}`, { fill: NEON.suave });
    area.replaceChildren(figuraInterativa(g, 'lab-figura'));
    out.replaceChildren(separar
      ? el('p', {}, 'Separando por tamanho: ', grande('a cirurgia aberta vence nos dois', cor), '.')
      : el('p', {}, 'No total: ', grande('a percutânea parece melhor', NEON.suave), ` (${pct(s.geral.B, 0)} × ${pct(s.geral.A, 0)}).`));
  };
  desenhar(false);
  return [chave({ id: 'lab-simp', rotulo: 'Separar por tamanho do cálculo', aoMudar: desenhar }), area, out];
}

// ---------- 09. Risco ----------
function cartaoRisco(cor) {
  const area = el('div'); const out = leitura();
  const v = { base: 0.08, rr: 0.75 };
  const desenhar = () => {
    const r = L.riscos(v.base, v.rr);
    const g = tela();
    const total = 1000;
    texto(g, 10, 16, `Em ${total.toLocaleString('pt-BR')} pessoas (cada ponto = 10):`, { fill: NEON.texto, 'font-size': 11 });
    const semEv = Math.round(v.base * 100), comEv = Math.round(r.tratado * 100);
    for (let i = 0; i < 100; i++) {
      const cx = 22 + (i % 20) * 16.5, cy = 36 + Math.floor(i / 20) * 24;
      const estado = i < comEv ? 'evento' : i < semEv ? 'evitado' : 'nada';
      g.append(svg('circle', { cx, cy, r: 5.5, fill: estado === 'evento' ? NEON.coral : estado === 'evitado' ? NEON.verde : '#22324A',
        'data-dica': estado === 'evento' ? 'Tem trombose mesmo com profilaxia' : estado === 'evitado' ? 'Trombose evitada pela profilaxia' : 'Não teria trombose de qualquer forma' }));
    }
    texto(g, 10, 170, '● trombose mesmo assim', { fill: NEON.coral }); texto(g, 140, 170, '● evitada', { fill: NEON.verde }); texto(g, 210, 170, '● sem trombose', { fill: '#5B6E8C' });
    texto(g, 10, 192, `Sem profilaxia ${pct(v.base)} → com profilaxia ${pct(r.tratado)}`, { fill: NEON.texto, 'font-size': 11 });
    area.replaceChildren(figuraInterativa(g, 'lab-figura'));
    out.replaceChildren(el('p', {}, 'Propaganda: "reduz ', grande(pct(r.rrr, 0), cor), ' das tromboses". Para o paciente: −', grande(`${num(r.rar * 100, 1)} ponto${r.rar * 100 >= 2 ? 's' : ''}`, NEON.verde),
      ` · NNT = ${Number.isFinite(r.nnt) ? r.nnt.toLocaleString('pt-BR') : '∞'}.`));
  };
  desenhar();
  return [
    controleDeslizante({ id: 'lab-base', rotulo: 'Risco de trombose sem profilaxia:', min: 0.005, max: 0.5, passo: 0.005, valor: 0.08, formatar: (x) => pct(x), aoMudar: (x) => { v.base = x; desenhar(); } }),
    controleDeslizante({ id: 'lab-rr', rotulo: 'Risco relativo (RR):', min: 0.2, max: 1, passo: 0.05, valor: 0.75, formatar: (x) => num(x, 2), aoMudar: (x) => { v.rr = x; desenhar(); } }),
    area, out,
  ];
}

const CONSTRUTORES = {
  correlacao: cartaoCorrelacao, selecao: cartaoSelecao, regressao: cartaoRegressao, significancia: cartaoSignificancia,
  amostra: cartaoAmostra, taxa_base: cartaoTaxaBase, media: cartaoMedia, simpson: cartaoSimpson, risco: cartaoRisco,
};

function cartao(c) {
  return el('article', { class: 'lab-cartao', id: `lab-${c.id}`, style: `--neon:${c.cor}` },
    el('p', { class: 'lab-titulo' }, `Armadilha ${c.numero} · ${c.titulo}`),
    el('h2', { class: 'lab-licao' }, c.licao),
    el('p', { class: 'lab-texto' }, c.texto),
    CONSTRUTORES[c.id](c.cor),
    el('p', { class: 'lab-pergunta' }, el('strong', {}, 'Pergunte: '), c.pergunta),
    el('p', { class: 'lab-projeto' }, el('strong', {}, 'No seu projeto: '), c.no_projeto),
    el('details', { class: 'lab-refs' }, el('summary', {}, 'Referências'), el('ol', {}, c.refs.map((r) => el('li', {}, citacao(r))))));
}

/** Faixa de botões numerados (01–09), também usada na tela inicial. */
export function chipsLaboratorio(destino = null) {
  return el('nav', { class: 'lab-chips', 'aria-label': 'Cartões do laboratório' }, LAB.cartoes.map((c) => el('a', {
    href: destino ? `${destino}` : `#/aprender/laboratorio`, style: `--neon:${c.cor}`, title: c.titulo,
    onclick: destino ? null : (e) => { e.preventDefault(); document.getElementById(`lab-${c.id}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' }); },
  }, el('span', { class: 'lab-chip-num' }, c.numero), ` ${c.titulo}`)));
}

export function telaLaboratorio() {
  return [
    el('section', { class: 'lab-cabecalho' },
      el('ul', { class: 'trilha', 'aria-label': 'Etapas' }, el('li', {}, 'Aprender'), el('li', {}, 'Laboratório')),
      el('h1', { class: 'lab-h1' }, LAB.titulo),
      el('p', { class: 'texto-suave' }, `${LAB.subtitulo} Mexa nos controles e toque nos gráficos.`)),
    chipsLaboratorio(),
    el('div', { class: 'lab-grade' }, LAB.cartoes.map(cartao)),
  ];
}
