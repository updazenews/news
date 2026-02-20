import { auth, db } from "./firebase-config.js";
import {
  onAuthStateChanged,
  sendPasswordResetEmail,
  signInWithEmailAndPassword,
  signOut
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import { doc, getDoc, updateDoc } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

const ALLOWED_ROLES = ["publisher", "admin", "super admin", "editor"];

export async function getUserProfile(uid) {
  const userRef = doc(db, "users", uid);
  const userSnap = await getDoc(userRef);
  return userSnap.exists() ? userSnap.data() : null;
}

export async function getUserRole(uid) {
  const profile = await getUserProfile(uid);
  return profile?.role || null;
}

export function canManageUsers(role) {
  return role === "admin" || role === "super admin";
}

export function isSuperAdmin(role) {
  return role === "super admin";
}

export async function sendResetEmail(email) {
  await sendPasswordResetEmail(auth, email);
}

export async function disableUserRecord(uid, disabled) {
  const userRef = doc(db, "users", uid);
  await updateDoc(userRef, {
    disabled: !!disabled,
    updatedAt: new Date().toISOString()
  });
}

export function guardAdminRoute({ allowRoles = ALLOWED_ROLES, redirectTo = "/admin/login.html" } = {}) {
  return new Promise((resolve) => {
    onAuthStateChanged(auth, async (user) => {
      if (!user) {
        window.location.href = redirectTo;
        resolve(null);
        return;
      }

      const profile = await getUserProfile(user.uid);
      const role = profile?.role;

      if (!profile || !allowRoles.includes(role) || profile.disabled === true) {
        await signOut(auth);
        window.location.href = redirectTo;
        resolve(null);
        return;
      }

      resolve({ user, role, profile });
    });
  });
}

const loginForm = document.getElementById("loginForm");
if (loginForm) {
  const loginMessage = document.getElementById("loginMessage");
  const forgotPasswordLink = document.getElementById("forgotPasswordLink");
  const forgotPasswordForm = document.getElementById("forgotPasswordForm");
  const forgotPasswordModalEl = document.getElementById("forgotPasswordModal");
  const resetEmailInput = document.getElementById("resetEmail");
  const forgotPasswordMessage = document.getElementById("forgotPasswordMessage");
  const forgotPasswordSubmitBtn = document.getElementById("forgotPasswordSubmitBtn");

  const forgotPasswordModal = forgotPasswordModalEl && window.bootstrap?.Modal
    ? new window.bootstrap.Modal(forgotPasswordModalEl)
    : null;

  loginForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    const email = document.getElementById("email").value.trim();
    const password = document.getElementById("password").value;

    loginMessage.textContent = "Authenticating...";
    loginMessage.className = "small mb-3 text-muted";

    try {
      const credential = await signInWithEmailAndPassword(auth, email, password);
      const profile = await getUserProfile(credential.user.uid);

      if (!profile || !ALLOWED_ROLES.includes(profile.role) || profile.disabled === true) {
        await signOut(auth);
        throw new Error("Unauthorized or disabled account.");
      }

      window.location.href = "/admin/index.html";
    } catch (error) {
      loginMessage.textContent = `Login failed: ${error.message}`;
      loginMessage.className = "small mb-3 text-danger";
    }
  });

  forgotPasswordLink?.addEventListener("click", (event) => {
    event.preventDefault();
    const loginEmail = document.getElementById("email")?.value?.trim();
    if (loginEmail && resetEmailInput) resetEmailInput.value = loginEmail;
    forgotPasswordMessage.textContent = "";
    forgotPasswordMessage.className = "small mt-2 mb-0";
    forgotPasswordModal?.show();
  });

  forgotPasswordForm?.addEventListener("submit", async (event) => {
    event.preventDefault();
    const resetEmail = resetEmailInput?.value?.trim();

    if (!resetEmail) {
      forgotPasswordMessage.className = "small mt-2 mb-0 text-danger";
      forgotPasswordMessage.textContent = "Please enter your email address.";
      return;
    }

    try {
      forgotPasswordSubmitBtn.disabled = true;
      forgotPasswordMessage.className = "small mt-2 mb-0 text-muted";
      forgotPasswordMessage.textContent = "Sending reset link...";
      await sendResetEmail(resetEmail);
      forgotPasswordMessage.className = "small mt-2 mb-0 text-success";
      forgotPasswordMessage.textContent = "Password reset link sent. Check your inbox.";
      setTimeout(() => forgotPasswordModal?.hide(), 1200);
    } catch (error) {
      forgotPasswordMessage.className = "small mt-2 mb-0 text-danger";
      forgotPasswordMessage.textContent = `Unable to send reset link: ${error.message}`;
    } finally {
      forgotPasswordSubmitBtn.disabled = false;
    }
  });
}
