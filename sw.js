// CCTV Manager - Service Worker
const CACHE = 'cctv-v1';
const ASSETS = [
  './Index.html',
  './manifest.json',
  'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js',
  'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css'
];

// تثبيت - تخزين الملفات
self.addEventListener('install', e=>{
  e.waitUntil(
    caches.open(CACHE).then(c=>c.addAll(ASSETS)).catch(()=>{})
  );
  self.skipWaiting();
});

// تفعيل - حذف الكاش القديم
self.addEventListener('activate', e=>{
  e.waitUntil(
    caches.keys().then(keys=>
      Promise.all(keys.filter(k=>k!==CACHE).map(k=>caches.delete(k)))
    )
  );
  self.clients.claim();
});

// طلبات الشبكة - Network First ثم Cache
self.addEventListener('fetch', e=>{
  if(e.request.method !== 'GET') return;
  if(e.request.url.includes('firebaseio.com')) return;
  if(e.request.url.includes('googleapis.com')) return;
  
  e.respondWith(
    fetch(e.request)
      .then(res=>{
        const clone = res.clone();
        caches.open(CACHE).then(c=>c.put(e.request, clone));
        return res;
      })
      .catch(()=>caches.match(e.request))
  );
});

// استقبال الإشعارات
self.addEventListener('push', e=>{
  const data = e.data ? e.data.json() : {};
  e.waitUntil(
    self.registration.showNotification(data.title||'CCTV Manager', {
      body: data.body||'',
      icon: './icon-192.png',
      badge: './icon-192.png',
      dir: 'rtl',
      lang: 'ar',
      vibrate: [200, 100, 200],
      data: data
    })
  );
});

// الضغط على الإشعار يفتح التطبيق
self.addEventListener('notificationclick', e=>{
  e.notification.close();
  e.waitUntil(
    clients.matchAll({type:'window'}).then(list=>{
      if(list.length) return list[0].focus();
      return clients.openWindow('./Index.html');
    })
  );
});
