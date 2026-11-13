// Gráficos em SVG desenhados no navegador (seguros: todo texto via textContent).
// Usam as cores do tema, então acompanham o modo escuro.
const NS = 'http://www.w3.org/2000/svg';
const CORES = ['var(--primaria)', 'var(--secundaria)', 'var(--acento)', 'var(--erro)', '#6A4C93', 'var(--sucesso)'];
const L = 640, A = 360, M = { e: 64, d: 16, t: 20, b: 52 };

export function svg(tag, attrs = {}, texto) {
  const n = document.createElementNS(NS, tag);
  for (const [k, v] of Object.entries(attrs)) if (v !== undefined && v !== null) n.setAttribute(k, String(v));
  if (texto !== undefined) n.textContent = String(texto);
  return n;
}
const finitos = (v) => v.filter((x) => typeof x === 'number' && Number.isFinite(x));
/** Quantil tipo 7 (o padrão do R). */
export function quantil(valores, p) {
  const v = [...valores].sort((a, b) => a - b);
  const h = (v.length - 1) * p, lo = Math.floor(h);
  return v[lo] + (h - lo) * ((v[Math.min(lo + 1, v.length - 1)]) - v[lo]);
}
function escala(min, max, de, ate) {
  if (min === max) { min -= 1; max += 1; }
  const f = (x) => de + ((x - min) / (max - min)) * (ate - de);
  f.min = min; f.max = max;
  return f;
}
function marcas(min, max, n = 5) {
  const passo0 = (max - min) / n, mag = 10 ** Math.floor(Math.log10(passo0 || 1));
  const passo = [1, 2, 2.5, 5, 10].map((m) => m * mag).find((p) => (max - min) / p <= n) || mag * 10;
  const out = [];
  for (let v = Math.ceil(min / passo) * passo; v <= max + 1e-9; v += passo) out.push(+v.toFixed(10));
  return out;
}
const fmt = (v) => Number(v).toLocaleString('pt-BR', { maximumFractionDigits: 3 });

function moldura(titulo, rotuloX, rotuloY, y, x) {
  const g = svg('svg', { viewBox: `0 0 ${L} ${A}`, class: 'grafico-svg', role: 'img', 'aria-label': titulo });
  g.append(svg('title', {}, titulo));
  for (const v of marcas(y.min, y.max)) {
    g.append(svg('line', { x1: M.e, x2: L - M.d, y1: y(v), y2: y(v), class: 'grade-linha' }));
    g.append(svg('text', { x: M.e - 8, y: y(v) + 4, 'text-anchor': 'end', class: 'eixo-texto' }, fmt(v)));
  }
  if (x?.min !== undefined) for (const v of marcas(x.min, x.max)) g.append(svg('text', { x: x(v), y: A - M.b + 18, 'text-anchor': 'middle', class: 'eixo-texto' }, fmt(v)));
  g.append(svg('line', { x1: M.e, x2: L - M.d, y1: A - M.b, y2: A - M.b, class: 'eixo-linha' }));
  g.append(svg('line', { x1: M.e, x2: M.e, y1: M.t, y2: A - M.b, class: 'eixo-linha' }));
  if (rotuloX) g.append(svg('text', { x: (M.e + L - M.d) / 2, y: A - 8, 'text-anchor': 'middle', class: 'eixo-rotulo' }, rotuloX));
  if (rotuloY) g.append(svg('text', { x: 14, y: (M.t + A - M.b) / 2, transform: `rotate(-90 14 ${(M.t + A - M.b) / 2})`, 'text-anchor': 'middle', class: 'eixo-rotulo' }, rotuloY));
  return g;
}
// Deslocamento determinístico (sem aleatoriedade) para os pontos não se sobreporem.
const jitter = (i) => (((i * 7919) % 101) / 100 - 0.5);

