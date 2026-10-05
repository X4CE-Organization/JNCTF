/*
 * JNCTF 的 Service Worker：只为「加到主屏后能离屏打开」服务，不做激进的缓存。
 *
 * 策略：
 *   - 页面导航：网络优先，断网时回退到缓存的首页外壳
 *   - /assets/ 静态资源：缓存优先（文件名带哈希，不会过期）
 *   - 接口 / 上传文件：完全不碰，永远走网络
 * 这样既满足安装到主屏的条件，又不会出现「改了代码用户还看到旧页面」。
 */
const CACHE = 'jnctf-shell-v1';
const SHELL = ['/', '/manifest.webmanifest', '/favicon.svg', '/icons/icon-192.png'];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE).then((cache) => cache.addAll(SHELL)).then(() => self.skipWaiting()).catch(() => self.skipWaiting()),
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((key) => key !== CACHE).map((key) => caches.delete(key))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;
  if (url.pathname.startsWith('/api/') || url.pathname.startsWith('/uploads/')) return;

  // 页面导航：网络优先，断网时用缓存的外壳顶一下
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then((response) => {
          const copy = response.clone();
          caches.open(CACHE).then((cache) => cache.put('/', copy)).catch(() => {});
          return response;
        })
        .catch(() => caches.match('/').then((cached) => cached || Response.error())),
    );
    return;
  }

  // 带哈希的构建产物：直接吃缓存
  if (url.pathname.startsWith('/assets/')) {
    event.respondWith(
      caches.match(request).then(
        (cached) =>
          cached ||
          fetch(request).then((response) => {
            const copy = response.clone();
            caches.open(CACHE).then((cache) => cache.put(request, copy)).catch(() => {});
            return response;
          }),
      ),
    );
  }
});
