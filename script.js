// API Configuration
const API_BASE = "http://localhost:5000/api";

// DOM Elements
const baseLapInput = document.getElementById("baseLap");
const trackSelect = document.getElementById("trackCondition");
const safetyCarSelect = document.getElementById("safetyCarRisk");
const targetDriverSelect = document.getElementById("targetDriver");
const targetCircuitSelect = document.getElementById("targetCircuit");
const runBtn = document.getElementById("simulateBtn");
const resetBtn = document.getElementById("resetBtn");
const tyreButtons = Array.from(document.querySelectorAll(".tyre-btn"));
const predictedTimeEl = document.getElementById("predictedTime");
const predictedMetaEl = document.getElementById("predictedMeta");
const deltaEl = document.getElementById("timeDelta");
const deltaMetaEl = document.getElementById("deltaMeta");
const pitWindowEl = document.getElementById("pitWindow");
const pitMetaEl = document.getElementById("pitMeta");
const raceTotalEl = document.getElementById("raceTotal");
const raceMetaEl = document.getElementById("raceMeta");
const postSimPanelEl = document.getElementById("postSimPanel");
const degradationChartEl = document.getElementById("degradationChart");
const pitTimelineTrackEl = document.getElementById("pitTimelineTrack");
const strategyBadgeEl = document.getElementById("strategyBadge");
const timelineStartEl = document.getElementById("timelineStart");
const timelineMidEl = document.getElementById("timelineMid");
const timelineEndEl = document.getElementById("timelineEnd");
const compoundLegendEl = document.getElementById("compoundLegend");
const compoundComparisonGridEl = document.getElementById("compoundComparisonGrid");
const copilotAnalysisTextEl = document.getElementById("copilotAnalysisText");

let scrollRevealObserver = null;
let revealRequiresPostSimulationScroll = false;
let hasScrolledAfterSimulation = false;
let simulationRevealStartScrollY = 0;
let resultRevealTimeouts = [];

// State
const simulationData = {
  drivers: [],
  races: [],
  selectedTyre: "soft",
};

const fallbackDrivers = [
  { id: 1, name: "Max Verstappen", number: 1, team: "Red Bull", position: 1 },
  { id: 2, name: "Lando Norris", number: 4, team: "McLaren", position: 2 },
  { id: 3, name: "Charles Leclerc", number: 16, team: "Ferrari", position: 3 },
  { id: 4, name: "Oscar Piastri", number: 81, team: "McLaren", position: 4 },
  { id: 5, name: "Carlos Sainz", number: 55, team: "Williams", position: 5 },
  { id: 6, name: "George Russell", number: 63, team: "Mercedes", position: 6 },
  { id: 7, name: "Lewis Hamilton", number: 44, team: "Ferrari", position: 7 },
  { id: 8, name: "Fernando Alonso", number: 14, team: "Aston Martin", position: 8 },
  { id: 9, name: "Alex Albon", number: 23, team: "Williams", position: 9 },
  { id: 10, name: "Lance Stroll", number: 18, team: "Aston Martin", position: 10 },
  { id: 11, name: "Pierre Gasly", number: 10, team: "Alpine", position: 11 },
  { id: 12, name: "Esteban Ocon", number: 31, team: "Haas", position: 12 },
  { id: 13, name: "Yuki Tsunoda", number: 22, team: "RB", position: 13 },
  { id: 14, name: "Daniel Ricciardo", number: 3, team: "RB", position: 14 },
  { id: 15, name: "Nico Hulkenberg", number: 27, team: "Sauber", position: 15 },
  { id: 16, name: "Valtteri Bottas", number: 77, team: "Sauber", position: 16 },
  { id: 17, name: "Kevin Magnussen", number: 20, team: "Haas", position: 17 },
  { id: 18, name: "Logan Sargeant", number: 2, team: "Williams", position: 18 },
  { id: 19, name: "Guanyu Zhou", number: 24, team: "Sauber", position: 19 },
  { id: 20, name: "Oliver Bearman", number: 87, team: "Haas", position: 20 },
];

const fallbackRaces = [
  { round: 1, circuit: "Monaco", circuit_key: "monaco", laps: 78, length_km: 3.337 },
  { round: 2, circuit: "Monza", circuit_key: "monza", laps: 53, length_km: 5.793 },
  { round: 3, circuit: "Silverstone", circuit_key: "silverstone", laps: 52, length_km: 5.891 },
  { round: 4, circuit: "Spa-Francorchamps", circuit_key: "spa-francorchamps", laps: 44, length_km: 7.004 },
  { round: 5, circuit: "Suzuka", circuit_key: "suzuka", laps: 53, length_km: 5.807 },
];

const tyreImpact = {
  soft: -0.8,
  medium: -0.25,
  hard: 0.2,
  inter: 2.0,
  wet: 3.8,
};

