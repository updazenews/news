import { auth } from "./firebase-config.js";
import { canManageUsers, guardAdminRoute, isSuperAdmin, logAdminEvent } from "./auth.js";
import { signOut } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";

const API_BASE = "https://api.openligadb.de";

const guardMessage = document.getElementById("guardMessage");
const statusText = document.getElementById("footballStatus");
const competitionCards = document.getElementById("competitionCards");
const fixturesBody = document.getElementById("uclFixturesBody");
const resultsBody = document.getElementById("uclResultsBody");
const adminUserLabel = document.getElementById("adminUserLabel");
const manageUsersLink = document.getElementById("manageUsersLink");
const adminLogsLink = document.getElementById("adminLogsLink");
const footballDemoLink = document.getElementById("footballDemoLink");

const fallbackMatches = [
  { matchDateTimeUTC: new Date(Date.now() + 86400000).toISOString(), team1: { teamName: "Real Madrid" }, team2: { teamName: "Manchester City" }, matchIsFinished: false, group: { groupOrderID: 1, groupName: "Matchday 1" }, matchResults: [] },
  { matchDateTimeUTC: new Date(Date.now() + 172800000).toISOString(), team1: { teamName: "Bayern Munich" }, team2: { teamName: "Inter" }, matchIsFinished: false, group: { groupOrderID: 1, groupName: "Matchday 1" }, matchResults: [] },
  { matchDateTimeUTC: new Date(Date.now() - 86400000).toISOString(), team1: { teamName: "PSG" }, team2: { teamName: "Arsenal" }, matchIsFinished: true, group: { groupOrderID: 6, groupName: "Matchday 6" }, matchResults: [{ resultTypeID: 2, pointsTeam1: 2, pointsTeam2: 1 }] },
  { matchDateTimeUTC: new Date(Date.now() - 172800000).toISOString(), team1: { teamName: "Barcelona" }, team2: { teamName: "Dortmund" }, matchIsFinished: true, group: { groupOrderID: 6, groupName: "Matchday 6" }, matchResults: [{ resultTypeID: 2, pointsTeam1: 3, pointsTeam2: 2 }] }
];

