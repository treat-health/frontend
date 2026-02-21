importScripts('https://www.gstatic.com/firebasejs/10.12.2/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.12.2/firebase-messaging-compat.js');

// Initialize the Firebase app in the service worker with the Treat-MH-Dev config
const firebaseConfig = {
    apiKey: "AIzaSyCHex8_Bb5oLdlF3jp31m0rfI7g2VSxCBs",
    authDomain: "treat-mh-dev.firebaseapp.com",
    projectId: "treat-mh-dev",
    storageBucket: "treat-mh-dev.firebasestorage.app",
    messagingSenderId: "766092981097",
    appId: "1:766092981097:web:dd52f1cf4ae733d24f43f8"
};

try {
    firebase.initializeApp(firebaseConfig);
    const messaging = firebase.messaging();

    messaging.onBackgroundMessage((payload) => {
        console.log('[firebase-messaging-sw.js] Received background push notification: ', payload);

        // Customize the notification here
        const notificationTitle = payload.notification?.title || 'Treat Health';
        const notificationOptions = {
            body: payload.notification?.body,
            icon: '/vite.svg', // Will show the react/vite icon for now
            data: payload.data,
        };

        return self.registration.showNotification(notificationTitle, notificationOptions);
    });
} catch (error) {
    console.error('Firebase messaging setup failed in service worker', error);
}
