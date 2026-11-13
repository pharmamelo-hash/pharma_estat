// Acompanhamento da coleta (F14): o trabalho já está rodando. Só contagens, nunca dados de participantes.
import { el, cabecalhoTela, aviso, numero } from './componentes.js';
import { projetoAtual, atualizarAtual } from '../estado/projeto.js';
import { resumoColeta, paraDia, dataValida } from '../calculo/coleta.js';
import { funcaoPoder } from '../calculo/amostra.js';
import { CALCULOS } from '../base.js';
import { recrutamento, barras, curvaPoder, figuraInterativa } from './graficos.js';

const hoje = () => new Date().toISOString().slice(0, 10);
const pct = (v) => `${numero(v * 100, 1)}%`;

function configuracao(p, c, aoSalvar) {
  const meta = el('input', { id: 'col-meta', type: 'number', min: 1, step: 1, value: c.meta || p.amostra?.resultado || '' });
  const inicio = el('input', { id: 'col-inicio', type: 'date', value: c.inicio || '' });
  const fim = el('input', { id: 'col-fim', type: 'date', value: c.fim_previsto || '' });
  const perdas = el('input', { id: 'col-perdas', type: 'number', min: 0, max: 90, step: 1, value: Math.round((c.perdas_previstas ?? p.amostra?.perdas ?? 0) * 100) });
  const grupos = el('input', { id: 'col-grupos', type: 'text', maxlength: 200, value: (c.grupos?.length ? c.grupos : ['Grupo A', 'Grupo B']).join('; ') });
  const status = el('p', { class: 'texto-suave', role: 'status' });
  return el('details', { class: 'cartao', open: !c.meta },
    el('summary', {}, 'Configurar a coleta'),
    el('div', { class: 'grade grade-2' },
      el('div', { class: 'campo' }, el('label', { for: 'col-meta' }, 'Meta total de participantes'), meta, el('small', { class: 'texto-suave' }, p.amostra?.resultado ? `Do cálculo amostral: ${p.amostra.resultado}.` : 'Faça o cálculo amostral para preencher sozinho.')),
      el('div', { class: 'campo' }, el('label', { for: 'col-grupos' }, 'Grupos (separe por ;)'), grupos),
      el('div', { class: 'campo' }, el('label', { for: 'col-inicio' }, 'Início da coleta'), inicio),
      el('div', { class: 'campo' }, el('label', { for: 'col-fim' }, 'Fim previsto'), fim),
      el('div', { class: 'campo' }, el('label', { for: 'col-perdas' }, 'Perdas previstas (%)'), perdas)),
    el('button', { class: 'botao', type: 'button', onclick: async () => {
      const lista = grupos.value.split(';').map((g) => g.trim()).filter(Boolean).slice(0, 10);
      await atualizarAtual({ coleta: { ...c, meta: Math.max(0, Math.floor(Number(meta.value) || 0)), inicio: dataValida(inicio.value) ? inicio.value : null,
        fim_previsto: dataValida(fim.value) ? fim.value : null, perdas_previstas: Math.min(0.9, Math.max(0, (Number(perdas.value) || 0) / 100)), grupos: lista.length ? lista : ['Grupo A'] } });
      status.textContent = 'Configuração salva.'; aoSalvar();
    } }, 'Salvar configuração'), status);
}

function formularioRegistro(c, aoSalvar) {
  const ult = [...(c.registros || [])].sort((a, b) => a.data.localeCompare(b.data)).at(-1);
  const data = el('input', { id: 'reg-data', type: 'date', value: hoje() });
  const campos = c.grupos.map((g, i) => el('div', { class: 'campo' }, el('label', { for: `reg-g${i}` }, `Incluídos até agora — ${g}`),
    el('input', { id: `reg-g${i}`, type: 'number', min: 0, step: 1, value: ult?.incluidos?.[g] ?? 0 })));
  const perdas = el('input', { id: 'reg-perdas', type: 'number', min: 0, step: 1, value: ult?.perdas ?? 0 });
  const erro = el('div', { role: 'alert' });
  return el('section', { class: 'cartao' },
    el('h2', {}, 'Registrar andamento'),
    el('p', { class: 'texto-suave' }, 'Informe os totais acumulados até a data (não os nomes). Pode registrar uma vez por semana.'),
    el('div', { class: 'grade grade-2' }, el('div', { class: 'campo' }, el('label', { for: 'reg-data' }, 'Data'), data), ...campos,
      el('div', { class: 'campo' }, el('label', { for: 'reg-perdas' }, 'Perdas acumuladas (todos os grupos)'), perdas)),
    erro,
    el('button', { class: 'botao', type: 'button', onclick: async () => {
      if (!dataValida(data.value)) { erro.replaceChildren(aviso('Informe uma data válida.', 'erro')); return; }
      const incluidos = Object.fromEntries(c.grupos.map((g, i) => [g, Math.max(0, Math.floor(Number(document.getElementById(`reg-g${i}`).value) || 0))]));
      const total = Object.values(incluidos).reduce((s, n) => s + n, 0);
      const nPerdas = Math.max(0, Math.floor(Number(perdas.value) || 0));
      if (nPerdas > total) { erro.replaceChildren(aviso('As perdas não podem ser maiores que o total de incluídos.', 'erro')); return; }
      const registros = (c.registros || []).filter((r) => r.data !== data.value).concat({ data: data.value, incluidos, perdas: nPerdas });
      await atualizarAtual({ coleta: { ...c, registros } });
      aoSalvar();
    } }, 'Adicionar registro'));
}

