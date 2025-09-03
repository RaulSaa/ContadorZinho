// Scripts for firebase and firebase messaging
importScripts('[https://www.gstatic.com/firebasejs/8.10.0/firebase-app.js](https://www.gstatic.com/firebasejs/8.10.0/firebase-app.js)');
importScripts('[https://www.gstatic.com/firebasejs/8.10.0/firebase-messaging.js](https://www.gstatic.com/firebasejs/8.10.0/firebase-messaging.js)');

// Initialize the Firebase app in the service worker by passing in the messagingSenderId.
firebase.initializeApp({
    apiKey: "AIzaSyBv0WRGvYlmBotnBc2InD85N1teQf45V2g",
    authDomain: "casinha-kr.firebaseapp.com",
    projectId: "casinha-kr",
    storageBucket: "casinha-kr.firebasestorage.app",
    messagingSenderId: "311939192764",
    appId: "1:311939192764:web:6a14910e5c35c4391a3db9",
    measurementId: "G-EDMYBHR1TY"
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
