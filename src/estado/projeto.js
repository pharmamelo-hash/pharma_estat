// Projeto do aluno (Doc 5): guarda SÓ respostas e escolhas, nunca os valores da planilha.
// Persistência no IndexedDB do aparelho; se indisponível, fica só na memória (com aviso).
import { VERSAO_APP, VERSAO_BASE } from '../config.js';

// Chaves internas mantidas do nome antigo para não perder projetos já salvos nos aparelhos.
const BANCO = 'bioestat';
const LOJA = 'projetos';
const CHAVE_ATUAL = 'bioestat.projetoAtual';
let atual = null;
let memoriaApenas = false;
const memoria = new Map();

function abrir() {
  return new Promise((ok, falha) => {
    try {
      const req = indexedDB.open(BANCO, 1);
      req.onupgradeneeded = () => req.result.createObjectStore(LOJA, { keyPath: 'id' });
      req.onsuccess = () => ok(req.result);
      req.onerror = () => falha(req.error);
    } catch (e) { falha(e); }
  });
}
async function operar(modo, fn) {
  if (memoriaApenas) return fn(null);
  try {
    const db = await abrir();
    return await new Promise((ok, falha) => {
      const tx = db.transaction(LOJA, modo);
      const r = fn(tx.objectStore(LOJA));
      tx.oncomplete = () => ok(r?.result);
      tx.onerror = () => falha(tx.error);
    });
  } catch {
    memoriaApenas = true;
    return fn(null);
  }
}

export const armazenamentoSoNaMemoria = () => memoriaApenas;

export async function listarProjetos() {
  const lista = await operar('readonly', (loja) => (loja ? loja.getAll() : { result: [...memoria.values()] }));
  return (lista || []).sort((a, b) => String(b.atualizado).localeCompare(String(a.atualizado)));
}
export async function salvarProjeto(p) {
  const copia = { ...p, atualizado: new Date().toISOString(), versao_app: VERSAO_APP, versao_base: VERSAO_BASE };
  await operar('readwrite', (loja) => (loja ? loja.put(copia) : (memoria.set(copia.id, copia), null)));
  return copia;
}
export async function apagarProjeto(id) {
  await operar('readwrite', (loja) => (loja ? loja.delete(id) : (memoria.delete(id), null)));
  if (atual?.id === id) definirAtual(null);
}
export async function apagarTodosProjetos() {
  await operar('readwrite', (loja) => (loja ? loja.clear() : (memoria.clear(), null)));
  definirAtual(null);
}

function novoId() {
  try { return crypto.randomUUID(); } catch { return `p${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`; }
}
export function novoProjeto(titulo = 'Projeto sem título') {
  return {
    id: novoId(), titulo: String(titulo).slice(0, 200), criado: new Date().toISOString(),
    pico: { p: '', i: '', c: '', o: '' }, desenho: null, teste: null, amostra: null, variaveis: [], revisao: {},
  };
}

export function projetoAtual() { return atual; }
export function definirAtual(p) {
  atual = p;
  try { if (p) localStorage.setItem(CHAVE_ATUAL, p.id); else localStorage.removeItem(CHAVE_ATUAL); } catch { /* sem armazenamento */ }
  window.dispatchEvent(new CustomEvent('projeto-mudou'));
}
export async function restaurarAtual() {
  let id = null;
  try { id = localStorage.getItem(CHAVE_ATUAL); } catch { /* ignore */ }
  if (!id) return null;
  const lista = await listarProjetos();
  atual = lista.find((p) => p.id === id) || null;
  return atual;
}
/** Garante um projeto atual (cria se não houver) e aplica mudanças. */
export async function atualizarAtual(mudancas) {
  const base = atual || novoProjeto();
  const salvo = await salvarProjeto({ ...base, ...mudancas });
  definirAtual(salvo);
  return salvo;
}

// ---------- Exportar / importar (só campos conhecidos; texto limitado) ----------
const texto = (v, max = 2000) => (typeof v === 'string' ? v.slice(0, max) : '');
const idBase = (v) => (typeof v === 'string' && /^[a-z0-9_]{1,80}$/.test(v) ? v : null);
const listaValores = (v) => (Array.isArray(v) ? v.filter((x) => typeof x === 'string' && x.length < 80).slice(0, 30) : []);

export function exportarProjeto(p) {
  return JSON.stringify({ formato: 'bioestat-projeto', versao: 1, projeto: p }, null, 2);
}
export function importarProjeto(json) {
  let bruto;
  try { bruto = JSON.parse(json); } catch { throw new Error('O arquivo não é um JSON válido.'); }
  if (bruto?.formato !== 'bioestat-projeto' || !bruto.projeto) throw new Error('Este arquivo não é um projeto exportado pelo app.');
  const p = bruto.projeto;
  const limpo = novoProjeto(texto(p.titulo, 200) || 'Projeto importado');
  limpo.pico = { p: texto(p.pico?.p), i: texto(p.pico?.i), c: texto(p.pico?.c), o: texto(p.pico?.o) };
  if (p.desenho && idBase(p.desenho.id)) limpo.desenho = { id: idBase(p.desenho.id), caminho: listaValores(p.desenho.caminho) };
  if (p.teste && idBase(p.teste.id)) limpo.teste = { id: idBase(p.teste.id), caminho: listaValores(p.teste.caminho) };
  if (p.amostra && idBase(p.amostra.calculo)) {
    const par = {};
    for (const [k, v] of Object.entries(p.amostra.parametros || {})) if (/^[a-z_0-9]{1,20}$/i.test(k) && (typeof v === 'number' || v === null)) par[k] = v;
    limpo.amostra = { calculo: idBase(p.amostra.calculo), parametros: par, perdas: Number(p.amostra.perdas) || 0, resultado: Number(p.amostra.resultado) || null };
  }
  limpo.variaveis = Array.isArray(p.variaveis) ? p.variaveis.slice(0, 300).map((v) => ({ nome: texto(v?.nome, 120), tipo: texto(v?.tipo, 20) })) : [];
  if (p.coleta && typeof p.coleta === 'object') {
    const data = (v) => (typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v) ? v : null);
    const inteiro = (v) => (Number.isFinite(Number(v)) && Number(v) >= 0 ? Math.floor(Number(v)) : 0);
    const grupos = listaValores(p.coleta.grupos).slice(0, 10);
    limpo.coleta = {
      meta: inteiro(p.coleta.meta), inicio: data(p.coleta.inicio), fim_previsto: data(p.coleta.fim_previsto),
      perdas_previstas: Math.min(0.9, Math.max(0, Number(p.coleta.perdas_previstas) || 0)), grupos,
      registros: (Array.isArray(p.coleta.registros) ? p.coleta.registros : []).slice(0, 500).filter((r) => data(r?.data)).map((r) => ({
        data: r.data, incluidos: Object.fromEntries(grupos.map((g) => [g, inteiro(r.incluidos?.[g])])), perdas: inteiro(r.perdas),
      })),
    };
  }
  if (p.revisao && typeof p.revisao === 'object') {
    for (const [k, v] of Object.entries(p.revisao)) {
      if (!/^[a-z_0-9]{1,40}$/.test(k)) continue;
      if (typeof v === 'string') limpo.revisao[k] = texto(v);
      else if (typeof v === 'number' && Number.isFinite(v)) limpo.revisao[k] = v;
      else if (Array.isArray(v)) limpo.revisao[k] = listaValores(v);
    }
  }
  return limpo;
}
