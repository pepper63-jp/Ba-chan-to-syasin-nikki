importScripts('https://www.gstatic.com/firebasejs/10.8.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.8.0/firebase-messaging-compat.js');

firebase.initializeApp({
    apiKey: "AIzaSyAOFOrXB5jFAy87Zuh_JgR1Lmq2N7gxc6Y",
    authDomain: "ba-tyan-to-hananikki.firebaseapp.com",
    databaseURL: "https://ba-tyan-to-hananikki-default-rtdb.firebaseio.com",
    projectId: "ba-tyan-to-hananikki",
    storageBucket: "ba-tyan-to-hananikki.firebasestorage.app",
    messagingSenderId: "245592923418",
    appId: "1:245592923418:web:be6ef7025fb667b965e0a3"
});

const messaging = firebase.messaging();

// notification付きメッセージはFCMが自動で表示するため
// ここでは何もしない（二重表示を防ぐ）
messaging.onBackgroundMessage((_payload) => {
    // 意図的に何もしない
});
