// Fichas montadas a partir da base (teste, desenho). Usadas nos assistentes e no catálogo.
import { el, fichaRecomendacao, listaTitulada, aviso, blocoCodigo } from './componentes.js';
import { TESTES, DESENHOS, CATEGORIAS, ROTULO_FORCA, citacao, refPendente } from '../base.js';

const listaRefs = (ids) => el('ol', { class: 'lista-refs' }, ids.map((id) => el('li', {}, citacao(id),
  refPendente(id) ? el('span', { class: 'selo pendente' }, 'conferir') : null)));

export function fichaTeste(id, { etiqueta = 'Teste indicado' } = {}) {
  const t = TESTES[id];
  if (!t) return aviso(`Teste não encontrado na base: ${id}`, 'erro');
  const alt = TESTES[t.alternativa];
  const selos = [];
  if (t.analise_no_app) selos.push('Analisável no app');
  return fichaRecomendacao({
    etiqueta, nome: t.nome, resumo: t.usar_quando, selos,
    abas: [
      { id: 'porque', rotulo: 'Por quê', conteudo: () => [
        el('p', {}, t.porque),
        el('p', {}, el('strong', {}, 'Não use quando: '), t.nao_usar_quando),
        alt && alt.id !== t.id ? el('p', {}, el('strong', {}, 'Alternativa: '), el('a', { href: `#/aprender/teste/${alt.id}` }, alt.nome)) : null,
        el('p', {}, el('strong', {}, 'Medida de efeito: '), t.efeito),
        t.encaminhar_bioestatistico ? aviso('Análise avançada: recomenda-se apoio de um bioestatístico.', 'atencao') : null,
      ] },
      { id: 'pressupostos', rotulo: 'Pressupostos', conteudo: () => [
        el('ul', { class: 'lista-pressupostos' }, t.pressupostos.map((p) => el('li', {}, el('strong', {}, p.nome), ` — ${p.como_verificar}`))),
        t.analise_no_app ? el('p', { class: 'texto-suave' }, 'Na análise dos seus dados, o app verifica estes pressupostos automaticamente e mostra o semáforo.') : null,
      ] },
      { id: 'relatar', rotulo: 'Como relatar', conteudo: () => [
        el('p', {}, t.como_relatar),
        el('p', { class: 'caixa-valor-p' }, 'Valor-p sozinho não basta: relate sempre a medida de efeito com o IC 95%.'),
        el('p', {}, el('strong', {}, 'No R:')),
        blocoCodigo(t.funcao_r),
      ] },
      { id: 'referencias', rotulo: 'Referências', conteudo: () => [listaRefs(t.refs)] },
    ],
  });
}

export function fichaDesenho(id, { etiqueta = 'Desenho indicado' } = {}) {
  const d = DESENHOS[id];
  if (!d) return aviso(`Desenho não encontrado na base: ${id}`, 'erro');
  return fichaRecomendacao({
    etiqueta, nome: d.nome, resumo: d.definicao,
    selos: [CATEGORIAS[d.categoria]?.nome, `Força causal: ${ROTULO_FORCA[d.forca_causal]}`].filter(Boolean),
    abas: [
      { id: 'quando', rotulo: 'Quando usar', conteudo: () => [
        el('p', {}, d.quando_usar),
        el('p', {}, el('strong', {}, 'Exemplo: '), d.exemplo_saude),
        el('p', {}, el('strong', {}, 'Tempo: '), d.temporalidade, ' · ', el('strong', {}, 'Unidade de análise: '), d.unidade_analise),
        d.observacao ? aviso(d.observacao, 'info') : null,
        d.encaminhar_bioestatistico ? aviso('Desenho com análise avançada: recomenda-se apoio de um bioestatístico.', 'atencao') : null,
        d.fora_do_escopo_estatistico ? aviso('Fora do escopo da análise estatística deste app.', 'info') : null,
      ] },
      { id: 'analise', rotulo: 'Medidas e análises', conteudo: () => [
        el('div', { class: 'grade grade-2' }, listaTitulada('Medidas', d.medidas), listaTitulada('Análises típicas', d.analises_tipicas)),
      ] },
      { id: 'vieses', rotulo: 'Vieses e limites', conteudo: () => [
        el('div', { class: 'grade grade-2' }, listaTitulada('Vantagens', d.vantagens), listaTitulada('Limitações', d.limitacoes)),
        listaTitulada('Vieses típicos', d.vieses),
      ] },
      { id: 'relato', rotulo: 'Diretriz de relato', conteudo: () => [
        el('p', {}, 'Use a lista de verificação desta diretriz ao escrever o projeto e o artigo:'),
        el('p', {}, el('strong', {}, citacao(d.diretriz))),
        el('p', {}, 'Os checklists oficiais estão na rede EQUATOR: ', el('a', { href: 'https://www.equator-network.org/', rel: 'noopener', target: '_blank' }, 'equator-network.org')),
      ] },
      { id: 'referencias', rotulo: 'Referências', conteudo: () => [listaRefs(d.refs)] },
    ],
  });
}

export { listaRefs };