/** Boxplot com pontos, por grupo. grupos = [{ rotulo, valores }] */
export function boxplot(grupos, rotuloX, rotuloY) {
  const todos = finitos(grupos.flatMap((g) => g.valores));
  const y = escala(Math.min(...todos), Math.max(...todos), A - M.b, M.t);
  const g = moldura(`Boxplot de ${rotuloY} por ${rotuloX}`, rotuloX, rotuloY, y);
  const largura = (L - M.e - M.d) / grupos.length;
  grupos.forEach((gr, i) => {
    const v = finitos(gr.valores); if (!v.length) return;
    const cx = M.e + largura * (i + 0.5), w = Math.min(70, largura * 0.45), cor = CORES[i % CORES.length];
    const q1 = quantil(v, 0.25), md = quantil(v, 0.5), q3 = quantil(v, 0.75), iqr = q3 - q1;
    const lo = Math.min(...v.filter((x) => x >= q1 - 1.5 * iqr)), hi = Math.max(...v.filter((x) => x <= q3 + 1.5 * iqr));
    g.append(svg('line', { x1: cx, x2: cx, y1: y(lo), y2: y(hi), stroke: cor, 'stroke-width': 1.5 }));
    g.append(svg('rect', { x: cx - w / 2, y: y(q3), width: w, height: Math.max(1, y(q1) - y(q3)), fill: cor, 'fill-opacity': 0.15, stroke: cor, 'stroke-width': 2, rx: 3, 'data-dica': `${gr.rotulo} · mediana ${fmt(md)} (IIQ ${fmt(q1)}–${fmt(q3)}) · n = ${v.length}` }));
    g.append(svg('line', { x1: cx - w / 2, x2: cx + w / 2, y1: y(md), y2: y(md), stroke: cor, 'stroke-width': 3 }));
    v.forEach((val, k) => g.append(svg('circle', { cx: cx + jitter(k) * w * 0.9, cy: y(val), r: 4, fill: cor, 'fill-opacity': 0.55, 'data-dica': `${gr.rotulo}: ${fmt(val)}` })));
    g.append(svg('text', { x: cx, y: A - M.b + 18, 'text-anchor': 'middle', class: 'eixo-texto' }, `${gr.rotulo} (n=${v.length})`));
  });
  return g;
}

/** Linhas por participante entre momentos. series = [[v1, v2, ...], ...]; rotulos = nomes dos momentos */
export function linhasPareadas(series, rotulos, rotuloY) {
  const todos = finitos(series.flat());
  const y = escala(Math.min(...todos), Math.max(...todos), A - M.b, M.t);
  const g = moldura(`Medidas pareadas de ${rotuloY}`, null, rotuloY, y);
  const x = (j) => M.e + 40 + (j * (L - M.e - M.d - 80)) / Math.max(1, rotulos.length - 1);
  for (const s of series) {
    if (s.some((v) => !Number.isFinite(v))) continue;
    g.append(svg('polyline', { points: s.map((v, j) => `${x(j)},${y(v)}`).join(' '), fill: 'none', stroke: 'var(--primaria)', 'stroke-opacity': 0.25 }));
  }
  const med = rotulos.map((_, j) => quantil(finitos(series.map((s) => s[j])), 0.5));
  g.append(svg('polyline', { points: med.map((v, j) => `${x(j)},${y(v)}`).join(' '), fill: 'none', stroke: 'var(--acento)', 'stroke-width': 4 }));
  rotulos.forEach((r, j) => g.append(svg('text', { x: x(j), y: A - M.b + 18, 'text-anchor': 'middle', class: 'eixo-texto' }, r)));
  g.append(svg('text', { x: L - M.d, y: M.t + 4, 'text-anchor': 'end', class: 'eixo-texto' }, 'linha laranja = mediana'));
  return g;
}

