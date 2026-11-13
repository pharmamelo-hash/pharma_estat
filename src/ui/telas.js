// Mapa de telas e rotas (Doc 3). Cada tela vive no seu próprio arquivo.
import { el, cabecalhoTela, cartaoAtalho, aviso } from './componentes.js';
import { NOME_APP, FRASE_APP, AVISO_FIXO, VERSAO_APP, VERSAO_BASE } from '../config.js';
import { BASE, DESENHOS, TESTES, refPendente } from '../base.js';
import { projetoAtual } from '../estado/projeto.js';
import { telaDesenho, telaTeste } from './tela-assistente.js';
import { telaAmostra } from './tela-amostra.js';
import { telaAprender, telaCatalogoDesenhos, telaCatalogoTestes, telaFichaTeste, telaGlossario } from './tela-aprender.js';
import { telaDados } from './tela-dados.js';
import { telaAnalise, telaRelatorio } from './tela-analise.js';
import { telaProjetos } from './tela-projetos.js';
import { telaRevisao } from './tela-revisao.js';
import { listaRefs } from './fichas.js';
import { telaLaboratorio } from './tela-laboratorio.js';
import { telaColeta } from './tela-coleta.js';
import { telaAuto } from './tela-auto.js';
import { telaTrilha, telaAula, barraProgresso } from './tela-trilha.js';
import TRILHA from '../../base/trilha.json';
import { resumoTrilha } from '../estado/progresso.js';
import { telaEfeito } from './tela-efeito.js';
import { telaRedator } from './tela-redator.js';
import { telaCorretor } from './tela-corretor.js';
import { blocoCitar } from './citar.js';

function cartaoProjeto() {
  const p = projetoAtual();
  if (!p) return el('section', { class: 'cartao' }, el('span', { class: 'etiqueta' }, 'Projeto'), el('p', {}, 'Nenhum projeto aberto. As escolhas que você salvar criam um projeto automaticamente.'), el('a', { class: 'botao secundario', href: '#/projetos' }, 'Meus projetos'));
  const feito = [p.desenho && DESENHOS[p.desenho.id]?.nome, p.teste && TESTES[p.teste.id]?.nome, p.amostra && `n = ${p.amostra.resultado}`].filter(Boolean);
  return el('section', { class: 'cartao' }, el('span', { class: 'etiqueta' }, 'Projeto aberto'), el('h2', {}, p.titulo),
    el('p', {}, feito.length ? feito.join(' · ') : 'Ainda sem desenho, teste ou amostra definidos.'),
    el('div', { class: 'acoes' }, el('a', { class: 'botao secundario', href: '#/projetos' }, 'Abrir projeto'), el('a', { class: 'botao secundario', href: '#/projeto/revisao' }, 'Revisão metodológica'), el('a', { class: 'botao secundario', href: '#/projeto/coleta' }, 'Acompanhar a coleta')));
}

