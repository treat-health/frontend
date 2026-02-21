// Load Firebase SDKs
importScripts('https://www.gstatic.com/firebasejs/10.12.2/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.12.2/firebase-messaging-compat.js');

// Load config injected at build/runtime
importScripts('/firebase-env.js');

const firebaseConfig = self.FIREBASE_CONFIG;
if (!firebaseConfig) {
  console.error('Firebase config not found on self.FIREBASE_CONFIG');
} else {
  try {
    firebase.initializeApp(firebaseConfig);
    const messaging = firebase.messaging();

    messaging.onBackgroundMessage((payload) => {
      console.log('[firebase-messaging-sw.js] Received background push notification: ', payload);

      const notificationTitle = payload.notification?.title || 'Treat Health';
      const notificationOptions = {
        body: payload.notification?.body,
        icon: '/vite.svg',
        data: payload.data,
      };

      return self.registration.showNotification(notificationTitle, notificationOptions);
    });
  } catch (error) {
    console.error('Firebase messaging setup failed in service worker', error);
  }
}