const trackImpact = {
  optimal: -0.4,
  hot: 0.7,
  cold: 0.45,
  green: 1.0,
  damp: 2.4,
  wet: 5.2,
};

const safetyImpact = {
  low: 0,
  medium: 0.35,
  high: 0.85,
};

const circuitImpact = {
  monaco: 1.8,
  monza: -1.0,
  silverstone: -0.4,
  "spa-francorchamps": -0.2,
  suzuka: -0.15,
  bahrain: 0.5,
  jeddah: 0.25,
  "albert-park": 0.4,
  shanghai: 0.3,
};

function formatCircuitLabel(race) {
  const laps = Number.isFinite(race.laps) ? `${race.laps} laps` : "laps n/a";
  const km = Number.isFinite(race.length_km) ? `${race.length_km.toFixed(3)}km` : "length n/a";
  return `${race.circuit} - ${laps} (${km})`;
}

function formatLapTime(seconds) {
  if (!Number.isFinite(seconds) || seconds <= 0) {
    return "--";
  }
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;
  return `${minutes}:${remainingSeconds.toFixed(3).padStart(6, "0")}`;
}

function formatRaceTotal(seconds) {
  if (!Number.isFinite(seconds) || seconds <= 0) {
    return "--";
  }
  const totalSeconds = Math.round(seconds);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const secs = totalSeconds % 60;
  if (hours > 0) {
    return `${hours}h ${minutes}m ${secs}s`;
  }
  return `${minutes}m ${secs}s`;
}

function getTyreLabel(tyre) {
  const labels = {
    soft: "Soft",
    medium: "Medium",
    hard: "Hard",
    inter: "Inter",
    wet: "Wet",
  };
  return labels[tyre] ?? "Unknown";
}

function computePitWindowLap(tyre, race, safetyRisk, track) {
  const totalLaps = Number(race?.laps) || 50;
  const baseRatio = {
    soft: 0.42,
    medium: 0.50,
    hard: 0.58,
    inter: 0.45,
    wet: 0.38,
  }[tyre] ?? 0.5;

  const riskAdjust = {
    low: 0,
    medium: -0.03,
    high: -0.07,
  }[safetyRisk] ?? 0;

  const trackAdjust = {
    optimal: 0,
    hot: -0.03,
    cold: 0.01,
    green: -0.02,
    damp: -0.06,
    wet: -0.09,
  }[track] ?? 0;

  const ratio = Math.min(0.72, Math.max(0.25, baseRatio + riskAdjust + trackAdjust));
  return Math.round(totalLaps * ratio);
}

function getDegradationCurves(predictedLap, raceLaps) {
  const laps = Number(raceLaps) || 50;
  const seriesSpec = {
    soft: { rate: 0.28, offset: -0.25 },
    medium: { rate: 0.18, offset: 0.0 },
    hard: { rate: 0.1, offset: 0.15 },
    inter: { rate: 0.24, offset: 0.6 },
    wet: { rate: 0.34, offset: 1.1 },
  };
  const curves = {};

  Object.entries(seriesSpec).forEach(([compound, spec]) => {
    curves[compound] = Array.from({ length: laps }, (_, index) => {
      const lap = index + 1;
      const time = predictedLap + spec.offset + index * spec.rate;
      return { lap, time: Number(time.toFixed(3)) };
    });
  });

  return curves;
}

function getPitTimeline(tyre, raceLaps, pitWindowLap, safetyRisk) {
  const laps = Number(raceLaps) || 50;
  let stopCount = { soft: 3, medium: 2, hard: 2, inter: 3, wet: 3 }[tyre] ?? 2;
  if (safetyRisk === "high") {
    stopCount = Math.min(3, stopCount + 1);
  }

  const fractionsByStops = {
    1: [0.56],
    2: [0.5, 0.78],
    3: [0.38, 0.66, 0.84],
  };

  const shift = { low: 0, medium: -0.02, high: -0.05 }[safetyRisk] ?? 0;
  const fractions = fractionsByStops[stopCount] || fractionsByStops[2];
  const pitLaps = [];
  fractions.forEach((fraction, index) => {
    let lap = Math.round(laps * (fraction + shift));
    if (index === 0) {
      lap = Math.max(lap, Number(pitWindowLap) || lap);
    }
    const minLap = pitLaps[index - 1] ? pitLaps[index - 1] + 4 : 4;
    const maxLap = laps - (stopCount - index);
    lap = Math.max(minLap, Math.min(maxLap, lap));
    pitLaps.push(lap);
  });

  const stintByTyre = {
    soft: ["Soft", "Medium", "Hard", "Hard"],
    medium: ["Medium", "Hard", "Hard"],
    hard: ["Hard", "Medium", "Hard"],
    inter: ["Inter", "Medium", "Hard", "Hard"],
    wet: ["Wet", "Inter", "Medium", "Hard"],
  };
  const stintOrder = stintByTyre[tyre] || ["Medium", "Hard", "Hard"];

  const timeline = [];
  let startLap = 1;
  pitLaps.forEach((pitLap, index) => {
    timeline.push({
      compound: stintOrder[Math.min(index, stintOrder.length - 1)],
      start_lap: startLap,
      end_lap: pitLap,
    });
    startLap = pitLap + 1;
  });
  timeline.push({
    compound: stintOrder[Math.min(pitLaps.length, stintOrder.length - 1)],
    start_lap: startLap,
    end_lap: laps,
  });

  return {
    timeline,
    pit_stop_count: pitLaps.length,
    strategy_label: `${pitLaps.length}-STOP`,
  };
}

