const CACHE_NAME = 'clientes-pwa-v1';
const urlsToCache = [
  '/',
  '/index.html',
  '/styles.css',
  '/app.js',
  '/manifest.json',
  'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.2/css/all.min.css',
  'https://cdn.jsdelivr.net/npm/bootstrap@5.3.0/dist/css/bootstrap.min.css'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => {
        console.log('Cache abierto');
        return cache.addAll(urlsToCache);
      })
  );
});

self.addEventListener('fetch', (event) => {
  const requestUrl = new URL(event.request.url);

  // Si la solicitud es para la API, intentar enviarla directamente
  if (requestUrl.pathname.startsWith('/api/')) {
    event.respondWith(
      fetch(event.request)
        .catch(() => {
          // Si no hay conexión, puede devolver una respuesta en caché o un error indicando que no hay conexión
          return new Response(JSON.stringify({ error: 'No hay conexión a internet' }), {
            headers: { 'Content-Type': 'application/json' },
            status: 503
          });
        })
    );
    return;
  }

  // Para otros recursos, usar la estrategia de caché first, luego network
  event.respondWith(
    caches.match(event.request)
      .then((response) => {
        if (response) {
          return response;
        }
        return fetch(event.request)
          .then((response) => {
            // Verificar si debemos cachear esta respuesta
            if (!response || response.status !== 200 || response.type !== 'basic') {
              return response;
            }

            const responseToCache = response.clone();
            caches.open(CACHE_NAME)
              .then((cache) => {
                cache.put(event.request, responseToCache);
              });

            return response;
          });
      })
  );
});

self.addEventListener('activate', (event) => {
  const cacheWhitelist = [CACHE_NAME];
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (cacheWhitelist.indexOf(cacheName) === -1) {
            return caches.delete(cacheName);
          }
        })
      );
    })
  );
});

// Al recuperar la conexión, intentar sincronizar
self.addEventListener('sync', (event) => {
  if (event.tag === 'sync-clientes') {
    event.waitUntil(sincronizarClientes());
  }
});

// Esta función sería llamada cuando se recupere la conexión
function sincronizarClientes() {
  return self.clients.matchAll()
    .then((clients) => {
      return clients.map((client) => {
        // Enviar mensaje al cliente para que sincronice
        return client.postMessage({ action: 'sincronizar' });
      });
    })
    .catch((err) => {
      console.error('Error durante la sincronización:', err);
    });
}