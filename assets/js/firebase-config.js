import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "YOUR_FIREBASE_API_KEY",
  authDomain: "YOUR_FIREBASE_PROJECT.firebaseapp.com",
  projectId: "YOUR_FIREBASE_PROJECT",
  storageBucket: "YOUR_FIREBASE_PROJECT.appspot.com",
  messagingSenderId: "YOUR_FIREBASE_SENDER_ID",
  appId: "YOUR_FIREBASE_APP_ID"
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
