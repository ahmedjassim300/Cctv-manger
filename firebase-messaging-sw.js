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

messaging.onBackgroundMessage(payload => {
  const { title, body } = payload.notification || {};
  return self.registration.showNotification(title || 'CCTV Manager', {
    body: body || '',
    icon: '/Cctv-manger/icon-192.png',
    badge: '/Cctv-manger/icon-192.png',
    dir: 'rtl',
    lang: 'ar',
    vibrate: [200, 100, 200]
  });
});

self.addEventListener('notificationclick', e => {
  e.notification.close();
  e.waitUntil(
    clients.matchAll({type:'window'}).then(list => {
      if(list.length) return list[0].focus();
      return clients.openWindow('/Cctv-manger/Index.html');
    })
  );
});
