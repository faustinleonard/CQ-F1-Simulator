// API Configuration
const API_BASE = "http://localhost:5000/api";

// DOM Elements
const baseLapInput = document.getElementById("baseLap");
const trackSelect = document.getElementById("trackCondition");
const safetyCarSelect = document.getElementById("safetyCarRisk");
const targetDriverSelect = document.getElementById("targetDriver");
const targetCircuitSelect = document.getElementById("targetCircuit");
const runBtn = document.getElementById("simulateBtn");
const tyreButtons = Array.from(document.querySelectorAll(".tyre-btn"));
const predictedTimeEl = document.getElementById("predictedTime");
const predictedMetaEl = document.getElementById("predictedMeta");
const deltaEl = document.getElementById("timeDelta");
const deltaMetaEl = document.getElementById("deltaMeta");
const pitWindowEl = document.getElementById("pitWindow");
const pitMetaEl = document.getElementById("pitMeta");
const raceTotalEl = document.getElementById("raceTotal");
const raceMetaEl = document.getElementById("raceMeta");

// State
const simulationData = {
  drivers: [],
  races: [],
  selectedTyre: "soft",
};

const fallbackDrivers = [
  { id: 1, name: "Max Verstappen", number: 1, team: "Red Bull", position: 1 },
  { id: 2, name: "Lando Norris", number: 4, team: "McLaren", position: 2 },
  { id: 3, name: "Lewis Hamilton", number: 44, team: "Mercedes", position: 3 },
  { id: 4, name: "Charles Leclerc", number: 16, team: "Ferrari", position: 4 },
  { id: 5, name: "George Russell", number: 63, team: "Mercedes", position: 5 },
  { id: 6, name: "Oscar Piastri", number: 81, team: "McLaren", position: 6 },
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
  sortedDrivers.forEach((driver) => {
    const option = document.createElement("option");
    option.value = String(driver.id);
    option.textContent = `#${driver.number} ${driver.name} - ${driver.team}`;
    targetDriverSelect.append(option);
  });
}

function populateCircuitDropdown(races) {
  targetCircuitSelect.replaceChildren();
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
  const baselinePosition = 5;
  const stepPerPosition = 0.12;
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

    const monacoRace = simulationData.races.find((race) => {
      const circuitName = String(race.circuit || "").toLowerCase();
      return circuitName.includes("monaco");
    });
    if (monacoRace?.round) {
      targetCircuitSelect.value = String(monacoRace.round);
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

  return {
    predicted_lap: Number((baseLap + totalDelta).toFixed(2)),
    total_delta: Number(totalDelta.toFixed(2)),
    pit_window_lap: computePitWindowLap(tyre, race, safetyRisk, track),
    race_total_seconds: Number(((baseLap + totalDelta) * raceLaps).toFixed(2)),
    race_laps: raceLaps,
    pit_window_reason: "Undercut window",
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
    updateUI(
      data.predicted_lap + driverDelta,
      data.total_delta + driverDelta,
      data.pit_window_lap,
      data.race_total_seconds,
      data.race_laps,
      data.pit_window_reason,
      selectedTyre,
      selectedDriver,
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
) {
  predictedTimeEl.textContent = formatLapTime(predictedLap);
  predictedMetaEl.textContent = `${getTyreLabel(tyre)} (${selectedDriver?.number ?? "--"}) at peak`;

  deltaEl.textContent = `${totalDelta > 0 ? "+" : ""}${totalDelta.toFixed(3)}s`;
  deltaEl.classList.remove("positive", "negative");
  deltaEl.classList.add(totalDelta > 0 ? "positive" : "negative");
  deltaMetaEl.textContent = "vs dry baseline";

  pitWindowEl.textContent = `Lap ${pitWindowLap ?? "--"}`;
  pitMetaEl.textContent = pitWindowReason || "Undercut window";

  raceTotalEl.textContent = formatRaceTotal(raceTotalSeconds);
  raceMetaEl.textContent = `${raceLaps ?? "--"} laps`;
}

tyreButtons.forEach((button) => {
  button.addEventListener("click", () => {
    setActiveTyre(button.dataset.tyre);
  });
});

runBtn.addEventListener("click", runSimulation);
window.addEventListener("DOMContentLoaded", () => {
  setActiveTyre("soft");
  initializeApp();
});
