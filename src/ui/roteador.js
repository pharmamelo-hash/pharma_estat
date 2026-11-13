// Roteamento por hash (#/planejar/teste). Funciona no GitHub Pages sem configurar servidor.
// Funções puras, testadas em testes/roteador.test.js.
export function caminhoDoHash(hash) {
  const limpo = String(hash || '').replace(/^#/, '').split('?')[0].replace(/\/+$/, '');
  return limpo === '' || limpo === '/' ? '/inicio' : (limpo.startsWith('/') ? limpo : `/${limpo}`);
}

/**
 * Resolve a rota: primeiro as fixas; depois as dinâmicas por prefixo (ex.: /aprender/teste/<id>).
 * O parâmetro só aceita letras minúsculas, números e _ (ids da base), por segurança.
 */
export function resolverRota(hash, rotas, naoEncontrada, dinamicas = []) {
  const caminho = caminhoDoHash(hash);
  if (rotas[caminho]) return { caminho, rota: rotas[caminho], parametro: null };
  for (const d of dinamicas) {
    if (caminho.startsWith(d.prefixo)) {
      const parametro = caminho.slice(d.prefixo.length);
      if (/^[a-z0-9_]{1,80}$/.test(parametro)) return { caminho, rota: d.rota, parametro };
    }
  }
  return { caminho, rota: naoEncontrada, parametro: null };
}
