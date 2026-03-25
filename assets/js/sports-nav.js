const API_BASE = "https://www.thesportsdb.com/api/v1/json/3";
const SPORTS_LIMIT = 12;
const LEAGUES_PER_SPORT = 8;

function escapeHtml(value = "") {
  const map = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;" };
  return String(value).replace(/[&<>"']/g, (char) => map[char]);
}

async function fetchSportsDb(path) {
  const response = await fetch(`${API_BASE}${path}`, { method: "GET", mode: "cors" });
  if (!response.ok) throw new Error(`TheSportsDB HTTP ${response.status}`);
  return response.json();
}

function makeLeagueUrl(sport, league, leagueId) {
  const params = new URLSearchParams({ sport, league });
  if (leagueId) params.set("leagueId", leagueId);
  return `sports.html?${params.toString()}`;
}

async function buildSportsMenus() {
  const menus = Array.from(document.querySelectorAll("[data-sports-menu]"));
  if (!menus.length) return;

  try {
    const sportsResp = await fetchSportsDb("/all_sports.php");
    const sports = (Array.isArray(sportsResp?.sports) ? sportsResp.sports : [])
      .map((item) => item.strSport)
      .filter(Boolean)
      .sort((a, b) => a.localeCompare(b))
      .slice(0, SPORTS_LIMIT);

    const leaguesBySport = await Promise.all(sports.map(async (sport) => {
      try {
        const resp = await fetchSportsDb(`/search_all_leagues.php?s=${encodeURIComponent(sport)}`);
        const leagues = (Array.isArray(resp?.countrys) ? resp.countrys : [])
          .filter((league) => (league.strSport || "").toLowerCase() === sport.toLowerCase())
          .slice(0, LEAGUES_PER_SPORT);
        return { sport, leagues };
      } catch {
        return { sport, leagues: [] };
      }
    }));

    const html = leaguesBySport.map(({ sport, leagues }) => {
      const subItems = leagues.length
        ? leagues.map((league) => `
            <li>
              <a class="dropdown-item" href="${makeLeagueUrl(sport, league.strLeague || `${sport} League`, league.idLeague)}">${escapeHtml(league.strLeague || `${sport} League`)}</a>
            </li>
          `).join("")
        : '<li><span class="dropdown-item-text text-muted">No leagues found</span></li>';

      return `
        <li class="dropend sports-dropend">
          <a class="dropdown-item dropdown-toggle" href="#" data-bs-toggle="dropdown" aria-expanded="false">${escapeHtml(sport)}</a>
          <ul class="dropdown-menu sports-submenu">
            ${subItems}
          </ul>
        </li>
      `;
    }).join("");

    menus.forEach((menu) => {
      menu.innerHTML = html;
    });
  } catch (error) {
    menus.forEach((menu) => {
      menu.innerHTML = '<li><span class="dropdown-item-text text-danger">Unable to load sports</span></li>';
    });
  }
}

buildSportsMenus();
