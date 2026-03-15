var CACHE_NAME = 'gorilla-dad-v3';
var ASSETS = ['./', './index.html'];

// ── INSTALL ────────────────────────────────────────────────────
self.addEventListener('install', function(e) {
  self.skipWaiting();
  e.waitUntil(
    caches.open(CACHE_NAME).then(function(cache) {
      return cache.addAll(ASSETS).catch(function() {});
    })
  );
});

// ── ACTIVATE ───────────────────────────────────────────────────
self.addEventListener('activate', function(e) {
  e.waitUntil(
    caches.keys().then(function(keys) {
      return Promise.all(
        keys.filter(function(k) { return k !== CACHE_NAME; })
            .map(function(k) { return caches.delete(k); })
      );
    })
  );
  self.clients.claim();
});

// ── FETCH ──────────────────────────────────────────────────────
self.addEventListener('fetch', function(e) {
  e.respondWith(
    caches.match(e.request).then(function(cached) {
      return cached || fetch(e.request).then(function(response) {
        var clone = response.clone();
        caches.open(CACHE_NAME).then(function(cache) {
          cache.put(e.request, clone);
        });
        return response;
      });
    }).catch(function() {
      return caches.match('./index.html');
    })
  );
});

// ── BACKGROUND TIMER via postMessage ──────────────────────────
// The app sends: {type:'startTimer', seconds:N, label:'Rest'}
// SW counts down and sends notifications at 10s and 0s
var bgTimer = null;
var bgRemain = 0;
var bgLabel = '';

self.addEventListener('message', function(e) {
  var data = e.data || {};

  if (data.type === 'startTimer') {
    // Clear existing
    if (bgTimer) { clearInterval(bgTimer); bgTimer = null; }
    bgRemain = data.seconds || 90;
    bgLabel = data.label || 'Rest';

    bgTimer = setInterval(function() {
      bgRemain--;

      // Notify clients still open (they handle audio themselves)
      self.clients.matchAll().then(function(clients) {
        clients.forEach(function(c) {
          c.postMessage({ type: 'timerTick', remain: bgRemain });
        });
      });

      // 10 second warning notification when app is in background
      if (bgRemain === 10) {
        self.registration.showNotification('Gorilla Dad 🦍', {
          body: bgLabel + ' — 10 seconds left...',
          icon: 'icon-192.png',
          tag: 'rest-warning',
          silent: false,
          vibrate: [100]
        }).catch(function() {});
      }

      // Done notification
      if (bgRemain <= 0) {
        clearInterval(bgTimer); bgTimer = null;
        self.registration.showNotification('Gorilla Dad 🦍', {
          body: bgLabel + ' over — GO! Next set time 💪',
          icon: 'icon-192.png',
          tag: 'rest-done',
          requireInteraction: true,
          silent: false,
          vibrate: [200, 100, 200, 100, 200]
        }).catch(function() {});

        // Tell open clients timer is done
        self.clients.matchAll().then(function(clients) {
          clients.forEach(function(c) {
            c.postMessage({ type: 'timerDone', label: bgLabel });
          });
        });
      }
    }, 1000);
  }

  if (data.type === 'stopTimer') {
    if (bgTimer) { clearInterval(bgTimer); bgTimer = null; }
    bgRemain = 0;
  }
});

// ── NOTIFICATION CLICK ─────────────────────────────────────────
self.addEventListener('notificationclick', function(e) {
  e.notification.close();
  e.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(function(clients) {
      if (clients.length) { return clients[0].focus(); }
      return self.clients.openWindow('./');
    })
  );
});
