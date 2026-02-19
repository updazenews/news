import { auth, db } from "./firebase-config.js";
import {
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import { doc, getDoc } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

const ALLOWED_ROLES = ["admin", "super admin", "editor"];

export async function getUserRole(uid) {
  const userRef = doc(db, "users", uid);
  const userSnap = await getDoc(userRef);
  return userSnap.exists() ? userSnap.data().role : null;
}

export function guardAdminRoute() {
  return new Promise((resolve) => {
    onAuthStateChanged(auth, async (user) => {
      if (!user) {
        window.location.href = "/admin/login.html";
        resolve(null);
        return;
      }

      const role = await getUserRole(user.uid);
      if (!ALLOWED_ROLES.includes(role)) {
        await signOut(auth);
        window.location.href = "/admin/login.html";
        resolve(null);
        return;
      }

      resolve({ user, role });
    });
  });
}

const loginForm = document.getElementById("loginForm");
if (loginForm) {
  const loginMessage = document.getElementById("loginMessage");

  loginForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    const email = document.getElementById("email").value.trim();
    const password = document.getElementById("password").value;

    loginMessage.textContent = "Authenticating...";
    loginMessage.className = "small mb-3 text-muted";

    try {
      const credential = await signInWithEmailAndPassword(auth, email, password);
      const role = await getUserRole(credential.user.uid);

      if (!ALLOWED_ROLES.includes(role)) {
        await signOut(auth);
        throw new Error("Unauthorized role.");
      }

      window.location.href = "/admin/index.html";
    } catch (error) {
      loginMessage.textContent = `Login failed: ${error.message}`;
      loginMessage.className = "small mb-3 text-danger";
    }
  });
}
