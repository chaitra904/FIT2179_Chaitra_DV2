const embedOptions = {
  actions: false,
  renderer: "svg"
};

const specBaseUrl = new URL("./Vis charts/", document.baseURI);
const rawRepoBaseUrl = getRawRepoBaseUrl();
const dataBaseUrl = rawRepoBaseUrl
  ? new URL("./data/", rawRepoBaseUrl).href
  : new URL("./data/", document.baseURI).href;
const globalBurdenDataUrl = new URL("global_cvd_burden_2025_2050.csv", dataBaseUrl).href;

const chartEmbeds = [
  ["#map", new URL("1. world_cvd_map.vg.json", specBaseUrl).href],
  ["#ausProtection", new URL("12. australia_vs_global_benchmark.vg.json", specBaseUrl).href],
  ["#streamgraph", new URL("11.cause_of_death_streamgraph.vg.json", specBaseUrl).href],
  ["#growthParadox", new URL("13. rates_vs_deaths_paradox.vg.json", specBaseUrl).href],
  ["#trend", new URL("6. cvd_trend_2025_2050.vg.json", specBaseUrl).href],
  ["#diseaseBar", new URL("4. cvd_disease_composition_bar.vg.json", specBaseUrl).href],
  ["#riskLollipop", new URL("5. future_risk_factor_lollipop.vg.json", specBaseUrl).href],
  ["#bubble", new URL("8. prevention_vs_mortality_bubble.vg.json", specBaseUrl).href],
  ["#heatmap", new URL("7. health_system_scorecard_heatmap.vg.json", specBaseUrl).href],
  ["#lifestyleDiff", new URL("10. lifestyle_risk_difference.vg.json", specBaseUrl).href]
];

const chartViews = {};
const sharedState = {
  selectedCountry: "Australia",
  hoveredCountry: null,
  selectedDisease: "All diseases",
  countryRows: new Map(),
  countryList: [],
  globalAverageMortality: 0
};

function getRawRepoBaseUrl() {
  const hostMatch = window.location.hostname.match(/^([^.]+)\.github\.io$/);
  const repoName = window.location.pathname.split("/").filter(Boolean)[0];

  if (!hostMatch || !repoName) {
    return null;
  }

  return `https://raw.githubusercontent.com/${hostMatch[1]}/${repoName}/main/`;
}

function resolveDatasetUrl(url) {
  if (typeof url !== "string" || /^https?:\/\//i.test(url)) {
    return url;
  }

  const prefixes = ["../data/", "./data/", "data/"];
  const matchedPrefix = prefixes.find((prefix) => url.startsWith(prefix));

  if (!matchedPrefix) {
    return url;
  }

  const filename = url.slice(matchedPrefix.length);
  return new URL(filename, dataBaseUrl).href;
}