export function telaColeta() {
  const area = el('div');
  const desenhar = () => {
    const p = projetoAtual();
    if (!p) { area.replaceChildren(aviso('Abra ou crie um projeto primeiro.', 'info'), el('a', { class: 'botao', href: '#/projetos' }, 'Ir para projetos')); return; }
    const c = { grupos: ['Grupo A', 'Grupo B'], registros: [], ...(p.coleta || {}) };
    const r = resumoColeta({ registros: c.registros, meta: c.meta, inicio: c.inicio, fimPrevisto: c.fim_previsto, perdasPrevistas: c.perdas_previstas, grupos: c.grupos });
    const blocos = [configuracao(p, c, desenhar)];
    if (c.meta) blocos.push(formularioRegistro(c, desenhar));
    if (!r.vazio) {
      const nGrupos = Math.max(1, c.grupos.length);
      blocos.push(el('section', { class: 'cartao ficha' },
        el('span', { class: 'etiqueta' }, `Situação em ${new Date(`${r.ultimaData}T12:00:00Z`).toLocaleDateString('pt-BR')}`),
        el('div', { class: 'painel-numeros' },
          el('div', {}, el('span', { class: 'numero-grande' }, `${r.total}`), el('small', {}, ` de ${c.meta || '—'} incluídos${r.percentualMeta !== null ? ` (${pct(r.percentualMeta)})` : ''}`)),
          el('div', {}, el('strong', {}, `${numero(r.ritmoSemanal, 1)}`), ' inclusões por semana'),
          el('div', {}, el('strong', {}, r.previsao ? new Date(`${r.previsao}T12:00:00Z`).toLocaleDateString('pt-BR') : '—'), ' previsão de atingir a meta'),
          el('div', {}, el('strong', {}, pct(r.perdasPct)), ` de perdas (previstas ${pct(c.perdas_previstas || 0)})`)),
        ...r.alertas.map((a) => aviso(a.texto, 'atencao')),
        el('h3', {}, 'Recrutamento'),
        figuraInterativa(recrutamento(c.inicio && paraDia(c.inicio) < r.serie[0].dia ? [{ dia: paraDia(c.inicio), total: 0, perdas: 0 }, ...r.serie] : r.serie, c.meta, r.previsao ? paraDia(r.previsao) : null, c.fim_previsto ? paraDia(c.fim_previsto) : null)),
        el('h3', {}, 'Incluídos por grupo (em relação à meta de cada grupo)'),
        figuraInterativa(barras(r.porGrupo.map((g) => g.grupo), ['incluídos'], r.porGrupo.map((g) => [Math.min(100, c.meta ? (g.n / (c.meta / nGrupos)) * 100 : 0)]), 'grupo', '% da meta do grupo')),
        painelPoderAtual(p, r, nGrupos)));
      blocos.push(el('details', { class: 'cartao' }, el('summary', {}, `Registros (${r.serie.length})`),
        el('ul', { class: 'lista-projetos' }, [...r.serie].reverse().map((reg) => el('li', {},
          el('span', {}, `${new Date(`${reg.data}T12:00:00Z`).toLocaleDateString('pt-BR')}: ${reg.total} incluídos · ${reg.perdas} perdas`),
          el('button', { class: 'botao secundario pequeno perigo', type: 'button', onclick: async () => {
            await atualizarAtual({ coleta: { ...c, registros: c.registros.filter((x) => x.data !== reg.data) } }); desenhar();
          } }, 'Remover'))))));
    }
    area.replaceChildren(...blocos);
  };
  desenhar();
  return [cabecalhoTela('Acompanhamento da coleta', 'Para quando o trabalho já está rodando: ritmo de inclusão, previsão de término, perdas e poder já atingido.', ['Projeto', 'Coleta']),
    aviso('Registre apenas totais. Nenhum nome, prontuário ou dado de participante é guardado aqui.', 'info'), area];
}

/** Poder com o n efetivo atual, usando os parâmetros do cálculo amostral salvo. */
function painelPoderAtual(p, r, nGrupos) {
  const a = p.amostra;
  if (!a?.calculo) return el('p', { class: 'texto-suave' }, 'Salve um cálculo amostral no projeto para ver o poder já atingido.');
  const f = funcaoPoder(a.calculo, a.parametros || {});
  if (!f) return null;
  const porGrupo = ['a_duas_medias', 'a_duas_proporcoes'].includes(a.calculo);
  if (a.calculo === 'a_sobrevivencia') return el('p', { class: 'texto-suave' }, 'Em sobrevida, o poder depende do número de eventos: acompanhe os eventos observados.');
  const nAtual = Math.max(2, Math.floor(porGrupo ? r.efetivos / nGrupos : r.efetivos));
  const nMeta = Math.max(nAtual, Math.ceil(porGrupo ? (a.resultado || 0) / 2 / (1 / (1 - (a.perdas || 0))) : (a.resultado || 0) * (1 - (a.perdas || 0))));
  const pAtual = f(nAtual);
  return el('div', {},
    el('h3', {}, 'Poder já atingido'),
    el('p', {}, `Com ${nAtual} ${porGrupo ? 'por grupo' : 'participantes'} efetivos, o poder para o efeito planejado (${CALCULOS[a.calculo]?.nome.toLowerCase()}) é `,
      el('strong', { style: `color:var(${pAtual >= (a.parametros?.poder ?? 0.8) ? '--sucesso' : '--atencao'})` }, `${Math.round(pAtual * 100)}%`), '.'),
    figuraInterativa(curvaPoder(f, Math.max(20, Math.ceil(nMeta * 1.6)), nMeta, nAtual, a.parametros?.poder ?? 0.8, porGrupo ? 'n por grupo' : 'n')),
    el('p', { class: 'texto-suave' }, 'Não use o poder para decidir parar a coleta ao ver os resultados: isso infla o erro tipo I. Siga o n planejado.'));
}