function telaInicio() {
  const r = resumoTrilha(TRILHA);
  const bloco = (cls, icone, titulo, texto, destino, extra) => el('a', { class: `bloco-inicio ${cls}`, href: destino },
    el('span', { class: 'bloco-icone', 'aria-hidden': 'true' }, icone), el('strong', {}, titulo), el('span', {}, texto), extra || null);
  return [
    el('section', { class: 'heroi' },
      el('span', { class: 'etiqueta' }, '@pharmamelo'),
      el('h1', {}, NOME_APP),
      el('p', {}, 'Bioestatística para a saúde: aprenda, planeje e analise o seu trabalho, com a justificativa e a referência de cada escolha.')),
    el('div', { class: 'blocos-inicio' },
      bloco('analisar', '✦', 'Analisar meu trabalho', 'Aponte o desfecho e a comparação: o app escolhe o teste, roda e explica o resultado.', '#/analisar/auto'),
      bloco('aprender', '▶', 'Aprender do básico ao avançado', r.proxima ? `${r.feitas ? 'Continue' : 'Comece'} por: ${r.proxima.titulo}` : 'Trilha concluída. Reveja quando quiser.', r.proxima ? `#/aprender/aula/${r.proxima.id}` : '#/aprender/trilha',
        el('span', { class: 'bloco-progresso' }, barraProgresso(r.feitas, r.total), el('small', {}, `${r.feitas} de ${r.total} aulas`))),
      bloco('planejar', '◇', 'Planejar meu estudo', 'Tipo de estudo, teste, tamanho da amostra e revisão metodológica do projeto.', '#/planejar')),
    cartaoProjeto(),
    el('div', { class: 'grade grade-2' },
      cartaoAtalho({ etiqueta: 'Projeto', titulo: 'Corrigir meu projeto (Word/PDF)', texto: 'O app lê o arquivo, aponta o que falta no método e corrige com o seu OK.', destino: '#/projeto/corrigir' }),
      cartaoAtalho({ etiqueta: 'Projeto', titulo: 'Escrever o projeto do zero', texto: 'Modelos CEP e TCC/Residência, com o método redigido pelo app.', destino: '#/projeto/redigir' }),
      cartaoAtalho({ etiqueta: 'Planejar', titulo: 'Qual é o meu tipo de estudo?', texto: 'Perguntas guiadas levam ao desenho, com vieses e diretriz de relato.', destino: '#/planejar/desenho' }),
      cartaoAtalho({ etiqueta: 'Planejar', titulo: 'Qual teste estatístico usar?', texto: 'Pelo tipo de desfecho e de grupo, com o porquê e as referências.', destino: '#/planejar/teste' }),
      cartaoAtalho({ etiqueta: 'Dimensionar', titulo: 'Quantos participantes?', texto: 'Seis cálculos conferidos contra o R, com curva de poder.', destino: '#/planejar/amostra' }),
      cartaoAtalho({ etiqueta: 'Laboratório', titulo: 'Armadilhas da evidência', texto: 'Nove simulações do hospital em que os números enganam.', destino: '#/aprender/laboratorio' }),
      cartaoAtalho({ etiqueta: 'Durante a coleta', titulo: 'Acompanhar a coleta', texto: 'Ritmo, previsão de término, perdas e poder já atingido.', destino: '#/projeto/coleta' }),
      cartaoAtalho({ etiqueta: 'Consulta', titulo: 'Catálogos e glossário', texto: 'Desenhos, testes e conceitos com exemplos da saúde.', destino: '#/aprender' })),
  ];
}