function getCompoundComparison(predictedLap, raceLaps, safetyRisk, track) {
  const laps = Number(raceLaps) || 50;
  const specs = {
    soft: { offset: -0.25, deg: 0.28, lifeRatio: 0.24 },
    medium: { offset: 0.0, deg: 0.18, lifeRatio: 0.36 },
    hard: { offset: 0.15, deg: 0.1, lifeRatio: 0.52 },
    inter: { offset: 0.6, deg: 0.24, lifeRatio: 0.28 },
    wet: { offset: 1.1, deg: 0.34, lifeRatio: 0.22 },
  };

  const trackDelta = {
    optimal: 0,
    hot: 0.08,
    cold: 0.03,
    green: 0.06,
    damp: 0.12,
    wet: 0.2,
  }[track] ?? 0;

  const riskLifeShift = {
    low: 0,
    medium: -0.03,
    high: -0.06,
  }[safetyRisk] ?? 0;

  const comparison = Object.entries(specs).map(([compound, spec]) => {
    const avg = predictedLap + spec.offset + trackDelta;
    const best = avg - 3.85;
    const life = Math.max(10, Math.min(laps - 1, Math.round(laps * (spec.lifeRatio + riskLifeShift))));
    const optimalStop = Math.max(6, Math.min(laps - 1, Math.round(life * 1.15)));
    return {
      compound,
      avg_lap_seconds: Number(avg.toFixed(3)),
      best_lap_seconds: Number(best.toFixed(3)),
      optimal_stop_lap: optimalStop,
      tyre_life_laps: life,
    };
  });

  const fastestCompound = comparison.reduce((best, current) => (
    current.avg_lap_seconds < best.avg_lap_seconds ? current : best
  )).compound;

  return {
    comparison,
    fastestCompound,
  };
}

function getCopilotAnalysis(tyre, track, safetyRisk, totalDelta, pitWindowLap, fastestCompound) {
  const pacePhrase =
    totalDelta <= -0.2
      ? "expect an advantage versus baseline"
      : totalDelta >= 1.2
        ? "expect a pace deficit versus baseline"
        : "expect near-baseline race pace";

  const trackLabel = {
    optimal: "optimal conditions",
    hot: "very hot asphalt",
    cold: "cold surface",
    green: "green track",
    damp: "damp conditions",
    wet: "wet conditions",
  }[track] || "current conditions";

  const riskLabel = {
    low: "low safety-car risk",
    medium: "medium safety-car risk",
    high: "high safety-car risk",
  }[safetyRisk] || "low safety-car risk";

  const selectedDriver = getSelectedDriver();
  const prefix = selectedDriver?.name ? `${selectedDriver.name}: ` : "";
  const fastestLabel = getTyreLabel(fastestCompound || "medium");
  return `${prefix}On ${getTyreLabel(tyre).toLowerCase()} compound with ${trackLabel}, ${pacePhrase}. With ${riskLabel}, target pit around lap ${pitWindowLap} for undercut coverage. If degradation rises, ${fastestLabel} currently projects as the fastest average alternative.`;
}

function toCompoundKey(label) {
  return String(label || "").trim().toLowerCase();
}

function applyLegendHighlight(selectedTyre) {
  if (!compoundLegendEl) {
    return;
  }
  const classes = ["soft", "medium", "hard", "inter", "wet"];
  classes.forEach((compound) => {
    const pill = compoundLegendEl.querySelector(`.compound-pill.${compound}`);
    if (pill) {
      pill.classList.toggle("active", compound === selectedTyre);
    }
  });
}

