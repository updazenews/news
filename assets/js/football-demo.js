import { auth } from "./firebase-config.js";
import { canManageUsers, guardAdminRoute, isSuperAdmin, logAdminEvent } from "./auth.js";
import { signOut } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";

const API_BASE = "https://www.thesportsdb.com/api/v1/json/3";
const PSL_NAME = "South African Premier Soccer League";
const PSL_LEAGUE_ID = "4802";

const guardMessage = document.getElementById("guardMessage");
const statusText = document.getElementById("footballStatus");
const teamsGrid = document.getElementById("pslTeamsGrid");
const standingsBody = document.getElementById("pslStandingsBody");
const eventsList = document.getElementById("pslEventsList");
const adminUserLabel = document.getElementById("adminUserLabel");
const manageUsersLink = document.getElementById("manageUsersLink");
const adminLogsLink = document.getElementById("adminLogsLink");
const footballDemoLink = document.getElementById("footballDemoLink");

const fallbackTeams = [
  { strTeam: "Mamelodi Sundowns", strBadge: "" },
  { strTeam: "Orlando Pirates", strBadge: "" },
  { strTeam: "Kaizer Chiefs", strBadge: "" },
  { strTeam: "Stellenbosch FC", strBadge: "" }
];

const fallbackTable = [
  { intRank: 1, strTeam: "Mamelodi Sundowns", intPlayed: 20, intWin: 15, intDraw: 3, intLoss: 2, intGoalsDifference: 24, intPoints: 48 },
  { intRank: 2, strTeam: "Orlando Pirates", intPlayed: 20, intWin: 12, intDraw: 4, intLoss: 4, intGoalsDifference: 16, intPoints: 40 },
  { intRank: 3, strTeam: "Stellenbosch FC", intPlayed: 20, intWin: 10, intDraw: 6, intLoss: 4, intGoalsDifference: 8, intPoints: 36 }
];

const fallbackEvents = [
  { strEvent: "Mamelodi Sundowns vs Orlando Pirates", dateEvent: "2026-03-15", strTime: "17:30:00", intHomeScore: "2", intAwayScore: "1", strStatus: "Match Finished", strVenue: "Loftus Versfeld Stadium" },
  { strEvent: "Kaizer Chiefs vs Cape Town City", dateEvent: "2026-03-16", strTime: "19:45:00", intHomeScore: "", intAwayScore: "", strStatus: "Not Started", strVenue: "FNB Stadium" }
];

