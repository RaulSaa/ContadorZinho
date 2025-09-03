// Scripts for firebase and firebase messaging
importScripts('[https://www.gstatic.com/firebasejs/8.10.0/firebase-app.js](https://www.gstatic.com/firebasejs/8.10.0/firebase-app.js)');
importScripts('[https://www.gstatic.com/firebasejs/8.10.0/firebase-messaging.js](https://www.gstatic.com/firebasejs/8.10.0/firebase-messaging.js)');

// Initialize the Firebase app in the service worker by passing in the messagingSenderId.
// Use os seus próprios valores aqui
firebase.initializeApp({
    apiKey: "COLE_AQUI_SUA_API_KEY",
    authDomain: "COLE_AQUI_SEU_AUTH_DOMAIN",
    projectId: "COLE_AQUI_SEU_PROJECT_ID",
    storageBucket: "COLE_AQUI_SEU_STORAGE_BUCKET",
    messagingSenderId: "COLE_AQUI_SEU_MESSAGING_SENDER_ID",
    appId: "COLE_AQUI_SEU_APP_ID",
    measurementId: "COLE_AQUI_SEU_MEASUREMENT_ID"
});

// Retrieve an instance of Firebase Messaging so that it can handle background messages.
const messaging = firebase.messaging();

messaging.onBackgroundMessage((payload) => {
  console.log('[firebase-messaging-sw.js] Received background message ', payload);
  const notificationTitle = payload.notification.title;
  const notificationOptions = {
    body: payload.notification.body,
    icon: '/icon-v2.svg'
  };

  self.registration.showNotification(notificationTitle, notificationOptions);
});
