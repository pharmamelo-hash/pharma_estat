// Animações das aulas (F16). Cada função desenha UM quadro no SVG para o instante t (0 a 1).
// São determinísticas (mesma semente → mesmo desenho) e todo texto entra por textContent.
import { svg } from './graficos.js';
import { gerador } from '../calculo/laboratorio.js';
import { pnorm, dnorm } from '../calculo/distribuicoes.js';

export const LARGURA = 360, ALTURA = 200;
const C = { texto: '#E6EEF1', suave: '#93A4B8', a: '#2EE6C9', b: '#F5A623', c: '#FF6B6B', d: '#4C8DFF', grade: '#22324A' };
const cl = (v) => Math.max(0, Math.min(1, v));
const fase = (t, a, b) => cl((t - a) / (b - a));
const suave = (x) => x * x * (3 - 2 * x);
const n1 = (v, c = 1) => Number(v).toLocaleString('pt-BR', { minimumFractionDigits: c, maximumFractionDigits: c });
const T = (g, x, y, txt, o = {}) => g.append(svg('text', { x, y, fill: C.texto, 'font-size': 11, ...o }, txt));
const linha = (g, x1, y1, x2, y2, o = {}) => g.append(svg('line', { x1, y1, x2, y2, stroke: C.suave, ...o }));
const seta = (g, x1, y1, x2, y2, cor = C.suave, o = {}) => {
  const ang = Math.atan2(y2 - y1, x2 - x1), p = (d) => `${x2 - 7 * Math.cos(ang + d)},${y2 - 7 * Math.sin(ang + d)}`;
  linha(g, x1, y1, x2, y2, { stroke: cor, 'stroke-width': 2, ...o });
  g.append(svg('polygon', { points: `${x2},${y2} ${p(0.45)} ${p(-0.45)}`, fill: cor }));
};
const curvaNormal = (g, mx, escalaX, base, alt, cor, o = {}) => {
  const pts = [];
  for (let z = -4; z <= 4.01; z += 0.1) pts.push(`${mx + z * escalaX},${base - dnorm(z) / dnorm(0) * alt}`);
  g.append(svg('polyline', { points: pts.join(' '), fill: 'none', stroke: cor, 'stroke-width': 2, ...o }));
};
const area = (g, mx, escalaX, base, alt, z0, z1, cor) => {
  const pts = [`${mx + z0 * escalaX},${base}`];
  for (let z = z0; z <= z1 + 0.001; z += 0.05) pts.push(`${mx + z * escalaX},${base - dnorm(z) / dnorm(0) * alt}`);
  pts.push(`${mx + z1 * escalaX},${base}`);
  g.append(svg('polygon', { points: pts.join(' '), fill: cor, 'fill-opacity': 0.45 }));
};

