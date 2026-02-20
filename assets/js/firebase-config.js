import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "AIzaSyDiRXSGIXw8lbbxx_jZk0VOyCzmt0rasLQ",
  authDomain: "updaze-news.firebaseapp.com",
  projectId: "updaze-news",
  storageBucket: "updaze-news.firebasestorage.app",
  messagingSenderId: "360342332196",
  appId: "1:360342332196:web:732d9972e8d7f69a1209b1",
  measurementId: "G-PHWVGJ3Q72"
};

const app = initializeApp(firebaseConfig);

export const auth = getAuth(app);
export const db = getFirestore(app);

/**
 * Firestore structure:
 *
 * collection: articles
 *  documentId: slug (string)
 *  fields:
 *    - title: string
 *    - slug: string
 *    - excerpt: string
 *    - content: string
 *    - category: string
 *    - author: string
 *    - imageUrl: string
 *    - imageCaption: string
 *    - publishedAt: timestamp
 *    - updatedAt: timestamp
 *    - status: "published"
 *
 * collection: users
 *  documentId: uid
 *  fields:
 *    - role: "admin" | "super admin" | "editor"
 *    - displayName: string
 */