function isCsvUrl(url) {
  return typeof url === "string" && /\.csv(?:[?#].*)?$/i.test(url);
}

const csvParseHints = {
  "global_cvd_burden_2025_2050.csv": {
    year: "number",
    population: "number",
    cvd_prevalence_pct: "number",
    cvd_prevalent_cases: "number",
    crude_cvd_deaths: "number",
    crude_mortality_rate_per_100k: "number",
    age_std_mortality_rate_per_100k: "number",
    total_cvd_dalys: "number",
    daly_rate_per_100k: "number",
    ischemic_heart_disease_deaths: "number",
    stroke_deaths: "number",
    hypertensive_heart_disease_deaths: "number",
    heart_failure_deaths: "number",
    peripheral_artery_disease_deaths: "number",
    high_sbp_attributable_deaths_pct: "number",
    high_bmi_attributable_deaths_pct: "number",
    high_ldl_attributable_deaths_pct: "number",
    high_fpg_attributable_deaths_pct: "number",
    tobacco_attributable_deaths_pct: "number",
    hypertension_treatment_coverage_pct: "number",
    statin_therapy_coverage_pct: "number",
    cardiac_rehab_access_pct: "number",
    economic_burden_usd_bn: "number",
    healthcare_pressure_score: "number",
    gdp_per_capita_usd: "number",
    modifiable_risk_burden_pct: "number",
    primary_prevention_score: "number"
  },
  "cause_of_deaths.csv": {
    Year: "number",
    "Cardiovascular Diseases": "number",
    Neoplasms: "number",
    "Chronic Respiratory Diseases": "number",
    "Diabetes Mellitus": "number",
    "Chronic Kidney Disease": "number"
  },
  "heart_attack_prediction_dataset.csv": {
    Age: "number",
    Cholesterol: "number",
    "Heart Rate": "number",
    Diabetes: "number",
    "Family History": "number",
    Smoking: "number",
    Obesity: "number",
    "Alcohol Consumption": "number",
    "Exercise Hours Per Week": "number",
    "Previous Heart Problems": "number",
    "Medication Use": "number",
    "Stress Level": "number",
    "Sedentary Hours Per Day": "number",
    Income: "number",
    BMI: "number",
    Triglycerides: "number",
    "Physical Activity Days Per Week": "number",
    "Sleep Hours Per Day": "number",
    "Heart Attack Risk": "number"
  },
  "smoking_risk_data.csv": {
    id: "number",
    age: "number",
    education: "number",
    cigsPerDay: "number",
    BPMeds: "number",
    prevalentStroke: "number",
    prevalentHyp: "number",
    diabetes: "number",
    totChol: "number",
    sysBP: "number",
    diaBP: "number",
    BMI: "number",
    heartRate: "number",
    glucose: "number"
  }
};

function getCsvParseHints(url) {
  if (!isCsvUrl(url)) {
    return null;
  }

  try {
    const filename = decodeURIComponent(new URL(url, document.baseURI).pathname.split("/").pop() || "");
    return csvParseHints[filename] || null;
  } catch {
    return null;
  }
}

function ensureCsvDataParsing(node) {
  if (!node || typeof node !== "object" || !isCsvUrl(node.url)) {
    return;
  }

  const parseHints = getCsvParseHints(node.url);

  if (!node.format) {
    node.format = { type: "csv", parse: parseHints || "auto" };
    return;
  }

  if (typeof node.format === "object") {
    if (!node.format.type) {
      node.format.type = "csv";
    }

    if (node.format.type === "csv" && !node.format.parse) {
      node.format.parse = parseHints || "auto";
    }
  }
}

function rewriteSpecUrls(node) {
  if (Array.isArray(node)) {
    node.forEach(rewriteSpecUrls);
    return;
  }

  if (!node || typeof node !== "object") {
    return;
  }

  for (const [key, value] of Object.entries(node)) {
    if (key === "url" && typeof value === "string") {
      node[key] = resolveDatasetUrl(value);
      continue;
    }

    rewriteSpecUrls(value);
  }

  ensureCsvDataParsing(node);
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");
}

function formatNumber(value, digits = 0) {
  return new Intl.NumberFormat("en-US", {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits
  }).format(Number(value));
}

function getMortalityPositionText(rate) {
  const difference = Number(rate) - sharedState.globalAverageMortality;

  if (Math.abs(difference) < 3) {
    return "around the global average";
  }

  return difference < 0 ? "below the global average" : "above the global average";
}

function updateSpotlightCards(country) {
  const row = sharedState.countryRows.get(country);
  const mortalityValue = document.querySelector("#kpiMortalityValue");
  const dalysValue = document.querySelector("#kpiDalysValue");
  const preventionValue = document.querySelector("#kpiPreventionValue");
  const pressureValue = document.querySelector("#kpiPressureValue");
  const narrative = document.querySelector("#kpiNarrative");

  if (!row || !mortalityValue || !dalysValue || !preventionValue || !pressureValue || !narrative) {
    return;
  }

  mortalityValue.textContent = formatNumber(row.age_std_mortality_rate_per_100k, 1);
  dalysValue.textContent = formatNumber(row.daly_rate_per_100k, 1);
  preventionValue.textContent = formatNumber(row.primary_prevention_score, 1);
  pressureValue.textContent = formatNumber(row.healthcare_pressure_score, 0);

  narrative.textContent =
    `${country} is the current spotlight country. It sits ${getMortalityPositionText(row.age_std_mortality_rate_per_100k)} in 2050, with ` +
    `${formatNumber(row.modifiable_risk_burden_pct, 1)}% of projected burden linked to modifiable risks and ` +
    `${formatNumber(row.crude_cvd_deaths, 0)} projected cardiovascular deaths.`;
}

function populateCountrySelect() {
  const select = document.querySelector("#countrySpotlightSelect");

  if (!select) {
    return;
  }

  select.innerHTML = sharedState.countryList
    .map((country) => `<option value="${escapeHtml(country)}">${escapeHtml(country)}</option>`)
    .join("");

  select.value = sharedState.selectedCountry;
  select.addEventListener("change", (event) => {
    setSelectedCountry(event.target.value);
  });
}

async function setChartSignal(selector, signalName, value) {
  const view = chartViews[selector];

  if (!view) {
    return;
  }

  try {
    view.signal(signalName, value);
    await view.runAsync();
  } catch (error) {
    console.warn(`Could not update signal ${signalName} for ${selector}`, error);
  }
}

async function setSelectedCountry(country) {
  if (!sharedState.countryRows.has(country)) {
    return;
  }

  sharedState.selectedCountry = country;
  sharedState.hoveredCountry = null;

  const select = document.querySelector("#countrySpotlightSelect");

  if (select && select.value !== country) {
    select.value = country;
  }

  updateSpotlightCards(country);

  await Promise.all([
    setChartSignal("#map", "selectedCountryName", country),
    setChartSignal("#bubble", "selectedCountryName", country),
    setChartSignal("#heatmap", "selectedCountryName", country)
  ]);
}

async function setSelectedDisease(disease) {
  const nextDisease = sharedState.selectedDisease === disease ? "All diseases" : disease;
  sharedState.selectedDisease = nextDisease;

  await Promise.all([
    setChartSignal("#diseaseBar", "selectedDiseaseName", nextDisease),
    setChartSignal("#riskLollipop", "selectedDiseaseName", nextDisease)
  ]);
}

function attachCountryHover(view) {
  view.addEventListener("mouseover", (_event, item) => {
    const country = item?.datum?.country;

    if (!country || !sharedState.countryRows.has(country)) {
      return;
    }

    sharedState.hoveredCountry = country;
    updateSpotlightCards(country);
  });

  view.addEventListener("mouseout", () => {
    if (!sharedState.hoveredCountry) {
      return;
    }

    sharedState.hoveredCountry = null;
    updateSpotlightCards(sharedState.selectedCountry);
  });
}

function attachCountrySelection(view) {
  view.addEventListener("click", (_event, item) => {
    const country = item?.datum?.country;

    if (!country) {
      return;
    }

    setSelectedCountry(country);
  });
}

function attachDiseaseSelection(view) {
  view.addEventListener("click", (_event, item) => {
    const disease = item?.datum?.id || item?.datum?.disease;

    if (!disease || disease === "root") {
      return;
    }

    setSelectedDisease(disease);
  });
}

function wireChartInteractions() {
  if (chartViews["#map"]) {
    attachCountryHover(chartViews["#map"]);
    attachCountrySelection(chartViews["#map"]);
  }

  if (chartViews["#bubble"]) {
    attachCountrySelection(chartViews["#bubble"]);
  }

  if (chartViews["#heatmap"]) {
    attachCountrySelection(chartViews["#heatmap"]);
  }

  if (chartViews["#diseaseBar"]) {
    attachDiseaseSelection(chartViews["#diseaseBar"]);
  }
}

async function loadCountryData() {
  const csvText = await vega.loader().load(globalBurdenDataUrl);
  const rows = vega
    .read(csvText, { type: "csv", parse: "auto" })
    .filter((row) => Number(row.year) === 2050);

  sharedState.countryRows = new Map(rows.map((row) => [row.country, row]));
  sharedState.countryList = rows
    .map((row) => row.country)
    .sort((left, right) => left.localeCompare(right));
  sharedState.globalAverageMortality =
    rows.reduce((sum, row) => sum + Number(row.age_std_mortality_rate_per_100k), 0) / rows.length;

  populateCountrySelect();
  updateSpotlightCards(sharedState.selectedCountry);
}

async function embedChart(selector, specPath) {
  const container = document.querySelector(selector);

  if (!container) {
    return;
  }

  try {
    container.innerHTML = "";
    const specResponse = await fetch(specPath);

    if (!specResponse.ok) {
      throw new Error(`Spec request failed: ${specResponse.status}`);
    }

    const spec = await specResponse.json();
    rewriteSpecUrls(spec);

    const result = await vegaEmbed(selector, spec, embedOptions);
    chartViews[selector] = result.view;
  } catch (error) {
    console.error(`Chart failed to load for ${selector}`, error);
    const detail = escapeHtml(error?.message || "Unknown rendering error");
    container.innerHTML = `<p class="chart-error">Chart could not be loaded.<span>${detail}</span></p>`;
  }
}

async function renderAllCharts() {
  for (const [selector, specPath] of chartEmbeds) {
    await embedChart(selector, specPath);
  }
}

document.addEventListener("DOMContentLoaded", async () => {
  await Promise.all([loadCountryData(), renderAllCharts()]);
  wireChartInteractions();
  await setSelectedCountry(sharedState.selectedCountry);
});
