// Distribuições de probabilidade em JavaScript puro.
// Precisão conferida contra o R 4.6 em testes/amostra.test.js (casos gerados no próprio R).

const RAIZ_2PI = Math.sqrt(2 * Math.PI);

/** Logaritmo da função gama (aproximação de Lanczos, g = 7, 9 coeficientes; erro ~1e-15). */
const LANCZOS = [0.99999999999980993, 676.5203681218851, -1259.1392167224028, 771.32342877765313,
  -176.61502916214059, 12.507343278686905, -0.13857109526572012, 9.9843695780195716e-6, 1.5056327351493116e-7];
export function lgama(x) {
  if (x < 0.5) return Math.log(Math.PI / Math.abs(Math.sin(Math.PI * x))) - lgama(1 - x);
  x -= 1;
  let a = LANCZOS[0];
  const t = x + 7.5;
  for (let i = 1; i < 9; i++) a += LANCZOS[i] / (x + i);
  return 0.5 * Math.log(2 * Math.PI) + (x + 0.5) * Math.log(t) - t + Math.log(a);
}

/** Função erro complementar com precisão ~1e-15 (série para |x|<2, fração contínua acima). */
function erfc(x) {
  if (x < 0) return 2 - erfc(-x);
  if (x < 2) {
    // erf por série de Taylor: erf(x) = 2/√π Σ (-1)^n x^(2n+1) / (n! (2n+1))
    let soma = x, termo = x;
    for (let n = 1; n < 200; n++) {
      termo *= -x * x / n;
      const parcela = termo / (2 * n + 1);
      soma += parcela;
      if (Math.abs(parcela) < 1e-17 * Math.abs(soma)) break;
    }
    return 1 - (2 / Math.sqrt(Math.PI)) * soma;
  }
  // Fração contínua de Lentz para erfc
  const pequeno = 1e-300;
  let f = x, C = x, D = 0;
  for (let n = 1; n < 500; n++) {
    const an = n / 2;
    D = x + an * D; D = Math.abs(D) < pequeno ? pequeno : D; D = 1 / D;
    C = x + an / C; C = Math.abs(C) < pequeno ? pequeno : C;
    const delta = C * D;
    f *= delta;
    if (Math.abs(delta - 1) < 1e-16) break;
  }
  return Math.exp(-x * x) / (f * Math.sqrt(Math.PI));
}

/** Distribuição normal padrão acumulada: P(Z ≤ x). */
export function pnorm(x) {
  return 0.5 * erfc(-x / Math.SQRT2);
}

/** Densidade normal padrão. */
export function dnorm(x) {
  return Math.exp(-0.5 * x * x) / RAIZ_2PI;
}

/** Quantil da normal padrão: algoritmo de Acklam + 2 passos de Halley (precisão de máquina). */
export function qnorm(p) {
  if (!(p > 0 && p < 1)) throw new RangeError('qnorm: p deve estar entre 0 e 1.');
  const a = [-3.969683028665376e+01, 2.209460984245205e+02, -2.759285104469687e+02, 1.383577518672690e+02, -3.066479806614716e+01, 2.506628277459239e+00];
  const b = [-5.447609879822406e+01, 1.615858368580409e+02, -1.556989798598866e+02, 6.680131188771972e+01, -1.328068155288572e+01];
  const c = [-7.784894002430293e-03, -3.223964580411365e-01, -2.400758277161838e+00, -2.549732539343734e+00, 4.374664141464968e+00, 2.938163982698783e+00];
  const d = [7.784695709041462e-03, 3.224671290700398e-01, 2.445134137142996e+00, 3.754408661907416e+00];
  const pBaixo = 0.02425;
  let x;
  if (p < pBaixo) {
    const q = Math.sqrt(-2 * Math.log(p));
    x = (((((c[0] * q + c[1]) * q + c[2]) * q + c[3]) * q + c[4]) * q + c[5]) / ((((d[0] * q + d[1]) * q + d[2]) * q + d[3]) * q + 1);
  } else if (p <= 1 - pBaixo) {
    const q = p - 0.5, r = q * q;
    x = (((((a[0] * r + a[1]) * r + a[2]) * r + a[3]) * r + a[4]) * r + a[5]) * q / (((((b[0] * r + b[1]) * r + b[2]) * r + b[3]) * r + b[4]) * r + 1);
  } else {
    const q = Math.sqrt(-2 * Math.log(1 - p));
    x = -(((((c[0] * q + c[1]) * q + c[2]) * q + c[3]) * q + c[4]) * q + c[5]) / ((((d[0] * q + d[1]) * q + d[2]) * q + d[3]) * q + 1);
  }
  for (let i = 0; i < 2; i++) { // refinamento de Halley
    const e = pnorm(x) - p;
    const u = e * RAIZ_2PI * Math.exp(x * x / 2);
    x -= u / (1 + x * u / 2);
  }
  return x;
}

/** Beta incompleta regularizada I_x(a, b) por fração contínua (Lentz). */
export function betaIncompleta(x, a, b) {
  if (x <= 0) return 0;
  if (x >= 1) return 1;
  const lnFrente = lgama(a + b) - lgama(a) - lgama(b) + a * Math.log(x) + b * Math.log(1 - x);
  if (x > (a + 1) / (a + b + 2)) return 1 - betaIncompleta(1 - x, b, a);
  const pequeno = 1e-300;
  let C = 1, D = 1 - (a + b) * x / (a + 1);
  D = Math.abs(D) < pequeno ? pequeno : D; D = 1 / D;
  let f = D;
  for (let m = 1; m < 1000; m++) {
    const m2 = 2 * m;
    let aa = m * (b - m) * x / ((a + m2 - 1) * (a + m2));
    D = 1 + aa * D; D = Math.abs(D) < pequeno ? pequeno : D; D = 1 / D;
    C = 1 + aa / C; C = Math.abs(C) < pequeno ? pequeno : C;
    f *= D * C;
    aa = -(a + m) * (a + b + m) * x / ((a + m2) * (a + m2 + 1));
    D = 1 + aa * D; D = Math.abs(D) < pequeno ? pequeno : D; D = 1 / D;
    C = 1 + aa / C; C = Math.abs(C) < pequeno ? pequeno : C;
    const delta = D * C;
    f *= delta;
    if (Math.abs(delta - 1) < 1e-15) break;
  }
  return Math.exp(lnFrente) * f / a;
}