function escapeHtml(value = "") {
  const map = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;" };
  return String(value).replace(/[&<>"']/g, (char) => map[char]);
}

async function fetchOpenLiga(path) {
  const response = await fetch(`${API_BASE}${path}`, { method: "GET", mode: "cors" });
  if (!response.ok) throw new Error(`OpenLigaDB HTTP ${response.status} for ${path}`);
  return response.json();
}

async function firstSuccessful(candidates = []) {
  let lastError = "No candidate endpoint available";
  for (const candidate of candidates) {
    try {
      const data = await fetchOpenLiga(candidate.path);
      if (Array.isArray(data) && data.length) return { data, candidate };
      if (Array.isArray(data) && !data.length) {
        lastError = `${candidate.path}: empty result`;
        continue;
      }
      return { data, candidate };
    } catch (error) {
      lastError = `${candidate.path}: ${error.message}`;
    }
  }
  throw new Error(lastError);
}

function formatDate(iso) {
  if (!iso) return "-";
  return new Date(iso).toLocaleString();
}

function competitionCard({ title, sourcePath, count, note }) {
  return `
    <div class="col-12 col-md-6">
      <article class="border rounded p-3 h-100">
        <h4 class="h6 mb-1">${escapeHtml(title)}</h4>
        <p class="small mb-1 text-muted">Source: OpenLigaDB</p>
        <p class="small mb-1 text-muted">Endpoint: <code>${escapeHtml(sourcePath || "demo fallback")}</code></p>
        <p class="small mb-0 text-muted">Items: ${escapeHtml(String(count ?? 0))}${note ? ` • ${escapeHtml(note)}` : ""}</p>
      </article>
    </div>
  `;
}

function renderCompetitions(info) {
  competitionCards.innerHTML = [
    competitionCard({
      title: "FIFA World Cup",
      sourcePath: info?.wcPath,
      count: info?.wcCount ?? 0,
      note: info?.wcFallback ? "Demo fallback" : "Live"
    }),
    competitionCard({
      title: "UEFA Champions League",
      sourcePath: info?.clPath,
      count: info?.clCount ?? 0,
      note: info?.clFallback ? "Demo fallback" : "Live"
    })
  ].join("");
}

function matchStatus(match) {
  return match?.matchIsFinished ? "FINISHED" : "SCHEDULED";
}

function matchday(match) {
  return match?.group?.groupOrderID || match?.group?.groupName || "-";
}

function extractScore(match) {
  const results = Array.isArray(match?.matchResults) ? match.matchResults : [];
  const fullTime = results.find((r) => Number(r.resultTypeID) === 2) || results[results.length - 1];
  if (!fullTime) return "- - -";
  return `${fullTime.pointsTeam1 ?? "-"} - ${fullTime.pointsTeam2 ?? "-"}`;
}

function renderFixtures(matches = []) {
  const upcoming = matches.filter((m) => !m.matchIsFinished).slice(0, 10);
  if (!upcoming.length) {
    fixturesBody.innerHTML = '<tr><td colspan="5" class="text-muted">No upcoming fixtures found.</td></tr>';
    return;
  }

  fixturesBody.innerHTML = upcoming.map((m) => `
    <tr>
      <td>${escapeHtml(formatDate(m.matchDateTimeUTC || m.matchDateTime))}</td>
      <td>${escapeHtml(m.team1?.teamName || "-")}</td>
      <td>${escapeHtml(m.team2?.teamName || "-")}</td>
      <td>${escapeHtml(matchStatus(m))}</td>
      <td>${escapeHtml(String(matchday(m)))}</td>
    </tr>
  `).join("");
}

function renderResults(matches = []) {
  const played = matches.filter((m) => m.matchIsFinished).slice(0, 10);
  if (!played.length) {
    resultsBody.innerHTML = '<tr><td colspan="5" class="text-muted">No recent match data found.</td></tr>';
    return;
  }

  resultsBody.innerHTML = played.map((m) => `
    <tr>
      <td>${escapeHtml(formatDate(m.matchDateTimeUTC || m.matchDateTime))}</td>
      <td>${escapeHtml(m.team1?.teamName || "-")}</td>
      <td>${escapeHtml(m.team2?.teamName || "-")}</td>
      <td>${escapeHtml(extractScore(m))}</td>
      <td>${escapeHtml(matchStatus(m))}</td>
    </tr>
  `).join("");
}

async function loadFootballDemo(authInfo) {
  statusText.textContent = "Loading FIFA World Cup and UEFA Champions League data from OpenLigaDB...";

  try {
    const year = new Date().getFullYear();

    const wcCandidates = [
      { path: `/getmatchdata/wm/${year}` },
      { path: "/getmatchdata/wm" },
      { path: "/getmatchdata/fifa-wm" },
      { path: "/getmatchdata" }
    ];

    const clCandidates = [
      { path: `/getmatchdata/championsleague/${year}` },
      { path: "/getmatchdata/championsleague" },
      { path: "/getmatchdata/uefa-champions-league" },
      { path: "/getmatchdata" }
    ];

    const [wcResolved, clResolved] = await Promise.all([
      firstSuccessful(wcCandidates),
      firstSuccessful(clCandidates)
    ]);

    const wcMatches = Array.isArray(wcResolved.data) ? wcResolved.data : [];
    const clMatches = Array.isArray(clResolved.data) ? clResolved.data : [];

    renderCompetitions({ wcPath: wcResolved.candidate.path, clPath: clResolved.candidate.path, wcCount: wcMatches.length, clCount: clMatches.length, wcFallback: false, clFallback: false });
    renderFixtures(clMatches);
    renderResults(clMatches);

    statusText.textContent = `Loaded OpenLigaDB data (WC: ${wcMatches.length}, UCL: ${clMatches.length}).`;

    await logAdminEvent({
      eventType: "football_demo_viewed",
      status: "success",
      email: authInfo.user.email || "",
      uid: authInfo.user.uid,
      role: authInfo.role,
      details: "Viewed football demo using OpenLigaDB"
    });
  } catch (error) {
    renderCompetitions({ wcPath: "demo fallback", clPath: "demo fallback", wcCount: fallbackMatches.length, clCount: fallbackMatches.length, wcFallback: true, clFallback: true });
    renderFixtures(fallbackMatches);
    renderResults(fallbackMatches);
    statusText.textContent = `OpenLigaDB live fetch failed (${error.message}). Showing demo fallback match data.`;
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