/** Barras agrupadas de percentuais. linhas = grupos; colunas = categorias do desfecho; pct[i][j] */
export function barras(linhas, colunas, pct, rotuloX, rotuloY) {
  const y = escala(0, 100, A - M.b, M.t);
  const g = moldura(`Percentual de ${rotuloY} por ${rotuloX}`, rotuloX, `% (${rotuloY})`, y);
  const largura = (L - M.e - M.d) / linhas.length, bw = Math.min(46, (largura * 0.8) / colunas.length);
  linhas.forEach((l, i) => {
    const x0 = M.e + largura * (i + 0.5) - (bw * colunas.length) / 2;
    colunas.forEach((c, j) => {
      const v = pct[i][j];
      g.append(svg('rect', { x: x0 + j * bw, y: y(v), width: bw - 3, height: y(0) - y(v), fill: CORES[j % CORES.length], rx: 2, 'data-dica': `${l} · ${c}: ${fmt(v)}%` }));
      g.append(svg('text', { x: x0 + j * bw + (bw - 3) / 2, y: y(v) - 4, 'text-anchor': 'middle', class: 'eixo-texto' }, `${Math.round(v)}%`));
    });
    g.append(svg('text', { x: M.e + largura * (i + 0.5), y: A - M.b + 18, 'text-anchor': 'middle', class: 'eixo-texto' }, l));
  });
  colunas.forEach((c, j) => {
    g.append(svg('rect', { x: L - M.d - 150, y: M.t + j * 18, width: 12, height: 12, fill: CORES[j % CORES.length] }));
    g.append(svg('text', { x: L - M.d - 132, y: M.t + j * 18 + 10, class: 'eixo-texto' }, c));
  });
  return g;
}

/** Dispersão com reta opcional ({ a, b } → y = a + b·x) e linhas horizontais opcionais. */
export function dispersao(xs, ys, rotuloX, rotuloY, { reta = null, horizontais = [] } = {}) {
  const pares = xs.map((x, i) => [x, ys[i]]).filter(([a, b]) => Number.isFinite(a) && Number.isFinite(b));
  const vx = pares.map((p) => p[0]), vy = [...pares.map((p) => p[1]), ...horizontais.map((h) => h.y)];
  const x = escala(Math.min(...vx), Math.max(...vx), M.e + 8, L - M.d - 8);
  const y = escala(Math.min(...vy), Math.max(...vy), A - M.b, M.t);
  const g = moldura(`Dispersão de ${rotuloY} por ${rotuloX}`, rotuloX, rotuloY, y, x);
  for (const h of horizontais) {
    g.append(svg('line', { x1: M.e, x2: L - M.d, y1: y(h.y), y2: y(h.y), stroke: h.cor || 'var(--acento)', 'stroke-width': 2, 'stroke-dasharray': h.tracejado ? '6 4' : null }));
    if (h.rotulo) g.append(svg('text', { x: L - M.d - 4, y: y(h.y) - 5, 'text-anchor': 'end', class: 'eixo-texto' }, h.rotulo));
  }
  pares.forEach(([a, b]) => g.append(svg('circle', { cx: x(a), cy: y(b), r: 4.5, fill: 'var(--primaria)', 'fill-opacity': 0.6, 'data-dica': `${rotuloX}: ${fmt(a)} · ${rotuloY}: ${fmt(b)}` })));
  if (reta) g.append(svg('line', { x1: x(x.min), x2: x(x.max), y1: y(reta.a + reta.b * x.min), y2: y(reta.a + reta.b * x.max), stroke: 'var(--acento)', 'stroke-width': 2.5 }));
  return g;
}