function renderDegradationChart(curves) {
  if (!degradationChartEl) {
    return;
  }

  const width = 1180;
  const height = 320;
  const padding = { top: 20, right: 18, bottom: 44, left: 72 };
  const innerWidth = width - padding.left - padding.right;
  const innerHeight = height - padding.top - padding.bottom;

  const compounds = ["soft", "medium", "hard", "inter", "wet"];
  const allSeries = compounds.flatMap((compound) => curves[compound] || []);
  if (!allSeries.length) {
    degradationChartEl.innerHTML = "";
    return;
  }

  const minLap = 1;
  const maxLap = Math.max(...allSeries.map((p) => Number(p.lap || 1)));
  const minTimeRaw = Math.min(...allSeries.map((p) => Number(p.time || 0)));
  const maxTimeRaw = Math.max(...allSeries.map((p) => Number(p.time || 0)));
  const minTime = Math.floor(minTimeRaw - 1);
  const maxTime = Math.ceil(maxTimeRaw + 1);

  const x = (lap) => padding.left + ((lap - minLap) / Math.max(1, (maxLap - minLap))) * innerWidth;
  const y = (time) => padding.top + ((maxTime - time) / Math.max(0.001, (maxTime - minTime))) * innerHeight;

  const makePath = (series) => {
    if (!series || !series.length) {
      return "";
    }
    return series
      .map((point, idx) => `${idx === 0 ? "M" : "L"}${x(Number(point.lap)).toFixed(2)} ${y(Number(point.time)).toFixed(2)}`)
      .join(" ");
  };

  const yTicks = 6;
  const xTicks = Math.min(12, maxLap);
  const grid = [];

  for (let i = 0; i <= yTicks; i += 1) {
    const ratio = i / yTicks;
    const tickTime = maxTime - ratio * (maxTime - minTime);
    const yy = padding.top + ratio * innerHeight;
    grid.push(`<line x1="${padding.left}" y1="${yy}" x2="${width - padding.right}" y2="${yy}" stroke="rgba(255,170,170,0.14)" />`);
    grid.push(`<text x="16" y="${yy + 4}" fill="rgba(255,214,214,0.75)" font-size="11" font-family="Space Grotesk">${formatLapTime(tickTime)}</text>`);
  }

  for (let i = 0; i <= xTicks; i += 1) {
    const ratio = i / Math.max(1, xTicks);
    const tickLap = Math.round(minLap + ratio * (maxLap - minLap));
    const xx = padding.left + ratio * innerWidth;
    grid.push(`<line x1="${xx}" y1="${padding.top}" x2="${xx}" y2="${height - padding.bottom}" stroke="rgba(255,170,170,0.1)" />`);
    grid.push(`<text x="${xx}" y="${height - 16}" text-anchor="middle" fill="rgba(255,214,214,0.72)" font-size="11" font-family="Space Grotesk">${tickLap}</text>`);
  }

  const pathSpec = {
    soft: { color: "#74a8ff", width: 2.2, dash: "7 6" },
    medium: { color: "#f3b300", width: 3.2, dash: "" },
    hard: { color: "#d6d6d6", width: 2.1, dash: "6 7" },
    inter: { color: "#27d2ac", width: 2.4, dash: "9 5" },
    wet: { color: "#8ba4ff", width: 2.4, dash: "2 8" },
  };

  const paths = compounds
    .map((compound) => {
      const series = curves[compound] || [];
      if (!series.length) {
        return "";
      }
      const spec = pathSpec[compound];
      const dashAttr = spec.dash ? `stroke-dasharray="${spec.dash}"` : "";
      return `<path d="${makePath(series)}" fill="none" stroke="${spec.color}" stroke-width="${spec.width}" ${dashAttr} />`;
    })
    .join("");

  degradationChartEl.innerHTML = `
    <rect x="0" y="0" width="${width}" height="${height}" fill="transparent"></rect>
    ${grid.join("")}
    ${paths}
    <text x="${width / 2}" y="${height - 4}" text-anchor="middle" fill="rgba(255,214,214,0.72)" font-size="12" font-family="Space Grotesk">LAP</text>
  `;
}

function renderPitTimeline(timeline, raceLaps, strategyLabel) {
  if (!pitTimelineTrackEl) {
    return;
  }

  const safeTimeline = Array.isArray(timeline) ? timeline : [];
  pitTimelineTrackEl.innerHTML = "";
  const totalLaps = Number(raceLaps) || 50;

  safeTimeline.forEach((segment) => {
    const start = Number(segment.start_lap) || 1;
    const end = Number(segment.end_lap) || start;
    const laps = Math.max(1, end - start + 1);
    const width = (laps / totalLaps) * 100;
    const compoundKey = toCompoundKey(segment.compound);

    const div = document.createElement("div");
    div.className = `timeline-segment ${compoundKey}`;
    div.style.width = `${width}%`;
    div.textContent = segment.compound || "Stint";
    pitTimelineTrackEl.append(div);
  });

  const firstSplit = safeTimeline.length > 1 ? safeTimeline[0].end_lap : Math.round(totalLaps * 0.5);
  timelineStartEl.textContent = "Lap 1";
  timelineMidEl.textContent = `Lap ${firstSplit}`;
  timelineEndEl.textContent = `Lap ${totalLaps}`;
  strategyBadgeEl.textContent = strategyLabel || "--";
}

