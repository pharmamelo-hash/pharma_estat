// Biblioteca de análises (src/r/biblioteca.R) executada no mesmo webR do app.
// Cada análise é comparada com a chamada direta da função do R sobre os mesmos dados.
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { readFileSync } from 'node:fs';
import { WebR } from 'webr';

let webR;
const BIB = readFileSync(new URL('../src/r/biblioteca.R', import.meta.url), 'utf8');

async function rodar(id, dados, papeis) {
  await webR.objs.globalEnv.bind('dados_app', await new webR.RList(dados));
  await webR.objs.globalEnv.bind('papeis_app', await new webR.RList(papeis));
  const txt = await webR.evalRString(`executar_analise("${id}", dados_app, papeis_app)`);
  return JSON.parse(txt);
}
const num = (expr) => webR.evalRNumber(expr);
const perto = (a, b, tol = 1e-9) => expect(Math.abs(a - b), `${a} vs ${b}`).toBeLessThan(tol * Math.max(1, Math.abs(b)));
const res = (r, id) => r.resultados.find((x) => x.teste === id);

// Dados de exemplo fixos (sem aleatoriedade)
const sleep = { extra: [0.7, -1.6, -0.2, -1.2, -0.1, 3.4, 3.7, 0.8, 0.0, 2.0, 1.9, 0.8, 1.1, 0.1, -0.1, 4.4, 5.5, 1.6, 4.6, 3.4], grupo: [...Array(10).fill('A'), ...Array(10).fill('B')] };
const tres = { y: [4.2, 5.1, 3.9, 4.8, 5.0, 6.1, 6.8, 5.9, 6.4, 7.0, 8.2, 7.7, 9.1, 8.0, 8.8], g: [...Array(5).fill('c1'), ...Array(5).fill('c2'), ...Array(5).fill('c3')] };
const cat = { exp: ['sim', 'sim', 'sim', 'sim', 'sim', 'sim', 'sim', 'sim', 'nao', 'nao', 'nao', 'nao', 'nao', 'nao', 'nao', 'nao', 'nao', 'nao', 'sim', 'nao'], ev: ['s', 's', 's', 's', 's', 'n', 'n', 'n', 's', 's', 'n', 'n', 'n', 'n', 'n', 'n', 'n', 'n', 's', 'n'] };

beforeAll(async () => {
  webR = new WebR({ interactive: false });
  await webR.init();
  await webR.evalRVoid(BIB);
}, 180000);
afterAll(() => webR?.close());

