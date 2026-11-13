// Motor de regras: percorre uma árvore de decisão da base (JSON).
// Não contém conteúdo científico: só a mecânica. Testado em testes/motor.test.js.

/** Estado inicial: na raiz, sem respostas. */
export function iniciar(arvore) {
  return { no: arvore.raiz, caminho: [], resultado: null };
}

/** Nó atual (pergunta) ou null se já há resultado. */
export function noAtual(arvore, estado) {
  return estado.resultado ? null : arvore.nos[estado.no] ?? null;
}

/**
 * Registra a resposta e devolve um NOVO estado (não altera o anterior).
 * Lança erro se a opção não existir — o app nunca deve aceitar resposta fora da árvore.
 */
export function responder(arvore, estado, valor) {
  const no = noAtual(arvore, estado);
  if (!no) throw new Error('Não há pergunta pendente.');
  const opcao = no.opcoes.find((o) => o.valor === valor);
  if (!opcao) throw new Error(`Opção "${valor}" não existe no nó ${estado.no}.`);
  const caminho = [...estado.caminho, { no: estado.no, valor, rotulo: opcao.rotulo, pergunta: no.pergunta }];
  if (opcao.resultado) return { no: estado.no, caminho, resultado: opcao.resultado };
  return { no: opcao.proximo, caminho, resultado: null };
}

/** Desfaz a última resposta. */
export function voltar(arvore, estado) {
  if (estado.caminho.length === 0) return estado;
  const caminho = estado.caminho.slice(0, -1);
  return { no: estado.caminho.at(-1).no, caminho, resultado: null };
}

/** Reconstrói o estado a partir de uma lista de valores (para projetos salvos). */
export function reproduzir(arvore, valores) {
  return valores.reduce((estado, valor) => responder(arvore, estado, valor), iniciar(arvore));
}

/** Profundidade restante máxima a partir de um nó (para a barra de progresso). */
export function profundidadeMaxima(arvore, idNo = arvore.raiz, visitados = new Set()) {
  if (visitados.has(idNo)) return Infinity;
  const no = arvore.nos[idNo];
  if (!no) return 0;
  const proximos = new Set([...visitados, idNo]);
  return 1 + Math.max(...no.opcoes.map((o) => (o.resultado ? 0 : profundidadeMaxima(arvore, o.proximo, proximos))));
}

/** Todos os caminhos raiz → resultado. Usado para testar a árvore inteira. */
export function todosOsCaminhos(arvore) {
  const caminhos = [];
  const andar = (idNo, valores) => {
    for (const opcao of arvore.nos[idNo].opcoes) {
      const v = [...valores, opcao.valor];
      if (opcao.resultado) caminhos.push({ valores: v, resultado: opcao.resultado });
      else andar(opcao.proximo, v);
    }
  };
  andar(arvore.raiz, []);
  return caminhos;
}

/**
 * Confere a árvore: destinos existentes, resultados válidos, nós sem uso, ciclos.
 * Devolve lista de erros (vazia = árvore íntegra).
 */
export function validarArvore(arvore, resultadosValidos) {
  const erros = [];
  if (!arvore.nos[arvore.raiz]) erros.push(`Raiz ${arvore.raiz} não existe.`);
  const alcancados = new Set();
  const andar = (idNo, pilha) => {
    if (pilha.includes(idNo)) { erros.push(`Ciclo: ${[...pilha, idNo].join(' → ')}`); return; }
    const no = arvore.nos[idNo];
    if (!no) { erros.push(`Nó ${idNo} não existe.`); return; }
    alcancados.add(idNo);
    if (!no.pergunta || !Array.isArray(no.opcoes) || no.opcoes.length < 2) erros.push(`Nó ${idNo} sem pergunta ou com menos de 2 opções.`);
    const valores = new Set();
    for (const o of no.opcoes) {
      if (valores.has(o.valor)) erros.push(`Nó ${idNo}: valor repetido ${o.valor}.`);
      valores.add(o.valor);
      if (!o.rotulo) erros.push(`Nó ${idNo}: opção ${o.valor} sem rótulo.`);
      if (Boolean(o.resultado) === Boolean(o.proximo)) erros.push(`Nó ${idNo}: opção ${o.valor} precisa de resultado OU próximo.`);
      if (o.resultado && !resultadosValidos.has(o.resultado)) erros.push(`Nó ${idNo}: resultado ${o.resultado} não existe na base.`);
      if (o.proximo) andar(o.proximo, [...pilha, idNo]);
    }
  };
  andar(arvore.raiz, []);
  Object.keys(arvore.nos).filter((id) => !alcancados.has(id)).forEach((id) => erros.push(`Nó ${id} nunca é alcançado.`));
  return [...new Set(erros)];
}