function showPostSimulationPanel() {
  if (!postSimPanelEl) {
    return;
  }
  postSimPanelEl.classList.remove("hidden");
  postSimPanelEl.classList.add("show");
  revealRequiresPostSimulationScroll = true;
  hasScrolledAfterSimulation = false;
  simulationRevealStartScrollY = window.scrollY || 0;

  document.querySelectorAll(".reveal-on-scroll").forEach((target) => {
    target.classList.remove("in-view");
  });

  registerScrollRevealTargets();
  requestAnimationFrame(() => {
    registerScrollRevealTargets();
  });
}

function setupScrollRevealObserver() {
  if (scrollRevealObserver || !("IntersectionObserver" in window)) {
    return;
  }

  scrollRevealObserver = new IntersectionObserver((entries, observer) => {
    entries.forEach((entry) => {
      if (!entry.isIntersecting) {
        return;
      }

      if (revealRequiresPostSimulationScroll && !hasScrolledAfterSimulation) {
        return;
      }

      entry.target.classList.add("in-view");
      observer.unobserve(entry.target);
    });
  }, {
    threshold: 0.5,
    rootMargin: "0px 0px -4% 0px",
  });
}

function registerScrollRevealTargets() {
  setupScrollRevealObserver();
  const targets = document.querySelectorAll(".reveal-on-scroll");

  targets.forEach((target) => {
    if (target.classList.contains("in-view")) {
      return;
    }

    if (!scrollRevealObserver) {
      target.classList.add("in-view");
      return;
    }

    scrollRevealObserver.observe(target);
  });
}

function renderCompoundComparison(compoundComparison, fastestCompound) {
  if (!compoundComparisonGridEl) {
    return;
  }

  const labels = {
    soft: "Soft (S)",
    medium: "Medium (M)",
    hard: "Hard (H)",
    inter: "Inter (I)",
    wet: "Wet (W)",
  };

  const orderedCompounds = ["hard", "medium", "soft", "inter", "wet"];
  const byCompound = {};
  (compoundComparison || []).forEach((item) => {
    byCompound[String(item.compound || "").toLowerCase()] = item;
  });

  compoundComparisonGridEl.innerHTML = "";

  orderedCompounds.forEach((compound) => {
    const data = byCompound[compound];
    if (!data) {
      return;
    }

    const card = document.createElement("article");
    card.className = `comparison-card ${compound === fastestCompound ? "fastest" : ""}`;
    card.classList.add("intro-reveal");

    card.innerHTML = `
      <div class="comparison-headline">
        <span class="comparison-dot ${compound}"></span>
        <span>${labels[compound]}</span>
        ${compound === fastestCompound ? '<span class="fastest-tag">Fastest Avg</span>' : ""}
      </div>

      <div class="comparison-metric">
        <div class="comparison-metric-label">Avg Lap</div>
        <div class="comparison-metric-value primary">${formatLapTime(data.avg_lap_seconds)}</div>
      </div>

      <div class="comparison-metric">
        <div class="comparison-metric-label">Best Lap</div>
        <div class="comparison-metric-value best">${formatLapTime(data.best_lap_seconds)}</div>
      </div>

      <div class="comparison-metric">
        <div class="comparison-metric-label">Optimal Stop</div>
        <div class="comparison-metric-value">Lap ${data.optimal_stop_lap}</div>
      </div>

      <div class="comparison-metric">
        <div class="comparison-metric-label">Tyre Life</div>
        <div class="comparison-metric-value">${data.tyre_life_laps} laps</div>
      </div>
    `;

    const delayMs = orderedCompounds.indexOf(compound) * 180;
    card.style.animationDelay = `${delayMs}ms`;

    if (compound === fastestCompound) {
      card.classList.add("sun-ray-flash");
      card.style.setProperty("--sun-delay", `${delayMs + 420}ms`);
    }

    compoundComparisonGridEl.append(card);
  });
}

function renderCopilotAnalysis(text) {
  if (!copilotAnalysisTextEl) {
    return;
  }
  copilotAnalysisTextEl.textContent = text || "Run simulation to generate a strategy briefing.";
}

function clearResultRevealTimers() {
  resultRevealTimeouts.forEach((timerId) => {
    clearTimeout(timerId);
  });
  resultRevealTimeouts = [];
}