function escapeHtml(value = "") {
  const map = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;" };
  return String(value).replace(/[&<>"']/g, (char) => map[char]);
}

async function fetchSportsDb(path) {
  const response = await fetch(`${API_BASE}${path}`, { method: "GET", mode: "cors" });
  if (!response.ok) throw new Error(`TheSportsDB HTTP ${response.status} for ${path}`);
  return response.json();
}

function logo(team = {}) {
  if (team.strBadge) return team.strBadge;
  if (team.strTeamBadge) return team.strTeamBadge;
  const text = encodeURIComponent((team.strTeam || "PSL").slice(0, 2).toUpperCase());
  return `https://ui-avatars.com/api/?name=${text}&background=1e3a8a&color=fff&size=128`;
}

function seasonCode() {
  const year = new Date().getFullYear();
  return `${year}-${year + 1}`;
}

function timeText(dateValue, timeValue) {
  const iso = `${dateValue || ""}T${(timeValue || "00:00:00").slice(0, 8)}`;
  const parsed = new Date(iso);
  if (Number.isNaN(parsed.getTime())) return "-";
  return parsed.toLocaleString(undefined, { weekday: "short", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
}

function renderTeams(teams = []) {
  if (!teams.length) {
    teamsGrid.innerHTML = '<p class="text-muted mb-0">No teams found.</p>';
    return;
  }

  teamsGrid.innerHTML = teams.slice(0, 18).map((team) => `
    <article class="football-team-card">
      <img src="${escapeHtml(logo(team))}" alt="${escapeHtml(team.strTeam || "Team")} logo" class="football-team-card-logo" loading="lazy" />
      <div>
        <p class="football-team-card-name mb-0">${escapeHtml(team.strTeam || "Unknown Team")}</p>
        <small class="text-muted">${escapeHtml(team.strStadium || "South African PSL")}</small>
      </div>
    </article>
  `).join("");
}

function renderStandings(rows = []) {
  if (!rows.length) {
    standingsBody.innerHTML = '<tr><td colspan="8" class="text-muted">Standings unavailable.</td></tr>';
    return;
  }

  standingsBody.innerHTML = rows.map((row) => `
    <tr>
      <td>${escapeHtml(row.intRank ?? "-")}</td>
      <td>${escapeHtml(row.strTeam || "-")}</td>
      <td>${escapeHtml(row.intPlayed ?? "-")}</td>
      <td>${escapeHtml(row.intWin ?? "-")}</td>
      <td>${escapeHtml(row.intDraw ?? "-")}</td>
      <td>${escapeHtml(row.intLoss ?? "-")}</td>
      <td>${escapeHtml(row.intGoalsDifference ?? "-")}</td>
      <td><strong>${escapeHtml(row.intPoints ?? "-")}</strong></td>
    </tr>
  `).join("");
}

function eventScore(event) {
  const home = event.intHomeScore;
  const away = event.intAwayScore;
  if (home === null || home === "" || away === null || away === "") return "vs";
  return `${home} - ${away}`;
}

function renderEvents(events = []) {
  if (!events.length) {
    eventsList.innerHTML = '<p class="text-muted mb-0">No match events available.</p>';
    return;
  }

  eventsList.innerHTML = events.slice(0, 10).map((event) => {
    const [home = "Home", away = "Away"] = String(event.strEvent || "Home vs Away").split(" vs ");
    return `
      <article class="football-event-card">
        <div class="football-event-top">
          <span class="football-event-team">${escapeHtml(home)}</span>
          <span class="football-event-score">${escapeHtml(eventScore(event))}</span>
          <span class="football-event-team text-end">${escapeHtml(away)}</span>
        </div>
        <div class="football-event-meta">
          <span>${escapeHtml(timeText(event.dateEvent, event.strTime))}</span>
          <span>${escapeHtml(event.strStatus || "Scheduled")}</span>
          <span>${escapeHtml(event.strVenue || "Venue TBC")}</span>
        </div>
      </article>
    `;
  }).join("");
}

async function loadFootballDemo(authInfo) {
  statusText.textContent = "Loading SA PSL teams, standings, and match events from TheSportsDB...";

  try {
    const [teamsResp, standingsResp, pastResp, nextResp] = await Promise.all([
      fetchSportsDb(`/search_all_teams.php?l=${encodeURIComponent(PSL_NAME)}`),
      fetchSportsDb(`/lookuptable.php?l=${PSL_LEAGUE_ID}`),
      fetchSportsDb(`/eventspastleague.php?id=${PSL_LEAGUE_ID}`),
      fetchSportsDb(`/eventsnextleague.php?id=${PSL_LEAGUE_ID}`)
    ]);

    const teams = Array.isArray(teamsResp?.teams) ? teamsResp.teams : [];
    const table = Array.isArray(standingsResp?.table) ? standingsResp.table : [];
    const events = [
      ...(Array.isArray(pastResp?.events) ? pastResp.events : []),
      ...(Array.isArray(nextResp?.events) ? nextResp.events : [])
    ].sort((a, b) => {
      const da = new Date(`${a.dateEvent || ""}T${a.strTime || "00:00:00"}`).getTime() || 0;
      const db = new Date(`${b.dateEvent || ""}T${b.strTime || "00:00:00"}`).getTime() || 0;
      return db - da;
    });

    renderTeams(teams);
    renderStandings(table);
    renderEvents(events);

    statusText.textContent = `Loaded TheSportsDB PSL endpoints (id=4802) (teams: ${teams.length}, standings: ${table.length}, events: ${events.length}).`;

    await logAdminEvent({
      eventType: "football_demo_viewed",
      status: "success",
      email: authInfo.user.email || "",
      uid: authInfo.user.uid,
      role: authInfo.role,
      details: "Viewed SA PSL demo using TheSportsDB"
    });
  } catch (error) {
    renderTeams(fallbackTeams);
    renderStandings(fallbackTable);
    renderEvents(fallbackEvents);
    statusText.textContent = `TheSportsDB fetch failed (${error.message}). Showing fallback demo data.`;
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
