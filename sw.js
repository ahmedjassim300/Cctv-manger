// CCTV Manager - Service Worker v2 (FCM)
importScripts('https://www.gstatic.com/firebasejs/10.12.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.12.0/firebase-messaging-compat.js');

firebase.initializeApp({
  apiKey:            "AIzaSyDRxLI4FFxbdCybC0KiA566omuenf_K8mA",
  authDomain:        "cctv-b01fb.firebaseapp.com",
  databaseURL:       "https://cctv-b01fb-default-rtdb.europe-west1.firebasedatabase.app",
  projectId:         "cctv-b01fb",
  storageBucket:     "cctv-b01fb.firebasestorage.app",
  messagingSenderId: "978629565242",
  appId:             "1:978629565242:web:8985b696142b95462b0e03"
});

const messaging = firebase.messaging();

// استقبال الإشعارات في الخلفية
messaging.onBackgroundMessage(payload => {
  const { title, body } = payload.notification || {};
  return self.registration.showNotification(title || 'CCTV Manager', {
    body: body || '',
    icon: './icon-192.png',
    badge: './icon-192.png',
    dir: 'rtl',
    lang: 'ar',
    vibrate: [200, 100, 200],
    data: payload.data || {}
  });
});

const CACHE = 'cctv-v2';
const ASSETS = ['./Index.html', './manifest.json'];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(ASSETS)).catch(() => {}));
  self.skipWaiting();
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))
    )
  );
  self.clients.claim();
});

self.addEventListener('fetch', e => {
  if (e.request.method !== 'GET') return;
  if (e.request.url.includes('firebaseio.com')) return;
  if (e.request.url.includes('googleapis.com')) return;
  if (e.request.url.includes('gstatic.com')) return;
  e.respondWith(
    fetch(e.request)
      .then(res => { const c=res.clone(); caches.open(CACHE).then(ca=>ca.put(e.request,c)); return res; })
      .catch(() => caches.match(e.request))
  );
});

self.addEventListener('notificationclick', e => {
  e.notification.close();
  e.waitUntil(
    clients.matchAll({type:'window'}).then(list => {
      if(list.length) return list[0].focus();
      return clients.openWindow('./Index.html');
    })
  );
});