function animateResultValuesSequentially() {
  const resultValues = [predictedTimeEl, deltaEl, pitWindowEl, raceTotalEl];
  clearResultRevealTimers();

  resultValues.forEach((valueEl) => {
    if (!valueEl) {
      return;
    }
    valueEl.classList.remove("result-reveal");
    void valueEl.offsetWidth;
  });

  const initialDelayMs = 140;
  const staggerMs = 300;
  resultValues.forEach((valueEl, index) => {
    if (!valueEl) {
      return;
    }
    const timerId = setTimeout(() => {
      valueEl.classList.add("result-reveal");
    }, initialDelayMs + (index * staggerMs));
    resultRevealTimeouts.push(timerId);
  });
}

function setActiveTyre(value) {
  simulationData.selectedTyre = value;
  tyreButtons.forEach((button) => {
    const isActive = button.dataset.tyre === value;
    button.classList.toggle("active", isActive);
    button.setAttribute("aria-pressed", isActive ? "true" : "false");
  });
}

function populateDriverDropdown(drivers) {
  const sortedDrivers = [...drivers].sort((a, b) => (a.position ?? 99) - (b.position ?? 99));
  targetDriverSelect.replaceChildren();

  const placeholder = document.createElement("option");
  placeholder.value = "";
  placeholder.textContent = "Select driver";
  placeholder.disabled = true;
  placeholder.selected = true;
  targetDriverSelect.append(placeholder);

  sortedDrivers.forEach((driver) => {
    const option = document.createElement("option");
    option.value = String(driver.id);
    option.textContent = `#${driver.number} ${driver.name} - ${driver.team}`;
    targetDriverSelect.append(option);
  });
}

function populateCircuitDropdown(races) {
  targetCircuitSelect.replaceChildren();

  const placeholder = document.createElement("option");
  placeholder.value = "";
  placeholder.textContent = "Select circuit";
  placeholder.disabled = true;
  placeholder.selected = true;
  targetCircuitSelect.append(placeholder);

  races.forEach((race) => {
    const option = document.createElement("option");
    option.value = String(race.round ?? race.circuit_key ?? race.circuit);
    option.dataset.circuitKey = race.circuit_key || String(race.circuit || "").toLowerCase();
    option.textContent = formatCircuitLabel(race);
    targetCircuitSelect.append(option);
  });
}

function getSelectedDriver() {
  const selectedId = Number(targetDriverSelect.value);
  return simulationData.drivers.find((driver) => driver.id === selectedId) ?? null;
}

function getSelectedRace() {
  const selectedRound = Number(targetCircuitSelect.value);
  if (Number.isFinite(selectedRound)) {
    return simulationData.races.find((race) => race.round === selectedRound) ?? null;
  }
  return simulationData.races[0] ?? null;
}

function getDriverDelta(driver) {
  if (!driver || !Number.isFinite(driver.position)) {
    return 0;
  }
  const baselinePosition = 10;
  const stepPerPosition = 0.06;
  return (driver.position - baselinePosition) * stepPerPosition;
}

async function initializeApp() {
  pitMetaEl.textContent = "Loading setup data...";

  try {
    const healthRes = await fetch(`${API_BASE}/health`);
    if (!healthRes.ok) {
      throw new Error("Backend server is unavailable");
    }

    const configRes = await fetch(`${API_BASE}/race-config`);
    if (configRes.ok) {
      const config = await configRes.json();
      simulationData.drivers = config.drivers?.length ? config.drivers : fallbackDrivers;
      simulationData.races = config.races?.length ? config.races : fallbackRaces;
      populateDriverDropdown(simulationData.drivers);
      populateCircuitDropdown(simulationData.races);
    } else {
      const [driverRes, racesRes] = await Promise.all([
        fetch(`${API_BASE}/drivers`),
        fetch(`${API_BASE}/races`),
      ]);

      simulationData.drivers = driverRes.ok ? await driverRes.json() : fallbackDrivers;
      simulationData.races = racesRes.ok ? await racesRes.json() : fallbackRaces;
      populateDriverDropdown(simulationData.drivers);
      populateCircuitDropdown(simulationData.races);
    }

    pitMetaEl.textContent = "Undercut window";
  } catch (error) {
    console.error("Initialization failed, falling back to local mode:", error);
    simulationData.drivers = fallbackDrivers;
    simulationData.races = fallbackRaces;
    populateDriverDropdown(simulationData.drivers);
    populateCircuitDropdown(simulationData.races);
    pitMetaEl.textContent = "Local mode active";
  }
}

