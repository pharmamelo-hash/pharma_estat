// Importação da planilha e dicionário de variáveis (F5). Tudo na memória do aparelho.
import Papa from 'papaparse';
import readXlsxFile from 'read-excel-file';
import { el, cabecalhoTela, aviso } from './componentes.js';
import { dadosAtuais, definirDados, limparDados, montarConjunto } from '../estado/dados.js';
import { atualizarAtual, projetoAtual } from '../estado/projeto.js';
import { limparR } from '../r/motor-r.js';

const LIMITE_LINHAS = 200000;
const LIMITE_MB = 30;
const TIPOS = [['quantitativo', 'Quantitativo'], ['categorico', 'Categórico'], ['ordinal', 'Ordinal']];

async function lerArquivo(arquivo) {
  if (arquivo.size > LIMITE_MB * 1048576) throw new Error(`Arquivo maior que ${LIMITE_MB} MB.`);
  const nome = arquivo.name.toLowerCase();
  if (nome.endsWith('.xlsx')) {
    const linhas = await readXlsxFile(arquivo);
    return linhas.map((l) => l.map((v) => (v instanceof Date ? v.toISOString().slice(0, 10) : v)));
  }
  if (nome.endsWith('.csv') || nome.endsWith('.txt') || nome.endsWith('.tsv')) {
    const texto = await arquivo.text();
    const r = Papa.parse(texto.replace(/^﻿/, ''), { skipEmptyLines: 'greedy', delimitersToGuess: [';', ',', '\t', '|'] });
    if (r.errors.length && !r.data.length) throw new Error('Não foi possível ler o CSV.');
    return r.data;
  }
  throw new Error('Formato não aceito. Use .csv ou .xlsx (salve planilhas .xls como .xlsx).');
}

function dicionario(conj) {
  const linhas = conj.colunas.map((c, i) => {
    const exemplos = [...new Set(c.valores.filter((v) => v !== null).slice(0, 50).map(String))].slice(0, 3).join(' · ');
    const tipo = el('select', { 'aria-label': `Tipo de ${c.nome}`, onchange: (e) => { c.tipo = e.target.value; } },
      TIPOS.map(([v, r]) => el('option', { value: v, selected: v === c.tipo }, r)));
    const incluir = el('input', { type: 'checkbox', checked: c.incluir, 'aria-label': `Usar ${c.nome}`, onchange: (e) => { c.incluir = e.target.checked; } });
    return el('tr', { class: c.identificador ? 'linha-alerta' : null },
      el('td', {}, incluir),
      el('th', { scope: 'row' }, c.nome, c.identificador ? el('span', { class: 'selo pendente' }, 'possível identificador') : null),
      el('td', {}, tipo),
      el('td', { class: 'num' }, String(conj.linhas - c.faltantes)),
      el('td', { class: 'num' }, String(c.faltantes)),
      el('td', { class: 'num' }, String(c.distintos)),
      el('td', { class: 'texto-suave' }, exemplos));
  });
  return el('div', { class: 'tabela-rolavel' }, el('table', { class: 'tabela' },
    el('thead', {}, el('tr', {}, ['Usar', 'Coluna', 'Tipo', 'Válidos', 'Faltantes', 'Distintos', 'Exemplos'].map((h) => el('th', { scope: 'col' }, h)))),
    el('tbody', {}, linhas)));
}

export function telaDados() {
  const area = el('div');
  const desenhar = () => {
    const conj = dadosAtuais();
    if (!conj) {
      const status = el('div', { role: 'status' });
      const input = el('input', { type: 'file', id: 'arquivo', accept: '.csv,.xlsx,.txt,.tsv', class: 'entrada-arquivo',
        onchange: async (e) => {
          const arquivo = e.target.files?.[0];
          if (!arquivo) return;
          status.replaceChildren(el('p', {}, 'Lendo o arquivo no seu aparelho…'));
          try {
            const matriz = await lerArquivo(arquivo);
            if (matriz.length - 1 > LIMITE_LINHAS) throw new Error(`Planilha com mais de ${LIMITE_LINHAS} linhas.`);
            definirDados(montarConjunto(matriz, arquivo.name));
            desenhar();
          } catch (err) {
            status.replaceChildren(aviso(err.message || 'Erro ao ler o arquivo.', 'erro'));
          } finally { e.target.value = ''; }
        } });
      area.replaceChildren(el('section', { class: 'cartao' },
        el('h2', {}, 'Importar planilha'),
        el('ul', {},
          el('li', {}, 'Primeira linha com os nomes das colunas; uma linha por participante.'),
          el('li', {}, 'Use .csv (vírgula ou ponto e vírgula) ou .xlsx. Decimais com vírgula são aceitos.'),
          el('li', {}, 'Variáveis ordinais: codifique em números (ex.: dor de 0 a 10; leve = 1, moderado = 2, grave = 3).')),
        el('label', { class: 'botao', for: 'arquivo' }, 'Escolher arquivo'), input, status));
      return;
    }
    const identificadores = conj.colunas.filter((c) => c.identificador);
    area.replaceChildren(
      el('section', { class: 'cartao' },
        el('h2', {}, conj.nomeArquivo),
        el('p', {}, `${conj.linhas} linhas · ${conj.colunas.length} colunas. Confira o tipo de cada coluna; desmarque as que não serão usadas.`),
        identificadores.length ? aviso(`As colunas ${identificadores.map((c) => `"${c.nome}"`).join(', ')} parecem identificar pessoas e foram desmarcadas. O ideal é removê-las da planilha antes de importar.`, 'erro', 'Atenção à privacidade:') : null,
        dicionario(conj),
        el('div', { class: 'acoes' },
          el('button', { class: 'botao', type: 'button', onclick: async () => {
            await atualizarAtual({ variaveis: conj.colunas.filter((c) => c.incluir).map((c) => ({ nome: c.nome, tipo: c.tipo })) });
            location.hash = '#/analisar/auto';
          } }, 'Analisar automaticamente →'),
          el('button', { class: 'botao secundario', type: 'button', onclick: async () => { limparDados(); await limparR().catch(() => {}); desenhar(); } }, 'Limpar dados agora')),
        el('p', { class: 'texto-suave' }, projetoAtual() ? `O projeto "${projetoAtual().titulo}" guarda só os nomes e tipos das colunas, nunca os valores.` : 'O projeto guarda só os nomes e tipos das colunas, nunca os valores.')));
  };
  desenhar();
  return [
    cabecalhoTela('Meus dados', 'Importe a planilha e confirme o tipo de cada coluna.', ['Analisar', 'Dados']),
    aviso('Use planilha desidentificada: sem nome, prontuário, CPF ou data de nascimento. O arquivo é lido só no seu aparelho, não é enviado a nenhum servidor e é apagado ao fechar a aba.', 'atencao', 'Antes de importar:'),
    area,
  ];
}
