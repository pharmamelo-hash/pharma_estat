// Assistentes guiados (desenho e teste) — usam o motor de regras sobre as árvores da base.
import { el, cabecalhoTela, cartaoPergunta, aviso } from './componentes.js';
import { iniciar, responder, voltar, noAtual, profundidadeMaxima, reproduzir } from '../motor/arvore.js';
import { BASE } from '../base.js';
import { fichaTeste, fichaDesenho } from './fichas.js';
import { projetoAtual, atualizarAtual } from '../estado/projeto.js';

const ESTADOS = {}; // estado de cada assistente durante a sessão

function assistente({ chave, arvore, titulo, descricao, etapas, ficha, campoProjeto, proximo }) {
  const area = el('div');
  if (!ESTADOS[chave]) {
    const salvo = projetoAtual()?.[campoProjeto];
    try { ESTADOS[chave] = salvo?.caminho?.length ? reproduzir(arvore, salvo.caminho) : iniciar(arvore); } catch { ESTADOS[chave] = iniciar(arvore); }
  }

  const desenhar = () => {
    const estado = ESTADOS[chave];
    const no = noAtual(arvore, estado);
    const respostas = estado.caminho.length
      ? el('details', { class: 'cartao resumo-respostas' },
        el('summary', {}, `Suas respostas (${estado.caminho.length})`),
        el('ol', {}, estado.caminho.map((c) => el('li', {}, el('span', { class: 'texto-suave' }, c.pergunta), el('br'), el('strong', {}, c.rotulo)))))
      : null;
    const acoes = el('div', { class: 'acoes' },
      estado.caminho.length ? el('button', { class: 'botao secundario', type: 'button', onclick: () => { ESTADOS[chave] = voltar(arvore, estado); desenhar(); } }, '← Voltar uma pergunta') : null,
      estado.caminho.length ? el('button', { class: 'botao secundario', type: 'button', onclick: () => { ESTADOS[chave] = iniciar(arvore); desenhar(); } }, 'Recomeçar') : null);

    if (no) {
      const passo = estado.caminho.length + 1;
      area.replaceChildren(
        cartaoPergunta({ pergunta: no, passo, totalPassos: estado.caminho.length + profundidadeMaxima(arvore, estado.no),
          aoEscolher: (valor) => { ESTADOS[chave] = responder(arvore, estado, valor); desenhar(); window.scrollTo(0, 0); } }),
        acoes, respostas);
      return;
    }
    const status = el('p', { class: 'texto-suave', role: 'status' });
    area.replaceChildren(
      ficha(estado.resultado),
      el('div', { class: 'acoes' },
        el('button', { class: 'botao', type: 'button', onclick: async () => {
          await atualizarAtual({ [campoProjeto]: { id: estado.resultado, caminho: estado.caminho.map((c) => c.valor) } });
          status.textContent = `Salvo no projeto "${projetoAtual().titulo}".`;
        } }, 'Salvar no projeto'),
        proximo ? el('a', { class: 'botao secundario', href: proximo.destino }, proximo.rotulo) : null),
      status, acoes, respostas);
  };
  desenhar();
  return [cabecalhoTela(titulo, descricao, etapas), area];
}

export function telaDesenho() {
  return assistente({
    chave: 'desenho', arvore: BASE.arvoreDesenho, campoProjeto: 'desenho', ficha: (id) => fichaDesenho(id),
    titulo: 'Qual é o meu tipo de estudo?', descricao: 'Responda uma pergunta por vez. Em dúvida, toque em "Não sei — me explique".',
    etapas: ['Planejar', 'Desenho'], proximo: { destino: '#/planejar/teste', rotulo: 'Próximo: escolher o teste →' },
  });
}
export function telaTeste() {
  return [
    ...assistente({
      chave: 'teste', arvore: BASE.arvoreTeste, campoProjeto: 'teste', ficha: (id) => fichaTeste(id),
      titulo: 'Qual teste estatístico usar?', descricao: 'Pense na análise do desfecho primário. Para outros desfechos, refaça o assistente.',
      etapas: ['Planejar', 'Teste'], proximo: { destino: '#/planejar/amostra', rotulo: 'Próximo: tamanho amostral →' },
    }),
    aviso('Escolha o teste antes de ver os dados. Trocar de teste depois de olhar o resultado aumenta o risco de falso positivo.', 'info', 'Boa prática:'),
  ];
}
