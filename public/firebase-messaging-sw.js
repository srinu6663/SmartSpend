// Firebase Cloud Messaging Service Worker
// This file must be in the /public directory

importScripts("https://www.gstatic.com/firebasejs/10.7.1/firebase-app-compat.js");
importScripts("https://www.gstatic.com/firebasejs/10.7.1/firebase-messaging-compat.js");

firebase.initializeApp({
  apiKey: "AIzaSyBpnfo7BsxYpTbvyacu_PF5fixO1yECG9I",
  authDomain: "smartspend-f2809.firebaseapp.com",
  projectId: "smartspend-f2809",
  storageBucket: "smartspend-f2809.firebasestorage.app",
  messagingSenderId: "841830598341",
  appId: "1:841830598341:web:e3884b9638744ed7b912ac",
});

const messaging = firebase.messaging();

// Handle background messages
messaging.onBackgroundMessage((payload) => {
  console.log("[Finly SW] Background message:", payload);

  const { title, body, icon } = payload.notification || {};

  self.registration.showNotification(title || "Finly", {
    body: body || "You have a new notification",
    icon: icon || "/icons/icon-192.png",
    badge: "/icons/icon-192.png",
    vibrate: [100, 50, 100],
    data: payload.data,
    actions: [
      { action: "open", title: "Open App" },
      { action: "dismiss", title: "Dismiss" },
    ],
  });
});

// Handle notification click
self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  if (event.action === "open" || !event.action) {
    event.waitUntil(clients.openWindow("/"));
  }
});
