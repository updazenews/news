const cityInput = document.getElementById("cityInput");
const suggestionsBox = document.getElementById("citySuggestions");
const statusText = document.getElementById("weatherStatus");
const forecastContainer = document.getElementById("weatherForecast");
const searchBtn = document.getElementById("weatherSearchBtn");

let suggestionItems = [];
let selectedLocation = null;
let debounceTimer = null;

function escapeHtml(value = "") {
  const map = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;" };
  return value.replace(/[&<>"']/g, (char) => map[char]);
}

function weatherCodeLabel(code) {
  const labels = {
    0: "Clear sky",
    1: "Mainly clear",
    2: "Partly cloudy",
    3: "Overcast",
    45: "Fog",
    48: "Depositing rime fog",
    51: "Light drizzle",
    53: "Drizzle",
    55: "Dense drizzle",
    61: "Slight rain",
    63: "Rain",
    65: "Heavy rain",
    71: "Slight snow",
    73: "Snow",
    75: "Heavy snow",
    80: "Rain showers",
    81: "Rain showers",
    82: "Violent rain showers",
    95: "Thunderstorm"
  };
  return labels[code] || "Weather update";
}

function formatDate(isoDate) {
  return new Date(isoDate).toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" });
}

function showSuggestions(locations = []) {
  suggestionItems = locations;
  if (!locations.length) {
    suggestionsBox.innerHTML = "";
    suggestionsBox.classList.add("d-none");
    return;
  }

  suggestionsBox.innerHTML = locations
    .map((location, index) => {
      const label = `${location.name}${location.admin1 ? `, ${location.admin1}` : ""}, ${location.country}`;
      return `<button type="button" class="list-group-item list-group-item-action" data-index="${index}">${escapeHtml(label)}</button>`;
    })
    .join("");

  suggestionsBox.classList.remove("d-none");
}

function hideSuggestions() {
  suggestionsBox.classList.add("d-none");
}

async function fetchCitySuggestions(query) {
  if (!query || query.trim().length < 2) {
    showSuggestions([]);
    return;
  }

  statusText.textContent = "Searching locations...";
  const endpoint = `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(query.trim())}&count=7&language=en&format=json`;

  try {
    const response = await fetch(endpoint);
    const data = await response.json();
    const results = Array.isArray(data?.results) ? data.results : [];
    showSuggestions(results);
    statusText.textContent = results.length ? "Select a city suggestion or click Get Forecast." : "No matching cities found.";
  } catch {
    statusText.textContent = "Unable to fetch city suggestions right now.";
    showSuggestions([]);
  }
}

function renderForecast(locationName, daily) {
  const days = daily.time.slice(0, 3).map((date, index) => ({
    date,
    min: daily.temperature_2m_min[index],
    max: daily.temperature_2m_max[index],
    code: daily.weathercode[index]
  }));

  forecastContainer.innerHTML = days
    .map((day) => `
      <div class="col-12 col-md-4">
        <article class="card h-100 weather-day-card">
          <div class="card-body">
            <p class="text-muted mb-1">${formatDate(day.date)}</p>
            <h2 class="h5 mb-2">${weatherCodeLabel(day.code)}</h2>
            <p class="mb-0"><strong>${Math.round(day.max)}°C</strong> / ${Math.round(day.min)}°C</p>
          </div>
        </article>
      </div>
    `)
    .join("");

  statusText.textContent = `3-day forecast for ${locationName}.`;
}

async function loadForecast(location) {
  if (!location) {
    statusText.textContent = "Please select a location first.";
    return;
  }

  const locationName = `${location.name}${location.admin1 ? `, ${location.admin1}` : ""}, ${location.country}`;
  statusText.textContent = `Loading forecast for ${locationName}...`;

  const endpoint = `https://api.open-meteo.com/v1/forecast?latitude=${location.latitude}&longitude=${location.longitude}&daily=weathercode,temperature_2m_max,temperature_2m_min&forecast_days=3&timezone=auto`;

  try {
    const response = await fetch(endpoint);
    const data = await response.json();
    if (!data?.daily?.time?.length) {
      statusText.textContent = "Forecast data unavailable for this location.";
      forecastContainer.innerHTML = "";
      return;
    }
    renderForecast(locationName, data.daily);
  } catch {
    statusText.textContent = "Unable to load weather forecast right now.";
    forecastContainer.innerHTML = "";
  }
}

function selectSuggestion(index) {
  const selected = suggestionItems[index];
  if (!selected) return;
  selectedLocation = selected;
  cityInput.value = `${selected.name}${selected.admin1 ? `, ${selected.admin1}` : ""}, ${selected.country}`;
  hideSuggestions();
}

cityInput?.addEventListener("input", (event) => {
  selectedLocation = null;
  clearTimeout(debounceTimer);
  debounceTimer = setTimeout(() => fetchCitySuggestions(event.target.value), 250);
});

cityInput?.addEventListener("keydown", (event) => {
  if (event.key === "Enter") {
    event.preventDefault();
    if (suggestionItems.length && !selectedLocation) {
      selectSuggestion(0);
    }
    loadForecast(selectedLocation);
  }
});

suggestionsBox?.addEventListener("click", (event) => {
  const trigger = event.target.closest("button[data-index]");
  if (!trigger) return;
  selectSuggestion(Number(trigger.dataset.index));
});

searchBtn?.addEventListener("click", () => {
  if (!selectedLocation && suggestionItems.length) {
    selectSuggestion(0);
  }
  loadForecast(selectedLocation);
});

document.addEventListener("click", (event) => {
  if (!event.target.closest(".weather-search-box")) hideSuggestions();
});

const year = document.getElementById("year");
if (year) year.textContent = String(new Date().getFullYear());
