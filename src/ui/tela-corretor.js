// Corretor do projeto (F20): envia Word/PDF (ou usa o Redator), o app aponta os problemas
// metodológicos, explica, pergunta o que precisa e aplica as correções com o OK do usuário.
import { el, cabecalhoTela, aviso } from './componentes.js';
import { BASE, DESENHOS, citacao } from '../base.js';
import MODELOS from '../../base/modelos-projeto.json';
import { projetoAtual, atualizarAtual } from '../estado/projeto.js';
import { montarDocumento } from '../motor/leitor-projeto.js';
import { corrigirProjeto, aplicarCorrecao, respostasPadrao, OPCOES_TESTE } from '../motor/corretor.js';
import { nomeDesenho, nomeTeste, LACUNA } from '../motor/modelos-texto.js';
import { lerArquivoProjeto, exportarDocx, exportarPdf, baixarBlob, nomeArquivo, contarLacunas } from './arquivos-projeto.js';
import { documentoDoRedator } from './tela-redator.js';
import { textoAmostraSalva } from './tela-amostra.js';
import { icone } from './icones.js';

const ROTULO_GRAV = { alta: 'Corrigir', media: 'Importante', baixa: 'Melhoria', info: 'Observação' };
const filtrar = (lista) => lista.flat(Infinity).filter(Boolean);

// Estado só em memória: o arquivo do usuário não é gravado.
const st = { original: null, nomeArquivo: '', ctx: null, achados: [], decisoes: {}, respostas: {}, ordem: [] };

function docAtual() {
  let d = st.original;
  for (const id of st.ordem) {
    const a = st.achados.find((x) => x.id === id);
    if (a) d = aplicarCorrecao(d, a, st.respostas[id] || {}, st.ctx.modelo);
  }
  return d;
}

/** Texto com [lacunas] destacadas, sem innerHTML. */
function comLacunas(texto) {
  const partes = String(texto).split(/(\[[^\]]{2,200}\])/);
  return partes.filter(Boolean).map((x) => (/^\[.*\]$/.test(x) ? el('mark', { class: 'lacuna' }, x) : x));
}

