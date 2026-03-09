import { auth } from "./firebase-config.js";
import { canManageUsers, guardAdminRoute, isSuperAdmin, logAdminEvent } from "./auth.js";
import { signOut } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";

const API_BASE = "https://api.openligadb.de";

const guardMessage = document.getElementById("guardMessage");
const statusText = document.getElementById("footballStatus");
const competitionCards = document.getElementById("competitionCards");
const fixturesWrap = document.getElementById("uclFixturesCards");
const resultsWrap = document.getElementById("uclResultsCards");
const adminUserLabel = document.getElementById("adminUserLabel");
const manageUsersLink = document.getElementById("manageUsersLink");
const adminLogsLink = document.getElementById("adminLogsLink");
const footballDemoLink = document.getElementById("footballDemoLink");

const fallbackMatches = [
  { leagueName: "UEFA Champions League", matchDateTimeUTC: new Date(Date.now() + 86400000).toISOString(), team1: { teamName: "Real Madrid", teamIconUrl: "" }, team2: { teamName: "Manchester City", teamIconUrl: "" }, matchIsFinished: false, group: { groupOrderID: 1, groupName: "Matchday 1" }, matchResults: [], goals: [] },
  { leagueName: "UEFA Champions League", matchDateTimeUTC: new Date(Date.now() - 86400000).toISOString(), team1: { teamName: "PSG", teamIconUrl: "https://upload.wikimedia.org/wikipedia/en/a/a7/Paris_Saint-Germain_F.C..svg" }, team2: { teamName: "Arsenal", teamIconUrl: "https://upload.wikimedia.org/wikipedia/en/5/53/Arsenal_FC.svg" }, matchIsFinished: true, group: { groupOrderID: 6, groupName: "Matchday 6" }, matchResults: [{ resultTypeID: 2, pointsTeam1: 2, pointsTeam2: 1 }], goals: [{ scoreTeam1: 1, scoreTeam2: 0, goalGetterName: "Hakimi" }, { scoreTeam1: 2, scoreTeam2: 0, goalGetterName: "Ruiz" }, { scoreTeam1: 2, scoreTeam2: 1, goalGetterName: "Saka" }], location: { locationStadium: "Parc des Princes", locationCity: "Paris" } }
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

function logoForTeam(team = {}) {
  if (team.teamIconUrl) return team.teamIconUrl;
  const label = encodeURIComponent((team.teamName || "Team").slice(0, 2).toUpperCase());
  return `https://ui-avatars.com/api/?name=${label}&background=0f172a&color=ffffff&size=64`;
}

function formatDate(iso) {
  if (!iso) return "-";
  return new Date(iso).toLocaleDateString(undefined, { day: "numeric", month: "short", year: "2-digit" });
}

function formatDateTime(iso) {
  if (!iso) return "-";
  return new Date(iso).toLocaleString(undefined, { weekday: "short", hour: "2-digit", minute: "2-digit" });
}

function scoreObj(match) {
  const results = Array.isArray(match?.matchResults) ? match.matchResults : [];
  const fullTime = results.find((r) => Number(r.resultTypeID) === 2) || results[results.length - 1] || {};
  return { home: fullTime.pointsTeam1 ?? "-", away: fullTime.pointsTeam2 ?? "-" };
}

function scorerText(match, homeSide = true) {
  const goals = Array.isArray(match?.goals) ? match.goals : [];
  if (!goals.length) return "";
  const teamGoals = goals.filter((goal) => {
    const prevHome = Number(goal.scoreTeam1 ?? 0) - Number(goal.scoreTeam2 ?? 0);
    const before = homeSide ? prevHome > 0 : prevHome < 0;
    const now = homeSide ? Number(goal.scoreTeam1) > Number(goal.scoreTeam2) : Number(goal.scoreTeam2) > Number(goal.scoreTeam1);
    return now || before;
  }).map((goal) => goal.goalGetterName).filter(Boolean);
  return teamGoals.slice(0, 3).join(", ");
}

function venueText(match) {
  const stadium = match?.location?.locationStadium;
  const city = match?.location?.locationCity;
  if (stadium && city) return `${stadium}, ${city}`;
  return stadium || city || "Venue not provided";
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
    competitionCard({ title: "FIFA World Cup", sourcePath: info?.wcPath, count: info?.wcCount ?? 0, note: info?.wcFallback ? "Demo fallback" : "Live" }),
    competitionCard({ title: "UEFA Champions League", sourcePath: info?.clPath, count: info?.clCount ?? 0, note: info?.clFallback ? "Demo fallback" : "Live" })
  ].join("");
}

