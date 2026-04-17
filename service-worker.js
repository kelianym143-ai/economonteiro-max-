// ==================== SERVICE WORKER ====================
// Habilita funcionalidades offline e cache local

const CACHE_NAME = 'economonteiro-v1';
const ASSETS_TO_CACHE = [
    '/',
    '/index.html',
    '/script.js',
    '/style.css',
    '/firebase-config.js',
    '/charts-module.js',
    '/ai-module.js',
    '/manifest.json',
    'https://cdn.tailwindcss.com',
    'https://cdn.jsdelivr.net/npm/chart.js'
];

// ✅ PWA ATIVADO - Service Worker Production Ready
// Instalar Service Worker
self.addEventListener('install', event => {
    event.waitUntil(
        caches.open(CACHE_NAME).then(cache => {
            console.log('Cache dos assets...');
            return cache.addAll(ASSETS_TO_CACHE).catch(err => {
                console.log('Erro ao cachear alguns assets:', err);
                // Continuar mesmo se alguns assets falharem
                return Promise.resolve();
            });
        })
    );
    self.skipWaiting();
});

// Ativar Service Worker
self.addEventListener('activate', event => {
    event.waitUntil(
        caches.keys().then(cacheNames => {
            return Promise.all(
                cacheNames.map(cacheName => {
                    if (cacheName !== CACHE_NAME) {
                        console.log('Deletando cache antigo:', cacheName);
                        return caches.delete(cacheName);
                    }
                })
            );
        })
    );
    self.clients.claim();
});

// Estratégia de cache: Network First, Fallback to Cache
self.addEventListener('fetch', event => {
    // Ignorar requisições não-GET
    if (event.request.method !== 'GET') {
        return;
    }
    
    // Para dados críticos (API de IA), tente a rede primeiro
    if (event.request.url.includes('/api/') || event.request.url.includes('openai') || event.request.url.includes('firebase')) {
        event.respondWith(
            fetch(event.request)
                .then(response => {
                    // Cache a resposta se for bem-sucedida
                    if (response.ok) {
                        const cacheCopy = response.clone();
                        caches.open(CACHE_NAME).then(cache => {
                            cache.put(event.request, cacheCopy);
                        });
                    }
                    return response;
                })
                .catch(() => {
                    // Se falhar, tente o cache
                    return caches.match(event.request);
                })
        );
        return;
    }
    
    // Para assets estáticos, use cache primeiro
    event.respondWith(
        caches.match(event.request)
            .then(response => {
                if (response) {
                    return response;
                }
                
                return fetch(event.request)
                    .then(response => {
                        // Não cachear respostas não-ok ou extensões específicas
                        if (!response || response.status !== 200 || response.type !== 'basic') {
                            return response;
                        }
                        
                        const responseToCache = response.clone();
                        caches.open(CACHE_NAME).then(cache => {
                            cache.put(event.request, responseToCache);
                        });
                        
                        return response;
                    })
                    .catch(() => {
                        // Offline fallback
                        return new Response(
                            'Offline - Conteúdo não disponível',
                            { status: 503, statusText: 'Service Unavailable' }
                        );
                    });
            })
    );
});

// Lidar com atualizações em background
self.addEventListener('message', event => {
    if (event.data && event.data.type === 'SKIP_WAITING') {
        self.skipWaiting();
    }
});

// Sincronização em background (quando reconectar à internet)
self.addEventListener('sync', event => {
    if (event.tag === 'sync-expenses') {
        event.waitUntil(
            // Sincronizar despesas com o servidor
            fetch('/api/sync-expenses', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    timestamp: new Date().toISOString()
                })
            }).catch(err => {
                console.log('Erro na sincronização:', err);
                // Tenta novamente mais tarde
                event.waitUntil(self.registration.sync.register('sync-expenses'));
            })
        );
    }
});

// Notificações em background
self.addEventListener('push', event => {
    let payload = {};
    try {
        payload = event.data?.json?.() || {};
    } catch {
        payload = { body: event.data?.text?.() || '' };
    }

    const lang = (payload.lang || 'pt-BR').toLowerCase();
    const titles = {
        'pt-br': 'EconoMonteiro Max',
        'en': 'EconoMonteiro Max',
        'es': 'EconoMonteiro Max',
        'fr': 'EconoMonteiro Max'
    };
    const defaultBodies = {
        'pt-br': 'Nova notificação',
        'en': 'New notification',
        'es': 'Nueva notificación',
        'fr': 'Nouvelle notification'
    };

    const normalizedLang = ['pt-br', 'en', 'es', 'fr'].includes(lang) ? lang : 'pt-br';
    const options = {
        body: payload.body || defaultBodies[normalizedLang],
        icon: '/icons/icon-192x192.svg',
        badge: '/icons/icon-96x96.svg',
        tag: 'economonteiro-notification',
        requireInteraction: false
    };
    
    event.waitUntil(
        self.registration.showNotification(payload.title || titles[normalizedLang], options)
    );
});

// Clique em notificação
self.addEventListener('notificationclick', event => {
    event.notification.close();
    event.waitUntil(
        clients.matchAll({ type: 'window' }).then(windowClients => {
            // Verifica se já há uma janela aberta
            for (let i = 0; i < windowClients.length; i++) {
                const client = windowClients[i];
                if (client.url === '/' && 'focus' in client) {
                    return client.focus();
                }
            }
            // Se não houver, abra uma nova
            if (clients.openWindow) {
                return clients.openWindow('/');
            }
        })
    );
});
