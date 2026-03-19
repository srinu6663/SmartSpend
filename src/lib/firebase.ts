import { initializeApp, getApps } from "firebase/app";
import { getMessaging, getToken, onMessage } from "firebase/messaging";

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
  measurementId: import.meta.env.VITE_FIREBASE_MEASUREMENT_ID,
};

// Avoid re-initializing on hot reload
const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApps()[0];

export const messaging = typeof window !== "undefined" ? getMessaging(app) : null;

export const requestFCMToken = async (): Promise<string | null> => {
  try {
    if (!messaging) return null;

    const registration = await navigator.serviceWorker.register("/firebase-messaging-sw.js");

    const token = await getToken(messaging, {
      vapidKey: import.meta.env.VITE_FIREBASE_VAPID_KEY,
      serviceWorkerRegistration: registration,
    });

    return token || null;
  } catch (err) {
    console.warn("FCM token request failed:", err);
    return null;
  }
};

export const onForegroundMessage = (callback: (payload: any) => void) => {
  if (!messaging) return () => {};
  return onMessage(messaging, callback);
};
