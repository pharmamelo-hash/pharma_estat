// Acesso central à base de conhecimento (JSON). Nenhum conteúdo científico mora no código.
import desenhos from '../base/desenhos.json';
import testes from '../base/testes.json';
import referencias from '../base/referencias.json';
import arvoreDesenho from '../base/arvore-desenho.json';
import arvoreTeste from '../base/arvore-teste.json';
import amostra from '../base/amostra.json';
import glossario from '../base/glossario.json';

export const BASE = { desenhos, testes, referencias, arvoreDesenho, arvoreTeste, amostra, glossario };

const porId = (lista) => Object.fromEntries(lista.map((x) => [x.id, x]));
export const DESENHOS = porId(desenhos.desenhos);
export const TESTES = porId(testes.testes);
export const REFS = porId(referencias.referencias);
export const CALCULOS = porId(amostra.calculos);
export const CATEGORIAS = porId(desenhos.categorias);

export const ROTULO_FORCA = { muito_baixa: 'muito baixa', baixa: 'baixa', moderada: 'moderada', alta: 'alta', nao_se_aplica: 'não se aplica' };

/** Citação de uma referência pelo id (ou o próprio id, se faltar). */
export const citacao = (id) => REFS[id]?.citacao ?? id;
export const refPendente = (id) => REFS[id]?.conferida === 'pendente';
