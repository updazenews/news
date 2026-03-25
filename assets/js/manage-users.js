import { auth, db } from "./firebase-config.js";
import { canManageUsers, guardAdminRoute, isSuperAdmin, logAdminEvent, sendResetEmail } from "./auth.js";
import { signOut } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import { collection, doc, getDocs, query, setDoc } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

const FIREBASE_WEB_API_KEY = "AIzaSyDiRXSGIXw8lbbxx_jZk0VOyCzmt0rasLQ";

const authInfo = await guardAdminRoute({ allowRoles: ["admin", "super admin"] });
const guardMessage = document.getElementById("guardMessage");
const label = document.getElementById("adminUserLabel");
const body = document.getElementById("usersTableBody");
const refreshUsersBtn = document.getElementById("refreshUsersBtn");
const addUserForm = document.getElementById("addUserForm");
const addUserMessage = document.getElementById("addUserMessage");
const addUserBtn = document.getElementById("addUserBtn");
const newUserRole = document.getElementById("newUserRole");
const adminLogsLink = document.getElementById("adminLogsLink");
const footballDemoLink = document.getElementById("footballDemoLink");

if (!authInfo || !canManageUsers(authInfo.role)) {
  guardMessage?.classList.remove("d-none");
  if (guardMessage) guardMessage.textContent = "Unauthorized access.";
} else {
  label.textContent = `${authInfo.profile.displayName || authInfo.user.email} (${authInfo.role})`;
  if (isSuperAdmin(authInfo.role)) adminLogsLink?.classList.remove("d-none");
  if (isSuperAdmin(authInfo.role)) footballDemoLink?.classList.remove("d-none");
  if (!isSuperAdmin(authInfo.role)) {
    const superAdminOption = [...newUserRole.options].find((option) => option.value === "super admin");
    superAdminOption?.remove();
  }
  await loadUsers();
}

document.getElementById("logoutBtn")?.addEventListener("click", async () => {
  await signOut(auth);
  window.location.href = "/admin/login.html";
});
refreshUsersBtn?.addEventListener("click", () => loadUsers());

async function loadUsers() {
  const snap = await getDocs(query(collection(db, "users")));
  body.innerHTML = snap.docs
    .map((d) => {
      const u = d.data();
      const roleOptions = isSuperAdmin(authInfo.role)
        ? ["publisher", "editor", "admin", "super admin"]
        : ["publisher", "editor", "admin"];
      const isTargetSuperAdmin = u.role === "super admin";
      const canEditRole = isSuperAdmin(authInfo.role) || !isTargetSuperAdmin;
      const disableFields = canEditRole ? "" : "disabled";

      return `<tr data-uid="${d.id}" data-target-super-admin="${isTargetSuperAdmin}">
      <td><input class="form-control form-control-sm" data-field="displayName" value="${escapeAttr(u.displayName || "")}"/></td>
      <td><input class="form-control form-control-sm" data-field="email" value="${escapeAttr(u.email || "")}"/></td>
      <td><input class="form-control form-control-sm" data-field="cellphone" value="${escapeAttr(u.cellphone || "")}"/></td>
      <td><select class="form-select form-select-sm" data-field="role" ${disableFields}>${roleOptions
        .map((r) => `<option value="${r}" ${u.role === r ? "selected" : ""}>${r}</option>`)
        .join("")}</select></td>
      <td><select class="form-select form-select-sm" data-field="disabled" ${disableFields}><option value="false" ${u.disabled ? "" : "selected"}>Active</option><option value="true" ${u.disabled ? "selected" : ""}>Disabled</option></select></td>
      <td class="d-flex gap-1"><button class="btn btn-sm btn-primary" data-action="save">Save</button><button class="btn btn-sm btn-outline-secondary" data-action="reset">Reset Password</button></td>
    </tr>`;
    })
    .join("");

  if (!snap.size) {
    body.innerHTML = '<tr><td colspan="6" class="text-muted">No users found.</td></tr>';
  }
}