/** Gráfico de floresta (OR com IC, escala log). itens = [{ termo, or, li, ls }] */
export function floresta(itens) {
  const ok = itens.filter((i) => [i.or, i.li, i.ls].every((v) => Number.isFinite(v) && v > 0));
  const alt = Math.max(160, 60 + ok.length * 34);
  const g = svg('svg', { viewBox: `0 0 ${L} ${alt}`, class: 'grafico-svg', role: 'img', 'aria-label': 'Gráfico de floresta das odds ratios' });
  const lmin = Math.log(Math.min(...ok.map((i) => i.li), 1)), lmax = Math.log(Math.max(...ok.map((i) => i.ls), 1));
  const x = escala(lmin, lmax, 230, L - 30);
  g.append(svg('line', { x1: x(0), x2: x(0), y1: 20, y2: alt - 40, class: 'eixo-linha', 'stroke-dasharray': '4 4' }));
  ok.forEach((i, k) => {
    const yy = 40 + k * 34;
    g.append(svg('text', { x: 220, y: yy + 4, 'text-anchor': 'end', class: 'eixo-texto' }, i.termo.length > 32 ? `${i.termo.slice(0, 31)}…` : i.termo));
    g.append(svg('line', { x1: x(Math.log(i.li)), x2: x(Math.log(i.ls)), y1: yy, y2: yy, stroke: 'var(--primaria)', 'stroke-width': 2.5 }));
    g.append(svg('rect', { x: x(Math.log(i.or)) - 6, y: yy - 6, width: 12, height: 12, fill: 'var(--primaria)', 'data-dica': `${i.termo}: OR ${fmt(i.or)} (IC 95% ${fmt(i.li)} a ${fmt(i.ls)})` }));
  });
  [0.25, 0.5, 1, 2, 4, 8].filter((v) => Math.log(v) >= x.min && Math.log(v) <= x.max).forEach((v) =>
    g.append(svg('text', { x: x(Math.log(v)), y: alt - 22, 'text-anchor': 'middle', class: 'eixo-texto' }, fmt(v))));
  g.append(svg('text', { x: (230 + L - 30) / 2, y: alt - 4, 'text-anchor': 'middle', class: 'eixo-rotulo' }, 'Odds ratio (IC 95%, escala log)'));
  return g;
}

/** Curva ROC. */
export function roc(fpr, tpr) {
  const x = escala(0, 1, M.e, L - M.d), y = escala(0, 1, A - M.b, M.t);
  const g = moldura('Curva ROC', '1 − especificidade', 'Sensibilidade', y, x);
  g.append(svg('line', { x1: x(0), y1: y(0), x2: x(1), y2: y(1), stroke: 'var(--texto-suave)', 'stroke-dasharray': '5 5' }));
  g.append(svg('polyline', { points: fpr.map((f, i) => `${x(f)},${y(tpr[i])}`).join(' '), fill: 'none', stroke: 'var(--primaria)', 'stroke-width': 3 }));
  return g;
}

// ---------- Interação: toque ou passe o mouse para ver o valor ----------
/** Envolve um SVG numa figura que mostra o texto de data-dica do elemento tocado. */
export function figuraInterativa(svgEl, classe = 'grafico') {
  const dica = document.createElement('div');
  dica.className = 'dica-grafico'; dica.hidden = true; dica.setAttribute('role', 'status');
  const fig = document.createElement('figure');
  fig.className = classe; fig.append(svgEl, dica);
  const mostrar = (e) => {
    const alvo = e.target.closest?.('[data-dica]');
    if (!alvo) { dica.hidden = true; return; }
    dica.textContent = alvo.getAttribute('data-dica');
    dica.hidden = false;
    const caixa = fig.getBoundingClientRect();
    const x = Math.min(Math.max(8, e.clientX - caixa.left + 10), caixa.width - 170);
    dica.style.left = `${x}px`; dica.style.top = `${Math.max(4, e.clientY - caixa.top - 40)}px`;
  };
  svgEl.addEventListener('pointermove', mostrar);
  svgEl.addEventListener('pointerdown', mostrar);
  svgEl.addEventListener('pointerleave', () => { dica.hidden = true; });
  return fig;
}

