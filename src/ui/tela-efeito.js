// Tamanho de efeito (F18): d, g de Hedges, h, RR, OR e conversões. Recalcula ao digitar.
import { el, cabecalhoTela, aviso, numero } from './componentes.js';
import { paraNumero } from '../estado/dados.js';
import { efeitoMedias, efeitoProporcoes, dParaR, rParaD, orParaD, dParaOr, rotuloD, rotuloR, rotuloH } from '../calculo/efeito.js';
import { blocoCitar } from './citar.js';
import { icone } from './icones.js';

const memoria = { aba: 'medias', medias: { n1: '30', m1: '142', dp1: '18', n2: '30', m2: '131', dp2: '16' }, prop: { p1: '18', p2: '9' }, conv: { de: 'd', valor: '0,5' } };

function campo(id, rotulo, grupo, chave, aoMudar, ajuda) {
  return el('div', { class: 'campo' }, el('label', { for: id }, rotulo),
    el('input', { id, type: 'text', inputmode: 'decimal', autocomplete: 'off', value: memoria[grupo][chave], oninput: (e) => { memoria[grupo][chave] = e.target.value; aoMudar(); } }),
    ajuda ? el('small', { class: 'texto-suave' }, ajuda) : null);
}
// replaceChildren escreveria "null" como texto: filtramos antes.
const por = (alvo, ...nos) => alvo.replaceChildren(...nos.flat().filter(Boolean));
const cartaoValor = (rotulo, valor, sub) => el('div', { class: 'valor-efeito' }, el('small', {}, rotulo), el('strong', {}, valor), sub ? el('span', {}, sub) : null);

function abaMedias() {
  const saida = el('div', { 'aria-live': 'polite' });
  const calc = () => {
    const v = Object.fromEntries(Object.entries(memoria.medias).map(([k, x]) => [k, paraNumero(x)]));
    if (Object.values(v).some((x) => x === null) || v.n1 < 2 || v.n2 < 2 || v.dp1 <= 0 || v.dp2 <= 0) {
      por(saida, aviso('Preencha n (≥ 2), média e DP (> 0) dos dois grupos.', 'info')); return;
    }
    const r = efeitoMedias(v);
    por(saida, 
      el('div', { class: 'grade-efeito' },
        cartaoValor('d de Cohen', numero(r.d, 2), `${rotuloD(r.d)} · IC 95% ${numero(r.li, 2)} a ${numero(r.ls, 2)}`),
        cartaoValor('g de Hedges', numero(r.g, 2), 'd corrigido para amostras pequenas'),
        cartaoValor('DP combinado', numero(r.sp, 2), 'média ponderada das variâncias'),
        cartaoValor('r equivalente', numero(r.r, 2), rotuloR(r.r))),
      el('p', {}, `A média do grupo 1 está ${numero(Math.abs(r.d), 2)} desvio-padrão ${r.d >= 0 ? 'acima' : 'abaixo'} da do grupo 2. Com d = ${numero(r.d, 2)}, cerca de ${Math.round(100 * pnormAprox(Math.abs(r.d)))}% do grupo com maior média fica acima da média do outro grupo (U3 de Cohen).`),
      v.n1 + v.n2 < 40 ? aviso('Com menos de 40 participantes no total, relate o g de Hedges, que corrige o viés do d.', 'atencao') : null,
      el('a', { class: 'botao secundario', href: '#/planejar/amostra' }, icone('amostra', 16), 'Usar este efeito na calculadora amostral'));
  };
  calc();
  return [el('p', { class: 'texto-suave' }, 'Médias e desvios-padrão de dois grupos independentes (ex.: pressão sistólica com e sem a intervenção).'),
    el('div', { class: 'grade grade-3' },
      campo('ef-n1', 'n do grupo 1', 'medias', 'n1', calc), campo('ef-m1', 'Média do grupo 1', 'medias', 'm1', calc), campo('ef-dp1', 'DP do grupo 1', 'medias', 'dp1', calc),
      campo('ef-n2', 'n do grupo 2', 'medias', 'n2', calc), campo('ef-m2', 'Média do grupo 2', 'medias', 'm2', calc), campo('ef-dp2', 'DP do grupo 2', 'medias', 'dp2', calc)),
    saida];
}
// Φ(x) para o U3, sem importar a distribuição inteira na tela.
function pnormAprox(x) { const t = 1 / (1 + 0.2316419 * x); const d = 0.3989423 * Math.exp(-x * x / 2); return 1 - d * t * (0.3193815 + t * (-0.3565638 + t * (1.781478 + t * (-1.821256 + t * 1.330274)))); }