/** t de Student acumulada: P(T ≤ t) com gl graus de liberdade. */
export function pt(t, gl) {
  const x = gl / (gl + t * t);
  const cauda = 0.5 * betaIncompleta(x, gl / 2, 0.5);
  return t >= 0 ? 1 - cauda : cauda;
}

/** Quantil da t de Student (Newton com salvaguarda por bissecção). */
export function qt(p, gl) {
  if (!(p > 0 && p < 1)) throw new RangeError('qt: p deve estar entre 0 e 1.');
  let x = qnorm(p);
  let baixo = -1e6, alto = 1e6;
  for (let i = 0; i < 200; i++) {
    const erro = pt(x, gl) - p;
    if (Math.abs(erro) < 1e-15) break;
    if (erro > 0) alto = x; else baixo = x;
    const dens = Math.exp(lgama((gl + 1) / 2) - lgama(gl / 2) - 0.5 * Math.log(gl * Math.PI) - ((gl + 1) / 2) * Math.log(1 + x * x / gl));
    let novo = x - erro / dens;
    if (!(novo > baixo && novo < alto)) novo = (baixo + alto) / 2;
    if (Math.abs(novo - x) < 1e-14 * Math.max(1, Math.abs(x))) { x = novo; break; }
    x = novo;
  }
  return x;
}

/**
 * t não central acumulada P(T ≤ t | gl, delta) — algoritmo AS 243 (Lenth, 1989),
 * o mesmo usado pelo R em pt(..., ncp).
 */
export function ptNaoCentral(t, gl, delta) {
  if (delta === 0) return pt(t, gl);
  let tt = t, del = delta, negativo = false;
  if (t < 0) { negativo = true; tt = -t; del = -delta; }
  const x = tt * tt / (tt * tt + gl);
  let tnc = 0;
  if (x > 0) {
    const lambda = del * del;
    let p = 0.5 * Math.exp(-0.5 * lambda);
    let q = Math.sqrt(2 / Math.PI) * p * del;
    let s = 0.5 - p;
    if (s < 1e-7) s = -0.5 * Math.expm1(-0.5 * lambda);
    let a = 0.5;
    const b = 0.5 * gl;
    const rxb = Math.pow(1 - x, b);
    const albeta = 0.5 * Math.log(Math.PI) + lgama(b) - lgama(0.5 + b);
    let xodd = betaIncompleta(x, a, b);
    let godd = 2 * rxb * Math.exp(a * Math.log(x) - albeta);
    tnc = b * x;
    let xeven = tnc < Number.EPSILON ? tnc : 1 - rxb;
    let geven = tnc * rxb;
    tnc = p * xodd + q * xeven;
    for (let en = 1; en <= 1000; en++) {
      a += 1;
      xodd -= godd;
      xeven -= geven;
      godd *= x * (a + b - 1) / a;
      geven *= x * (a + b - 0.5) / (a + 0.5);
      p *= lambda / (2 * en);
      q *= lambda / (2 * en + 1);
      s -= p;
      tnc += p * xodd + q * xeven;
      const errbd = 2 * s * (xodd - godd);
      if (Math.abs(errbd) < 1e-13) break;
    }
  }
  tnc += pnorm(-del);
  const resultado = negativo ? 1 - tnc : tnc;
  return Math.min(1, Math.max(0, resultado));
}

/** Raiz de f em [a, b] por Brent (f(a) e f(b) com sinais opostos). */
export function raiz(f, a, b, tol = 1e-10) {
  let fa = f(a), fb = f(b);
  if (fa * fb > 0) throw new RangeError('raiz: o intervalo não contém solução.');
  let c = a, fc = fa, d = b - a, e = d;
  for (let i = 0; i < 300; i++) {
    if (fb * fc > 0) { c = a; fc = fa; d = b - a; e = d; }
    if (Math.abs(fc) < Math.abs(fb)) { a = b; b = c; c = a; fa = fb; fb = fc; fc = fa; }
    const tol1 = 2 * Number.EPSILON * Math.abs(b) + tol / 2;
    const m = (c - b) / 2;
    if (Math.abs(m) <= tol1 || fb === 0) return b;
    if (Math.abs(e) >= tol1 && Math.abs(fa) > Math.abs(fb)) {
      const s = fb / fa;
      let p, q;
      if (a === c) { p = 2 * m * s; q = 1 - s; } else {
        const qq = fa / fc, r = fb / fc;
        p = s * (2 * m * qq * (qq - r) - (b - a) * (r - 1));
        q = (qq - 1) * (r - 1) * (s - 1);
      }
      if (p > 0) q = -q; else p = -p;
      if (2 * p < Math.min(3 * m * q - Math.abs(tol1 * q), Math.abs(e * q))) { e = d; d = p / q; } else { d = m; e = d; }
    } else { d = m; e = d; }
    a = b; fa = fb;
    b += Math.abs(d) > tol1 ? d : (m > 0 ? tol1 : -tol1);
    fb = f(b);
  }
  return b;
}
