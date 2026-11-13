// Interpretação em linguagem simples do resultado de uma análise (F15).
// Texto montado por regras, a partir dos números devolvidos pelo R. Testado em testes/auto.test.js.

const n2 = (v, c = 2) => (v === null || v === undefined || Number.isNaN(v) ? '—' : Number(v).toLocaleString('pt-BR', { minimumFractionDigits: c, maximumFractionDigits: c }));
const pTxt = (p) => (p < 0.001 ? 'p < 0,001' : `p = ${n2(p, 3)}`);
const pct = (v) => `${n2(v * 100, 1)}%`;

export function forcaCorrelacao(r) {
  const a = Math.abs(r);
  return a < 0.1 ? 'desprezível' : a < 0.3 ? 'fraca' : a < 0.5 ? 'moderada' : a < 0.7 ? 'forte' : 'muito forte';
}
export function tamanhoD(d) {
  const a = Math.abs(d);
  return a < 0.2 ? 'muito pequeno' : a < 0.5 ? 'pequeno' : a < 0.8 ? 'médio' : 'grande';
}
export function tamanhoEta(e) { return e < 0.01 ? 'muito pequeno' : e < 0.06 ? 'pequeno' : e < 0.14 ? 'médio' : 'grande'; }

function fraseSignificancia(p) {
  if (p === null || p === undefined) return null;
  return p < 0.05
    ? `O resultado é estatisticamente significativo (${pTxt(p)}): uma diferença deste tamanho seria improvável se, na população, não houvesse diferença nenhuma.`
    : `O resultado não é estatisticamente significativo (${pTxt(p)}): os dados são compatíveis com ausência de diferença. Isso não prova que os grupos são iguais; pode faltar amostra.`;
}

/**
 * r = resultado do R (com r.principal já definido); contexto = { medida: 'rr'|'rp'|'or', causal, nomeDesenho }
 * Devolve [{ titulo, texto }].
 */