/** Curva de poder × n, com marcas do n calculado e do n escolhido no controle. */
export function curvaPoder(fPoder, nMax, nCalculado, nEscolhido, alvo, rotuloN) {
  const x = escala(0, nMax, M.e, L - M.d), y = escala(0, 1, A - M.b, M.t);
  const g = moldura(`Curva de poder em função de ${rotuloN}`, rotuloN, 'Poder', y, x);
  const passos = 80, pts = [];
  for (let i = 0; i <= passos; i++) { const n = Math.max(2, (nMax * i) / passos); pts.push([n, fPoder(n)]); }
  g.append(svg('line', { x1: M.e, x2: L - M.d, y1: y(alvo), y2: y(alvo), stroke: 'var(--acento)', 'stroke-dasharray': '6 4', 'stroke-width': 1.5 }));
  g.append(svg('text', { x: L - M.d - 4, y: y(alvo) - 6, 'text-anchor': 'end', class: 'eixo-texto' }, `poder desejado ${Math.round(alvo * 100)}%`));
  g.append(svg('polyline', { points: pts.map(([n, p]) => `${x(n)},${y(p)}`).join(' '), fill: 'none', stroke: 'var(--primaria)', 'stroke-width': 3 }));
  pts.forEach(([n, p], i) => { if (i % 4 === 0) g.append(svg('circle', { cx: x(n), cy: y(p), r: 7, fill: 'transparent', 'data-dica': `${rotuloN} = ${Math.round(n)} → poder ${Math.round(p * 100)}%` })); });
  g.append(svg('line', { x1: x(nCalculado), x2: x(nCalculado), y1: y(0), y2: y(fPoder(nCalculado)), stroke: 'var(--secundaria)', 'stroke-dasharray': '3 3' }));
  g.append(svg('circle', { cx: x(nCalculado), cy: y(fPoder(nCalculado)), r: 6, fill: 'var(--secundaria)', 'data-dica': `n calculado = ${nCalculado} → poder ${Math.round(fPoder(nCalculado) * 100)}%` }));
  const pe = fPoder(nEscolhido);
  g.append(svg('circle', { cx: x(nEscolhido), cy: y(pe), r: 8, fill: pe >= alvo ? 'var(--sucesso)' : 'var(--erro)', stroke: 'var(--superficie)', 'stroke-width': 2, 'data-dica': `Seu n = ${nEscolhido} → poder ${Math.round(pe * 100)}%` }));
  return g;
}

/** Recrutamento acumulado × meta, com projeção tracejada até a meta. */
export function recrutamento(serie, meta, previsaoDia, fimPrevistoDia) {
  const dias = serie.map((r) => r.dia);
  const d0 = Math.min(...dias), d1 = Math.max(...dias, previsaoDia ?? -Infinity, fimPrevistoDia ?? -Infinity);
  const x = escala(d0, d1 + 1, M.e, L - M.d), y = escala(0, Math.max(meta, ...serie.map((r) => r.total)) * 1.08, A - M.b, M.t);
  const g = moldura('Recrutamento acumulado em relação à meta', null, 'Participantes incluídos', y);
  const data = (d) => new Date(d * 86400000).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', timeZone: 'UTC' });
  [d0, Math.round((d0 + d1) / 2), d1].forEach((d) => g.append(svg('text', { x: x(d), y: A - M.b + 18, 'text-anchor': 'middle', class: 'eixo-texto' }, data(d))));
  if (meta > 0) {
    g.append(svg('line', { x1: M.e, x2: L - M.d, y1: y(meta), y2: y(meta), stroke: 'var(--acento)', 'stroke-dasharray': '6 4', 'stroke-width': 1.5 }));
    g.append(svg('text', { x: M.e + 6, y: y(meta) - 6, class: 'eixo-texto' }, `meta ${meta}`));
  }
  if (fimPrevistoDia) {
    g.append(svg('line', { x1: x(fimPrevistoDia), x2: x(fimPrevistoDia), y1: M.t, y2: A - M.b, stroke: 'var(--erro)', 'stroke-dasharray': '3 3' }));
    g.append(svg('text', { x: x(fimPrevistoDia) - 4, y: M.t + 12, 'text-anchor': 'end', class: 'eixo-texto' }, 'fim previsto'));
  }
  const ult = serie.at(-1);
  if (previsaoDia && meta > ult.total) g.append(svg('line', { x1: x(ult.dia), y1: y(ult.total), x2: x(previsaoDia), y2: y(meta), stroke: 'var(--secundaria)', 'stroke-width': 2, 'stroke-dasharray': '5 5', 'data-dica': `Projeção no ritmo atual: meta em ${data(previsaoDia)}` }));
  g.append(svg('polyline', { points: serie.map((r) => `${x(r.dia)},${y(r.total)}`).join(' '), fill: 'none', stroke: 'var(--primaria)', 'stroke-width': 3 }));
  serie.forEach((r) => g.append(svg('circle', { cx: x(r.dia), cy: y(r.total), r: 6, fill: 'var(--primaria)', 'data-dica': `${data(r.dia)}: ${r.total} incluídos, ${r.perdas} perdas` })));
  return g;
}
