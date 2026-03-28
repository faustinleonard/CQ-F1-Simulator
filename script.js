// API Configuration
const API_BASE = "http://localhost:5000/api";

// DOM Elements
const baseLapInput = document.getElementById("baseLap");
const tireSelect = document.getElementById("tireCondition");
const trackSelect = document.getElementById("trackCondition");
const targetDriverSelect = document.getElementById("targetDriver");
const runBtn = document.getElementById("simulateBtn");
const predictedTimeEl = document.getElementById("predictedTime");
const deltaEl = document.getElementById("timeDelta");
const strategyNoteEl = document.getElementById("strategyNote");

// State
let simulationData = {
  drivers: [],
};

const fallbackDrivers = [
  { id: 1, name: "Max Verstappen", number: 1, team: "Red Bull Racing", position: 1 },
  { id: 2, name: "Lando Norris", number: 4, team: "McLaren", position: 2 },
  { id: 3, name: "Lewis Hamilton", number: 44, team: "Mercedes", position: 3 },
  { id: 4, name: "Carlos Sainz", number: 55, team: "Ferrari", position: 4 },
  { id: 5, name: "Charles Leclerc", number: 16, team: "Ferrari", position: 5 },
  { id: 6, name: "Oscar Piastri", number: 81, team: "McLaren", position: 6 },
  { id: 7, name: "George Russell", number: 63, team: "Mercedes", position: 7 },
  { id: 8, name: "Fernando Alonso", number: 14, team: "Aston Martin", position: 8 },
];

function populateDriverDropdown(drivers) {
  const sortedDrivers = [...drivers].sort((a, b) => {
    const aPos = Number.isFinite(a.position) ? a.position : Number.MAX_SAFE_INTEGER;
    const bPos = Number.isFinite(b.position) ? b.position : Number.MAX_SAFE_INTEGER;
    return aPos - bPos;
  });

  targetDriverSelect.replaceChildren();

  sortedDrivers.forEach((driver) => {
    const option = document.createElement("option");
    option.value = String(driver.id);
    option.textContent = `#${driver.number} ${driver.name} (${driver.team})`;
    targetDriverSelect.append(option);
  });
}

function getSelectedDriver() {
  const selectedId = Number(targetDriverSelect.value);
  return simulationData.drivers.find((driver) => driver.id === selectedId) ?? null;
}

function getDriverDelta(driver) {
  if (!driver || !Number.isFinite(driver.position)) {
    return 0;
  }

  // Better championship position implies slightly faster expected pace.
  const baselinePosition = 4;
  const stepPerPosition = 0.12;
  return (driver.position - baselinePosition) * stepPerPosition;
}

/**
 * Initialize app by fetching reference data from backend.
 */
async function initializeApp() {
  try {
    // Check backend health
    const healthRes = await fetch(`${API_BASE}/health`);
    if (!healthRes.ok) {
      throw new Error("Backend server is not running");
    }

    strategyNoteEl.textContent = "Fetching simulation data...";

    const [driverRes, raceRes] = await Promise.all([
      fetch(`${API_BASE}/drivers`),
      fetch(`${API_BASE}/races`),
    ]);

    if (driverRes.ok) {
      simulationData.drivers = await driverRes.json();
      if (simulationData.drivers.length > 0) {
        populateDriverDropdown(simulationData.drivers);
      }
    }

    if (simulationData.drivers.length === 0) {
      simulationData.drivers = fallbackDrivers;
      populateDriverDropdown(simulationData.drivers);
    }

    if (raceRes.ok) {
      const races = await raceRes.json();
      console.log(`✓ Connected to backend. ${races.length} races loaded.`);
    }

  } catch (error) {
    console.error("Failed to initialize app:", error);
    strategyNoteEl.textContent =
      "⚠️ Backend unavailable. Using local simulation mode.";

    simulationData.drivers = fallbackDrivers;
    populateDriverDropdown(simulationData.drivers);
  }
}

/**
 * Get strategy note based on tire, track, and delta.
 */
function getStrategyNote(tire, track, delta, driverName) {
  const prefix = driverName ? `${driverName}: ` : "";

  if (track === "wet" && tire !== "wet") {
    return `${prefix}Wet track and wrong tire: high risk, plan an immediate pit stop.`;
  }

  if (track === "damp" && tire !== "intermediate" && tire !== "wet") {
    return `${prefix}Damp conditions favor intermediate tires for safer pace.`;
  }

  if (delta <= 0) {
    return `${prefix}Current setup is competitive. Extend the stint if tire wear allows.`;
  }

  if (delta > 2) {
    return `${prefix}Lap time loss is significant. Undercut window may be opening.`;
  }

  return `${prefix}Pace is acceptable, but monitor degradation and track evolution.`;
}

/**
 * Run simulation via backend API or fallback to local calculation.
 */
async function runSimulation() {
  const baseLap = Number(baseLapInput.value);
  const tire = tireSelect.value;
  const track = trackSelect.value;
  const selectedDriver = getSelectedDriver();
  const driverDelta = getDriverDelta(selectedDriver);

  if (!Number.isFinite(baseLap) || baseLap <= 0) {
    strategyNoteEl.textContent = "Enter a valid base lap time before simulation.";
    return;
  }

  try {
    // Call backend API for lap time simulation
    const response = await fetch(`${API_BASE}/simulate/lap`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        base_lap: baseLap,
        tire_condition: tire,
        track_condition: track,
      }),
    });

    if (!response.ok) {
      throw new Error(`API error: ${response.status}`);
    }

    const data = await response.json();
    updateUI(
      data.predicted_lap + driverDelta,
      data.total_delta + driverDelta,
      tire,
      track,
      selectedDriver?.name,
    );
  } catch (error) {
    console.warn("API call failed, using local simulation:", error);
    localFallbackSimulation(baseLap, tire, track, selectedDriver?.name, driverDelta);
  }
}

/**
 * Local fallback simulation (no backend required).
 */
function localFallbackSimulation(baseLap, tire, track, driverName, driverDelta = 0) {
  const tireImpact = {
    new_soft: -0.8,
    new_medium: -0.25,
    new_hard: 0.2,
    worn_soft: 1.4,
    worn_medium: 0.9,
    worn_hard: 0.55,
    intermediate: 2.0,
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

  const tireDelta = tireImpact[tire] ?? 0;
  const trackDelta = trackImpact[track] ?? 0;
  const totalDelta = tireDelta + trackDelta + driverDelta;
  const predictedLap = baseLap + totalDelta;

  updateUI(predictedLap, totalDelta, tire, track, driverName);
}

/**
 * Update UI with simulation results.
 */
function updateUI(predictedLap, totalDelta, tire, track, driverName) {
  predictedTimeEl.textContent = `${predictedLap.toFixed(2)} s`;
  deltaEl.textContent = `${totalDelta > 0 ? "+" : ""}${totalDelta.toFixed(2)} s`;
  deltaEl.classList.remove("positive", "negative");
  deltaEl.classList.add(totalDelta > 0 ? "positive" : "negative");

  strategyNoteEl.textContent = getStrategyNote(tire, track, totalDelta, driverName);
}

// Event Listeners
runBtn.addEventListener("click", runSimulation);

// Initialize app on load
window.addEventListener("DOMContentLoaded", initializeApp);
