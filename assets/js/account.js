import { auth, db } from "./firebase-config.js";
import { canManageUsers, guardAdminRoute, isSuperAdmin, logAdminEvent } from "./auth.js";
import { signOut } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import { doc, updateDoc } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

const authInfo = await guardAdminRoute();
const guardMessage = document.getElementById("guardMessage");
const label = document.getElementById("adminUserLabel");
const manageUsersLink = document.getElementById("manageUsersLink");
const adminLogsLink = document.getElementById("adminLogsLink");
const footballDemoLink = document.getElementById("footballDemoLink");
const form = document.getElementById("accountForm");
const msg = document.getElementById("accountMessage");
const saveProfileBtn = document.getElementById("saveProfileBtn");

if (!authInfo) {
  guardMessage?.classList.remove("d-none");
  if (guardMessage) guardMessage.textContent = "Unauthorized access.";
} else {
  label.textContent = `${authInfo.profile.displayName || authInfo.user.email} (${authInfo.role})`;
  if (canManageUsers(authInfo.role)) manageUsersLink?.classList.remove("d-none");
  if (isSuperAdmin(authInfo.role)) adminLogsLink?.classList.remove("d-none");
  if (isSuperAdmin(authInfo.role)) footballDemoLink?.classList.remove("d-none");
  document.getElementById("displayName").value = authInfo.profile.displayName || "";
  document.getElementById("cellphone").value = authInfo.profile.cellphone || "";
}

document.getElementById("logoutBtn")?.addEventListener("click", async () => {
  await signOut(auth);
  window.location.href = "/admin/login.html";
});

form?.addEventListener("submit", async (e) => {
  e.preventDefault();
  if (!authInfo) return;

  const displayName = document.getElementById("displayName").value.trim();
  const cellphone = document.getElementById("cellphone").value.trim();

  if (!displayName) {
    msg.className = "small mt-3 mb-0 text-danger";
    msg.textContent = "Name is required.";
    return;
  }

  try {
    saveProfileBtn.disabled = true;
    msg.className = "small mt-3 mb-0 text-muted";
    msg.textContent = "Saving profile...";

    await updateDoc(doc(db, "users", authInfo.user.uid), {
      displayName,
      cellphone,
      updatedAt: new Date().toISOString()
    });

    await logAdminEvent({ eventType: "profile_updated", email: authInfo.user.email || "", uid: authInfo.user.uid, role: authInfo.role, details: "Updated own profile" });

    msg.className = "small mt-3 mb-0 text-success";
    msg.textContent = "Profile updated successfully.";
    label.textContent = `${displayName || authInfo.user.email} (${authInfo.role})`;
  } catch (error) {
    msg.className = "small mt-3 mb-0 text-danger";
    msg.textContent = `Unable to save profile: ${error.message}`;
  } finally {
    saveProfileBtn.disabled = false;
  }
});