function telaPlanejar() {
  return [
    cabecalhoTela('Planejar', 'Defina o desenho, o teste e o tamanho da amostra antes de coletar os dados.'),
    cartaoProjeto(),
    el('div', { class: 'grade grade-2' },
      cartaoAtalho({ etiqueta: 'Passo 1', titulo: 'Tipo de estudo', texto: 'Assistente de desenho.', destino: '#/planejar/desenho' }),
      cartaoAtalho({ etiqueta: 'Passo 2', titulo: 'Teste estatístico', texto: 'Assistente de teste e ficha.', destino: '#/planejar/teste' }),
      cartaoAtalho({ etiqueta: 'Passo 3', titulo: 'Tamanho amostral', texto: 'Cálculo com premissas.', destino: '#/planejar/amostra' }),
      cartaoAtalho({ etiqueta: 'Passo 4', titulo: 'Escrever o projeto', texto: 'Modelo CEP ou TCC/Residência, com o método redigido pelo app. Baixa em Word ou PDF.', destino: '#/projeto/redigir' }),
      cartaoAtalho({ etiqueta: 'Passo 5', titulo: 'Corrigir projeto pronto', texto: 'Envie o Word ou PDF: o app aponta, explica e corrige com o seu OK.', destino: '#/projeto/corrigir' }),
      cartaoAtalho({ etiqueta: 'Formulário', titulo: 'Revisão metodológica', texto: 'Parecer com as inconsistências do projeto.', destino: '#/projeto/revisao' })),
  ];
}
function telaAnalisar() {
  return [
    cabecalhoTela('Analisar', 'O R roda no seu aparelho. Nenhum dado é enviado.'),
    el('div', { class: 'grade grade-2' },
      cartaoAtalho({ etiqueta: 'Recomendado', titulo: 'Analisar meu trabalho (automático)', texto: 'O app identifica a análise, escolhe o teste e interpreta. Aceita planilha ou números resumidos.', destino: '#/analisar/auto' }),
      cartaoAtalho({ etiqueta: 'Durante a coleta', titulo: 'Acompanhar a coleta', texto: 'Ritmo, previsão de término, perdas e poder já atingido.', destino: '#/projeto/coleta' }),
      cartaoAtalho({ etiqueta: 'Passo 1', titulo: 'Importar dados', texto: 'Planilha e dicionário de variáveis.', destino: '#/analisar/dados' }),
      cartaoAtalho({ etiqueta: 'Passo 2', titulo: 'Análise manual', texto: 'Você escolhe o teste e as colunas.', destino: '#/analisar/resultado' }),
      cartaoAtalho({ etiqueta: 'Passo 3', titulo: 'Relatório', texto: 'Métodos, resultados e script R.', destino: '#/analisar/relatorio' })),
  ];
}
function telaSobre() {
  const todas = BASE.referencias.referencias.map((r) => r.id);
  const pend = todas.filter(refPendente).length;
  return [
    cabecalhoTela('Sobre', null),
    el('section', { class: 'cartao' },
      el('h2', {}, 'Aviso de uso'), el('p', {}, AVISO_FIXO),
      el('h2', {}, 'Privacidade'),
      el('p', {}, 'Sem cadastro e sem coleta de dados pessoais. Os projetos ficam só neste aparelho e guardam apenas o planejamento. A planilha é analisada na memória do navegador, nunca é enviada e é apagada ao fechar a aba.'),
      el('h2', {}, 'Como o app decide'),
      el('p', {}, 'As recomendações vêm de regras fixas, revisadas e com referência — sem inteligência artificial decidindo. A mesma resposta gera sempre a mesma recomendação. Os cálculos amostrais são conferidos contra o R, e as análises rodam no próprio R (webR).'),
      el('h2', {}, 'Versões'),
      el('p', { class: 'mono' }, `app ${VERSAO_APP} · base ${VERSAO_BASE}`),
      el('p', {}, 'Desenvolvido por @pharmamelo — Ciência que informa, farmácia que cuida.')),
    blocoCitar(),
    el('section', { class: 'cartao' }, el('h2', {}, `Referências da base (${todas.length})`),
      pend ? aviso(`${pend} referências ainda marcadas para conferência antes da versão final.`, 'atencao') : null,
      listaRefs(todas)),
  ];
}
function telaNaoEncontrada() {
  return [cabecalhoTela('Página não encontrada', 'Volte ao início pelo menu.'), el('a', { class: 'botao', href: '#/inicio' }, 'Ir para o início')];
}

export const ROTAS = {
  '/inicio': { tela: telaInicio, menu: 'inicio', titulo: 'Início' },
  '/planejar': { tela: telaPlanejar, menu: 'planejar', titulo: 'Planejar' },
  '/planejar/desenho': { tela: telaDesenho, menu: 'planejar', titulo: 'Tipo de estudo' },
  '/planejar/teste': { tela: telaTeste, menu: 'planejar', titulo: 'Teste estatístico' },
  '/planejar/amostra': { tela: telaAmostra, menu: 'planejar', titulo: 'Tamanho amostral' },
  '/projetos': { tela: telaProjetos, menu: 'planejar', titulo: 'Projetos' },
  '/projeto/revisao': { tela: telaRevisao, menu: 'planejar', titulo: 'Revisão metodológica' },
  '/projeto/redigir': { tela: telaRedator, menu: 'planejar', titulo: 'Escrever o projeto' },
  '/projeto/corrigir': { tela: telaCorretor, menu: 'planejar', titulo: 'Corrigir projeto' },
  '/projeto/coleta': { tela: telaColeta, menu: 'analisar', titulo: 'Acompanhamento da coleta' },
  '/analisar': { tela: telaAnalisar, menu: 'analisar', titulo: 'Analisar' },
  '/analisar/auto': { tela: telaAuto, menu: 'analisar', titulo: 'Analisar meu trabalho' },
  '/analisar/dados': { tela: telaDados, menu: 'analisar', titulo: 'Meus dados' },
  '/analisar/resultado': { tela: telaAnalise, menu: 'analisar', titulo: 'Análise' },
  '/analisar/relatorio': { tela: telaRelatorio, menu: 'analisar', titulo: 'Relatório' },
  '/aprender': { tela: telaAprender, menu: 'aprender', titulo: 'Aprender' },
  '/aprender/desenhos': { tela: telaCatalogoDesenhos, menu: 'aprender', titulo: 'Tipos de estudo' },
  '/aprender/testes': { tela: telaCatalogoTestes, menu: 'aprender', titulo: 'Testes estatísticos' },
  '/aprender/trilha': { tela: telaTrilha, menu: 'aprender', titulo: 'Trilha' },
  '/aprender/glossario': { tela: telaGlossario, menu: 'aprender', titulo: 'Glossário' },
  '/aprender/laboratorio': { tela: telaLaboratorio, menu: 'aprender', titulo: 'Laboratório' },
  '/ferramentas/efeito': { tela: telaEfeito, menu: 'planejar', titulo: 'Tamanho de efeito' },
  '/sobre': { tela: telaSobre, menu: null, titulo: 'Sobre' },
};
export const ROTAS_DINAMICAS = [
  { prefixo: '/aprender/teste/', rota: { tela: telaFichaTeste, menu: 'aprender', titulo: 'Ficha do teste' } },
  { prefixo: '/aprender/aula/', rota: { tela: telaAula, menu: 'aprender', titulo: 'Aula' } },
];
export const TELA_NAO_ENCONTRADA = { tela: telaNaoEncontrada, menu: null, titulo: 'Não encontrada' };