export function interpretar(r, contexto = {}) {
  const res = r.resultados.find((x) => x.teste === r.principal) || r.resultados[0];
  const blocos = [];
  const violados = (r.pressupostos || []).filter((x) => x.estado === 'violado').map((x) => x.nome);
  const limites = (r.pressupostos || []).filter((x) => x.estado === 'limite').map((x) => x.nome);
  blocos.push({ titulo: 'Teste usado', texto: `${res.nome}. ${violados.length ? `Foi o escolhido porque este pressuposto não foi atendido: ${violados.join('; ')}.` : limites.length ? `Pressupostos atendidos, com atenção a: ${limites.join('; ')}.` : 'Os pressupostos verificados foram atendidos.'}` });

  const ef = res.efeito;
  let achado = '';
  switch (r.tipo) {
    case 'dois_grupos': {
      const [a, b] = r.descritivas;
      const usaMedia = res.teste === 't_t_welch';
      const maior = (usaMedia ? a.media >= b.media : a.mediana >= b.mediana) ? a : b, menor = maior === a ? b : a;
      // orienta a diferença como (maior − menor)
      const sinal = maior === a ? 1 : -1;
      const dif = sinal * ef.valor, li = sinal === 1 ? ef.li : -ef.ls, ls = sinal === 1 ? ef.ls : -ef.li;
      achado = usaMedia
        ? `O grupo "${maior.grupo}" teve média maior (${n2(maior.media)}) que "${menor.grupo}" (${n2(menor.media)}). A diferença de médias é ${n2(dif)} (IC 95% ${n2(li)} a ${n2(ls)}${li * ls < 0 ? ', intervalo que inclui o zero' : ''}).`
        : `O grupo "${maior.grupo}" teve mediana maior (${n2(maior.mediana)}; IIQ ${n2(maior.q1)}–${n2(maior.q3)}) que "${menor.grupo}" (${n2(menor.mediana)}; IIQ ${n2(menor.q1)}–${n2(menor.q3)}).`;
      const d = /d de Cohen = (-?[\d,]+)/.exec(r.resultados[0]?.efeito?.nota || '');
      if (d && usaMedia) achado += ` O tamanho do efeito é ${tamanhoD(Number(d[1].replace(',', '.')))} (d de Cohen = ${d[1].replace('-', '')}).`;
      break;
    }
    case 'pareado': {
      const sobe = ef.valor > 0;
      achado = `Entre a primeira e a segunda medida, os valores ${sobe ? 'aumentaram' : 'diminuíram'} em ${res.teste === 't_t_pareado' ? 'média' : 'mediana (pseudomediana)'} ${n2(Math.abs(ef.valor))} (IC 95% ${n2(ef.li)} a ${n2(ef.ls)}).`;
      break;
    }
    case 'varios': {
      const ord = [...r.descritivas].sort((x, y) => y.media - x.media);
      achado = `Maior média em "${ord[0].grupo}" (${n2(ord[0].media)}) e menor em "${ord.at(-1).grupo}" (${n2(ord.at(-1).media)}).`;
      const sig = (res.pares || []).filter((x) => x.p < 0.05).map((x) => x.par);
      if (res.p < 0.05) achado += sig.length ? ` Nas comparações par a par, diferem: ${sig.join('; ')}.` : ' Nenhum par isolado atingiu significância após a correção para múltiplas comparações.';
      const anova = r.resultados.find((x) => x.teste === 't_anova_um_fator');
      if (anova?.efeito?.valor !== undefined) achado += ` O grupo explica ${pct(anova.efeito.valor)} da variação do desfecho (efeito ${tamanhoEta(anova.efeito.valor)}).`;
      break;
    }
    case 'friedman': achado = `As medidas ${res.p < 0.05 ? 'mudaram' : 'não mostraram mudança clara'} ao longo dos momentos (W de Kendall = ${n2(ef.valor)}; 0 = nenhuma mudança consistente, 1 = todos mudam igual).`; break;
    case 'categoricas': {
      if (r.medidas_2x2) {
        const m = r.medidas_2x2, usaOr = contexto.medida === 'or';
        const med = usaOr ? m.or : m.rr;
        const sigla = usaOr ? 'OR' : contexto.medida === 'rp' ? 'RP' : 'RR';
        const extenso = usaOr ? 'odds ratio' : contexto.medida === 'rp' ? 'razão de prevalências' : 'risco relativo';
        achado = `"${r.nivel_evento}" ocorreu em ${pct(m.risco_expostos)} do grupo "${r.nivel_exposto}" e em ${pct(m.risco_nao_expostos)} do grupo de comparação, o que dá ${extenso} de ${n2(med.valor)} (${sigla} = ${n2(med.valor)}; IC 95% ${n2(med.li)} a ${n2(med.ls)}${med.li < 1 && med.ls > 1 ? ', intervalo que inclui 1' : ''}).`;
        if (!usaOr && m.dif.valor !== 0) achado += ` Em termos absolutos, a diferença é de ${n2(Math.abs(m.dif.valor) * 100, 1)} pontos percentuais.`;
      } else achado = `A distribuição das categorias ${res.p < 0.05 ? 'difere' : 'não difere de forma clara'} entre os grupos (V de Cramér = ${n2(r.resultados[0].efeito.valor)}).`;
      break;
    }
    case 'mcnemar': achado = `A proporção ${ef.valor > 0 ? 'aumentou' : 'diminuiu'} ${n2(Math.abs(ef.valor) * 100, 1)} pontos percentuais entre os dois momentos (IC 95% ${n2(ef.li * 100, 1)} a ${n2(ef.ls * 100, 1)}).`; break;
    case 'correlacao': {
      const forca = forcaCorrelacao(ef.valor), sigla = res.teste === 't_pearson' ? 'r' : 'rho';
      achado = forca === 'desprezível'
        ? `Praticamente não há correlação entre as duas variáveis (${sigla} = ${n2(ef.valor)}).`
        : `A correlação é ${ef.valor >= 0 ? 'positiva' : 'negativa'} e ${forca} (${sigla} = ${n2(ef.valor)}): quando uma variável aumenta, a outra tende a ${ef.valor >= 0 ? 'aumentar' : 'diminuir'}.${res.teste === 't_pearson' ? ` Ela explica ${pct(ef.valor ** 2)} da variação (r²).` : ''}`;
      break;
    }
    case 'logistica': {
      const c = res.coeficientes?.[0];
      if (c) achado = `Para "${c.termo}", a chance de "${r.nivel_evento}" é multiplicada por ${n2(c.or)} a cada unidade ou categoria (OR = ${n2(c.or)}; IC 95% ${n2(c.li)} a ${n2(c.ls)}; ${pTxt(c.p)}).`;
      break;
    }
    case 'linear': {
      const c = res.coeficientes?.[0];
      if (c) achado = `A cada unidade de "${c.termo}", o desfecho muda em média ${n2(c.beta)} (IC 95% ${n2(c.li)} a ${n2(c.ls)}). O modelo explica ${pct(Math.max(0, ef.valor))} da variação (R² ajustado).`;
      break;
    }
    default: achado = ef ? `${ef.nome}: ${n2(ef.valor)}${ef.li !== null && ef.li !== undefined ? ` (IC 95% ${n2(ef.li)} a ${n2(ef.ls)})` : ''}.` : '';
  }
  if (achado) blocos.push({ titulo: 'O que os números dizem', texto: achado });
  const sig = fraseSignificancia(res.p);
  if (sig) blocos.push({ titulo: 'Significância', texto: sig });

  const cuidados = [];
  if (r.n < 30) cuidados.push(`A amostra é pequena (n = ${r.n}): as estimativas são imprecisas.`);
  if (contexto.causal === true) cuidados.push('Como houve sorteio, a diferença pode ser atribuída à intervenção, desde que as perdas e o cegamento tenham sido bem conduzidos.');
  else if (contexto.nomeDesenho) cuidados.push(`Em estudo do tipo ${contexto.nomeDesenho.toLowerCase()}, o resultado mostra associação, não causa: outros fatores (confundidores) podem explicar a diferença.`);
  else cuidados.push('Associação não é causa: considere confundidores e o desenho do estudo antes de concluir.');
  if (r.tipo === 'categoricas' && contexto.medida === 'or') cuidados.push('A odds ratio não é risco: só se aproxima do risco relativo quando o desfecho é raro.');
  cuidados.push('Pergunte sempre se o tamanho do efeito importa para o paciente, não só se o valor-p é pequeno.');
  blocos.push({ titulo: 'Cuidados ao concluir', texto: cuidados.join(' ') });
  return blocos;
}
