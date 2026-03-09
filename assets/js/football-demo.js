import { auth } from "./firebase-config.js";
import { canManageUsers, guardAdminRoute, isSuperAdmin, logAdminEvent } from "./auth.js";
import { signOut } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";

const FOOTBALL_DATA_TOKEN = "fbf603093fd941cd80dabc3e285b3151";
const API_BASE = "https://api.football-data.org/v4";

const guardMessage = document.getElementById("guardMessage");
const statusText = document.getElementById("footballStatus");
const competitionCards = document.getElementById("competitionCards");
const fixturesBody = document.getElementById("uclFixturesBody");
const resultsBody = document.getElementById("uclResultsBody");
const adminUserLabel = document.getElementById("adminUserLabel");
const manageUsersLink = document.getElementById("manageUsersLink");
const adminLogsLink = document.getElementById("adminLogsLink");
const footballDemoLink = document.getElementById("footballDemoLink");

function escapeHtml(value = "") {
  const map = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;" };
  return String(value).replace(/[&<>"']/g, (char) => map[char]);
}

async function fetchFootball(path) {
  const response = await fetch(`${API_BASE}${path}`, {
    headers: { "X-Auth-Token": FOOTBALL_DATA_TOKEN }
  });
  if (!response.ok) throw new Error(`Football API failed (${response.status})`);
  return response.json();
}

function formatDate(iso) {
  if (!iso) return "-";
  return new Date(iso).toLocaleString();
}

function renderCompetitions(wcData, clData) {
  const items = [wcData?.competition, clData?.competition].filter(Boolean);
  if (!items.length) {
    competitionCards.innerHTML = '<div class="col-12 text-muted">No competition data available.</div>';
    return;
  }

  competitionCards.innerHTML = items.map((comp) => `
    <div class="col-12 col-md-6">
      <article class="border rounded p-3 h-100">
        <h4 class="h6 mb-1">${escapeHtml(comp.name || "Competition")}</h4>
        <p class="small mb-1 text-muted">Code: ${escapeHtml(comp.code || "-")}</p>
        <p class="small mb-0 text-muted">Type: ${escapeHtml(comp.type || "-")} • Plan: ${escapeHtml(comp.plan || "-")}</p>
      </article>
    </div>
  `).join("");
}

function renderFixtures(matches = []) {
  const upcoming = matches.filter((m) => m.status === "SCHEDULED" || m.status === "TIMED").slice(0, 10);
  if (!upcoming.length) {
    fixturesBody.innerHTML = '<tr><td colspan="5" class="text-muted">No upcoming fixtures found.</td></tr>';
    return;
  }

  fixturesBody.innerHTML = upcoming.map((m) => `
    <tr>
      <td>${escapeHtml(formatDate(m.utcDate))}</td>
      <td>${escapeHtml(m.homeTeam?.name || "-")}</td>
      <td>${escapeHtml(m.awayTeam?.name || "-")}</td>
      <td>${escapeHtml(m.status || "-")}</td>
      <td>${escapeHtml(m.matchday ?? "-")}</td>
    </tr>
  `).join("");
}

function renderResults(matches = []) {
  const played = matches.filter((m) => m.status === "FINISHED").slice(0, 10);
  if (!played.length) {
    resultsBody.innerHTML = '<tr><td colspan="5" class="text-muted">No recent match data found.</td></tr>';
    return;
  }

  resultsBody.innerHTML = played.map((m) => {
    const home = m.score?.fullTime?.home ?? "-";
    const away = m.score?.fullTime?.away ?? "-";
    return `
      <tr>
        <td>${escapeHtml(formatDate(m.utcDate))}</td>
        <td>${escapeHtml(m.homeTeam?.name || "-")}</td>
        <td>${escapeHtml(m.awayTeam?.name || "-")}</td>
        <td>${escapeHtml(`${home} - ${away}`)}</td>
        <td>${escapeHtml(m.status || "-")}</td>
      </tr>
    `;
  }).join("");
}

async function loadFootballDemo(authInfo) {
  statusText.textContent = "Loading FIFA World Cup and UEFA Champions League data...";

  try {
    const [wcData, clData, clMatchesData] = await Promise.all([
      fetchFootball("/competitions/WC"),
      fetchFootball("/competitions/CL"),
      fetchFootball("/competitions/CL/matches")
    ]);

    renderCompetitions(wcData, clData);
    const matches = Array.isArray(clMatchesData?.matches) ? clMatchesData.matches : [];
    renderFixtures(matches);
    renderResults(matches);

    statusText.textContent = `Loaded ${matches.length} Champions League matches.`;

    await logAdminEvent({
      eventType: "football_demo_viewed",
      status: "success",
      email: authInfo.user.email || "",
      uid: authInfo.user.uid,
      role: authInfo.role,
      details: "Viewed football demo with FIFA World Cup and UCL data"
    });
  } catch (error) {
    statusText.textContent = `Unable to load football data: ${error.message}`;
    fixturesBody.innerHTML = '<tr><td colspan="5" class="text-danger">Failed to load fixtures.</td></tr>';
    resultsBody.innerHTML = '<tr><td colspan="5" class="text-danger">Failed to load match data.</td></tr>';
  }
}

const authInfo = await guardAdminRoute({ allowRoles: ["super admin"] });
if (!authInfo || !isSuperAdmin(authInfo.role)) {
  guardMessage?.classList.remove("d-none");
  if (guardMessage) guardMessage.textContent = "Only super admin can access Football Demo.";
} else {
  adminUserLabel.textContent = `${authInfo.profile.displayName || authInfo.user.email} (${authInfo.role})`;
  if (canManageUsers(authInfo.role)) manageUsersLink?.classList.remove("d-none");
  adminLogsLink?.classList.remove("d-none");
  footballDemoLink?.classList.remove("d-none");
  await loadFootballDemo(authInfo);

  document.getElementById("reloadFootballBtn")?.addEventListener("click", () => loadFootballDemo(authInfo));
}

document.getElementById("logoutBtn")?.addEventListener("click", async () => {
  await signOut(auth);
  window.location.href = "/admin/login.html";
});
