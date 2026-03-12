const API_BASE = "https://www.thesportsdb.com/api/v1/json/3";
const DEFAULT_SPORT = "Soccer";
const DEFAULT_LEAGUE = "South African Premier Soccer League";
const DEFAULT_LEAGUE_ID = "4802";

const MANUAL_LEAGUES = {
  Soccer: {
    "South African Premier Soccer League": "4802",
    "UEFA Champions League": "4480",
    "English Premier League": "4328",
    LaLiga: "4335"
  },
  Basketball: {
    NBA: "4387"
  },
  Rugby: {
    "United Rugby Championship": "4766"
  },
  Cricket: {
    "Indian Premier League": "5090"
  }
};

const leagueTitle = document.getElementById("leagueTitle");
const leagueStatus = document.getElementById("leagueStatus");
const standingsTitle = document.getElementById("standingsTitle");
const standingsBody = document.getElementById("standingsBody");
const fixturesList = document.getElementById("fixturesList");
const leagueMeta = document.getElementById("leagueMeta");
const leagueDescription = document.getElementById("leagueDescription");
const leagueBadge = document.getElementById("leagueBadge");

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
    leagueId: params.get("leagueId") || ""
  };
}

function resolveLeagueId(sport, league, requestedId) {
  if (requestedId) return requestedId;
  return MANUAL_LEAGUES?.[sport]?.[league] || DEFAULT_LEAGUE_ID;
}

async function fetchLeagueTeams(leagueName) {
  const resp = await fetchSportsDb(`/search_all_teams.php?l=${encodeURIComponent(leagueName)}`);
  const teams = Array.isArray(resp?.teams) ? resp.teams : [];
  return new Set(teams.map((team) => String(team.strTeam || "").trim().toLowerCase()).filter(Boolean));
}

function renderLeagueInfo(leagueData, sport, league) {
  const name = leagueData?.strLeague || league;
  const country = leagueData?.strCountry || "International";
  const formed = leagueData?.intFormedYear ? ` • Founded ${leagueData.intFormedYear}` : "";
  leagueMeta.textContent = `${sport} • ${name} • ${country}${formed}`;
  leagueDescription.textContent = leagueData?.strDescriptionEN || `Live table and fixtures for ${name}.`;

  const badgeUrl = leagueData?.strBadge || leagueData?.strLogo || "";
  if (badgeUrl) {
    leagueBadge.src = badgeUrl;
    leagueBadge.classList.remove("d-none");
  } else {
    leagueBadge.removeAttribute("src");
    leagueBadge.classList.add("d-none");
  }
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

async function loadSportsPage() {
  const { sport, league, leagueId } = parseQuery();
  const resolvedLeagueId = resolveLeagueId(sport, league, leagueId);

  leagueTitle.textContent = `${sport} • ${league}`;
  standingsTitle.textContent = `Top 5 on ${league}`;
  leagueStatus.textContent = "Loading table, league information and upcoming fixtures...";

  try {
    const [leagueResp, tableResp, eventsResp, leagueTeams] = await Promise.all([
      fetchSportsDb(`/lookupleague.php?id=${resolvedLeagueId}`),
      fetchSportsDb(`/lookuptable.php?l=${resolvedLeagueId}`),
      fetchSportsDb(`/eventsnextleague.php?id=${resolvedLeagueId}`),
      fetchLeagueTeams(league)
    ]);

    const leagueData = Array.isArray(leagueResp?.leagues) ? leagueResp.leagues[0] : null;
    const table = Array.isArray(tableResp?.table) ? tableResp.table : [];
    const events = Array.isArray(eventsResp?.events) ? eventsResp.events : [];
    const filteredEvents = leagueTeams.size
      ? events.filter((event) => {
        const home = String(event.strHomeTeam || "").trim().toLowerCase();
        const away = String(event.strAwayTeam || "").trim().toLowerCase();
        return leagueTeams.has(home) && leagueTeams.has(away);
      })
      : events;

    renderLeagueInfo(leagueData, sport, league);
    renderStandings(table);
    renderFixtures(filteredEvents);
    leagueStatus.textContent = `Loaded ${table.length} standings rows and ${filteredEvents.length} scheduled matches for ${league}.`;
  } catch (error) {
    renderLeagueInfo(null, sport, league);
    renderStandings([]);
    renderFixtures([]);
    leagueStatus.textContent = `Unable to load live data (${error.message}).`;
  }
}

loadSportsPage();