function matchCard(match, finished = true) {
  const score = scoreObj(match);
  const homeName = match?.team1?.teamName || "Home";
  const awayName = match?.team2?.teamName || "Away";
  const league = match?.leagueName || "UEFA Champions League";
  const dateLabel = formatDate(match.matchDateTimeUTC || match.matchDateTime);
  const homeScorers = scorerText(match, true);
  const awayScorers = scorerText(match, false);

  return `
    <article class="football-match-card">
      <header class="football-match-head">
        <strong>${finished ? "Results" : "Fixture"}</strong>
        <span>›</span>
      </header>
      <p class="football-league-name">${escapeHtml(league)}</p>
      <p class="football-match-date">${escapeHtml(dateLabel)}</p>
      <div class="football-score-row">
        <div class="football-team football-team-left">
          <img src="${escapeHtml(logoForTeam(match.team1 || {}))}" alt="${escapeHtml(homeName)} logo" class="football-team-logo" loading="lazy" />
          <span class="football-team-name">${escapeHtml(homeName)}</span>
        </div>
        <div class="football-center-score">
          <span class="football-score-number">${escapeHtml(String(score.home))}</span>
          <span class="football-score-dash">-</span>
          <span class="football-score-number">${escapeHtml(String(score.away))}</span>
        </div>
        <div class="football-team football-team-right">
          <span class="football-team-name">${escapeHtml(awayName)}</span>
          <img src="${escapeHtml(logoForTeam(match.team2 || {}))}" alt="${escapeHtml(awayName)} logo" class="football-team-logo" loading="lazy" />
        </div>
      </div>
      <div class="football-goals-row">
        <span>${escapeHtml(homeScorers || "-")}</span>
        <span>${finished ? "⚽" : "🗓️"}</span>
        <span>${escapeHtml(awayScorers || "-")}</span>
      </div>
      <p class="football-venue">📍 ${escapeHtml(finished ? venueText(match) : `Kickoff ${formatDateTime(match.matchDateTimeUTC || match.matchDateTime)}`)}</p>
    </article>
  `;
}

function renderFixtures(matches = []) {
  const upcoming = matches.filter((m) => !m.matchIsFinished).slice(0, 8);
  if (!upcoming.length) {
    fixturesWrap.innerHTML = '<p class="text-muted mb-0">No upcoming fixtures found.</p>';
    return;
  }
  fixturesWrap.innerHTML = upcoming.map((m) => matchCard(m, false)).join("");
}

function renderResults(matches = []) {
  const played = matches.filter((m) => m.matchIsFinished).slice(0, 8);
  if (!played.length) {
    resultsWrap.innerHTML = '<p class="text-muted mb-0">No recent match data found.</p>';
    return;
  }
  resultsWrap.innerHTML = played.map((m) => matchCard(m, true)).join("");
}

async function loadFootballDemo(authInfo) {
  statusText.textContent = "Loading FIFA World Cup and UEFA Champions League data from OpenLigaDB...";

  try {
    const year = new Date().getFullYear();
    const wcCandidates = [{ path: `/getmatchdata/wm/${year}` }, { path: "/getmatchdata/wm" }, { path: "/getmatchdata/fifa-wm" }, { path: "/getmatchdata" }];
    const clCandidates = [{ path: `/getmatchdata/championsleague/${year}` }, { path: "/getmatchdata/championsleague" }, { path: "/getmatchdata/uefa-champions-league" }, { path: "/getmatchdata" }];

    const [wcResolved, clResolved] = await Promise.all([firstSuccessful(wcCandidates), firstSuccessful(clCandidates)]);
    const wcMatches = Array.isArray(wcResolved.data) ? wcResolved.data : [];
    const clMatches = Array.isArray(clResolved.data) ? clResolved.data : [];

    renderCompetitions({ wcPath: wcResolved.candidate.path, clPath: clResolved.candidate.path, wcCount: wcMatches.length, clCount: clMatches.length, wcFallback: false, clFallback: false });
    renderFixtures(clMatches);
    renderResults(clMatches);

    statusText.textContent = `Loaded OpenLigaDB data (WC: ${wcMatches.length}, UCL: ${clMatches.length}).`;
    await logAdminEvent({ eventType: "football_demo_viewed", status: "success", email: authInfo.user.email || "", uid: authInfo.user.uid, role: authInfo.role, details: "Viewed football demo using OpenLigaDB" });
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
