// Projetos (F9): guardados no aparelho; exportar e importar como arquivo .json.
import { el, cabecalhoTela, aviso, blocoCodigo, botaoBaixar } from './componentes.js';
import { listarProjetos, novoProjeto, salvarProjeto, apagarProjeto, apagarTodosProjetos, projetoAtual, definirAtual, exportarProjeto, importarProjeto, atualizarAtual, armazenamentoSoNaMemoria } from '../estado/projeto.js';
import { DESENHOS, TESTES, CALCULOS } from '../base.js';

const data = (iso) => { try { return new Date(iso).toLocaleDateString('pt-BR'); } catch { return ''; } };

function botaoConfirmar(rotulo, acao) {
  let armado = false;
  const b = el('button', { class: 'botao secundario pequeno perigo', type: 'button', onclick: async () => {
    if (!armado) { armado = true; b.textContent = 'Toque de novo para confirmar'; setTimeout(() => { armado = false; b.textContent = rotulo; }, 4000); return; }
    await acao();
  } }, rotulo);
  return b;
}

function editorProjeto(p, aoMudar) {
  const campo = (id, rotulo, valor, dica) => el('div', { class: 'campo' }, el('label', { for: id }, rotulo),
    el('textarea', { id, rows: 2, maxlength: 2000 }, valor || ''), dica ? el('small', { class: 'texto-suave' }, dica) : null);
  const titulo = el('input', { id: 'pj-titulo', type: 'text', maxlength: 200, value: p.titulo });
  const status = el('p', { class: 'texto-suave', role: 'status' });
  const resumo = [
    ['Desenho', p.desenho?.id ? DESENHOS[p.desenho.id]?.nome : null, '#/planejar/desenho'],
    ['Teste', p.teste?.id ? TESTES[p.teste.id]?.nome : null, '#/planejar/teste'],
    ['Tamanho amostral', p.amostra?.calculo ? `${CALCULOS[p.amostra.calculo]?.nome}: ${p.amostra.resultado ?? '—'} no total` : null, '#/planejar/amostra'],
    ['Variáveis', p.variaveis?.length ? `${p.variaveis.length} colunas (só nomes e tipos)` : null, '#/analisar/dados'],
  ];
  return el('section', { class: 'cartao' },
    el('span', { class: 'etiqueta' }, 'Projeto atual'),
    el('div', { class: 'campo' }, el('label', { for: 'pj-titulo' }, 'Título'), titulo),
    el('h3', {}, 'Pergunta de pesquisa (PICO/PECO)'),
    el('div', { class: 'grade grade-2' },
      campo('pj-p', 'P — população', p.pico?.p, 'Ex.: adultos internados em UTI com sepse'),
      campo('pj-i', 'I/E — intervenção ou exposição', p.pico?.i, 'Ex.: infusão estendida de meropeném'),
      campo('pj-c', 'C — comparação', p.pico?.c, 'Ex.: infusão intermitente'),
      campo('pj-o', 'O — desfecho', p.pico?.o, 'Ex.: mortalidade em 28 dias')),
    el('div', { class: 'acoes' }, el('button', { class: 'botao', type: 'button', onclick: async () => {
      const v = (id) => document.getElementById(id).value;
      await atualizarAtual({ titulo: v('pj-titulo').trim() || 'Projeto sem título', pico: { p: v('pj-p'), i: v('pj-i'), c: v('pj-c'), o: v('pj-o') } });
      status.textContent = 'Salvo.'; aoMudar();
    } }, 'Salvar')),
    status,
    el('h3', {}, 'Etapas'),
    el('ul', { class: 'lista-etapas' }, resumo.map(([nome, valor, destino]) => el('li', {},
      el('span', { class: valor ? 'feito' : 'pendente' }, valor ? '✓ ' : '○ '), el('strong', {}, `${nome}: `), valor || 'não definido', ' · ', el('a', { href: destino }, valor ? 'alterar' : 'definir')))),
    el('div', { class: 'acoes' }, el('a', { class: 'botao', href: '#/projeto/revisao' }, 'Revisão metodológica do projeto →'), el('a', { class: 'botao secundario', href: '#/projeto/coleta' }, 'Acompanhar a coleta →')),
    el('details', {}, el('summary', {}, 'Exportar este projeto'),
      el('p', { class: 'texto-suave' }, 'O arquivo contém só o planejamento (nenhum dado de participante).'),
      botaoBaixar(`projeto-${p.id.slice(0, 8)}.json`, exportarProjeto(p), 'application/json', 'Baixar .json'),
      blocoCodigo(exportarProjeto(p), 'Copiar JSON')));
}

