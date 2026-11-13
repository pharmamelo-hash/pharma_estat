// Revisão metodológica do projeto (F11): formulário guiado + parecer do motor de regras.
import { el, cabecalhoTela, aviso, blocoCodigo } from './componentes.js';
import { BASE, DESENHOS, TESTES, citacao } from '../base.js';
import regrasRevisao from '../../base/regras-revisao.json';
import { revisarProjeto } from '../motor/auditoria.js';
import { projetoAtual, atualizarAtual } from '../estado/projeto.js';
import { listaRefs } from './fichas.js';

const SN = [['sim', 'Sim'], ['nao', 'Não']];
// Perguntas do formulário: [campo, rótulo, opções | 'texto' | 'numero' | 'testes', condição(desenho)]
const ECR = (d) => ['d_ecr_paralelo', 'd_ecr_cruzado', 'd_ecr_cluster'].includes(d);
const OBS = (d) => ['d_transversal_analitico', 'd_caso_controle', 'd_coorte_prospectiva', 'd_coorte_retrospectiva'].includes(d);
const PERGUNTAS = [
  ['desfecho_primario', 'Desfecho primário (como e quando será medido)', 'texto'],
  ['tipo_desfecho', 'Tipo do desfecho primário', [['quantitativo', 'Quantitativo'], ['ordinal', 'Ordinal'], ['binario', 'Binário (sim/não)'], ['categorico', 'Categórico (3+ categorias)'], ['tempo', 'Tempo até evento']]],
  ['n_grupos', 'Quantos grupos serão comparados?', [['1', 'Um (sem comparação)'], ['2', 'Dois'], ['3+', 'Três ou mais'], ['nao_se_aplica', 'Não se aplica (correlação, modelo)']]],
  ['pareado', 'Os grupos são pareados (mesmas pessoas ou pares)?', SN],
  ['medida', 'Medida de associação principal', [['rr', 'Risco relativo (RR)'], ['rp', 'Razão de prevalências (RP)'], ['or', 'Odds ratio (OR)'], ['hr', 'Hazard ratio (HR)'], ['dif_medias', 'Diferença de médias/medianas'], ['correlacao', 'Correlação'], ['prevalencia', 'Prevalência'], ['sens_esp', 'Sensibilidade/especificidade'], ['nenhuma', 'Nenhuma']]],
  ['freq_desfecho', 'Frequência esperada do desfecho', [['raro', 'Rara (< 10%)'], ['comum', 'Comum (≥ 10%)'], ['nao_sei', 'Não sei']]],
  ['testes_planejados', 'Testes estatísticos planejados', 'testes'],
  ['amostra_calculada', 'O tamanho amostral foi calculado?', [['sim', 'Sim'], ['nao', 'Não'], ['censo', 'Não: serão todos os casos do período (censo)']]],
  ['fonte_efeito', 'O efeito esperado do cálculo tem fonte citada?', SN, (d, r) => r.amostra_calculada === 'sim'],
  ['perdas_previstas', 'O cálculo prevê perdas?', SN, (d, r) => r.amostra_calculada === 'sim'],
  ['n_planejado', 'Número de participantes que você espera incluir', 'numero'],
  ['vai_ajustar', 'Haverá modelo de regressão (ajuste por vários fatores)?', SN],
  ['n_variaveis_modelo', 'Quantas variáveis entrarão no modelo?', 'numero', (d, r) => r.vai_ajustar === 'sim'],
  ['eventos_esperados', 'Quantos eventos (desfecho = sim) você espera?', 'numero', (d, r) => r.vai_ajustar === 'sim'],
  ['confundidores_listados', 'Os confundidores estão listados, com plano de controle?', SN, OBS],
  ['ocultacao', 'Haverá ocultação da alocação (sequência sigilosa)?', SN, ECR],
  ['cegamento', 'Haverá cegamento (ao menos do avaliador do desfecho)?', SN, ECR],
  ['itt', 'A análise principal será por intenção de tratar?', SN, ECR],
  ['grupo_controle', 'Há grupo controle concorrente?', SN, (d) => d === 'd_quase_antes_depois'],
  ['dados_faltantes_plano', 'Há plano para dados faltantes de prontuário?', SN, (d) => ['d_coorte_retrospectiva', 'd_caso_controle', 'd_serie_casos'].includes(d)],
  ['correcao_multiplas', 'Haverá correção para múltiplas comparações?', [['sim', 'Sim'], ['nao', 'Não'], ['nao_se_aplica', 'Não se aplica']]],
  ['interpretacao_individual', 'As conclusões serão sobre indivíduos?', SN, (d) => d === 'd_ecologico'],
  ['objetivo_associacao', 'O objetivo inclui testar associação entre fatores?', SN, (d) => ['d_relato_caso', 'd_serie_casos'].includes(d)],
  ['diretriz', 'Diretriz de relato citada no projeto', 'diretriz'],
  ['cep', 'O projeto será submetido ao CEP (Plataforma Brasil)?', [['sim', 'Sim'], ['nao', 'Não'], ['dispensa', 'Dispensado (justificado)']]],
];
const ROTULO_GRAVIDADE = { alta: 'Alta', media: 'Média', baixa: 'Baixa', info: 'Informação' };

