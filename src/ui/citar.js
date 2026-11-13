// "Como citar o Pharma_estat" (Vancouver e ABNT), com a data de acesso de hoje.
import { el, blocoCodigo } from './componentes.js';
import { NOME_APP, VERSAO_APP } from '../config.js';

const MESES_ABNT = ['jan.', 'fev.', 'mar.', 'abr.', 'maio', 'jun.', 'jul.', 'ago.', 'set.', 'out.', 'nov.', 'dez.'];
const MESES_VANC = ['jan', 'fev', 'mar', 'abr', 'maio', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];

export function citacoes(data = new Date(), url = enderecoApp()) {
  const ano = data.getFullYear();
  const titulo = `${NOME_APP}: consultor de bioestatística para a saúde`;
  return {
    abnt: `MELO, Ademar Soares. ${titulo}. Versão ${VERSAO_APP}. Belém: @pharmamelo, ${ano}. Software. Disponível em: ${url}. Acesso em: ${data.getDate()} ${MESES_ABNT[data.getMonth()]} ${ano}.`,
    vancouver: `Melo AS. ${titulo} [software]. Versão ${VERSAO_APP}. Belém: @pharmamelo; ${ano} [citado ${ano} ${MESES_VANC[data.getMonth()]} ${data.getDate()}]. Disponível em: ${url}`,
  };
}
function enderecoApp() {
  try { return `${location.origin}${location.pathname}`; } catch { return '[endereço do app]'; }
}
export function blocoCitar() {
  const c = citacoes();
  return el('details', { class: 'cartao citar' },
    el('summary', {}, el('strong', {}, `Como citar o ${NOME_APP}`)),
    el('p', { class: 'texto-suave' }, 'Cite o software no método, junto com a versão usada. Para o tamanho amostral, cite também a fonte do efeito esperado.'),
    el('h3', {}, 'ABNT (NBR 6023)'), blocoCodigo(c.abnt, 'Copiar ABNT'),
    el('h3', {}, 'Vancouver'), blocoCodigo(c.vancouver, 'Copiar Vancouver'));
}