body?.addEventListener("click", async (e) => {
  const btn = e.target.closest("button[data-action]");
  if (!btn) return;
  const row = btn.closest("tr[data-uid]");
  const uid = row.dataset.uid;
  const isTargetSuperAdmin = row.dataset.targetSuperAdmin === "true";

  if (btn.dataset.action === "save") {
    const payload = Object.fromEntries([...row.querySelectorAll("[data-field]")].map((el) => [el.dataset.field, el.value.trim()]));

    if (!isSuperAdmin(authInfo.role) && (payload.role === "super admin" || isTargetSuperAdmin)) {
      alert("You cannot change super admin accounts.");
      return;
    }

    try {
      btn.disabled = true;
      await setDoc(
        doc(db, "users", uid),
        {
          displayName: payload.displayName,
          email: payload.email,
          cellphone: payload.cellphone,
          role: payload.role,
          disabled: payload.disabled === "true",
          updatedAt: new Date().toISOString()
        },
        { merge: true }
      );
      await logAdminEvent({ eventType: "user_updated", email: authInfo.user.email || "", uid: authInfo.user.uid, role: authInfo.role, details: `Updated user ${uid}` });
      alert("User changes saved.");
    } catch (error) {
      alert(`Unable to save user: ${error.message}`);
    } finally {
      btn.disabled = false;
    }
  }

  if (btn.dataset.action === "reset") {
    const email = row.querySelector('[data-field="email"]').value.trim();
    if (!email) {
      alert("User email is required to send reset link.");
      return;
    }

    try {
      btn.disabled = true;
      await sendResetEmail(email);
      await logAdminEvent({ eventType: "user_password_reset", email: authInfo.user.email || "", uid: authInfo.user.uid, role: authInfo.role, details: `Sent password reset to ${email}` });
      alert("Password reset email sent.");
    } catch (error) {
      alert(`Reset failed: ${error.message}`);
    } finally {
      btn.disabled = false;
    }
  }
});

addUserForm?.addEventListener("submit", async (event) => {
  event.preventDefault();
  if (!authInfo) return;

  const displayName = document.getElementById("newUserName").value.trim();
  const email = document.getElementById("newUserEmail").value.trim();
  const cellphone = document.getElementById("newUserCellphone").value.trim();
  const role = document.getElementById("newUserRole").value;
  const password = document.getElementById("newUserPassword").value;

  if (!displayName || !email || !password) {
    addUserMessage.className = "small text-danger";
    addUserMessage.textContent = "Name, email and temporary password are required.";
    return;
  }

  if (!isSuperAdmin(authInfo.role) && role === "super admin") {
    addUserMessage.className = "small text-danger";
    addUserMessage.textContent = "Only super admin can create super admin users.";
    return;
  }

  try {
    addUserBtn.disabled = true;
    addUserMessage.className = "small text-muted";
    addUserMessage.textContent = "Creating user...";

    const signupResponse = await fetch(`https://identitytoolkit.googleapis.com/v1/accounts:signUp?key=${FIREBASE_WEB_API_KEY}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password, returnSecureToken: true })
    });

    const signupData = await signupResponse.json();
    if (!signupResponse.ok || !signupData.localId) {
      throw new Error(signupData.error?.message || "Could not create auth user.");
    }

    await setDoc(doc(db, "users", signupData.localId), {
      displayName,
      email,
      cellphone,
      role,
      disabled: false,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    }, { merge: true });

    await logAdminEvent({ eventType: "user_added", email: authInfo.user.email || "", uid: authInfo.user.uid, role: authInfo.role, details: `Added user ${email}` });
    addUserMessage.className = "small text-success";
    addUserMessage.textContent = "User created successfully.";
    addUserForm.reset();
    if (!isSuperAdmin(authInfo.role)) document.getElementById("newUserRole").value = "publisher";
    await loadUsers();
  } catch (error) {
    addUserMessage.className = "small text-danger";
    addUserMessage.textContent = `Unable to create user: ${error.message}`;
  } finally {
    addUserBtn.disabled = false;
  }
});

function escapeAttr(value = "") {
  return value.replace(/[&<>'"]/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "\"": "&quot;", "'": "&#39;" }[char]));
}
