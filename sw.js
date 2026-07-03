// ═══════════════════════════════════════════════════════
//  Service Worker — CCTV Manager
//  يحل مشكلة "التحديثات لا تصل للمستخدم" نهائياً
// ═══════════════════════════════════════════════════════

// ⚠️ مهم جداً: غيّر هذا الرقم مع كل رفعة تحديث جديدة على GitHub
// (حتى لو تعديل بسيط) — هذا هو ما يجبر المتصفح على تنزيل نسخة جديدة تماماً
const CACHE_VERSION = 'v2026-07-04-01';
const CACHE_NAME = 'cctv-manager-' + CACHE_VERSION;

// ═══════════════════════════════════════════════════════
//  التثبيت — فور توفر نسخة جديدة، فعّلها فوراً بدون انتظار
// ═══════════════════════════════════════════════════════
self.addEventListener('install', (event) => {
  self.skipWaiting(); // لا تنتظر إغلاق كل التبويبات القديمة
});

// ═══════════════════════════════════════════════════════
//  التفعيل — احذف كل نسخ الكاش القديمة فوراً
// ═══════════════════════════════════════════════════════
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames
          .filter((name) => name !== CACHE_NAME)
          .map((name) => caches.delete(name))
      );
    }).then(() => self.clients.claim()) // تحكّم فوري بكل التبويبات المفتوحة
  );
});

// ═══════════════════════════════════════════════════════
//  الجلب — استراتيجية "Network First" للملف الرئيسي
//  هذا يعني: حاول الإنترنت أولاً دائماً، والكاش فقط كخطة بديلة
//  عند انقطاع الإنترنت (offline fallback)
// ═══════════════════════════════════════════════════════
self.addEventListener('fetch', (event) => {
  const url = event.request.url;

  // ملف index.html (أو الجذر) — دائماً من الشبكة أولاً لضمان آخر تحديث
  const isMainDocument =
    event.request.mode === 'navigate' ||
    url.endsWith('.html') ||
    url.endsWith('/Cctv-manger/') ||
    url.endsWith('/Cctv-manger');

  if (isMainDocument) {
    event.respondWith(
      fetch(event.request, { cache: 'no-store' })
        .then((response) => {
          // حدّث الكاش بالنسخة الجديدة لاستخدامها عند انقطاع الإنترنت لاحقاً
          const clone = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone));
          return response;
        })
        .catch(() => {
          // لا يوجد إنترنت → استخدم آخر نسخة محفوظة كحل بديل مؤقت
          return caches.match(event.request);
        })
    );
    return;
  }

  // باقي الملفات (صور، أيقونات...) — كاش أولاً لسرعة أكبر، مع تحديث في الخلفية
  event.respondWith(
    caches.match(event.request).then((cached) => {
      const fetchPromise = fetch(event.request)
        .then((response) => {
          const clone = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone));
          return response;
        })
        .catch(() => cached);
      return cached || fetchPromise;
    })
  );
});

// ═══════════════════════════════════════════════════════
//  الإشعارات (FCM) — تبقى كما هي بدون تغيير
// ═══════════════════════════════════════════════════════
self.addEventListener('push', (event) => {
  if (!event.data) return;
  try {
    const data = event.data.json();
    const title = data.notification?.title || 'CCTV Manager';
    const options = {
      body: data.notification?.body || '',
      icon: data.notification?.icon || '/Cctv-manger/icon-192.png',
      badge: '/Cctv-manger/icon-192.png',
      dir: 'rtl',
      lang: 'ar',
      data: data.data || {},
    };
    event.waitUntil(self.registration.showNotification(title, options));
  } catch (e) {
    console.warn('Push event parse error:', e);
  }
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  event.waitUntil(
    clients.matchAll({ type: 'window' }).then((clientList) => {
      for (const client of clientList) {
        if ('focus' in client) return client.focus();
      }
      if (clients.openWindow) {
        return clients.openWindow('/Cctv-manger/');
      }
    })
  );
});
