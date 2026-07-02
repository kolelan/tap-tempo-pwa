const CACHE_NAME = 'tap-tempo-v1';
const urlsToCache = [
    '/index.html',
    '/style.css',
    '/app.js',
    '/manifest.json',
    '/icons/icon-192.png',
    '/icons/icon-512.png'
];

// Установка – кэшируем все необходимые ресурсы
self.addEventListener('install', event => {
    event.waitUntil(
        caches.open(CACHE_NAME)
            .then(cache => {
                console.log('Кэширование ресурсов');
                return cache.addAll(urlsToCache);
            })
            .catch(err => console.error('Ошибка кэширования:', err))
    );
    self.skipWaiting(); // сразу активируем
});

// Активация – удаляем старые кэши
self.addEventListener('activate', event => {
    event.waitUntil(
        caches.keys().then(cacheNames => {
            return Promise.all(
                cacheNames.map(name => {
                    if (name !== CACHE_NAME) {
                        return caches.delete(name);
                    }
                })
            );
        })
    );
    self.clients.claim(); // берём под контроль все клиенты
});

// Перехват запросов – отдаём из кэша, приоритет кэша, но с обновлением (fallback network)
self.addEventListener('fetch', event => {
    event.respondWith(
        caches.match(event.request)
            .then(response => {
                // Если есть в кэше – возвращаем
                if (response) {
                    return response;
                }
                // Иначе идём в сеть
                return fetch(event.request)
                    .then(networkResponse => {
                        // Кэшируем ответ для будущих запросов (опционально)
                        return caches.open(CACHE_NAME).then(cache => {
                            cache.put(event.request, networkResponse.clone());
                            return networkResponse;
                        });
                    })
                    .catch(() => {
                        // Если сеть недоступна и нет кэша – возвращаем fallback-страницу
                        // (можно вернуть что-то вроде офлайн-страницы)
                        return new Response('Офлайн', { status: 503 });
                    });
            })
    );
});