export async function telaProjetos() {
  const area = el('div');
  const desenhar = async () => {
    const lista = await listarProjetos();
    const atual = projetoAtual();
    const statusImp = el('div', { role: 'status' });
    const importar = async (texto) => {
      try { const p = await salvarProjeto(importarProjeto(texto)); definirAtual(p); statusImp.replaceChildren(aviso(`Projeto "${p.titulo}" importado.`, 'info')); desenhar(); } catch (e) { statusImp.replaceChildren(aviso(e.message, 'erro')); }
    };
    const colar = el('textarea', { rows: 3, placeholder: 'Ou cole aqui o JSON exportado', 'aria-label': 'JSON do projeto' });
    area.replaceChildren(
      armazenamentoSoNaMemoria() ? aviso('Este navegador não permite salvar no aparelho: os projetos ficam só até fechar a aba. Exporte o .json para não perder.', 'atencao') : null,
      atual ? editorProjeto(atual, desenhar) : null,
      el('section', { class: 'cartao' },
        el('h2', {}, 'Meus projetos'),
        el('div', { class: 'acoes' }, el('button', { class: 'botao', type: 'button', onclick: async () => { const p = await salvarProjeto(novoProjeto('Novo projeto')); definirAtual(p); desenhar(); } }, '+ Novo projeto')),
        lista.length ? el('ul', { class: 'lista-projetos' }, lista.map((p) => el('li', { class: p.id === atual?.id ? 'ativo' : null },
          el('div', {}, el('strong', {}, p.titulo), el('br'), el('span', { class: 'texto-suave' }, `Atualizado em ${data(p.atualizado)}${p.desenho?.id ? ` · ${DESENHOS[p.desenho.id]?.nome}` : ''}`)),
          el('div', { class: 'acoes' },
            p.id === atual?.id ? el('span', { class: 'selo' }, 'aberto') : el('button', { class: 'botao secundario pequeno', type: 'button', onclick: () => { definirAtual(p); desenhar(); } }, 'Abrir'),
            botaoConfirmar('Apagar', async () => { await apagarProjeto(p.id); desenhar(); })))))
          : el('p', { class: 'texto-suave' }, 'Nenhum projeto ainda.')),
      el('section', { class: 'cartao' },
        el('h2', {}, 'Importar projeto'),
        el('input', { type: 'file', accept: '.json,application/json', 'aria-label': 'Arquivo .json do projeto', onchange: async (e) => { const f = e.target.files?.[0]; if (f && f.size < 1048576) importar(await f.text()); e.target.value = ''; } }),
        colar, el('button', { class: 'botao secundario', type: 'button', onclick: () => importar(colar.value) }, 'Importar texto colado'),
        statusImp),
      el('section', { class: 'cartao' },
        el('h2', {}, 'Privacidade'),
        el('p', {}, 'Os projetos ficam só neste aparelho. Nenhum dado é enviado a servidores.'),
        lista.length ? botaoConfirmar('Apagar todos os meus projetos', async () => { await apagarTodosProjetos(); desenhar(); }) : null));
  };
  await desenhar();
  return [cabecalhoTela('Projetos', 'Planejamento salvo no seu aparelho: pergunta, desenho, teste, amostra e revisão.'), area];
}
