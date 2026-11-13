// Redator do projeto (F19): escrever do zero nos modelos CEP ou TCC/Residência (ABNT),
// com as seções de método pré-preenchidas pelo app, e baixar em Word ou PDF.
import { el, cabecalhoTela, aviso } from './componentes.js';
import MODELOS from '../../base/modelos-projeto.json';
import { projetoAtual, atualizarAtual } from '../estado/projeto.js';
import { textoAmostraSalva } from './tela-amostra.js';
import {
  textoDesenho, textoAmostra, textoAnalise, textoEtica, textoRiscos, textoCriterios, textoDesfechos,
  textoDiretriz, textoCronograma, textoOrcamento, refsDoTexto, citacaoRef, LACUNA,
} from '../motor/modelos-texto.js';
import { exportarDocx, exportarPdf, baixarBlob, nomeArquivo } from './arquivos-projeto.js';
import { icone } from './icones.js';

const GRUPOS3 = ['t_anova_um_fator', 't_welch_anova', 't_kruskal_wallis'];
const OBS = ['d_transversal_analitico', 'd_caso_controle', 'd_coorte_prospectiva', 'd_coorte_retrospectiva'];

/** Texto que o app sabe escrever para uma seção, a partir do que está no projeto. */
export function gerarSecao(auto, p) {
  const d = p?.desenho?.id || null;
  const testesIds = p?.teste?.id ? [p.teste.id] : [];
  switch (auto) {
    case 'desenho': return [textoDesenho(d), textoDiretriz(d)].filter(Boolean).join('\n');
    case 'amostra': return textoAmostra(textoAmostraSalva(p), d);
    case 'analise': return textoAnalise({ testesIds, grupos3: testesIds.some((t) => GRUPOS3.includes(t)), ajuste: OBS.includes(d) });
    case 'etica': return textoEtica({ d });
    case 'riscos': return textoRiscos({ d });
    case 'criterios': return textoCriterios();
    case 'desfechos': return textoDesfechos(p?.revisao?.desfecho_primario || p?.pico?.o);
    case 'cronograma': return textoCronograma();
    case 'orcamento': return textoOrcamento();
    case 'referencias': return refsDoTexto({ d, testesIds }).map(citacaoRef).join('\n');
    default: return '';
  }
}

/** Converte o texto do Redator no documento de exportação/correção. */
export function documentoDoRedator(t) {
  const modelo = MODELOS.modelos[t.modelo] || MODELOS.modelos.cep;
  const secoes = [];
  for (const s of modelo.secoes) {
    const texto = (t.secoes?.[s.id] || '').trim();
    if (s.grupo) { secoes.push({ uid: s.id, chave: s.id, titulo: s.titulo, nivel: 1, paragrafos: [] }); continue; }
    if (!texto) continue;
    secoes.push({ uid: s.id, chave: s.id, titulo: s.titulo, nivel: s.nivel, paragrafos: texto.split('\n').map((x) => x.trim()).filter(Boolean).map((x) => ({ texto: x })) });
  }
  // Remove "Metodologia" vazia se nenhuma subseção dela foi escrita.
  const iMet = secoes.findIndex((s) => s.chave === 'metodologia');
  if (iMet !== -1 && !(secoes[iMet + 1]?.nivel > 1)) secoes.splice(iMet, 1);
  return { titulo: t.meta?.titulo || '', meta: t.meta || {}, modelo: t.modelo, preambulo: [], secoes };
}

let temporizador = null;
function salvarDepois(t, status) {
  clearTimeout(temporizador);
  status.textContent = 'Salvando…';
  temporizador = setTimeout(async () => {
    await atualizarAtual({ texto: t });
    status.textContent = `Salvo no projeto "${projetoAtual().titulo}" (só neste aparelho).`;
  }, 700);
}

