// Service Worker minimal — Pilar
// Estratégia:
//   - Precache do shell básico (index + logo + manifest).
//   - Network-first com fallback para cache em navegação (HTML).
//   - Cache-first em assets estáticos (/assets/*, JS, CSS, SVG).
//   - Sem cache de chamadas Supabase/API (sempre rede).

const CACHE_NAME = "pilar-v1";
const SHELL = ["/", "/index.html", "/pilar-logo.svg", "/manifest.webmanifest"];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(CACHE_NAME)
      .then((cache) => cache.addAll(SHELL).catch(() => undefined))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
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
        .catch(() => caches.match(req).then((hit) => hit || caches.match("/index.html"))),
    );
    return;
  }

  // Assets estáticos: cache-first
  if (url.origin === self.location.origin && /\.(js|css|svg|png|ico|woff2?|ttf)$/i.test(url.pathname)) {
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
      }),
    );
  }
});
