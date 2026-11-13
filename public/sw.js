// Service Worker: guarda os arquivos do app para funcionar offline (Doc 2).
// Estratégia: página principal = rede primeiro (pega versão nova), cópia do cache se offline;
// demais arquivos do próprio site = cache primeiro (nomes com hash mudam a cada versão).
// Nunca guarda nada de outros domínios e nunca guarda dados do estudo.
const VERSAO_CACHE = 'pharmaestat-v0.13.0';
const ESSENCIAIS = ['./', './index.html', './manifest.webmanifest', './icones/icone.svg'];

self.addEventListener('install', (evento) => {
  evento.waitUntil(caches.open(VERSAO_CACHE).then((cache) => cache.addAll(ESSENCIAIS)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (evento) => {
  evento.waitUntil(
    caches.keys()
      .then((nomes) => Promise.all(nomes.filter((n) => n !== VERSAO_CACHE).map((n) => caches.delete(n))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', (evento) => {
  const pedido = evento.request;
  if (pedido.method !== 'GET') return;
  const url = new URL(pedido.url);
  if (url.origin !== self.location.origin) return;

  if (pedido.mode === 'navigate') {
    evento.respondWith(
      fetch(pedido)
        .then((resposta) => {
          const copia = resposta.clone();
          caches.open(VERSAO_CACHE).then((cache) => cache.put('./index.html', copia));
          return resposta;
        })
        .catch(() => caches.match('./index.html')),
    );
    return;
  }

  evento.respondWith(
    caches.match(pedido).then((emCache) => emCache || fetch(pedido).then((resposta) => {
      if (resposta.ok) {
        const copia = resposta.clone();
        caches.open(VERSAO_CACHE).then((cache) => cache.put(pedido, copia));
      }
      return resposta;
    })),
  );
});
