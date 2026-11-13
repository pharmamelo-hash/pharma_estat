// Componentes reutilizáveis da interface.
// Regra de segurança (Doc 7.3): todo texto entra por textContent, nunca innerHTML,
// porque nomes de colunas e categorias virão da planilha do aluno.

/**
 * Cria um elemento de forma segura.
 * el('p', { class: 'x' }, 'texto', outroElemento)
 */
export function el(tag, atributos = {}, ...filhos) {
  const elemento = document.createElement(tag);
  for (const [chave, valor] of Object.entries(atributos)) {
    if (valor === false || valor === null || valor === undefined) continue;
    if (chave.startsWith('on') && typeof valor === 'function') {
      elemento.addEventListener(chave.slice(2).toLowerCase(), valor);
    } else if (chave === 'class') {
      elemento.className = valor;
    } else {
      elemento.setAttribute(chave, valor === true ? '' : String(valor));
    }
  }
  for (const filho of filhos.flat()) {
    if (filho === null || filho === undefined || filho === false) continue;
    elemento.append(filho instanceof Node ? filho : document.createTextNode(String(filho)));
  }
  return elemento;
}

/** Cabeçalho padrão de tela. */
export function cabecalhoTela(titulo, descricao, etapas = []) {
  return el('div', { class: 'cabecalho-tela' },
    etapas.length ? el('ul', { class: 'trilha', 'aria-label': 'Etapas' }, etapas.map((e) => el('li', {}, e))) : null,
    el('h1', {}, titulo),
    descricao ? el('p', { class: 'texto-suave' }, descricao) : null,
  );
}

/** Cartão de atalho para outra tela. */
export function cartaoAtalho({ etiqueta, titulo, texto, destino }) {
  return el('a', { class: 'cartao atalho', href: destino },
    etiqueta ? el('span', { class: 'etiqueta' }, etiqueta) : null,
    el('h3', {}, titulo),
    el('p', {}, texto),
  );
}

/** Aviso (tipo: 'atencao' | 'info' | 'erro'). */
export function aviso(texto, tipo = 'atencao', titulo) {
  return el('div', { class: `aviso ${tipo === 'atencao' ? '' : tipo}`.trim(), role: tipo === 'erro' ? 'alert' : 'note' },
    titulo ? el('strong', {}, titulo, ' ') : null,
    texto,
  );
}

/**
 * Cartão de pergunta do assistente.
 * pergunta = { texto, explicacao, opcoes: [{ valor, rotulo, detalhe }] }
 * aoEscolher(valor) é chamado quando o aluno toca numa opção.
 */
export function cartaoPergunta({ pergunta, passo, totalPassos, selecionada, aoEscolher }) {
  const explicacao = el('div', { class: 'explicacao', hidden: true }, pergunta.explicacao || '');
  const botaoNaoSei = el('button', {
    class: 'botao-nao-sei', type: 'button', 'aria-expanded': 'false',
    onclick: () => {
      const abrir = explicacao.hidden;
      explicacao.hidden = !abrir;
      botaoNaoSei.setAttribute('aria-expanded', String(abrir));
    },
  }, 'Não sei — me explique');

  const progresso = Math.round((passo / totalPassos) * 100);
  return el('section', { class: 'cartao cartao-pergunta', 'aria-labelledby': 'pergunta-atual' },
    el('div', { class: 'pergunta-progresso', role: 'progressbar', 'aria-valuemin': 0, 'aria-valuemax': totalPassos, 'aria-valuenow': passo, 'aria-label': `Pergunta ${passo} de ${totalPassos}` },
      el('span', { style: `width:${progresso}%` })),
    el('p', { class: 'etiqueta' }, `Pergunta ${passo} de ${totalPassos}`),
    el('p', { class: 'pergunta-texto', id: 'pergunta-atual' }, pergunta.texto),
    el('div', { class: 'opcoes' }, pergunta.opcoes.map((opcao) =>
      el('button', {
        class: 'opcao', type: 'button', 'aria-pressed': String(opcao.valor === selecionada),
        onclick: () => aoEscolher?.(opcao.valor),
      }, opcao.rotulo, opcao.detalhe ? el('small', {}, opcao.detalhe) : null))),
    pergunta.explicacao ? botaoNaoSei : null,
    explicacao,
  );
}

/**
 * Semáforo de pressupostos (Doc 4): ícone + palavra + cor.
 * itens = [{ estado: 'ok'|'limite'|'violado', nome, detalhe }]
 */
const ESTADOS = {
  ok: '✓ Atendido',
  limite: '! Limítrofe',
  violado: '✗ Violado',
};
export function semaforo(itens) {
  return el('ul', { class: 'semaforo' }, itens.map((item) =>
    el('li', { class: item.estado },
      el('span', { class: 'marcador' }, ESTADOS[item.estado]),
      el('span', {}, el('strong', {}, item.nome), item.detalhe ? ` — ${item.detalhe}` : ''))));
}

