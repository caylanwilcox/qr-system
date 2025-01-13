// src/components/utils/firebase-admin.js
import admin from 'firebase-admin';

export async function initAdmin() {
    if (admin.apps.length) return admin;

    try {
        admin.initializeApp({
            credential: admin.credential.cert({
                projectId: "qr-system-1cea7",
                clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
                privateKey: process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n'),
            }),
            databaseURL: "https://qr-system-1cea7-default-rtdb.firebaseio.com"
        });

        return admin;
    } catch (error) {
        console.error('Firebase Admin initialization error:', error);
        throw error;
    }
}