// Menu lateral em grupos (F18). `tambem`: prefixos de rota que acendem o item.
export const MENU_LATERAL = [
  { grupo: 'Principal', itens: [
    { rotulo: 'Início', icone: 'inicio', destino: '#/inicio' },
    { rotulo: 'Analisar meu trabalho', icone: 'analisar', destino: '#/analisar/auto' },
  ] },
  { grupo: 'Meu projeto', itens: [
    { rotulo: 'Projetos', icone: 'projetos', destino: '#/projetos' },
    { rotulo: 'Escrever o projeto', icone: 'escrever', destino: '#/projeto/redigir' },
    { rotulo: 'Corrigir projeto (Word/PDF)', icone: 'corrigir', destino: '#/projeto/corrigir' },
    { rotulo: 'Revisão metodológica', icone: 'revisao', destino: '#/projeto/revisao' },
    { rotulo: 'Acompanhar a coleta', icone: 'coleta', destino: '#/projeto/coleta' },
  ] },
  { grupo: 'Ferramentas estatísticas', itens: [
    { rotulo: 'Tipo de estudo', icone: 'desenho', destino: '#/planejar/desenho' },
    { rotulo: 'Qual teste usar', icone: 'teste', destino: '#/planejar/teste' },
    { rotulo: 'Amostra e poder', icone: 'amostra', destino: '#/planejar/amostra' },
    { rotulo: 'Tamanho de efeito', icone: 'efeito', destino: '#/ferramentas/efeito' },
    { rotulo: 'Análise manual', icone: 'manual', destino: '#/analisar/dados', tambem: ['/analisar/resultado', '/analisar/relatorio'] },
  ] },
  { grupo: 'Recursos didáticos', itens: [
    { rotulo: 'Trilha de aulas', icone: 'trilha', destino: '#/aprender/trilha', tambem: ['/aprender/aula/'] },
    { rotulo: 'Laboratório', icone: 'laboratorio', destino: '#/aprender/laboratorio' },
    { rotulo: 'Glossário', icone: 'glossario', destino: '#/aprender/glossario' },
    { rotulo: 'Catálogos', icone: 'catalogo', destino: '#/aprender', tambem: ['/aprender/desenhos', '/aprender/testes', '/aprender/teste/'] },
  ] },
  { grupo: 'App', itens: [
    { rotulo: 'Sobre e como citar', icone: 'sobre', destino: '#/sobre' },
  ] },
];
/** Item do menu lateral que corresponde à rota atual (para aria-current). */
export function itemAtivo(caminho) {
  for (const g of MENU_LATERAL) for (const i of g.itens) {
    if (i.destino === `#${caminho}`) return i.destino;
    if ((i.tambem || []).some((t) => (t.endsWith('/') ? caminho.startsWith(t) : caminho === t))) return i.destino;
  }
  return null;
}

export const MENU = [
  { id: 'inicio', rotulo: 'Início', icone: 'inicio', destino: '#/inicio' },
  { id: 'planejar', rotulo: 'Planejar', icone: 'planejar', destino: '#/planejar' },
  { id: 'analisar', rotulo: 'Analisar', icone: 'analisar', destino: '#/analisar' },
  { id: 'aprender', rotulo: 'Aprender', icone: 'aprender', destino: '#/aprender' },
];