function localFallbackSimulation(baseLap, tyre, track, safetyRisk, race, driverDelta = 0) {
  const normalizedCircuit = String(race?.circuit_key || race?.circuit || "").toLowerCase().replaceAll(" ", "-");
  const raceLaps = Number(race?.laps) || 50;
  const totalDelta =
    (tyreImpact[tyre] ?? 0) +
    (trackImpact[track] ?? 0) +
    (safetyImpact[safetyRisk] ?? 0) +
    (circuitImpact[normalizedCircuit] ?? 0) +
    driverDelta;

  const pitTimeline = getPitTimeline(
    tyre,
    raceLaps,
    computePitWindowLap(tyre, race, safetyRisk, track),
    safetyRisk,
  );
  const compoundComparison = getCompoundComparison(baseLap + totalDelta, raceLaps, safetyRisk, track);
  const copilotAnalysis = getCopilotAnalysis(
    tyre,
    track,
    safetyRisk,
    totalDelta,
    computePitWindowLap(tyre, race, safetyRisk, track),
    compoundComparison.fastestCompound,
  );

  return {
    predicted_lap: Number((baseLap + totalDelta).toFixed(2)),
    total_delta: Number(totalDelta.toFixed(2)),
    pit_window_lap: computePitWindowLap(tyre, race, safetyRisk, track),
    race_total_seconds: Number(((baseLap + totalDelta) * raceLaps).toFixed(2)),
    race_laps: raceLaps,
    pit_window_reason: "Undercut window",
    degradation_curves: getDegradationCurves(baseLap + totalDelta, raceLaps),
    pit_strategy_timeline: pitTimeline.timeline,
    pit_stop_count: pitTimeline.pit_stop_count,
    strategy_label: pitTimeline.strategy_label,
    compound_comparison: compoundComparison.comparison,
    fastest_compound: compoundComparison.fastestCompound,
    copilot_analysis: copilotAnalysis,
  };
}

async function runSimulation() {
  const baseLap = Number(baseLapInput.value);
  const track = trackSelect.value;
  const safetyRisk = safetyCarSelect.value;
  const selectedTyre = simulationData.selectedTyre;
  const selectedDriver = getSelectedDriver();
  const selectedRace = getSelectedRace();
  const driverDelta = getDriverDelta(selectedDriver);

  if (!Number.isFinite(baseLap) || baseLap <= 0) {
    pitMetaEl.textContent = "Enter a valid base lap time.";
    return;
  }

  if (!targetDriverSelect.value || !targetCircuitSelect.value || !track || !safetyRisk) {
    pitMetaEl.textContent = "Select driver, circuit, track condition, and safety risk.";
    return;
  }

  runBtn.disabled = true;
  runBtn.textContent = "Running...";

  try {
    const response = await fetch(`${API_BASE}/simulate/lap`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        base_lap: baseLap,
        tyre_compound: selectedTyre,
        track_condition: track,
        safety_car_risk: safetyRisk,
        round: selectedRace?.round,
        circuit: selectedRace?.circuit_key || selectedRace?.circuit,
        driver_id: selectedDriver?.id,
      }),
    });

    if (!response.ok) {
      throw new Error(`API error: ${response.status}`);
    }

    const data = await response.json();
    const backendSelectedDriver = data.selected_driver || selectedDriver;
    updateUI(
      data.predicted_lap,
      data.total_delta,
      data.pit_window_lap,
      data.race_total_seconds,
      data.race_laps,
      data.pit_window_reason,
      selectedTyre,
      backendSelectedDriver,
      {
        degradationCurves: data.degradation_curves,
        pitStrategyTimeline: data.pit_strategy_timeline,
        strategyLabel: data.strategy_label,
        compoundComparison: data.compound_comparison,
        fastestCompound: data.fastest_compound,
        copilotAnalysis: data.copilot_analysis,
      },
    );
  } catch (error) {
    console.warn("API call failed, using local fallback:", error);
    const fallback = localFallbackSimulation(
      baseLap,
      selectedTyre,
      track,
      safetyRisk,
      selectedRace,
      driverDelta,
    );
    updateUI(
      fallback.predicted_lap,
      fallback.total_delta,
      fallback.pit_window_lap,
      fallback.race_total_seconds,
      fallback.race_laps,
      fallback.pit_window_reason,
      selectedTyre,
      selectedDriver,
      {
        degradationCurves: fallback.degradation_curves,
        pitStrategyTimeline: fallback.pit_strategy_timeline,
        strategyLabel: fallback.strategy_label,
        compoundComparison: fallback.compound_comparison,
        fastestCompound: fallback.fastest_compound,
        copilotAnalysis: fallback.copilot_analysis,
      },
    );
  } finally {
    runBtn.disabled = false;
    runBtn.textContent = "Run Simulation";
  }
}

