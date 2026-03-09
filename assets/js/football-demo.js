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

const mockPayload = {
  wc: { competition: { name: "FIFA World Cup", code: "WC", type: "CUP", plan: "DEMO" } },
  cl: { competition: { name: "UEFA Champions League", code: "CL", type: "CUP", plan: "DEMO" } },
  matches: {
    matches: [
      { status: "SCHEDULED", utcDate: new Date(Date.now() + 86400000).toISOString(), homeTeam: { name: "Real Madrid" }, awayTeam: { name: "Manchester City" }, matchday: 1 },
      { status: "SCHEDULED", utcDate: new Date(Date.now() + 172800000).toISOString(), homeTeam: { name: "Bayern Munich" }, awayTeam: { name: "Inter" }, matchday: 1 },
      { status: "FINISHED", utcDate: new Date(Date.now() - 86400000).toISOString(), homeTeam: { name: "PSG" }, awayTeam: { name: "Arsenal" }, matchday: 6, score: { fullTime: { home: 2, away: 1 } } },
      { status: "FINISHED", utcDate: new Date(Date.now() - 172800000).toISOString(), homeTeam: { name: "Barcelona" }, awayTeam: { name: "Dortmund" }, matchday: 6, score: { fullTime: { home: 3, away: 2 } } }
    ]
  }
};

function escapeHtml(value = "") {
  const map = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;" };
  return String(value).replace(/[&<>"']/g, (char) => map[char]);
}

function buildProxyCandidates(url, withTokenQuery = false) {
  const targetUrl = withTokenQuery
    ? `${url}${url.includes("?") ? "&" : "?"}X-Auth-Token=${encodeURIComponent(FOOTBALL_DATA_TOKEN)}`
    : url;

  const encoded = encodeURIComponent(targetUrl);
  const customProxy = (window.FOOTBALL_PROXY_URL || "").trim();

  const candidates = [
    { url: targetUrl, headers: { "X-Auth-Token": FOOTBALL_DATA_TOKEN }, label: "direct" },
    { url: `https://corsproxy.io/?${encoded}`, headers: { "X-Auth-Token": FOOTBALL_DATA_TOKEN }, label: "corsproxy-header" },
    { url: `https://corsproxy.io/?${encoded}`, headers: {}, label: "corsproxy-query" }
  ];

  if (customProxy) {
    const normalized = customProxy.endsWith("/") ? customProxy : `${customProxy}/`;
    candidates.unshift({ url: `${normalized}${encoded}`, headers: { "X-Auth-Token": FOOTBALL_DATA_TOKEN }, label: "custom-proxy-header" });
    candidates.unshift({ url: `${normalized}${encoded}`, headers: {}, label: "custom-proxy-query" });
  }

  return candidates;
}

async function fetchFootball(path) {
  const url = `${API_BASE}${path}`;
  const attempts = [
    ...buildProxyCandidates(url, false),
    ...buildProxyCandidates(url, true)
  ];

  let lastError = "Unknown network error";

  for (const attempt of attempts) {
    try {
      const response = await fetch(attempt.url, {
        method: "GET",
        headers: attempt.headers,
        mode: "cors"
      });
      if (!response.ok) {
        lastError = `${attempt.label}: HTTP ${response.status}`;
        continue;
      }
      return await response.json();
    } catch (error) {
      lastError = `${attempt.label}: ${error.message}`;
    }
  }

  throw new Error(lastError);
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
    renderCompetitions(mockPayload.wc, mockPayload.cl);
    renderFixtures(mockPayload.matches.matches);
    renderResults(mockPayload.matches.matches);
    statusText.textContent = `Live API blocked by CORS/network (${error.message}). Showing demo fallback data. Set window.FOOTBALL_PROXY_URL to your server-side proxy to enable live data in production.`;
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
