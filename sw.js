/* 离线缓存：先网络后缓存（保证更新），离线时用缓存 */
const C = 'jkt-v1';
const FILES = ['./', 'index.html', 'css/style.css', 'js/core.js', 'js/signs.js', 'js/quiz.js', 'js/qb1.js', 'js/qb4.js', 'js/sim2.js', 'js/sim3.js', 'js/ref.js', 'manifest.json'];
self.addEventListener('install', e => { e.waitUntil(caches.open(C).then(c => c.addAll(FILES).catch(() => {}))); self.skipWaiting(); });
self.addEventListener('activate', e => { e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== C).map(k => caches.delete(k))))); self.clients.claim(); });
self.addEventListener('fetch', e => {
  if (e.request.method !== 'GET') return;
  e.respondWith(fetch(e.request).then(r => { const cp = r.clone(); caches.open(C).then(c => c.put(e.request, cp)); return r; })
    .catch(() => caches.match(e.request, { ignoreSearch: true })));
});
