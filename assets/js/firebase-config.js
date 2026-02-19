import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "AIzaSyCZSyty8XgrkBycReUHXzZZJgvajJMatJQ",
  authDomain: "updaze-jobs.firebaseapp.com",
  projectId: "updaze-jobs",
  storageBucket: "updaze-jobs.firebasestorage.app",
  messagingSenderId: "208744900105",
  appId: "1:208744900105:web:84456f914b2ae57ee7fad8",
  measurementId: "G-WM1KXZD6DL"
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
