const API_BASE = "https://www.thesportsdb.com/api/v1/json/3";
const DEFAULT_SPORT = "Soccer";
const DEFAULT_LEAGUE = "South African Premier Soccer League";
const DEFAULT_LEAGUE_ID = "4802";

const leagueTitle = document.getElementById("leagueTitle");
const leagueStatus = document.getElementById("leagueStatus");
const standingsTitle = document.getElementById("standingsTitle");
const standingsBody = document.getElementById("standingsBody");
const fixturesList = document.getElementById("fixturesList");

function escapeHtml(value = "") {
  const map = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;" };
  return String(value).replace(/[&<>"']/g, (char) => map[char]);
}

async function fetchSportsDb(path) {
  const response = await fetch(`${API_BASE}${path}`, { method: "GET", mode: "cors" });
  if (!response.ok) throw new Error(`TheSportsDB HTTP ${response.status}`);
  return response.json();
}

function parseQuery() {
  const params = new URLSearchParams(window.location.search);
  return {
    sport: params.get("sport") || DEFAULT_SPORT,
    league: params.get("league") || DEFAULT_LEAGUE,
    leagueId: params.get("leagueId") || DEFAULT_LEAGUE_ID
  };
}

function renderStandings(rows = []) {
  if (!rows.length) {
    standingsBody.innerHTML = '<tr><td colspan="8" class="text-muted">Standings unavailable for this league.</td></tr>';
    return;
  }

  const sorted = rows
    .slice()
    .sort((a, b) => Number(a.intRank || 9999) - Number(b.intRank || 9999))
    .slice(0, 5);

  standingsBody.innerHTML = sorted.map((row) => `
    <tr>
      <td>${escapeHtml(row.intRank || "-")}</td>
      <td class="d-flex align-items-center gap-2"><img class="sports-team-logo" src="${escapeHtml(row.strBadge || "")}" alt="" onerror="this.style.display='none'" />${escapeHtml(row.strTeam || "-")}</td>
      <td>${escapeHtml(row.intPlayed || "-")}</td>
      <td>${escapeHtml(row.intWin || "-")}</td>
      <td>${escapeHtml(row.intDraw || "-")}</td>
      <td>${escapeHtml(row.intLoss || "-")}</td>
      <td>${escapeHtml(row.intGoalsDifference || "-")}</td>
      <td><strong>${escapeHtml(row.intPoints || "-")}</strong></td>
    </tr>
  `).join("");
}

function renderFixtures(events = []) {
  if (!events.length) {
    fixturesList.innerHTML = '<p class="text-muted mb-0">No scheduled matches available.</p>';
    return;
  }

  const sorted = events.slice().sort((a, b) => {
    const da = new Date(`${a.dateEvent || ""}T${a.strTime || "00:00:00"}`).getTime() || 0;
    const db = new Date(`${b.dateEvent || ""}T${b.strTime || "00:00:00"}`).getTime() || 0;
    return da - db;
  });

  fixturesList.innerHTML = sorted.slice(0, 10).map((event) => {
    const home = event.strHomeTeam || "Home";
    const away = event.strAwayTeam || "Away";
    const when = event.dateEvent ? `${event.dateEvent} ${event.strTime || ""}`.trim() : "Date TBC";
    return `
      <article class="sports-event-card">
        <div class="sports-event-teams"><span>${escapeHtml(home)}</span><strong>vs</strong><span>${escapeHtml(away)}</span></div>
        <div class="sports-event-meta"><span>${escapeHtml(when)}</span><span>${escapeHtml(event.strVenue || "Venue TBC")}</span></div>
      </article>
    `;
  }).join("");
}

async function resolveLeagueId(sport, leagueName, leagueId) {
  if (leagueId) return leagueId;
  const resp = await fetchSportsDb(`/search_all_leagues.php?s=${encodeURIComponent(sport)}`);
  const leagues = Array.isArray(resp?.countrys) ? resp.countrys : [];
  const match = leagues.find((league) => (league.strLeague || "").toLowerCase() === leagueName.toLowerCase());
  return match?.idLeague || DEFAULT_LEAGUE_ID;
}

async function loadSportsPage() {
  const { sport, league, leagueId } = parseQuery();
  leagueTitle.textContent = `${sport} • ${league}`;
  standingsTitle.textContent = `Top 5 on ${league}`;
  leagueStatus.textContent = "Loading table and upcoming fixtures...";

  try {
    const resolvedLeagueId = await resolveLeagueId(sport, league, leagueId);
    const [tableResp, eventsResp] = await Promise.all([
      fetchSportsDb(`/lookuptable.php?l=${resolvedLeagueId}`),
      fetchSportsDb(`/eventsnextleague.php?id=${resolvedLeagueId}`)
    ]);

    const table = Array.isArray(tableResp?.table) ? tableResp.table : [];
    const events = Array.isArray(eventsResp?.events) ? eventsResp.events : [];

    renderStandings(table);
    renderFixtures(events);
    leagueStatus.textContent = `Loaded ${table.length} standings rows and ${events.length} scheduled matches.`;
  } catch (error) {
    renderStandings([]);
    renderFixtures([]);
    leagueStatus.textContent = `Unable to load live data (${error.message}).`;
  }
}

loadSportsPage();
