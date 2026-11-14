// Guarda o app no aparelho para abrir sem internet.
// Ao publicar uma versão nova, aumente o número abaixo (ex.: v3 → v4).
// Se criar um arquivo novo, inclua-o na lista ARQUIVOS.

const VERSAO = "coleta-mqai-demo-v29";
const ARQUIVOS = [
  // Página e configuração
  "./",
  "./index.html",
  "./manifest.webmanifest",
  // Estilos
  "./css/fontes.css",
  "./css/variaveis.css",
  "./css/base.css",
  "./css/layout.css",
  "./css/componentes.css",
  "./css/telas.css",
  "./css/responsivo.css",
  "./fonts/raleway-latin-400-normal.woff2",
  "./fonts/raleway-latin-600-normal.woff2",
  "./fonts/raleway-latin-700-normal.woff2",
  // Código do app
  "./js/main.js",
  "./js/config.js",
  "./js/bibliotecas.js",
  "./js/util.js",
  "./js/eventos.js",
  "./js/sistemas.js",
  "./js/storage.js",
  "./js/validacao.js",
  "./js/etapas.js",
  "./js/painel.js",
  "./js/lembrete.js",
  "./js/excel.js",
  "./js/relatorio-pdf.js",
  "./js/exemplos.js",
  "./js/ia.js",
  "./js/ui/navegacao.js",
  "./js/ui/formulario.js",
  "./js/ui/lista.js",
  "./js/ui/exportar.js",
  "./js/ui/painel.js",
  "./js/ui/toast.js",
  "./js/ui/lembrete.js",
  // Dados (fictícios)
  "./data/sistemas.json",
  // Bibliotecas
  "./vendor/jszip.min.js",
  "./vendor/jspdf.umd.min.js",
  // Ícones
  "./icons/icon-192.png",
  "./icons/icon-512.png",
  "./icons/apple-touch-icon.png",
];

self.addEventListener("install", (e) => {
  e.waitUntil(caches.open(VERSAO).then((c) => c.addAll(ARQUIVOS)).then(() => self.skipWaiting()));
});

self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches.keys()
      .then((ks) => Promise.all(ks.filter((k) => k !== VERSAO).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

// Com internet: busca a versão mais nova e atualiza a cópia guardada.
// Sem internet: usa a cópia guardada.
// As chamadas à IA (/api/…) nunca passam pelo cache: vão direto para a rede.
self.addEventListener("fetch", (e) => {
  const req = e.request;
  const url = new URL(req.url);
  if (req.method !== "GET" || url.origin !== location.origin || url.pathname.startsWith("/api/")) return;
  const chave = req.mode === "navigate" ? "./index.html" : req;
  e.respondWith(
    fetch(req)
      .then((r) => {
        if (r.ok) { const copia = r.clone(); caches.open(VERSAO).then((c) => c.put(chave, copia)); }
        return r;
      })
      .catch(() => caches.match(chave).then((r) => r || caches.match(req, { ignoreSearch: true }))),
  );
});