function updateUI(
  predictedLap,
  totalDelta,
  pitWindowLap,
  raceTotalSeconds,
  raceLaps,
  pitWindowReason,
  tyre,
  selectedDriver,
  analysisData,
) {
  predictedTimeEl.textContent = formatLapTime(predictedLap);
  predictedMetaEl.textContent = `${selectedDriver?.name ?? "Driver"} - ${getTyreLabel(tyre)} at peak`;

  deltaEl.textContent = `${totalDelta > 0 ? "+" : ""}${totalDelta.toFixed(3)}s`;
  deltaEl.classList.remove("positive", "negative");
  deltaEl.classList.add(totalDelta > 0 ? "positive" : "negative");
  deltaMetaEl.textContent = "vs dry baseline";

  pitWindowEl.textContent = `Lap ${pitWindowLap ?? "--"}`;
  pitMetaEl.textContent = pitWindowReason || "Undercut window";

  raceTotalEl.textContent = formatRaceTotal(raceTotalSeconds);
  raceMetaEl.textContent = `${raceLaps ?? "--"} laps`;

  const degradationCurves = analysisData?.degradationCurves || getDegradationCurves(predictedLap, raceLaps);
  const pitStrategyTimeline = analysisData?.pitStrategyTimeline || [];
  const strategyLabel = analysisData?.strategyLabel || "--";
  const localComparison = getCompoundComparison(predictedLap, raceLaps, safetyCarSelect.value, trackSelect.value);
  const compoundComparison = analysisData?.compoundComparison || localComparison.comparison;
  const fastestCompound = analysisData?.fastestCompound || localComparison.fastestCompound;
  const copilotAnalysis = analysisData?.copilotAnalysis
    || getCopilotAnalysis(
      tyre,
      trackSelect.value,
      safetyCarSelect.value,
      totalDelta,
      pitWindowLap,
      fastestCompound,
    );
  applyLegendHighlight(tyre);
  renderDegradationChart(degradationCurves);
  renderPitTimeline(pitStrategyTimeline, raceLaps, strategyLabel);
  renderCompoundComparison(compoundComparison, fastestCompound);
  renderCopilotAnalysis(copilotAnalysis);
  animateResultValuesSequentially();
  showPostSimulationPanel();
}

function resetSimulationUI() {
  clearResultRevealTimers();

  baseLapInput.value = "";

  if (targetDriverSelect.options.length) {
    targetDriverSelect.selectedIndex = 0;
  }
  if (targetCircuitSelect.options.length) {
    targetCircuitSelect.selectedIndex = 0;
  }
  if (trackSelect.options.length) {
    trackSelect.selectedIndex = 0;
  }
  if (safetyCarSelect.options.length) {
    safetyCarSelect.selectedIndex = 0;
  }

  setActiveTyre("soft");

  [predictedTimeEl, deltaEl, pitWindowEl, raceTotalEl].forEach((el) => {
    el.classList.remove("result-reveal");
  });

  predictedTimeEl.textContent = "--";
  predictedMetaEl.textContent = "Tyre setup";
  deltaEl.textContent = "--";
  deltaEl.classList.remove("positive", "negative");
  deltaMetaEl.textContent = "vs dry baseline";
  pitWindowEl.textContent = "--";
  pitMetaEl.textContent = "Undercut window";
  raceTotalEl.textContent = "--";
  raceMetaEl.textContent = "-- laps";

  degradationChartEl.innerHTML = "";
  pitTimelineTrackEl.innerHTML = "";
  strategyBadgeEl.textContent = "--";
  timelineStartEl.textContent = "Lap 1";
  timelineMidEl.textContent = "Lap --";
  timelineEndEl.textContent = "Lap --";
  compoundComparisonGridEl.innerHTML = "";
  renderCopilotAnalysis("Run simulation to generate a strategy briefing.");
  applyLegendHighlight("soft");

  revealRequiresPostSimulationScroll = false;
  hasScrolledAfterSimulation = false;
  simulationRevealStartScrollY = window.scrollY || 0;

  document.querySelectorAll(".reveal-on-scroll").forEach((target) => {
    target.classList.remove("in-view");
  });

  postSimPanelEl.classList.remove("show");
  postSimPanelEl.classList.add("hidden");

  runBtn.disabled = false;
  runBtn.textContent = "Run Simulation";
}

tyreButtons.forEach((button) => {
  button.addEventListener("click", () => {
    setActiveTyre(button.dataset.tyre);
  });
});

runBtn.addEventListener("click", runSimulation);
if (resetBtn) {
  resetBtn.addEventListener("click", resetSimulationUI);
}

window.addEventListener("DOMContentLoaded", () => {
  setActiveTyre("soft");
  registerScrollRevealTargets();

  window.addEventListener("scroll", () => {
    if (!revealRequiresPostSimulationScroll || hasScrolledAfterSimulation) {
      return;
    }

    const scrollDelta = Math.abs((window.scrollY || 0) - simulationRevealStartScrollY);
    if (scrollDelta < 24) {
      return;
    }

    hasScrolledAfterSimulation = true;
    registerScrollRevealTargets();
  }, { passive: true });

  initializeApp();
});
