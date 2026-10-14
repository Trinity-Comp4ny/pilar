// Service Worker minimal — Pilar
// Estratégia:
//   - Precache do shell básico (index + logo + manifest).
//   - Network-first com fallback para cache em navegação (HTML).
//   - Cache-first só em /assets/* (nome com hash, conteúdo imutável).
//   - Network-first nos demais arquivos estáticos (favicon, ícones, logo): o
//     nome não muda quando a arte muda, então cache-first prendia a versão
//     antiga pra sempre (o favicon branco de julho seguia aparecendo).
//   - Sem cache de chamadas Supabase/API (sempre rede).

// Trocar a versão descarta o cache anterior no activate.
const CACHE_NAME = "pilar-v2";
const SHELL = ["/", "/index.html", "/pilar-logo.svg", "/manifest.webmanifest"];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(CACHE_NAME)
      .then((cache) => cache.addAll(SHELL).catch(() => undefined))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;

  const url = new URL(req.url);

  // Não interceptar chamadas de API/Supabase/analytics
  if (
    url.hostname.includes("supabase.co") ||
    url.hostname.includes("googletagmanager.com") ||
    url.hostname.includes("google-analytics.com") ||
    url.hostname.includes("fonts.googleapis.com") ||
    url.hostname.includes("fonts.gstatic.com")
  ) {
    return;
  }

  // Navegação (HTML): network-first com fallback pro cache
  if (req.mode === "navigate") {
    event.respondWith(
      fetch(req)
        .then((res) => {
          const copy = res.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(req, copy).catch(() => undefined));
          return res;
        })
        .catch(() => caches.match(req).then((hit) => hit || caches.match("/index.html")))
    );
    return;
  }

  if (url.origin !== self.location.origin) return;

  // Assets com hash: cache-first
  if (url.pathname.startsWith("/assets/")) {
    event.respondWith(
      caches.match(req).then((hit) => {
        if (hit) return hit;
        return fetch(req).then((res) => {
          if (res.ok) {
            const copy = res.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(req, copy).catch(() => undefined));
          }
          return res;
        });
      })
    );
    return;
  }

  // Demais estáticos (favicon, ícones, logo): network-first com fallback pro cache
  if (/\.(js|css|svg|png|ico|woff2?|ttf)$/i.test(url.pathname)) {
    event.respondWith(
      fetch(req)
        .then((res) => {
          if (res.ok) {
            const copy = res.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(req, copy).catch(() => undefined));
          }
          return res;
        })
        .catch(() => caches.match(req).then((hit) => hit || Response.error()))
    );
  }
});