function baseRevisao() {
  return { regras: regrasRevisao.regras, desenhos: DESENHOS, testes: TESTES, listaTestes: BASE.testes.testes, nomeRef: (id) => citacao(id).split('.').slice(1, 2).join('').trim() || id };
}

export function textoParecer(projeto, resultado) {
  const linhas = [`PARECER METODOLÓGICO — ${projeto.titulo}`, `Desenho: ${DESENHOS[projeto.desenho?.id || projeto.revisao?.desenho]?.nome || 'não definido'}`, ''];
  resultado.achados.forEach((a, i) => linhas.push(`${i + 1}. [${ROTULO_GRAVIDADE[a.gravidade]}] ${a.achado}\n   Recomendação: ${a.recomendacao}\n   Ref.: ${a.refs.map(citacao).join(' | ')}`));
  if (!resultado.achados.length) linhas.push('Nenhuma inconsistência encontrada nas regras verificadas.');
  linhas.push('', `Verificações atendidas: ${resultado.aprovados.length}.`, 'Parecer automático baseado em regras; não substitui a avaliação do orientador ou de um bioestatístico.');
  return linhas.join('\n');
}

export function telaRevisao() {
  const p = projetoAtual();
  if (!p) return [cabecalhoTela('Revisão metodológica', null, ['Projeto', 'Revisão']), aviso('Abra ou crie um projeto primeiro.', 'info'), el('a', { class: 'botao', href: '#/projetos' }, 'Ir para projetos')];
  const r = { ...(p.revisao || {}) };
  if (!r.desfecho_primario && p.pico?.o) r.desfecho_primario = p.pico.o;
  const desenho = p.desenho?.id || r.desenho;
  const formArea = el('div');
  const parecer = el('div', { 'aria-live': 'polite' });

  const controle = ([campo, rotulo, tipo]) => {
    const id = `rv-${campo}`;
    if (tipo === 'texto') return el('textarea', { id, rows: 2, maxlength: 2000, oninput: (e) => { r[campo] = e.target.value; } }, r[campo] || p.pico?.o || '');
    if (tipo === 'numero') return el('input', { id, type: 'number', min: 0, step: 1, value: r[campo] ?? '', oninput: (e) => { r[campo] = e.target.value === '' ? undefined : Number(e.target.value); } });
    if (tipo === 'testes') {
      const marcados = new Set(r.testes_planejados || (p.teste?.id ? [p.teste.id] : []));
      r.testes_planejados = [...marcados];
      return el('div', { class: 'lista-marcar colunas' }, BASE.testes.testes.filter((t) => t.objetivo !== 'pressuposto').map((t) => el('label', {},
        el('input', { type: 'checkbox', checked: marcados.has(t.id), onchange: (e) => { if (e.target.checked) marcados.add(t.id); else marcados.delete(t.id); r.testes_planejados = [...marcados]; } }), ` ${t.nome}`)));
    }
    const opcoes = tipo === 'diretriz'
      ? [['nenhuma', 'Nenhuma'], ...BASE.referencias.referencias.filter((x) => x.tipo === 'diretriz').map((x) => [x.id, citacao(x.id).split('.').slice(1, 2).join('').trim().slice(0, 90)])]
      : tipo;
    return el('select', { id, onchange: (e) => { r[campo] = e.target.value || undefined; desenharForm(); } },
      el('option', { value: '' }, '— responda —'),
      opcoes.map(([v, rot]) => el('option', { value: v, selected: r[campo] === v }, rot)));
  };

  const desenharForm = () => {
    const d = p.desenho?.id || r.desenho;
    const visiveis = PERGUNTAS.filter((q) => !q[3] || q[3](d, r));
    formArea.replaceChildren(el('section', { class: 'cartao' },
      p.desenho?.id ? el('p', {}, el('strong', {}, 'Desenho do projeto: '), DESENHOS[p.desenho.id].nome, ' · ', el('a', { href: '#/planejar/desenho' }, 'alterar'))
        : el('div', { class: 'campo' }, el('label', { for: 'rv-desenho' }, 'Desenho do estudo'),
          el('select', { id: 'rv-desenho', onchange: (e) => { r.desenho = e.target.value || undefined; desenharForm(); } }, el('option', { value: '' }, '— escolha ou use o assistente —'),
            BASE.desenhos.desenhos.map((x) => el('option', { value: x.id, selected: r.desenho === x.id }, x.nome)))),
      el('div', { class: 'grade grade-2' }, visiveis.map((q) => el('div', { class: `campo ${q[2] === 'testes' ? 'largo' : ''}` }, el('label', { for: `rv-${q[0]}` }, q[1]), controle(q)))),
      el('div', { class: 'acoes' }, el('button', { class: 'botao', type: 'button', onclick: gerar }, 'Gerar parecer'))));
  };

  async function gerar() {
    const salvo = await atualizarAtual({ revisao: r });
    const res = revisarProjeto(salvo, baseRevisao());
    const texto = textoParecer(salvo, res);
    parecer.replaceChildren(el('section', { class: 'cartao ficha' },
      el('span', { class: 'etiqueta' }, 'Parecer metodológico'),
      el('h2', {}, salvo.titulo),
      el('p', {}, `${res.contagem.alta} achado(s) de gravidade alta · ${res.contagem.media} média · ${res.contagem.baixa} baixa · ${res.aprovados.length} verificação(ões) atendida(s).`),
      res.achados.length ? el('ol', { class: 'lista-achados' }, res.achados.map((a) => el('li', { class: `achado ${a.gravidade}` },
        el('span', { class: 'marcador-gravidade' }, a.gravidade === 'alta' ? '✗ Alta' : a.gravidade === 'media' ? '! Média' : a.gravidade === 'baixa' ? '• Baixa' : 'i Informação'),
        el('p', {}, el('strong', {}, a.achado)), el('p', {}, a.recomendacao),
        el('details', {}, el('summary', {}, 'Referências'), listaRefs(a.refs)))))
        : aviso('Nenhuma inconsistência encontrada nas regras verificadas.', 'info'),
      el('p', { class: 'texto-suave' }, 'Parecer automático baseado em regras explícitas: aponta inconsistências frequentes, mas não substitui a leitura do orientador ou de um bioestatístico.'),
      el('h3', {}, 'Texto do parecer'), blocoCodigo(texto, 'Copiar parecer')));
    parecer.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  desenharForm();
  return [
    cabecalhoTela('Revisão metodológica', 'Responda sobre o seu projeto. O app cruza desenho, desfecho, medida, testes e amostra e aponta incoerências, com referências.', ['Projeto', 'Revisão']),
    !desenho ? aviso('Dica: defina o desenho com o assistente antes, para a revisão ficar mais precisa.', 'info') : null,
    formArea, parecer,
  ];
}
