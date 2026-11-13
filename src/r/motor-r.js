// Ponte com o R (webR). O R roda num processo separado (worker), então a tela não trava.
// Os arquivos do R ficam no próprio site (pasta webr/), sem CDN: funciona em redes que bloqueiam sites externos.
import { WebR, ChannelType } from 'webr';
import BIBLIOTECA from './biblioteca.R?raw';
import { TESTES } from '../base.js';

let promessa = null;
let estado = 'parado'; // parado | carregando | pronto | erro
export const estadoR = () => estado;

export function carregarR() {
  if (promessa) return promessa;
  estado = 'carregando';
  window.dispatchEvent(new CustomEvent('r-estado'));
  promessa = (async () => {
    const webR = new WebR({
      baseUrl: new URL('webr/', document.baseURI).href,
      channelType: ChannelType.PostMessage, // não exige cabeçalhos especiais do servidor (GitHub Pages)
      interactive: false,
    });
    await webR.init();
    await webR.evalRVoid(BIBLIOTECA);
    const versao = await webR.evalRString('R.version.string');
    estado = 'pronto';
    window.dispatchEvent(new CustomEvent('r-estado'));
    return { webR, versao };
  })().catch((e) => {
    estado = 'erro';
    promessa = null;
    window.dispatchEvent(new CustomEvent('r-estado'));
    throw e;
  });
  return promessa;
}

/**
 * Executa uma análise da biblioteca. `colunas` = { nome: [valores] } só com as colunas usadas;
 * `papeis` = { y, g, x, ... } com NOMES de colunas (passados como dados, nunca como código).
 */
export async function analisar(idTeste, colunas, papeis) {
  if (!TESTES[idTeste]?.analise_no_app) throw new Error('Este teste não está disponível para análise no app.');
  const { webR } = await carregarR();
  const abrigo = await new webR.Shelter();
  try {
    // RList explícita: evita que o webR tente converter as colunas num data.frame.
    await webR.objs.globalEnv.bind('dados_app', await new abrigo.RList(colunas));
    await webR.objs.globalEnv.bind('papeis_app', await new abrigo.RList(papeis));
    // idTeste vem da base e foi validado acima (lista fechada), então pode ir no código.
    const json = await webR.evalRString(`executar_analise("${idTeste}", dados_app, papeis_app)`);
    await webR.evalRVoid('rm(dados_app, papeis_app)');
    return JSON.parse(json);
  } finally {
    abrigo.purge();
  }
}

/** Apaga qualquer dado que tenha ficado no R. */
export async function limparR() {
  if (estado !== 'pronto') return;
  const { webR } = await promessa;
  await webR.evalRVoid('rm(list = setdiff(ls(), lsf.str()))');
}
