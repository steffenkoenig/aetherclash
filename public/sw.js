// public/sw.js
// Service worker for Aether Clash — caches JS bundle and all 3D/audio assets
// so subsequent visits load in < 1 s even on slow connections.

const CACHE_VERSION = 'aetherclash-v1';

// Assets to pre-cache on install
const PRECACHE_ASSETS = [
  '/',
  '/index.html',
  // Character models + atlases
  '/assets/kael/kael.glb',
  '/assets/kael/kael_atlas.png',
  '/assets/gorun/gorun.glb',
  '/assets/gorun/gorun_atlas.png',
  '/assets/vela/vela.glb',
  '/assets/vela/vela_atlas.png',
  '/assets/syne/syne.glb',
  '/assets/syne/syne_atlas.png',
  '/assets/zira/zira.glb',
  '/assets/zira/zira_atlas.png',
  // Stage music
  '/assets/audio/music_aether_plateau.ogg',
  '/assets/audio/music_forge.ogg',
  '/assets/audio/music_cloud_citadel.ogg',
  '/assets/audio/music_ancient_ruin.ogg',
  '/assets/audio/music_digital_grid.ogg',
  // SFX
  '/assets/audio/hit.ogg',
  '/assets/audio/hit_strong.ogg',
  '/assets/audio/shield_hit.ogg',
  '/assets/audio/shield_break.ogg',
  '/assets/audio/jump.ogg',
  '/assets/audio/double_jump.ogg',
  '/assets/audio/land.ogg',
  '/assets/audio/ko.ogg',
  '/assets/audio/item_spawn.ogg',
  '/assets/audio/item_pickup.ogg',
  '/assets/audio/explosion.ogg',
  '/assets/audio/geyser.ogg',
  '/assets/audio/lightning.ogg',
  '/assets/audio/phase_shift.ogg',
  '/assets/audio/guardian_summon.ogg',
  '/assets/audio/heal.ogg',
  '/assets/audio/menu_select.ogg',
  '/assets/audio/menu_confirm.ogg',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_VERSION).then(cache =>
      // addAll is best-effort: missing assets are silently skipped via individual adds
      Promise.allSettled(
        PRECACHE_ASSETS.map(url => cache.add(url).catch(() => undefined)),
      ),
    ).then(() => self.skipWaiting()),
  );
});

self.addEventListener('activate', (event) => {
  // Delete old cache versions
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(
        keys
          .filter(k => k !== CACHE_VERSION)
          .map(k => caches.delete(k)),
      ),
    ).then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', (event) => {
  const { request } = event;

  // Only cache GET requests
  if (request.method !== 'GET') return;

  // Navigation requests: network-first, fall back to cached index.html
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request).catch(() =>
        caches.match('/index.html').then(r => r ?? Response.error()),
      ),
    );
    return;
  }

  // Assets: cache-first strategy
  event.respondWith(
    caches.match(request).then(cached => {
      if (cached) return cached;
      return fetch(request).then(response => {
        // Cache successful responses for static assets
        if (response.ok && response.type === 'basic') {
          const clone = response.clone();
          caches.open(CACHE_VERSION).then(cache => cache.put(request, clone));
        }
        return response;
      });
    }),
  );
});
