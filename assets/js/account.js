import { auth, db } from "./firebase-config.js";
import { canManageUsers, guardAdminRoute } from "./auth.js";
import { signOut } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import { doc, updateDoc } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

const authInfo = await guardAdminRoute();
const guardMessage = document.getElementById("guardMessage");
const label = document.getElementById("adminUserLabel");
const manageUsersLink = document.getElementById("manageUsersLink");
const form = document.getElementById("accountForm");
const msg = document.getElementById("accountMessage");

if (!authInfo) {
  guardMessage?.classList.remove("d-none");
  guardMessage.textContent = "Unauthorized access.";
} else {
  label.textContent = `${authInfo.profile.displayName || authInfo.user.email} (${authInfo.role})`;
  if (canManageUsers(authInfo.role)) manageUsersLink?.classList.remove("d-none");
  document.getElementById("displayName").value = authInfo.profile.displayName || "";
  document.getElementById("cellphone").value = authInfo.profile.cellphone || "";
}

document.getElementById("logoutBtn")?.addEventListener("click", async () => { await signOut(auth); window.location.href = "/admin/login.html"; });

form?.addEventListener("submit", async (e) => {
  e.preventDefault();
  if (!authInfo) return;
  await updateDoc(doc(db, "users", authInfo.user.uid), {
    displayName: document.getElementById("displayName").value.trim(),
    cellphone: document.getElementById("cellphone").value.trim(),
    updatedAt: new Date().toISOString()
  });
  msg.className = "small mt-3 text-success";
  msg.textContent = "Profile updated.";
});
