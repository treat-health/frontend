import { initializeApp } from 'firebase/app';
import { getMessaging, getToken, onMessage, isSupported } from 'firebase/messaging';

const firebaseConfig = {
    apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
    authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
    projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
    storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
    messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
    appId: import.meta.env.VITE_FIREBASE_APP_ID,
    measurementId: import.meta.env.VITE_FIREBASE_MEASUREMENT_ID,
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);

// Keep a reference to messaging, initialize asymptotically to avoid crashes on unsupported browsers
let messaging: ReturnType<typeof getMessaging> | null = null;

// Initialize Firebase Cloud Messaging and get a reference to the service
isSupported().then((supported) => {
    if (supported) {
        messaging = getMessaging(app);
    } else {
        console.warn('Firebase Messaging is not supported in this browser environment.');
    }
});

export const VAPID_KEY = import.meta.env.VITE_FIREBASE_VAPID_KEY as string;
export { app, messaging, getToken, onMessage };
