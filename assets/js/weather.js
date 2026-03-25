const cityInput = document.getElementById("cityInput");
const suggestionsBox = document.getElementById("citySuggestions");
const statusText = document.getElementById("weatherStatus");
const searchBtn = document.getElementById("weatherSearchBtn");
const dashboard = document.getElementById("weatherDashboard");

const currentTempEl = document.getElementById("currentTemp");
const currentMetricsEl = document.getElementById("currentMetrics");
const currentCityEl = document.getElementById("currentCity");
const currentDateTimeEl = document.getElementById("currentDateTime");
const currentConditionEl = document.getElementById("currentCondition");
const currentIconEl = document.getElementById("currentIcon");

const trendArea = document.getElementById("trendArea");
const trendLine = document.getElementById("trendLine");
const trendValuesEl = document.getElementById("trendValues");
const trendLabelsEl = document.getElementById("trendLabels");
const dailyForecastCards = document.getElementById("dailyForecastCards");

let suggestionItems = [];
let selectedLocation = null;
let debounceTimer = null;

function escapeHtml(value = "") {
  const map = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;" };
  return value.replace(/[&<>"']/g, (char) => map[char]);
}

function weatherCodeLabel(code) {
  const labels = {
    0: "Clear",
    1: "Mainly clear",
    2: "Partly cloudy",
    3: "Overcast",
    45: "Fog",
    48: "Fog",
    51: "Light drizzle",
    53: "Drizzle",
    55: "Dense drizzle",
    61: "Slight rain",
    63: "Rain",
    65: "Heavy rain",
    71: "Snow",
    73: "Snow",
    75: "Heavy snow",
    80: "Rain showers",
    81: "Rain showers",
    82: "Heavy showers",
    95: "Thunderstorm"
  };
  return labels[code] || "Weather";
}

function weatherIcon(code, isDay = true) {
  if ([61, 63, 65, 80, 81, 82].includes(code)) return "🌧️";
  if ([71, 73, 75].includes(code)) return "❄️";
  if ([45, 48].includes(code)) return "🌫️";
  if ([95].includes(code)) return "⛈️";
  if ([1, 2, 3].includes(code)) return isDay ? "⛅" : "☁️";
  return isDay ? "☀️" : "🌙";
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

function nearestIndex(times = [], targetISO = "") {
  if (!times.length || !targetISO) return 0;
  const target = new Date(targetISO).getTime();
  let closest = 0;
  let bestDistance = Number.POSITIVE_INFINITY;
  times.forEach((time, idx) => {
    const distance = Math.abs(new Date(time).getTime() - target);
    if (distance < bestDistance) {
      bestDistance = distance;
      closest = idx;
    }
  });
  return closest;
}

function renderTrendChart(values = [], labels = []) {
  if (!values.length || !trendLine || !trendArea) return;
  const width = 760;
  const height = 120;
  const min = Math.min(...values) - 1;
  const max = Math.max(...values) + 1;
  const spread = Math.max(1, max - min);

  const points = values.map((value, idx) => {
    const x = (idx / Math.max(values.length - 1, 1)) * width;
    const y = ((max - value) / spread) * (height - 25) + 5;
    return [x, y];
  });

  const linePath = points
    .map(([x, y], idx) => `${idx === 0 ? "M" : "L"}${x.toFixed(2)} ${y.toFixed(2)}`)
    .join(" ");

  const areaPath = `${linePath} L ${width} ${height} L 0 ${height} Z`;
  trendLine.setAttribute("d", linePath);
  trendArea.setAttribute("d", areaPath);

  trendValuesEl.innerHTML = values.map((temp) => `<span>${Math.round(temp)}</span>`).join("");
  trendLabelsEl.innerHTML = labels.map((label) => `<span>${escapeHtml(label)}</span>`).join("");
}

function renderDailyCards(daily) {
  dailyForecastCards.innerHTML = daily.time.slice(0, 3).map((date, index) => {
    const code = daily.weathercode[index];
    return `
      <article class="weather-day-item">
        <p class="day-name">${new Date(date).toLocaleDateString(undefined, { weekday: "short" })}</p>
        <div class="day-icon">${weatherIcon(code, true)}</div>
        <p class="day-temp">${Math.round(daily.temperature_2m_max[index])}° <span>${Math.round(daily.temperature_2m_min[index])}°</span></p>
      </article>
    `;
  }).join("");
}

function renderForecast(locationName, payload) {
  const { current, daily, hourly } = payload;
  const condition = weatherCodeLabel(current.weather_code);
  const currentIso = current.time;
  const humidityIndex = nearestIndex(hourly.time, currentIso);

  currentTempEl.textContent = `${Math.round(current.temperature_2m)}`;
  currentCityEl.textContent = locationName;
  currentDateTimeEl.textContent = new Date(currentIso).toLocaleString(undefined, { weekday: "long", hour: "2-digit", minute: "2-digit" });
  currentConditionEl.textContent = condition;
  currentIconEl.textContent = weatherIcon(current.weather_code, current.is_day === 1);

  const humidity = Number(hourly.relative_humidity_2m?.[humidityIndex] ?? 0);
  const precip = Number(hourly.precipitation_probability?.[humidityIndex] ?? 0);
  currentMetricsEl.innerHTML = `Precipitation: ${Math.round(precip)}%<br />Humidity: ${Math.round(humidity)}%<br />Wind: ${Math.round(current.wind_speed_10m)} km/h`;

  const start = nearestIndex(hourly.time, currentIso);
  const stepIndices = Array.from({ length: 8 }, (_, idx) => start + idx * 3).filter((idx) => idx < hourly.time.length);
  const tempSeries = stepIndices.map((idx) => hourly.temperature_2m[idx]);
  const labelSeries = stepIndices.map((idx) => new Date(hourly.time[idx]).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", hour12: false }));

  renderTrendChart(tempSeries, labelSeries);
  renderDailyCards(daily);
  dashboard.classList.remove("d-none");

  statusText.textContent = `3-day forecast for ${locationName}.`;
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

async function loadForecast(location) {
  if (!location) {
    statusText.textContent = "Please select a location first.";
    return;
  }

  const locationName = `${location.name}${location.admin1 ? `, ${location.admin1}` : ""}, ${location.country}`;
  statusText.textContent = `Loading forecast for ${locationName}...`;

  const endpoint = `https://api.open-meteo.com/v1/forecast?latitude=${location.latitude}&longitude=${location.longitude}&current=temperature_2m,weather_code,wind_speed_10m,is_day&hourly=temperature_2m,relative_humidity_2m,precipitation_probability&daily=weathercode,temperature_2m_max,temperature_2m_min&forecast_days=3&timezone=auto`;

  try {
    const response = await fetch(endpoint);
    const data = await response.json();
    if (!data?.current?.time || !data?.daily?.time?.length || !data?.hourly?.time?.length) {
      statusText.textContent = "Forecast data unavailable for this location.";
      dashboard.classList.add("d-none");
      return;
    }

    renderForecast(locationName, data);
  } catch {
    statusText.textContent = "Unable to load weather forecast right now.";
    dashboard.classList.add("d-none");
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
    if (suggestionItems.length && !selectedLocation) selectSuggestion(0);
    loadForecast(selectedLocation);
  }
});

suggestionsBox?.addEventListener("click", (event) => {
  const trigger = event.target.closest("button[data-index]");
  if (!trigger) return;
  selectSuggestion(Number(trigger.dataset.index));
});

searchBtn?.addEventListener("click", () => {
  if (!selectedLocation && suggestionItems.length) selectSuggestion(0);
  loadForecast(selectedLocation);
});

document.addEventListener("click", (event) => {
  if (!event.target.closest(".weather-search-box")) hideSuggestions();
});

const year = document.getElementById("year");
if (year) year.textContent = String(new Date().getFullYear());