/**
 * Ficha em abas (usada para teste, desenho e cálculo).
 * ficha = { etiqueta, nome, resumo, selos: [texto], abas: [{ id, rotulo, conteudo: () => [nós] }], rodape: [nós] }
 */
let contadorFichas = 0;
export function fichaRecomendacao(ficha) {
  const abas = ficha.abas;
  const sufixo = `f${++contadorFichas}`;
  const botoes = [];
  const paineis = [];
  const selecionar = (indice) => {
    botoes.forEach((b, i) => {
      b.setAttribute('aria-selected', String(i === indice));
      b.tabIndex = i === indice ? 0 : -1;
      paineis[i].hidden = i !== indice;
    });
  };
  abas.forEach((aba, i) => {
    const idAba = `aba-${aba.id}-${sufixo}`;
    const idPainel = `painel-${aba.id}-${sufixo}`;
    botoes.push(el('button', {
      class: 'aba', role: 'tab', id: idAba, type: 'button', 'aria-controls': idPainel,
      onclick: () => selecionar(i),
      onkeydown: (e) => {
        if (e.key === 'ArrowRight') { selecionar((i + 1) % abas.length); botoes[(i + 1) % abas.length].focus(); }
        if (e.key === 'ArrowLeft') { const j = (i - 1 + abas.length) % abas.length; selecionar(j); botoes[j].focus(); }
      },
    }, aba.rotulo));
    paineis.push(el('div', { class: 'painel', role: 'tabpanel', id: idPainel, 'aria-labelledby': idAba }, aba.conteudo()));
  });
  selecionar(0);

  return el('article', { class: 'cartao ficha' },
    el('span', { class: 'etiqueta' }, ficha.etiqueta || 'Recomendação'),
    el('div', { class: 'ficha-titulo' }, el('h2', {}, ficha.nome), (ficha.selos || []).map((s) => el('span', { class: 'selo' }, s))),
    ficha.resumo ? el('p', {}, ficha.resumo) : null,
    el('div', { class: 'abas', role: 'tablist', 'aria-label': 'Detalhes' }, botoes),
    paineis,
    ficha.rodape || null,
  );
}

/** Lista simples com título. */
export function listaTitulada(titulo, itens) {
  return el('div', { class: 'bloco-lista' }, el('strong', {}, titulo), el('ul', {}, itens.map((i) => el('li', {}, i))));
}

/** Bloco de código com botão Copiar (a cópia exige clique; recusa é tratada). */
export function blocoCodigo(texto, rotulo = 'Copiar') {
  const pre = el('pre', { class: 'codigo' }, el('code', {}, texto));
  const aviso = el('span', { class: 'texto-suave', role: 'status' });
  const botao = el('button', {
    class: 'botao secundario pequeno', type: 'button',
    onclick: async () => {
      try { await navigator.clipboard.writeText(texto); aviso.textContent = ' Copiado.'; } catch { aviso.textContent = ' Não foi possível copiar: selecione o texto e copie manualmente.'; }
    },
  }, rotulo);
  return el('div', { class: 'bloco-codigo' }, pre, el('div', {}, botao, aviso));
}

/** Baixar texto como arquivo (no GitHub Pages funciona; em visualizadores que bloqueiam, oferece copiar). */
export function botaoBaixar(nomeArquivo, conteudo, tipo = 'text/plain', rotulo = 'Baixar') {
  return el('button', {
    class: 'botao secundario pequeno', type: 'button',
    onclick: () => {
      try {
        const url = URL.createObjectURL(new Blob([conteudo], { type: `${tipo};charset=utf-8` }));
        const a = el('a', { href: url, download: nomeArquivo });
        document.body.append(a); a.click(); a.remove();
        setTimeout(() => URL.revokeObjectURL(url), 2000);
      } catch { /* sem download disponível: o bloco de cópia continua na tela */ }
    },
  }, rotulo);
}

/** Formata número em pt-BR com casas decimais fixas; NA vira travessão. */
export function numero(v, casas = 2) {
  if (v === null || v === undefined || Number.isNaN(v)) return '—';
  return Number(v).toLocaleString('pt-BR', { minimumFractionDigits: casas, maximumFractionDigits: casas });
}
/** "p = 0,032" ou "p < 0,001". */
export function textoP(p) {
  if (p === null || p === undefined || Number.isNaN(p)) return '';
  return p < 0.001 ? 'p < 0,001' : `p = ${numero(p, 3)}`;
}
/** Valor-p no padrão de artigo. */
export function valorP(p) {
  if (p === null || p === undefined || Number.isNaN(p)) return '—';
  if (p < 0.001) return '< 0,001';
  return numero(p, 3);
}