export function telaCorretor() {
  const area = el('div');
  const origemRedator = /origem=redator/.test(location.hash);

  const etapaEnvio = () => {
    const erro = el('div', { role: 'alert' });
    const entrada = el('input', { type: 'file', id: 'arquivo-projeto', accept: '.docx,.pdf,.txt,.md,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document', class: 'pular',
      onchange: async (e) => {
        const f = e.target.files?.[0];
        if (!f) return;
        erro.replaceChildren(aviso(`Lendo "${f.name}"…`, 'info'));
        try {
          const blocos = await lerArquivoProjeto(f);
          st.original = montarDocumento(blocos); st.nomeArquivo = f.name;
          if (!st.original.secoes.length) throw new Error('Não encontrei títulos de seção (Introdução, Objetivos, Métodos…). Confira se o arquivo é o projeto.');
          etapaConfirmar(); window.scrollTo(0, 0);
        } catch (er) { console.error(er); erro.replaceChildren(aviso(er.message || 'Não foi possível ler o arquivo.', 'erro')); }
      } });
    const p = projetoAtual();
    area.replaceChildren(...filtrar([
      el('section', { class: 'cartao envio-projeto' },
        el('label', { for: 'arquivo-projeto', class: 'zona-arquivo' }, icone('projetos', 32),
          el('strong', {}, 'Enviar o projeto'), el('span', {}, 'Word (.docx) ou PDF com texto (não escaneado)')),
        entrada, erro,
        el('p', { class: 'texto-suave' }, 'O arquivo é lido só neste aparelho e não é enviado nem guardado. A correção cobre a parte metodológica: desenho, critérios, desfecho, amostra, análise estatística, ética, riscos, cronograma, orçamento e referências das normas.')),
      p?.texto ? el('section', { class: 'cartao' }, el('h2', {}, 'Ou revisar o texto do Redator'),
        el('p', {}, `Projeto aberto: "${p.titulo}".`),
        el('button', { class: 'botao secundario', type: 'button', onclick: () => { st.original = documentoDoRedator(p.texto); st.nomeArquivo = ''; etapaConfirmar(); } }, 'Revisar o texto escrito no app')) : null,
    ]));
  };

  const etapaConfirmar = () => {
    const p = projetoAtual();
    const previa = corrigirProjeto(st.original, {});
    const s = previa.sinais;
    const desenhoInicial = s.desenhos[0] || p?.desenho?.id || '';
    let desenho = desenhoInicial;
    let modelo = st.original.modelo || (/plataforma brasil|riscos|tcle/i.test(JSON.stringify(st.original.secoes.map((x) => x.titulo))) ? 'cep' : 'cep');
    const encontradas = new Set(st.original.secoes.map((x) => x.chave).filter(Boolean));
    const chips = (mod) => MODELOS.modelos[mod].secoes.filter((x) => !x.grupo).map((x) => el('span', { class: `chip ${encontradas.has(x.id) ? 'ok' : 'falta'}` }, `${encontradas.has(x.id) ? '✓' : '○'} ${x.titulo}`));
    const caixaChips = el('div', { class: 'chips' }, chips(modelo));
    const sel = el('select', { id: 'cor-desenho', onchange: (e) => { desenho = e.target.value; } },
      el('option', { value: '' }, '— não sei / outro —'),
      ...BASE.desenhos.desenhos.map((d) => el('option', { value: d.id, selected: d.id === desenhoInicial || null }, d.nome)));
    area.replaceChildren(...filtrar([
      el('section', { class: 'cartao' },
        el('span', { class: 'etiqueta' }, st.nomeArquivo ? 'Arquivo lido' : 'Texto do Redator'),
        el('h2', {}, st.original.titulo || st.nomeArquivo || 'Projeto'),
        el('p', { class: 'texto-suave' }, `${st.original.secoes.length} seções · ${st.original.secoes.reduce((n, x) => n + x.paragrafos.length, 0)} parágrafos`),
        el('h3', {}, 'O que o app encontrou no texto'),
        el('ul', { class: 'lista-sinais' },
          el('li', {}, el('strong', {}, 'Desenho: '), s.desenhos.length ? s.desenhos.slice(0, 2).map(nomeDesenho).join(' ou ') : 'não identificado'),
          el('li', {}, el('strong', {}, 'Testes: '), s.testes.length ? s.testes.map(nomeTeste).join('; ') : 'nenhum nomeado'),
          el('li', {}, el('strong', {}, 'Amostra: '), [s.temCalculo ? 'há cálculo' : s.censo ? 'censo/conveniência' : 'sem cálculo', s.n ? `n = ${s.n}` : null, s.alfa ? `α = ${Math.round(s.alfa * 100)}%` : null, s.poder ? `poder = ${Math.round(s.poder * 100)}%` : null].filter(Boolean).join(' · ')),
          el('li', {}, el('strong', {}, 'Ética: '), [s.res466 ? 'Res. 466' : null, s.tcle ? 'TCLE' : null, s.dispensa ? 'dispensa de TCLE' : null, s.lgpd ? 'LGPD' : null].filter(Boolean).join(' · ') || 'nada encontrado')),
        el('h3', {}, 'Confirme antes de corrigir'),
        el('div', { class: 'grade grade-2' },
          el('div', { class: 'campo' }, el('label', { for: 'cor-desenho' }, 'Desenho do estudo'), sel,
            el('small', { class: 'texto-suave' }, 'Na dúvida, use o assistente "Tipo de estudo" e volte.')),
          el('div', { class: 'campo' }, el('span', { class: 'rotulo-campo' }, 'Modelo do projeto'),
            el('div', { class: 'segmentado', role: 'group', 'aria-label': 'Modelo' }, ...Object.entries(MODELOS.modelos).map(([id, m]) => el('button', { type: 'button', 'aria-pressed': String(modelo === id), onclick: (e) => {
              modelo = id; e.currentTarget.parentElement.querySelectorAll('button').forEach((b) => b.setAttribute('aria-pressed', String(b === e.currentTarget)));
              caixaChips.replaceChildren(...chips(modelo));
            } }, m.nome))))),
        el('h3', {}, 'Seções do modelo'), caixaChips,
        el('div', { class: 'acoes' },
          el('button', { class: 'botao', type: 'button', onclick: () => {
            st.ctx = { desenho: desenho || null, modelo, textoAmostraSalvo: textoAmostraSalva(p) };
            const r = corrigirProjeto(st.original, st.ctx);
            st.achados = r.achados; st.decisoes = {}; st.ordem = [];
            st.respostas = Object.fromEntries(r.achados.map((a) => [a.id, respostasPadrao(a, { desenho: st.ctx.desenho, teste: p?.teste?.id })]));
            etapaAchados(); window.scrollTo(0, 0);
          } }, icone('revisao', 16), 'Analisar o projeto'),
          el('button', { class: 'botao secundario', type: 'button', onclick: () => { st.original = null; etapaEnvio(); } }, 'Trocar de arquivo'))),
    ]));
  };

  const etapaAchados = () => {
    const doc = docAtual();
    const pend = st.achados.filter((a) => !st.decisoes[a.id]);
    const corrigiveis = pend.filter((a) => a.correcao);
    const cont = { alta: 0, media: 0, baixa: 0, info: 0 };
    st.achados.forEach((a) => { cont[a.gravidade] += 1; });
    const lacunas = contarLacunas(doc);
    const status = el('p', { class: 'texto-suave', role: 'status' });
    const marcar = el('input', { type: 'checkbox', id: 'cor-marcar', checked: true });

    const aplicar = (a) => { st.decisoes[a.id] = 'aplicada'; st.ordem.push(a.id); etapaAchados(); };
    const desfazer = (a) => { delete st.decisoes[a.id]; st.ordem = st.ordem.filter((x) => x !== a.id); etapaAchados(); };
    const ignorar = (a) => { st.decisoes[a.id] = 'ignorada'; etapaAchados(); };

    const cartao = (a) => {
      const dec = st.decisoes[a.id];
      const resp = st.respostas[a.id] || (st.respostas[a.id] = {});
      const previa = el('div', { class: 'previa-correcao' });
      const desenharPrevia = () => {
        if (!a.correcao) { previa.replaceChildren(); return; }
        if (a.correcao.acao === 'trocar') { previa.replaceChildren(el('p', {}, el('strong', {}, 'Troca no texto: '), a.correcao.trocas.map(([re, para]) => `"${re.source.replace(/\\b/g, '')}" → "${para}"`).join('; '))); return; }
        let texto = '';
        try { texto = a.correcao.gerar(resp); } catch { texto = ''; }
        const destino = MODELOS.modelos[st.ctx.modelo].secoes.find((x) => x.id === a.correcao.alvo)?.titulo || a.correcao.alvo;
        const existe = st.original.secoes.some((x) => x.chave === a.correcao.alvo);
        previa.replaceChildren(
          el('p', { class: 'texto-suave' }, existe ? `Acrescentar ao final de "${destino}":` : `Criar a seção "${destino}" com:`),
          ...String(texto).split('\n').filter(Boolean).map((l) => el('p', { class: 'trecho-novo' }, ...comLacunas(l))),
          a.correcao.nota ? el('p', { class: 'texto-suave' }, a.correcao.nota) : null);
      };
      const perguntas = (a.correcao?.pergunta || []).map((q) => {
        const id = `q-${a.id}-${q.campo}`;
        let ctl;
        if (q.tipo === 'desenho') ctl = el('select', { id, onchange: (e) => { resp[q.campo] = e.target.value; desenharPrevia(); } }, el('option', { value: '' }, '— escolha —'), ...BASE.desenhos.desenhos.map((d) => el('option', { value: d.id, selected: resp[q.campo] === d.id || null }, d.nome)));
        else if (q.tipo === 'teste') ctl = el('select', { id, onchange: (e) => { resp[q.campo] = e.target.value; desenharPrevia(); } }, el('option', { value: '' }, '— deixar para completar —'), ...OPCOES_TESTE.map(([v, n]) => el('option', { value: v, selected: resp[q.campo] === v || null }, n)));
        else if (q.tipo === 'select') ctl = el('select', { id, onchange: (e) => { resp[q.campo] = e.target.value; desenharPrevia(); } }, ...q.opcoes.map(([v, n]) => el('option', { value: v, selected: (resp[q.campo] ?? q.padrao) === v || null }, n)));
        else ctl = el('input', { id, type: 'text', inputmode: q.tipo === 'numero' ? 'decimal' : 'text', value: String(resp[q.campo] ?? q.padrao ?? ''), oninput: (e) => { resp[q.campo] = e.target.value; desenharPrevia(); } });
        return el('div', { class: 'campo' }, el('label', { for: id }, q.rotulo), ctl);
      });
      desenharPrevia();
      return el('article', { class: `cartao achado grav-${a.gravidade} ${dec ? `feito ${dec}` : ''}` },
        el('div', { class: 'achado-topo' }, el('span', { class: `selo-grav ${a.gravidade}` }, ROTULO_GRAV[a.gravidade]), el('h3', {}, a.titulo)),
        dec ? null : el('p', { class: 'porque' }, el('strong', {}, 'Por quê: '), a.porque),
        !dec && perguntas.length ? el('div', { class: 'grade grade-2' }, perguntas) : null,
        !dec && a.correcao ? previa : null,
        !dec && a.refs?.length ? el('details', {}, el('summary', {}, 'Referência'), el('ul', {}, ...a.refs.map((r) => el('li', {}, citacao(r))))) : null,
        el('div', { class: 'acoes' },
          dec === 'aplicada' ? [el('span', { class: 'feito-texto' }, '✓ Correção aplicada'), el('button', { class: 'botao secundario pequeno', type: 'button', onclick: () => desfazer(a) }, 'Desfazer')]
            : dec === 'ignorada' ? [el('span', { class: 'feito-texto' }, 'Ignorada'), el('button', { class: 'botao secundario pequeno', type: 'button', onclick: () => desfazer(a) }, 'Rever')]
              : [a.correcao ? el('button', { class: 'botao', type: 'button', onclick: () => aplicar(a) }, 'OK, aplicar') : null,
                el('button', { class: 'botao secundario', type: 'button', onclick: () => ignorar(a) }, a.correcao ? 'Ignorar' : 'Entendi')]));
    };

    const previaDoc = el('details', { class: 'cartao previa-doc' }, el('summary', {}, el('strong', {}, 'Ver o projeto corrigido')),
      doc.titulo ? el('h2', {}, doc.titulo) : null,
      ...doc.secoes.flatMap((sec) => [
        el(sec.nivel > 1 ? 'h4' : 'h3', { class: sec.nova ? 'trecho-novo' : null }, sec.titulo),
        ...sec.paragrafos.map((pp) => el('p', { class: pp.marca ? `trecho-${pp.marca}` : null }, ...comLacunas(pp.texto)))]));

    const baixar = async (tipo) => {
      status.textContent = 'Gerando o arquivo…';
      try {
        const blob = tipo === 'docx' ? await exportarDocx({ ...doc, modelo: st.ctx.modelo }, { marcar: marcar.checked }) : await exportarPdf({ ...doc, modelo: st.ctx.modelo }, { marcar: marcar.checked });
        baixarBlob(blob, nomeArquivo(doc.titulo || st.nomeArquivo.replace(/\.[a-z]+$/i, '') || 'projeto', tipo, '_corrigido'));
        status.textContent = 'Arquivo gerado.';
      } catch (e) { console.error(e); status.textContent = 'Não foi possível gerar o arquivo neste navegador.'; }
    };

    const levarAoRedator = async () => {
      const secoes = {};
      let ultima = 'introducao';
      for (const sec of doc.secoes) {
        const corpo = sec.paragrafos.map((x) => x.texto).join('\n');
        const chave = sec.chave && sec.chave !== 'metodologia' ? sec.chave : null;
        if (chave) { secoes[chave] = [secoes[chave], corpo].filter(Boolean).join('\n'); ultima = chave; }
        else if (corpo) secoes[ultima] = [secoes[ultima], `${sec.titulo}:`, corpo].filter(Boolean).join('\n');
      }
      const anterior = projetoAtual()?.texto;
      if (anterior && Object.values(anterior.secoes || {}).some((v) => v.trim()) && !window.confirm('O projeto aberto já tem texto no Redator. Substituir pelo projeto corrigido?')) return;
      await atualizarAtual({ texto: { modelo: st.ctx.modelo, meta: { ...(anterior?.meta || {}), titulo: doc.titulo || anterior?.meta?.titulo || '' }, secoes } });
      location.hash = '#/projeto/redigir';
    };

    const aplicarTodas = () => {
      if (!corrigiveis.length) return;
      if (!window.confirm(`Aplicar ${corrigiveis.length} correç${corrigiveis.length > 1 ? 'ões' : 'ão'} com as respostas sugeridas? Você pode desfazer cada uma depois.`)) return;
      for (const a of corrigiveis) { st.decisoes[a.id] = 'aplicada'; st.ordem.push(a.id); }
      etapaAchados();
    };

    const feitas = Object.values(st.decisoes).filter((x) => x === 'aplicada').length;
    area.replaceChildren(...filtrar([
      el('section', { class: 'cartao resumo-correcao' },
        el('span', { class: 'etiqueta' }, `${nomeDesenho(st.ctx.desenho) || 'Desenho não definido'} · ${MODELOS.modelos[st.ctx.modelo].nome}`),
        el('h2', {}, st.achados.length ? `${st.achados.length} ponto${st.achados.length > 1 ? 's' : ''} para revisar` : 'Nenhum problema metodológico encontrado'),
        el('div', { class: 'painel-numeros' }, ...['alta', 'media', 'baixa', 'info'].map((g) => el('div', { class: `numero-grav ${g}` }, el('strong', {}, String(cont[g])), el('small', {}, ROTULO_GRAV[g])))),
        el('p', {}, `${feitas} aplicada${feitas === 1 ? '' : 's'} · ${pend.length} pendente${pend.length === 1 ? '' : 's'}${lacunas ? ` · ${lacunas} trecho${lacunas > 1 ? 's' : ''} [entre colchetes] para você completar` : ''}`),
        el('div', { class: 'acoes' },
          corrigiveis.length ? el('button', { class: 'botao', type: 'button', onclick: aplicarTodas }, `OK, aplicar todas (${corrigiveis.length})`) : null,
          el('button', { class: 'botao secundario', type: 'button', onclick: () => etapaConfirmar() }, 'Mudar desenho ou modelo'),
          el('button', { class: 'botao secundario', type: 'button', onclick: () => { st.original = null; st.ctx = null; etapaEnvio(); } }, 'Enviar outro projeto'))),
      ...st.achados.map(cartao),
      previaDoc,
      el('section', { class: 'cartao' }, el('h2', {}, 'Baixar o projeto corrigido'),
        el('label', { class: 'linha-check', for: 'cor-marcar' }, marcar, 'Destacar em amarelo o que o app acrescentou ou trocou (desmarque para a versão final)'),
        el('div', { class: 'acoes' },
          el('button', { class: 'botao', type: 'button', onclick: () => baixar('docx') }, icone('salvar', 16), 'Baixar Word (.docx)'),
          el('button', { class: 'botao secundario', type: 'button', onclick: () => baixar('pdf') }, icone('pdf', 16), 'Baixar PDF'),
          el('button', { class: 'botao secundario', type: 'button', onclick: levarAoRedator }, icone('manual', 16), 'Continuar editando no app')),
        aviso('O Word é gerado de novo a partir do texto: formatação especial, figuras e tabelas complexas do arquivo original não são copiadas. Use o arquivo baixado como base ou copie as partes corrigidas para o seu original.', 'info'),
        status),
    ]));
  };

  if (origemRedator && projetoAtual()?.texto) { st.original = documentoDoRedator(projetoAtual().texto); st.nomeArquivo = ''; st.ctx = null; etapaConfirmar(); }
  else if (st.original && st.ctx) etapaAchados(); else etapaEnvio();
  return [
    cabecalhoTela('Corrigir projeto pronto', 'Envie o projeto em Word ou PDF. O app aponta o que falta no método, explica o porquê e corrige com o seu OK.', ['Projeto']),
    area,
  ];
}