function abaProporcoes() {
  const saida = el('div', { 'aria-live': 'polite' });
  const calc = () => {
    let p1 = paraNumero(String(memoria.prop.p1).replace('%', '')), p2 = paraNumero(String(memoria.prop.p2).replace('%', ''));
    if (p1 === null || p2 === null) { por(saida, aviso('Informe as duas proporções (ex.: 18 ou 0,18).', 'info')); return; }
    if (p1 > 1) p1 /= 100; if (p2 > 1) p2 /= 100;
    if (!(p1 > 0 && p1 < 1 && p2 > 0 && p2 < 1)) { por(saida, aviso('As proporções precisam estar entre 0 e 100%, sem incluir os extremos.', 'erro')); return; }
    const r = efeitoProporcoes({ p1, p2 });
    const nnt = r.dif !== 0 ? Math.ceil(1 / Math.abs(r.dif)) : null;
    por(saida, 
      el('div', { class: 'grade-efeito' },
        cartaoValor('Diferença de risco', `${numero(r.dif * 100, 1)} p.p.`, nnt ? `${r.dif < 0 ? 'NNT' : 'NNH'} ≈ ${nnt}` : ''),
        cartaoValor('Risco relativo (RR)', numero(r.rr, 2), r.rr < 1 ? `redução de ${numero((1 - r.rr) * 100, 0)}%` : `aumento de ${numero((r.rr - 1) * 100, 0)}%`),
        cartaoValor('Odds ratio (OR)', numero(r.or, 2), Math.min(p1, p2) > 0.1 ? 'desfecho frequente: OR exagera o RR' : 'desfecho raro: OR ≈ RR'),
        cartaoValor('h de Cohen', numero(r.h, 2), rotuloH(r.h))),
      el('p', {}, `Em 100 pacientes de cada grupo, esperam-se ${numero(p1 * 100, 0)} eventos no grupo 1 e ${numero(p2 * 100, 0)} no grupo 2.${nnt ? ` Seria preciso tratar cerca de ${nnt} pacientes para ${r.dif < 0 ? 'evitar' : 'causar'} um evento a mais.` : ''}`),
      el('p', { class: 'texto-suave' }, 'O h de Cohen é o efeito usado pelo G*Power e pelo pacote pwr para proporções. Em estudos de coorte e ensaios, relate RR e diferença de risco; em caso-controle, só o OR é estimável.'));
  };
  calc();
  return [el('p', { class: 'texto-suave' }, 'Proporção do desfecho em cada grupo (ex.: infecção do sítio cirúrgico com e sem a nova profilaxia).'),
    el('div', { class: 'grade grade-2' }, campo('ef-p1', 'Proporção no grupo 1 (%)', 'prop', 'p1', calc), campo('ef-p2', 'Proporção no grupo 2 (%)', 'prop', 'p2', calc)),
    saida];
}

function abaConversoes() {
  const saida = el('div', { 'aria-live': 'polite' });
  const seletor = el('select', { id: 'conv-de', onchange: (e) => { memoria.conv.de = e.target.value; calc(); } },
    ...[['d', 'd de Cohen'], ['r', 'Correlação r'], ['or', 'Odds ratio']].map(([v, t]) => el('option', { value: v, selected: memoria.conv.de === v || null }, t)));
  function calc() {
    const x = paraNumero(memoria.conv.valor);
    const de = memoria.conv.de;
    if (x === null || (de === 'r' && !(x > -1 && x < 1)) || (de === 'or' && !(x > 0))) { por(saida, aviso(de === 'r' ? 'r precisa estar entre −1 e 1.' : de === 'or' ? 'O OR precisa ser maior que 0.' : 'Informe um número.', 'info')); return; }
    const d = de === 'd' ? x : de === 'r' ? rParaD(x) : orParaD(x);
    const r = dParaR(d), or = dParaOr(d);
    por(saida, 
      el('div', { class: 'grade-efeito' },
        cartaoValor('d de Cohen', numero(d, 2), rotuloD(d)), cartaoValor('r', numero(r, 2), rotuloR(r)),
        cartaoValor('Odds ratio', numero(or, 2), 'via log(OR)·√3/π'), cartaoValor('r²', numero(r * r, 3), 'variância explicada')),
      aviso('Conversões aproximadas (grupos de tamanho parecido e distribuição logística para o OR). Úteis para planejar ou comparar estudos, não para substituir a medida original do artigo.', 'atencao'));
  }
  calc();
  return [el('p', { class: 'texto-suave' }, 'Encontrou o efeito num artigo em outra escala? Converta para a que a sua calculadora pede.'),
    el('div', { class: 'grade grade-2' }, el('div', { class: 'campo' }, el('label', { for: 'conv-de' }, 'Tenho o valor de'), seletor), campo('conv-valor', 'Valor', 'conv', 'valor', calc)),
    saida];
}

export function telaEfeito() {
  const corpo = el('div', { class: 'cartao' });
  const abas = [['medias', 'Duas médias'], ['prop', 'Duas proporções'], ['conv', 'Converter medidas']];
  const barra = el('div', { class: 'segmentado', role: 'tablist', 'aria-label': 'Tipo de efeito' });
  const desenhar = () => {
    barra.replaceChildren(...abas.map(([id, t]) => el('button', { type: 'button', role: 'tab', 'aria-selected': String(memoria.aba === id), 'aria-pressed': String(memoria.aba === id), onclick: () => { memoria.aba = id; desenhar(); } }, t)));
    corpo.replaceChildren(...[memoria.aba === 'medias' ? abaMedias() : memoria.aba === 'prop' ? abaProporcoes() : abaConversoes()].flat());
  };
  desenhar();
  return [
    cabecalhoTela('Tamanho de efeito', 'O valor-p diz se há diferença; o tamanho de efeito diz quanto. Calcule, interprete e converta.', ['Ferramenta']),
    barra, corpo,
    el('section', { class: 'cartao' }, el('h2', {}, 'Como ler'),
      el('ul', {},
        el('li', {}, el('strong', {}, 'Cohen (1988): '), 'd 0,2 pequeno · 0,5 médio · 0,8 grande; r 0,1 · 0,3 · 0,5. São convenções gerais.'),
        el('li', {}, el('strong', {}, 'Relevância clínica vem antes: '), 'uma queda de 5 mmHg pode ser "pequena" em d e importante para o paciente. Compare com a diferença mínima clinicamente importante da sua área.'),
        el('li', {}, el('strong', {}, 'Relate sempre com IC 95%: '), 'mostra a precisão da estimativa.'))),
    blocoCitar(),
  ];
}
