// Minimal service worker. It never caches API calls or signed-in data pages, except the
// attendance screen and the trip sheet, which must open at a campsite with no signal. Taps on that screen are
// saved on the phone and synced later (see AttendanceClient).
const SHELL = "sp-shell-v1";
const PAGES = "sp-pages-v2";
const OFFLINE = "/offline.html";

self.addEventListener("install", (e) => {
  e.waitUntil(caches.open(SHELL).then((c) => c.addAll([OFFLINE])).then(() => self.skipWaiting()));
});

self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.filter((k) => ![SHELL, PAGES].includes(k)).map((k) => caches.delete(k)))).then(() => self.clients.claim()),
  );
});

self.addEventListener("message", (e) => {
  if (e.data === "clear-private") caches.delete(PAGES);
});

self.addEventListener("fetch", (e) => {
  const req = e.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  if (url.origin !== location.origin || url.pathname.startsWith("/api/") || url.pathname.startsWith("/auth/")) return;

  if (url.pathname.startsWith("/_next/static/") || url.pathname.startsWith("/icons/")) {
    e.respondWith(caches.open(SHELL).then(async (c) => {
      const hit = await c.match(req);
      if (hit) return hit;
      const res = await fetch(req);
      if (res.ok) c.put(req, res.clone());
      return res;
    }));
    return;
  }

  if (req.mode === "navigate") {
    const keep = /^\/events\/[0-9a-f-]{36}\/(attendance|trip-sheet)\/?$/.test(url.pathname);
    e.respondWith((async () => {
      try {
        const res = await fetch(req);
        if (keep && res.ok) (await caches.open(PAGES)).put(req, res.clone());
        return res;
      } catch {
        if (keep) { const hit = await (await caches.open(PAGES)).match(req); if (hit) return hit; }
        return (await caches.open(SHELL)).match(OFFLINE);
      }
    })());
  }
});