describe('biblioteca R do app', () => {
  it('dois grupos: Welch e Mann-Whitney iguais às funções do R', async () => {
    const r = await rodar('t_t_welch', { extra: sleep.extra, grupo: sleep.grupo }, { y: 'extra', g: 'grupo' });
    expect(r.ok).toBe(true);
    await webR.objs.globalEnv.bind('s', await new webR.RList(sleep));
    perto(res(r, 't_t_welch').p, await num('t.test(s$extra ~ factor(s$grupo))$p.value'));
    perto(res(r, 't_t_welch').p, 0.07939414, 1e-6); // valor clássico do conjunto sleep
    perto(res(r, 't_mann_whitney').p, await num('suppressWarnings(wilcox.test(s$extra ~ factor(s$grupo))$p.value)'));
    expect(r.grafico).toBeNull(); // gráficos são desenhados em JS no navegador
  });

  it('pareado: t pareado e Wilcoxon', async () => {
    const d = { antes: sleep.extra.slice(0, 10), depois: sleep.extra.slice(10) };
    const r = await rodar('t_t_pareado', d, { y: 'antes', y2: 'depois' });
    await webR.objs.globalEnv.bind('p', await new webR.RList(d));
    perto(res(r, 't_t_pareado').p, await num('t.test(p$depois, p$antes, paired = TRUE)$p.value'));
    perto(res(r, 't_t_pareado').efeito.valor, 1.58, 1e-9);
    perto(res(r, 't_wilcoxon_pareado').p, await num('suppressWarnings(wilcox.test(p$depois, p$antes, paired = TRUE)$p.value)'));
  });

  it('três grupos: ANOVA, Welch e Kruskal-Wallis', async () => {
    const r = await rodar('t_anova_um_fator', tres, { y: 'y', g: 'g' });
    await webR.objs.globalEnv.bind('t3', await new webR.RList(tres));
    perto(res(r, 't_anova_um_fator').p, await num('summary(aov(t3$y ~ factor(t3$g)))[[1]][["Pr(>F)"]][1]'));
    perto(res(r, 't_welch_anova').p, await num('oneway.test(t3$y ~ factor(t3$g))$p.value'));
    perto(res(r, 't_kruskal_wallis').p, await num('kruskal.test(t3$y ~ factor(t3$g))$p.value'));
    expect(res(r, 't_anova_um_fator').pares).toHaveLength(3);
  });

  it('categóricas: qui-quadrado, Fisher e RR com exposto/evento escolhidos', async () => {
    const r = await rodar('t_qui_quadrado', cat, { g: 'exp', y: 'ev', nivel_exposto: 'sim', nivel_evento: 's' });
    await webR.objs.globalEnv.bind('ct', await new webR.RList(cat));
    perto(res(r, 't_fisher_exato').p, await num('fisher.test(table(ct$exp, ct$ev))$p.value'));
    perto(res(r, 't_qui_quadrado').p, await num('suppressWarnings(chisq.test(table(ct$exp, ct$ev), correct = FALSE)$p.value)'));
    // expostos: 9 com 6 eventos; não expostos: 11 com 2 eventos → RR = (6/9)/(2/11)
    perto(r.medidas_2x2.rr.valor, (6 / 9) / (2 / 11));
    expect(r.sugerido).toBe('t_fisher_exato'); // frequências esperadas baixas
  });

  it('McNemar, correlação, regressões, kappa, Bland-Altman e acurácia rodam sem erro', async () => {
    const pares = { a: ['s', 's', 'n', 'n', 's', 'n', 's', 'n', 'n', 'n'], b: ['s', 'n', 'n', 's', 's', 's', 's', 's', 'n', 's'] };
    expect((await rodar('t_mcnemar', pares, { y: 'a', y2: 'b', nivel_evento: 's' })).ok).toBe(true);
    const k = await rodar('t_kappa', pares, { y: 'a', y2: 'b' });
    expect(k.ok).toBe(true);
    const xy = { x: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12], y: [2.1, 3.9, 6.2, 7.8, 10.1, 12.2, 13.8, 16.1, 18.2, 19.9, 22.1, 24.0] };
    const c = await rodar('t_pearson', xy, { x: 'x', y: 'y' });
    await webR.objs.globalEnv.bind('xy', await new webR.RList(xy));
    perto(res(c, 't_pearson').efeito.valor, await num('cor(xy$x, xy$y)'));
    const l = await rodar('t_regressao_linear', xy, { y: 'y', x: ['x'], tipos: { x: 'quantitativo' } });
    perto(l.resultados[0].coeficientes[0].beta, await num('coef(lm(y ~ x, data = as.data.frame(xy)))[2]'));
    const log = { ev: ['s', 'n', 's', 'n', 'n', 's', 'n', 'n', 's', 'n', 's', 's', 'n', 'n', 'n', 's', 'n', 'n', 's', 'n'], dose: [9, 2, 8, 3, 5, 7, 1, 4, 6, 2, 9, 4, 3, 6, 2, 8, 1, 5, 7, 3] };
    const lg = await rodar('t_regressao_logistica', log, { y: 'ev', x: ['dose'], tipos: { dose: 'quantitativo' }, nivel_evento: 's' });
    await webR.objs.globalEnv.bind('lg', await new webR.RList(log));
    perto(lg.resultados[0].coeficientes[0].or, await num('exp(coef(glm(I(ev == "s") ~ dose, data = as.data.frame(lg), family = binomial))[2])'), 1e-7);
    expect(lg.pressupostos[0].estado).toBe('limite'); // 8 eventos na categoria menos frequente / 1 preditor = EPV 8 (entre 5 e 10)
  });

  it('Bland-Altman e acurácia', async () => {
    const m = { a: [10, 12, 9, 15, 20, 18, 11, 14, 16, 13], b: [11, 12, 10, 14, 21, 17, 12, 15, 15, 14] };
    const ba = await rodar('t_bland_altman', m, { y: 'a', y2: 'b' });
    perto(ba.resultados[0].efeito.valor, -0.3);
    const ac = { ref: ['d', 'd', 'd', 'd', 'd', 's', 's', 's', 's', 's', 's', 's'], teste: ['+', '+', '+', '+', '-', '-', '-', '-', '+', '-', '-', '-'] };
    const r = await rodar('t_acuracia_roc', ac, { y: 'ref', g: 'teste', nivel_evento: 'd', nivel_teste_positivo: '+', tipos: { teste: 'categorico' } });
    perto(r.resultados[0].medidas[0].valor, 4 / 5); // sensibilidade
    perto(r.resultados[0].medidas[1].valor, 6 / 7); // especificidade
  });

  it('erros viram mensagem amigável, sem quebrar', async () => {
    const r = await rodar('t_t_welch', tres, { y: 'y', g: 'g' });
    expect(r.ok).toBe(false);
    expect(r.erro).toMatch(/exatamente 2 categorias/);
    const r2 = await rodar('t_inexistente', tres, { y: 'y' });
    expect(r2.ok).toBe(false);
  });

  it('nome de coluna malicioso é tratado como dado, não como código', async () => {
    const nome = 'x"); system("echo invadido'; // tentativa de injeção
    const r = await rodar('t_t_welch', { [nome]: sleep.extra, grupo: sleep.grupo }, { y: nome, g: 'grupo' });
    expect(r.ok).toBe(true);
    expect(r.descritivas[0].n).toBe(10);
  });
}, 300000);
