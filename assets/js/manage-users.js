import { auth, db } from "./firebase-config.js";
import { canManageUsers, guardAdminRoute, isSuperAdmin, sendResetEmail } from "./auth.js";
import { signOut } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import { collection, doc, getDocs, query, setDoc, updateDoc } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

const authInfo = await guardAdminRoute({ allowRoles: ["admin", "super admin"] });
const guardMessage = document.getElementById("guardMessage");
const label = document.getElementById("adminUserLabel");
const body = document.getElementById("usersTableBody");

if (!authInfo || !canManageUsers(authInfo.role)) {
  guardMessage?.classList.remove("d-none");
  if (guardMessage) guardMessage.textContent = "Unauthorized access.";
} else {
  label.textContent = `${authInfo.profile.displayName || authInfo.user.email} (${authInfo.role})`;
  await loadUsers();
}

document.getElementById("logoutBtn")?.addEventListener("click", async () => { await signOut(auth); window.location.href = "/admin/login.html"; });

async function loadUsers() {
  const snap = await getDocs(query(collection(db, "users")));
  body.innerHTML = snap.docs.map((d) => {
    const u = d.data();
    const roleOptions = isSuperAdmin(authInfo.role)
      ? ["publisher", "admin", "super admin", "editor"]
      : ["publisher", "admin", "editor"];
    const canEditRole = isSuperAdmin(authInfo.role) || u.role !== "super admin";
    const disableRole = canEditRole ? "" : "disabled";
    return `<tr data-uid="${d.id}">
      <td><input class="form-control form-control-sm" data-field="displayName" value="${u.displayName || ""}"/></td>
      <td><input class="form-control form-control-sm" data-field="email" value="${u.email || ""}"/></td>
      <td><input class="form-control form-control-sm" data-field="cellphone" value="${u.cellphone || ""}"/></td>
      <td><select class="form-select form-select-sm" data-field="role" ${disableRole}>${roleOptions.map((r)=>`<option ${u.role===r?"selected":""}>${r}</option>`).join("")}</select></td>
      <td><select class="form-select form-select-sm" data-field="disabled" ${disableRole}><option value="false" ${u.disabled?"":"selected"}>Active</option><option value="true" ${u.disabled?"selected":""}>Disabled</option></select></td>
      <td class="d-flex gap-1"><button class="btn btn-sm btn-primary" data-action="save">Save</button><button class="btn btn-sm btn-outline-secondary" data-action="reset">Reset</button></td>
    </tr>`;
  }).join("");
}

body?.addEventListener("click", async (e) => {
  const btn = e.target.closest("button[data-action]");
  if (!btn) return;
  const row = btn.closest("tr[data-uid]");
  const uid = row.dataset.uid;

  if (btn.dataset.action === "save") {
    const payload = Object.fromEntries([...row.querySelectorAll("[data-field]")].map((el) => [el.dataset.field, el.value]));
    if (!isSuperAdmin(authInfo.role) && payload.role === "super admin") {
      alert("Role escalation blocked.");
      return;
    }
    await setDoc(doc(db, "users", uid), {
      displayName: payload.displayName,
      email: payload.email,
      cellphone: payload.cellphone,
      role: payload.role,
      disabled: payload.disabled === "true",
      updatedAt: new Date().toISOString()
    }, { merge: true });
    alert("User saved.");
  }

  if (btn.dataset.action === "reset") {
    const email = row.querySelector('[data-field="email"]').value.trim();
    await sendResetEmail(email);
    alert("Password reset sent.");
  }
});
