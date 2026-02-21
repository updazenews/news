import { auth, db } from "./firebase-config.js";
import { canManageUsers, guardAdminRoute, isSuperAdmin, logAdminEvent } from "./auth.js";
import { signOut } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import { collection, getDocs, limit, orderBy, query } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

const authInfo = await guardAdminRoute({ allowRoles: ["super admin"] });
const guardMessage = document.getElementById("guardMessage");
const adminUserLabel = document.getElementById("adminUserLabel");
const manageUsersLink = document.getElementById("manageUsersLink");
const adminLogsLink = document.getElementById("adminLogsLink");
const adminLogsBody = document.getElementById("adminLogsBody");
const adminLogsStatus = document.getElementById("adminLogsStatus");

if (!authInfo || !isSuperAdmin(authInfo.role)) {
  guardMessage?.classList.remove("d-none");
  if (guardMessage) guardMessage.textContent = "Only super admin can access logs.";
} else {
  adminUserLabel.textContent = `${authInfo.profile.displayName || authInfo.user.email} (${authInfo.role})`;
  if (canManageUsers(authInfo.role)) manageUsersLink?.classList.remove("d-none");
  adminLogsLink?.classList.remove("d-none");
  await loadLogs();
  await logAdminEvent({
    eventType: "super_admin_logs_view",
    status: "success",
    email: authInfo.user.email || "",
    uid: authInfo.user.uid,
    role: authInfo.role,
    details: "Viewed system logs page"
  });
}

document.getElementById("logoutBtn")?.addEventListener("click", async () => {
  await signOut(auth);
  window.location.href = "/admin/login.html";
});

async function loadLogs() {
  adminLogsStatus.textContent = "Loading logs...";
  try {
    const snap = await getDocs(query(collection(db, "admin_logs"), orderBy("createdAt", "desc"), limit(200)));
    if (snap.empty) {
      adminLogsBody.innerHTML = '<tr><td colspan="5" class="text-muted">No logs found.</td></tr>';
      adminLogsStatus.textContent = "No log entries yet.";
      return;
    }

    adminLogsBody.innerHTML = snap.docs.map((entry) => {
      const log = entry.data();
      const when = log.createdAt?.toDate ? log.createdAt.toDate().toLocaleString() : (log.timestamp || "-");
      return `<tr><td>${escapeHtml(log.eventType || "-")}</td><td>${escapeHtml(log.status || "-")}</td><td>${escapeHtml(log.email || "-")}</td><td>${escapeHtml(log.details || "-")}</td><td>${escapeHtml(when)}</td></tr>`;
    }).join("");

    adminLogsStatus.textContent = `Showing ${snap.size} latest log entries.`;
  } catch (error) {
    adminLogsBody.innerHTML = '<tr><td colspan="5" class="text-danger">Unable to load logs.</td></tr>';
    adminLogsStatus.textContent = `Error: ${error.message}`;
  }
}

function escapeHtml(value = "") {
  const map = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;" };
  return value.replace(/[&<>"']/g, (char) => map[char]);
}