const ANIM = {
  titulo(g, t, p) {
    const o = suave(fase(t, 0, 0.35));
    T(g, 180, 92 - 6 * (1 - o), p.texto, { 'text-anchor': 'middle', 'font-size': 21, 'font-weight': 700, opacity: o });
    if (p.sub) T(g, 180, 120, p.sub, { 'text-anchor': 'middle', fill: C.a, 'font-size': 12, opacity: suave(fase(t, 0.3, 0.7)) });
    g.append(svg('rect', { x: 130, y: 134, width: 100 * suave(fase(t, 0.2, 0.9)), height: 3, fill: C.b, rx: 2 }));
  },

  classificar(g, t, p) {
    const cols = [['Quantitativa', 62, C.a], ['Ordinal', 180, C.b], ['Categórica', 298, C.d]];
    cols.forEach(([nome, x, cor]) => { T(g, x, 24, nome, { 'text-anchor': 'middle', fill: cor, 'font-weight': 700, 'font-size': 12 }); linha(g, x - 50, 32, x + 50, 32, { stroke: cor }); });
    const cont = [0, 0, 0];
    p.itens.forEach(([nome, col], i) => {
      const f = suave(fase(t, (i / p.itens.length) * 0.85, (i / p.itens.length) * 0.85 + 0.15));
      const linhaN = cont[col]++; if (f <= 0) return;
      const x = cols[col][1], y = 52 + linhaN * 30 - (1 - f) * 20;
      g.append(svg('rect', { x: x - 52, y: y - 13, width: 104, height: 22, rx: 11, fill: cols[col][2], 'fill-opacity': 0.18 * f, stroke: cols[col][2], 'stroke-opacity': f }));
      T(g, x, y + 2, nome, { 'text-anchor': 'middle', 'font-size': 10, opacity: f });
    });
  },

  distribuicao(g, t, p) {
    const r = gerador(p.forma === 'assimetrica' ? 5 : 9);
    const vals = Array.from({ length: 70 }, () => (p.forma === 'assimetrica' ? Math.exp(r.normal() * 0.75) * 4 : 10 + r.normal() * 2.5));
    const min = Math.min(...vals), max = Math.max(...vals), nb = 18;
    const X = (v) => 30 + ((v - min) / (max - min)) * 300;
    linha(g, 24, 170, 336, 170);
    const pilha = Array(nb).fill(0), mostrar = Math.floor(fase(t, 0, 0.6) * vals.length);
    vals.slice(0, mostrar).forEach((v) => {
      const b = Math.min(nb - 1, Math.floor(((v - min) / (max - min)) * nb));
      g.append(svg('circle', { cx: 30 + (b + 0.5) * (300 / nb), cy: 163 - pilha[b]++ * 9, r: 4, fill: C.d, 'fill-opacity': 0.85 }));
    });
    const media = vals.reduce((s, v) => s + v, 0) / vals.length, ord = [...vals].sort((a, b) => a - b), mediana = (ord[34] + ord[35]) / 2;
    const dp = Math.sqrt(vals.reduce((s, v) => s + (v - media) ** 2, 0) / (vals.length - 1));
    const f2 = fase(t, 0.62, 0.8);
    if (p.dp && f2 > 0) {
      g.append(svg('rect', { x: X(media - dp), y: 40, width: X(media + dp) - X(media - dp), height: 130, fill: C.a, 'fill-opacity': 0.12 * f2 }));
      T(g, X(media), 36, '± 1 desvio-padrão ≈ 68%', { 'text-anchor': 'middle', fill: C.a, 'font-size': 10, opacity: f2 });
      if (p.dp === 2) { g.append(svg('rect', { x: X(media - 2 * dp), y: 54, width: X(media + 2 * dp) - X(media - 2 * dp), height: 116, fill: 'none', stroke: C.b, 'stroke-dasharray': '4 3', opacity: fase(t, 0.8, 0.95) })); T(g, X(media), 196, '± 2 desvios-padrão ≈ 95%', { 'text-anchor': 'middle', fill: C.b, 'font-size': 10, opacity: fase(t, 0.8, 0.95) }); }
    }
    if (p.media && f2 > 0) { linha(g, X(media), 44, X(media), 170, { stroke: C.b, 'stroke-width': 2.5, opacity: f2 }); T(g, X(media) + 4, 52, `média ${n1(media)}`, { fill: C.b, opacity: f2 }); }
    if (p.mediana && f2 > 0) { linha(g, X(mediana), 60, X(mediana), 170, { stroke: C.a, 'stroke-width': 2.5, opacity: f2 }); T(g, X(mediana) - 4, 70, `mediana ${n1(mediana)}`, { fill: C.a, 'text-anchor': 'end', opacity: f2 }); }
    if (p.rotulo) T(g, 30, 190, p.rotulo, { fill: C.suave, 'font-size': 10 });
  },

  amostras_ic(g, t) {
    const des = [5, -12, 20, -3, 9, -25, 14, 2, -8, 30, -16, 6, 41, -5, 11, -20, 3, 17, -9, -1];
    linha(g, 180, 18, 180, 186, { stroke: C.b, 'stroke-width': 2, 'stroke-dasharray': '5 4' });
    T(g, 184, 16, 'média verdadeira', { fill: C.b, 'font-size': 10 });
    const k = Math.floor(fase(t, 0, 0.85) * des.length);
    des.slice(0, k).forEach((d, i) => {
      const fora = Math.abs(d) > 36, y = 26 + i * 8, cor = fora ? C.c : C.a;
      linha(g, 180 + d - 36, y, 180 + d + 36, y, { stroke: cor, 'stroke-width': 2.5 });
      g.append(svg('circle', { cx: 180 + d, cy: y, r: 3, fill: cor }));
    });
    T(g, 8, 196, `${k} amostras · ${des.slice(0, k).filter((d) => Math.abs(d) <= 36).length} intervalos contêm a média verdadeira`, { fill: C.suave, 'font-size': 10 });
  },

  desenho(g, t, p) {
    linha(g, 20, 176, 340, 176); T(g, 20, 192, 'passado', { fill: C.suave, 'font-size': 10 }); T(g, 340, 192, 'futuro', { fill: C.suave, 'font-size': 10, 'text-anchor': 'end' });
    const caixa = (x, y, txt, cor, o) => { if (o <= 0) return; g.append(svg('rect', { x: x - 54, y: y - 14, width: 108, height: 26, rx: 8, fill: cor, 'fill-opacity': 0.16 * o, stroke: cor, 'stroke-opacity': o })); T(g, x, y + 3, txt, { 'text-anchor': 'middle', 'font-size': 10, opacity: o }); };
    const hoje = (x) => { linha(g, x, 24, x, 176, { stroke: C.b, 'stroke-dasharray': '4 4' }); T(g, x, 18, 'pesquisador hoje', { 'text-anchor': 'middle', fill: C.b, 'font-size': 10 }); };
    const f1 = suave(fase(t, 0, 0.3)), f2 = suave(fase(t, 0.3, 0.65)), f3 = suave(fase(t, 0.65, 0.95));
    if (p.tipo === 'transversal') {
      hoje(180); caixa(110, 80, 'exposição?', C.a, f1); caixa(250, 80, 'desfecho?', C.c, f2);
      T(g, 180, 130, 'os dois medidos no mesmo momento', { 'text-anchor': 'middle', fill: C.suave, opacity: f3 }); T(g, 180, 148, 'mede prevalência; não sabe quem veio primeiro', { 'text-anchor': 'middle', fill: C.suave, 'font-size': 10, opacity: f3 });
    } else if (p.tipo === 'caso_controle') {
      hoje(290); caixa(280, 70, 'casos (com desfecho)', C.c, f1); caixa(280, 120, 'controles (sem)', C.a, f1);
      if (f2 > 0) { seta(g, 222, 70, 222 - 90 * f2, 70, C.c); seta(g, 222, 120, 222 - 90 * f2, 120, C.a); }
      caixa(76, 70, 'exposto antes?', C.suave, f3); caixa(76, 120, 'exposto antes?', C.suave, f3);
      T(g, 180, 156, 'parte do desfecho e olha para trás → odds ratio', { 'text-anchor': 'middle', fill: C.suave, 'font-size': 10, opacity: f3 });
    } else if (p.tipo === 'coorte') {
      hoje(p.retro ? 300 : 60); caixa(80, 70, 'expostos', C.a, f1); caixa(80, 120, 'não expostos', C.d, f1);
      if (f2 > 0) { seta(g, 138, 70, 138 + 90 * f2, 70, C.a); seta(g, 138, 120, 138 + 90 * f2, 120, C.d); }
      caixa(286, 70, 'desfecho?', C.c, f3); caixa(286, 120, 'desfecho?', C.c, f3);
      T(g, 180, 156, p.retro ? 'tudo já está nos registros (coorte retrospectiva)' : 'acompanha no tempo → incidência e risco relativo', { 'text-anchor': 'middle', fill: C.suave, 'font-size': 10, opacity: f3 });
    } else {
      hoje(40); caixa(66, 95, 'participantes', C.suave, f1);
      if (f2 > 0) { g.append(svg('rect', { x: 132, y: 80, width: 30, height: 30, rx: 6, fill: C.b, opacity: f2, transform: `rotate(${f2 * 180} 147 95)` })); T(g, 147, 126, 'sorteio', { 'text-anchor': 'middle', fill: C.b, 'font-size': 10, opacity: f2 }); seta(g, 164, 88, 198, 70, C.a); seta(g, 164, 102, 198, 120, C.d); }
      caixa(254, 70, 'intervenção → desfecho', C.a, f3); caixa(254, 120, 'controle → desfecho', C.d, f3);
      T(g, 180, 156, 'o sorteio equilibra os confundidores', { 'text-anchor': 'middle', fill: C.suave, 'font-size': 10, opacity: f3 });
    }
  },

  valor_p(g, t, p) {
    const mx = 180, ex = 36, base = 160, alt = 110, z = p.z * suave(fase(t, 0.1, 0.7));
    linha(g, 20, base, 340, base); curvaNormal(g, mx, ex, base, alt, C.suave);
    T(g, mx, 30, 'se não houvesse diferença (H0)…', { 'text-anchor': 'middle', fill: C.suave, 'font-size': 10 });
    if (z > 0.05) { area(g, mx, ex, base, alt, z, 4, C.c); area(g, mx, ex, base, alt, -4, -z, C.c); }
    linha(g, mx + z * ex, 44, mx + z * ex, base, { stroke: C.b, 'stroke-width': 2.5 }); T(g, mx + z * ex, 40, 'seu resultado', { 'text-anchor': 'middle', fill: C.b, 'font-size': 10 });
    const pv = 2 * pnorm(-Math.abs(z));
    T(g, 180, 186, `área vermelha = valor-p = ${pv < 0.001 ? '< 0,001' : n1(pv, 3)}`, { 'text-anchor': 'middle', fill: pv < 0.05 ? C.c : C.texto, 'font-weight': 700 });
  },

  grupos(g, t, p) {
    const r = gerador(21), k = p.medias.length, larg = 300 / k;
    const todos = p.medias.map((m) => Array.from({ length: 14 }, () => m + r.normal() * p.dp));
    const flat = todos.flat(), min = Math.min(...flat), max = Math.max(...flat), Y = (v) => 165 - ((v - min) / (max - min)) * 130;
    const cores = [C.a, C.b, C.d, C.c];
    const medias = todos.map((v) => v.reduce((s, x) => s + x, 0) / v.length), geral = flat.reduce((s, x) => s + x, 0) / flat.length;
    todos.forEach((v, i) => {
      const cx = 30 + larg * (i + 0.5), n = Math.floor(fase(t, 0, 0.45) * v.length);
      v.slice(0, n).forEach((val, j) => g.append(svg('circle', { cx: cx + (((j * 7919) % 11) - 5) * 3.2, cy: Y(val), r: 4, fill: cores[i], 'fill-opacity': 0.75 })));
      const f = fase(t, 0.45, 0.65); if (f > 0) linha(g, cx - 30 * f, Y(medias[i]), cx + 30 * f, Y(medias[i]), { stroke: cores[i], 'stroke-width': 3 });
      T(g, cx, 186, p.rotulos[i], { 'text-anchor': 'middle', 'font-size': 10 });
    });
    const f3 = fase(t, 0.68, 0.92);
    if (f3 > 0 && k === 2) {
      const x = 180; linha(g, x, Y(medias[0]), x, Y(medias[1]), { stroke: C.texto, 'stroke-width': 2, opacity: f3 });
      T(g, x + 6, (Y(medias[0]) + Y(medias[1])) / 2 + 3, 'diferença (sinal)', { opacity: f3, 'font-size': 10 });
      T(g, 180, 16, 'o teste compara a diferença com a dispersão (ruído)', { 'text-anchor': 'middle', fill: C.suave, 'font-size': 10, opacity: f3 });
    }
    if (f3 > 0 && k > 2) {
      linha(g, 24, Y(geral), 336, Y(geral), { stroke: C.texto, 'stroke-dasharray': '5 4', opacity: f3 }); T(g, 334, Y(geral) - 5, 'média geral', { 'text-anchor': 'end', 'font-size': 10, opacity: f3 });
      T(g, 180, 16, 'F = variação ENTRE os grupos ÷ variação DENTRO dos grupos', { 'text-anchor': 'middle', fill: C.suave, 'font-size': 10, opacity: f3 });
    }
  },

  pareado(g, t) {
    const r = gerador(4), antes = Array.from({ length: 12 }, () => 150 + r.normal() * 14), depois = antes.map((a) => a - 9 + r.normal() * 5);
    const Y = (v) => 170 - ((v - 115) / 70) * 140, k = fase(t, 0, 0.7) * antes.length;
    T(g, 90, 190, 'antes', { 'text-anchor': 'middle' }); T(g, 270, 190, 'depois', { 'text-anchor': 'middle' });
    antes.forEach((a, i) => {
      if (i > k) return; const f = cl(k - i);
      g.append(svg('circle', { cx: 90, cy: Y(a), r: 4, fill: C.d }));
      linha(g, 90, Y(a), 90 + 180 * f, Y(a) + (Y(depois[i]) - Y(a)) * f, { stroke: depois[i] < a ? C.a : C.c, 'stroke-opacity': 0.7, 'stroke-width': 1.6 });
      if (f >= 1) g.append(svg('circle', { cx: 270, cy: Y(depois[i]), r: 4, fill: C.b }));
    });
    const dif = depois.reduce((s, d, i) => s + d - antes[i], 0) / 12;
    T(g, 180, 16, `cada paciente é o seu próprio controle · diferença média ${n1(dif)} mmHg`, { 'text-anchor': 'middle', fill: C.suave, 'font-size': 10, opacity: fase(t, 0.75, 0.95) });
  },

  postos(g, t) {
    const vals = [3, 4, 5, 6, 7, 48], grupo = [0, 1, 0, 1, 0, 1], f = suave(fase(t, 0.4, 0.8));
    T(g, 180, 20, f < 0.5 ? 'valores originais: um paciente ficou 48 dias' : 'postos: só a ordem importa', { 'text-anchor': 'middle', fill: C.suave });
    linha(g, 20, 110, 340, 110);
    vals.forEach((v, i) => {
      const xOrig = 30 + (v / 50) * 300, xPosto = 55 + i * 50, x = xOrig + (xPosto - xOrig) * f;
      g.append(svg('circle', { cx: x, cy: 96, r: 11, fill: grupo[i] ? C.b : C.a, 'fill-opacity': 0.85 }));
      T(g, x, 100, f < 0.5 ? `${v}` : `${i + 1}º`, { 'text-anchor': 'middle', fill: '#0B1220', 'font-weight': 700, 'font-size': 10 });
    });
    T(g, 180, 150, 'o valor extremo vira apenas "o maior" e para de distorcer', { 'text-anchor': 'middle', 'font-size': 10, opacity: fase(t, 0.8, 1) });
    T(g, 110, 176, '● grupo A', { fill: C.a, 'font-size': 10 }); T(g, 200, 176, '● grupo B', { fill: C.b, 'font-size': 10 });
  },

  tabela2x2(g, t, p) {
    const diag = p.modo === 'diag';
    const paineis = [[diag ? 'Doentes' : 'Expostos', p.a, p.a + p.b, 24], [diag ? 'Sadios' : 'Não expostos', p.c, p.c + p.d, 196]];
    paineis.forEach(([nome, ev, tot, x0], k) => {
      T(g, x0, 22, `${nome} (n = ${tot})`, { 'font-weight': 700 });
      const n = Math.floor(fase(t, k * 0.25, k * 0.25 + 0.3) * tot);
      for (let i = 0; i < n; i++) g.append(svg('circle', { cx: x0 + 8 + (i % 7) * 20, cy: 40 + Math.floor(i / 7) * 20, r: 7, fill: i < ev ? (diag && k === 1 ? C.b : C.c) : C.grade, stroke: C.suave, 'stroke-opacity': 0.4 }));
      const f = fase(t, 0.6, 0.75);
      T(g, x0, 132, diag ? `teste positivo: ${ev}/${tot} = ${n1(ev / tot * 100, 0)}%` : `com desfecho: ${ev}/${tot} = ${n1(ev / tot * 100, 0)}%`, { opacity: f, fill: C.suave });
    });
    const f = fase(t, 0.8, 0.95), r1 = p.a / (p.a + p.b), r0 = p.c / (p.c + p.d);
    const txt = diag ? `sensibilidade ${n1(r1 * 100, 0)}% · especificidade ${n1((1 - r0) * 100, 0)}%`
      : p.medida === 'or' ? `odds ratio = (${p.a}×${p.d}) ÷ (${p.b}×${p.c}) = ${n1((p.a * p.d) / (p.b * p.c), 2)}`
        : `risco relativo = ${n1(r1 * 100, 0)}% ÷ ${n1(r0 * 100, 0)}% = ${n1(r1 / r0, 2)}`;
    T(g, 180, 166, txt, { 'text-anchor': 'middle', fill: C.b, 'font-weight': 700, 'font-size': 13, opacity: f });
    if (p.nota) T(g, 180, 186, p.nota, { 'text-anchor': 'middle', fill: C.suave, 'font-size': 10, opacity: f });
  },

  dispersao(g, t, p) {
    const r = gerador(p.semente || 12), n = 34;
    const xs = Array.from({ length: n }, () => r.normal()), ys = xs.map((x) => p.r * x + Math.sqrt(1 - p.r ** 2) * r.normal());
    const X = (v) => 180 + v * 52, Y = (v) => 100 - v * 30, k = Math.floor(fase(t, 0, 0.55) * n);
    linha(g, 30, 178, 340, 178); linha(g, 30, 20, 30, 178);
    T(g, 336, 192, p.x || 'x', { 'text-anchor': 'end', fill: C.suave, 'font-size': 10 }); T(g, 34, 28, p.y || 'y', { fill: C.suave, 'font-size': 10 });
    const mx = xs.reduce((s, v) => s + v, 0) / n, my = ys.reduce((s, v) => s + v, 0) / n;
    const b = xs.reduce((s, v, i) => s + (v - mx) * (ys[i] - my), 0) / xs.reduce((s, v) => s + (v - mx) ** 2, 0), a = my - b * mx;
    const fr = fase(t, 0.8, 0.98);
    xs.slice(0, k).forEach((x, i) => {
      if (p.residuos && fr > 0) linha(g, X(x), Y(ys[i]), X(x), Y(ys[i]) + (Y(a + b * x) - Y(ys[i])) * fr, { stroke: C.c, 'stroke-opacity': 0.8 });
      g.append(svg('circle', { cx: X(x), cy: Y(ys[i]), r: 4, fill: C.d, 'fill-opacity': 0.8 }));
    });
    const fl = fase(t, 0.58, 0.8);
    if (p.reta !== false && fl > 0) linha(g, X(-2.6), Y(a - 2.6 * b), X(-2.6 + 5.2 * fl), Y(a + (-2.6 + 5.2 * fl) * b), { stroke: C.b, 'stroke-width': 2.5 });
    const sxy = xs.reduce((s, v, i) => s + (v - mx) * (ys[i] - my), 0), rr = sxy / Math.sqrt(xs.reduce((s, v) => s + (v - mx) ** 2, 0) * ys.reduce((s, v) => s + (v - my) ** 2, 0));
    T(g, 334, 34, p.residuos ? 'resíduos = distância de cada ponto à reta' : `r = ${n1(rr, 2)}`, { 'text-anchor': 'end', fill: p.residuos ? C.c : C.b, 'font-weight': 700, opacity: p.residuos ? fr : fl });
  },

  logistica(g, t) {
    const r = gerador(8), X = (v) => 40 + (v / 20) * 290, Y = (pr) => 160 - pr * 120, prob = (x) => 1 / (1 + Math.exp(-(x - 10) * 0.45));
    linha(g, 36, 160, 336, 160); linha(g, 36, 40, 336, 40, { stroke: C.grade });
    T(g, 4, 44, 'óbito', { 'font-size': 10, fill: C.c }); T(g, 4, 164, 'alta', { 'font-size': 10, fill: C.a }); T(g, 336, 178, 'escore de gravidade →', { 'text-anchor': 'end', fill: C.suave, 'font-size': 10 });
    const n = Math.floor(fase(t, 0, 0.5) * 40);
    for (let i = 0; i < n; i++) { const x = r.unif() * 20, ev = r.unif() < prob(x); g.append(svg('circle', { cx: X(x), cy: (ev ? 40 : 160) + (r.unif() - 0.5) * 12, r: 3.5, fill: ev ? C.c : C.a, 'fill-opacity': 0.8 })); }
    const f = fase(t, 0.5, 0.9), pts = [];
    for (let x = 0; x <= 20 * f; x += 0.4) pts.push(`${X(x)},${Y(prob(x))}`);
    if (pts.length > 1) g.append(svg('polyline', { points: pts.join(' '), fill: 'none', stroke: C.b, 'stroke-width': 3 }));
    T(g, 180, 20, 'a curva estima a probabilidade do desfecho (entre 0 e 1)', { 'text-anchor': 'middle', fill: C.suave, 'font-size': 10, opacity: fase(t, 0.85, 1) });
  },

  poder(g, t) {
    const desloc = 0.8 + 3 * suave(fase(t, 0.15, 0.9)), ex = 30, base = 150, alt = 95, m0 = 110;
    linha(g, 10, base, 350, base);
    area(g, m0 + desloc * ex, ex, base, alt, -4, 1.96 - desloc, C.c); area(g, m0 + desloc * ex, ex, base, alt, 1.96 - desloc, 4, C.a);
    curvaNormal(g, m0, ex, base, alt, C.suave); curvaNormal(g, m0 + desloc * ex, ex, base, alt, C.a);
    linha(g, m0 + 1.96 * ex, 30, m0 + 1.96 * ex, base, { stroke: C.b, 'stroke-dasharray': '4 3' }); T(g, m0 + 1.96 * ex + 4, 38, 'limite de α = 5%', { fill: C.b, 'font-size': 10 });
    T(g, m0, 46, 'sem efeito', { 'text-anchor': 'middle', fill: C.suave, 'font-size': 10 }); T(g, m0 + desloc * ex, 62, 'com efeito', { 'text-anchor': 'middle', fill: C.a, 'font-size': 10 });
    const pod = 1 - pnorm(1.96 - desloc);
    T(g, 180, 172, `amostra ${desloc < 1.5 ? 'pequena' : desloc < 2.8 ? 'média' : 'grande'} → poder ${n1(pod * 100, 0)}%`, { 'text-anchor': 'middle', 'font-weight': 700 });
    T(g, 180, 190, 'verde = detecta o efeito (poder) · vermelho = deixa passar (erro tipo II)', { 'text-anchor': 'middle', fill: C.suave, 'font-size': 10 });
  },

  sobrevida(g, t) {
    const A = [[0, 1], [3, 0.92], [6, 0.85], [9, 0.8], [14, 0.74], [20, 0.7], [30, 0.66]], B = [[0, 1], [2, 0.84], [5, 0.7], [8, 0.58], [12, 0.48], [18, 0.4], [30, 0.34]];
    const X = (d) => 40 + (d / 30) * 290, Y = (s) => 165 - s * 135, lim = fase(t, 0, 0.8) * 30;
    linha(g, 40, 165, 336, 165); linha(g, 40, 24, 40, 165); T(g, 336, 182, 'dias de seguimento', { 'text-anchor': 'end', fill: C.suave, 'font-size': 10 }); T(g, 44, 22, '% sem o evento', { fill: C.suave, 'font-size': 10 });
    [[A, C.a, 'esquema novo'], [B, C.c, 'esquema usual']].forEach(([curva, cor, nome]) => {
      const pts = [];
      curva.forEach(([d, s], i) => { if (d > lim) return; if (i) pts.push(`${X(d)},${Y(curva[i - 1][1])}`); pts.push(`${X(d)},${Y(s)}`); });
      const ult = curva.filter(([d]) => d <= lim).at(-1); pts.push(`${X(lim)},${Y(ult[1])}`);
      g.append(svg('polyline', { points: pts.join(' '), fill: 'none', stroke: cor, 'stroke-width': 2.5 }));
      if (lim > 16) linha(g, X(16), Y(ult[1]) - 5, X(16), Y(ult[1]) + 5, { stroke: cor });
      T(g, X(lim) - 4, Y(ult[1]) - 6, nome, { 'text-anchor': 'end', fill: cor, 'font-size': 10 });
    });
    T(g, 190, 196, 'tracinho = censura (paciente saiu sem ter o evento)', { 'text-anchor': 'middle', fill: C.suave, 'font-size': 10, opacity: fase(t, 0.6, 0.8) });
  },

  confundimento(g, t, p) {
    const no = (x, y, txt, cor, o) => { g.append(svg('rect', { x: x - 58, y: y - 16, width: 116, height: 30, rx: 10, fill: cor, 'fill-opacity': 0.16 * o, stroke: cor, 'stroke-opacity': o })); T(g, x, y + 3, txt, { 'text-anchor': 'middle', 'font-size': 10, opacity: o }); };
    const f1 = suave(fase(t, 0, 0.25)), f2 = suave(fase(t, 0.3, 0.6)), f3 = suave(fase(t, 0.65, 0.9));
    no(76, 140, p.exposicao, C.d, f1); no(284, 140, p.desfecho, C.c, f1);
    if (f1 > 0.5) seta(g, 136, 140, 136 + 88 * f1, 140, f3 > 0.5 ? C.suave : C.b, f3 > 0.5 ? { 'stroke-dasharray': '5 4' } : {});
    T(g, 180, 132, f3 > 0.5 ? 'associação aparente' : 'causa?', { 'text-anchor': 'middle', fill: C.suave, 'font-size': 10, opacity: f1 });
    if (f2 > 0) { no(180, 46, p.confundidor, C.b, f2); seta(g, 150, 64, 150 - 50 * f2, 64 + 58 * f2, C.b); seta(g, 210, 64, 210 + 50 * f2, 64 + 58 * f2, C.b); }
    T(g, 180, 186, 'o confundidor causa os dois e cria uma associação falsa entre eles', { 'text-anchor': 'middle', fill: C.suave, 'font-size': 10, opacity: f3 });
  },

  roc(g, t) {
    const pts = [[0, 0], [0.03, 0.3], [0.08, 0.55], [0.15, 0.72], [0.25, 0.83], [0.4, 0.91], [0.6, 0.96], [1, 1]], X = (v) => 70 + v * 220, Y = (v) => 170 - v * 145;
    linha(g, 70, 170, 290, 170); linha(g, 70, 25, 70, 170); linha(g, X(0), Y(0), X(1), Y(1), { 'stroke-dasharray': '4 4' });
    T(g, 180, 190, '1 − especificidade (falsos positivos)', { 'text-anchor': 'middle', fill: C.suave, 'font-size': 10 }); T(g, 8, 20, 'sensibilidade', { fill: C.suave, 'font-size': 10 });
    const k = fase(t, 0, 0.7) * (pts.length - 1), vis = pts.slice(0, Math.floor(k) + 1);
    if (Math.floor(k) < pts.length - 1) { const a = pts[Math.floor(k)], b = pts[Math.floor(k) + 1], f = k - Math.floor(k); vis.push([a[0] + (b[0] - a[0]) * f, a[1] + (b[1] - a[1]) * f]); }
    g.append(svg('polyline', { points: vis.map(([x, y]) => `${X(x)},${Y(y)}`).join(' '), fill: 'none', stroke: C.a, 'stroke-width': 3 }));
    const f = fase(t, 0.72, 0.92);
    g.append(svg('circle', { cx: X(0.15), cy: Y(0.72), r: 6, fill: C.b, opacity: f })); T(g, X(0.15) + 10, Y(0.72) + 14, 'melhor ponto de corte', { fill: C.b, 'font-size': 10, opacity: f });
    T(g, 230, 120, 'AUC = 0,87', { fill: C.a, 'font-weight': 700, opacity: f }); T(g, 222, 136, '(0,5 = acaso; 1 = perfeito)', { fill: C.suave, 'font-size': 9, opacity: f });
  },
};

export const TIPOS_ANIMACAO = Object.keys(ANIM);

/** Desenha no SVG o quadro t (0 a 1) da animação pedida. */
export function desenharQuadro(svgEl, tipo, t, params = {}) {
  svgEl.replaceChildren();
  (ANIM[tipo] || ANIM.titulo)(svgEl, cl(t), params);
}