export function telaRedator() {
  const p = projetoAtual();
  const t = structuredClone(p?.texto || { modelo: 'cep', meta: { titulo: p?.titulo && !/^Projeto sem título/.test(p.titulo) ? p.titulo : '', ano: String(new Date().getFullYear()) }, secoes: {} });
  const area = el('div');
  const status = el('p', { class: 'texto-suave', role: 'status' });
  const progresso = el('div', { class: 'redator-progresso' });

  const atualizarProgresso = () => {
    const modelo = MODELOS.modelos[t.modelo];
    const lista = modelo.secoes.filter((s) => !s.grupo);
    const feitas = lista.filter((s) => (t.secoes[s.id] || '').trim()).length;
    const lacunas = lista.reduce((n, s) => n + ((t.secoes[s.id] || '').match(LACUNA) || []).length, 0);
    progresso.replaceChildren(
      el('div', { class: 'medidor' }, el('span', { style: `width:${Math.round((feitas / lista.length) * 100)}%` })),
      el('p', {}, el('strong', {}, `${feitas} de ${lista.length} seções escritas`), lacunas ? ` · ${lacunas} trecho${lacunas > 1 ? 's' : ''} [entre colchetes] para completar` : ''));
  };

  const campoMeta = (id, rotulo, ajuda) => el('div', { class: 'campo' }, el('label', { for: `meta-${id}` }, rotulo),
    el('input', { id: `meta-${id}`, type: 'text', maxlength: 300, value: t.meta[id] || '', oninput: (e) => { t.meta[id] = e.target.value; salvarDepois(t, status); } }),
    ajuda ? el('small', { class: 'texto-suave' }, ajuda) : null);

  const desenhar = () => {
    const modelo = MODELOS.modelos[t.modelo];
    const cartoes = modelo.secoes.map((s) => {
      if (s.grupo) return el('h2', { class: 'redator-grupo' }, s.titulo);
      const caixa = el('textarea', { id: `sec-${s.id}`, rows: 5, maxlength: 30000, placeholder: s.ajuda,
        oninput: (e) => { t.secoes[s.id] = e.target.value; ajustar(e.target); salvarDepois(t, status); atualizarProgresso(); } }, t.secoes[s.id] || '');
      const preencher = s.auto ? el('button', { class: 'botao secundario pequeno', type: 'button', onclick: () => {
        const novo = gerarSecao(s.auto, projetoAtual());
        const atual = (t.secoes[s.id] || '').trim();
        if (atual && !window.confirm('Esta seção já tem texto. Acrescentar o texto do app no final? (Nada é apagado.)')) return;
        t.secoes[s.id] = atual ? `${atual}\n${novo}` : novo;
        caixa.value = t.secoes[s.id]; ajustar(caixa); salvarDepois(t, status); atualizarProgresso();
      } }, icone('analisar', 14), 'Preencher com o app') : null;
      requestAnimationFrame(() => ajustar(caixa));
      return el('section', { class: `cartao redator-secao ${s.nivel > 1 ? 'sub' : ''}` },
        el('div', { class: 'redator-cabeca' }, el('h3', {}, s.titulo), preencher),
        s.ajuda ? el('p', { class: 'dica-tutor' }, el('strong', {}, 'Dica: '), s.ajuda) : null,
        el('label', { class: 'pular', for: `sec-${s.id}` }, s.titulo), caixa);
    });
    area.replaceChildren(...cartoes);
    atualizarProgresso();
  };
  const ajustar = (ta) => { ta.style.height = 'auto'; ta.style.height = `${Math.min(900, ta.scrollHeight + 4)}px`; };

  const preencherTudo = () => {
    const modelo = MODELOS.modelos[t.modelo];
    let n = 0;
    for (const s of modelo.secoes) if (s.auto && !(t.secoes[s.id] || '').trim()) { t.secoes[s.id] = gerarSecao(s.auto, projetoAtual()); n += 1; }
    desenhar(); salvarDepois(t, status);
    status.textContent = n ? `${n} seções preenchidas. Complete os trechos [entre colchetes].` : 'As seções que o app sabe escrever já têm texto.';
  };

  const baixar = async (tipo) => {
    status.textContent = 'Gerando o arquivo…';
    try {
      const doc = documentoDoRedator(t);
      if (!doc.secoes.length) { status.textContent = 'Escreva ao menos uma seção antes de baixar.'; return; }
      const blob = tipo === 'docx' ? await exportarDocx(doc, { marcar: marcar.checked }) : await exportarPdf(doc, { marcar: marcar.checked });
      baixarBlob(blob, nomeArquivo(doc.titulo || 'projeto', tipo));
      status.textContent = `Arquivo ${tipo === 'docx' ? 'Word' : 'PDF'} gerado.`;
    } catch (e) { console.error(e); status.textContent = 'Não foi possível gerar o arquivo neste navegador.'; }
  };
  const marcar = el('input', { type: 'checkbox', id: 'red-marcar' });

  const p0 = projetoAtual();
  const faltam = [!p0?.desenho?.id && ['o tipo de estudo', '#/planejar/desenho'], !p0?.teste?.id && ['o teste', '#/planejar/teste'], !p0?.amostra?.calculo && ['o cálculo amostral', '#/planejar/amostra']].filter(Boolean);
  desenhar();
  return [
    cabecalhoTela('Escrever o projeto', 'Escolha o modelo, escreva cada parte com as dicas e deixe o app redigir o método. Depois baixe em Word ou PDF.', ['Projeto']),
    faltam.length ? el('div', { class: 'aviso info' }, 'Para o app escrever o método completo, defina antes: ', ...faltam.flatMap(([t2, h], i) => [i ? ', ' : '', el('a', { href: h }, t2)]), '. O que faltar fica [entre colchetes].') : null,
    el('section', { class: 'cartao' },
      el('div', { class: 'segmentado', role: 'group', 'aria-label': 'Modelo' },
        ...Object.entries(MODELOS.modelos).map(([id, m]) => el('button', { type: 'button', 'aria-pressed': String(t.modelo === id), onclick: (e) => {
          t.modelo = id; e.currentTarget.parentElement.querySelectorAll('button').forEach((b) => b.setAttribute('aria-pressed', String(b === e.currentTarget)));
          desenhar(); salvarDepois(t, status);
        } }, m.nome))),
      el('p', { class: 'texto-suave' }, 'Trocar de modelo não apaga nada: o texto de cada seção é mantido.'),
      el('div', { class: 'grade grade-2' },
        el('div', { class: 'campo largo' }, el('label', { for: 'meta-titulo' }, 'Título do projeto'),
          el('input', { id: 'meta-titulo', type: 'text', maxlength: 300, value: t.meta.titulo || '', oninput: (e) => { t.meta.titulo = e.target.value; salvarDepois(t, status); } })),
        campoMeta('autor', 'Autor(a)'), campoMeta('orientador', 'Orientador(a)'), campoMeta('instituicao', 'Instituição'), campoMeta('programa', 'Programa ou curso', 'Ex.: Residência Multiprofissional em Saúde'),
        campoMeta('cidade', 'Cidade'), campoMeta('ano', 'Ano')),
      progresso,
      el('div', { class: 'acoes' },
        el('button', { class: 'botao', type: 'button', onclick: preencherTudo }, icone('analisar', 16), 'Preencher tudo o que o app sabe'),
        el('a', { class: 'botao secundario', href: '#/projeto/corrigir?origem=redator' }, icone('revisao', 16), 'Revisar este texto'))),
    area,
    el('section', { class: 'cartao redator-baixar' },
      el('h2', {}, 'Baixar'),
      el('label', { class: 'linha-check', for: 'red-marcar' }, marcar, 'Destacar os trechos [entre colchetes] que ainda faltam'),
      el('div', { class: 'acoes' },
        el('button', { class: 'botao', type: 'button', onclick: () => baixar('docx') }, icone('salvar', 16), 'Baixar Word (.docx)'),
        el('button', { class: 'botao secundario', type: 'button', onclick: () => baixar('pdf') }, icone('pdf', 16), 'Baixar PDF')),
      el('p', { class: 'texto-suave' }, 'Word com Times New Roman 12, espaço 1,5 e margens ABNT (3/2 cm). O texto fica salvo só neste aparelho; exporte o projeto em "Projetos" para levar a outro.'),
      status),
  ];
}
