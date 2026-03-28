// API Configuration
const API_BASE = "http://localhost:5000/api";

// DOM Elements
const baseLapInput = document.getElementById("baseLap");
const tireSelect = document.getElementById("tireCondition");
const trackSelect = document.getElementById("trackCondition");
const runBtn = document.getElementById("simulateBtn");
const predictedTimeEl = document.getElementById("predictedTime");
const deltaEl = document.getElementById("timeDelta");
const strategyNoteEl = document.getElementById("strategyNote");

// State
let simulationData = {
  tire_impact: {},
  track_impact: {},
};

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

    // The backend has hardcoded tire/track impacts in the RaceSimulator class.
    // We can fetch sample data to validate connection.
    const raceRes = await fetch(`${API_BASE}/races`);
    if (raceRes.ok) {
      const races = await raceRes.json();
      console.log(`✓ Connected to backend. ${races.length} races loaded.`);
    }

    runSimulation();
  } catch (error) {
    console.error("Failed to initialize app:", error);
    strategyNoteEl.textContent =
      "⚠️ Backend unavailable. Using local simulation mode.";
  }
}

/**
 * Get strategy note based on tire, track, and delta.
 */
function getStrategyNote(tire, track, delta) {
  if (track === "wet" && tire !== "wet") {
    return "Wet track and wrong tire: high risk, plan an immediate pit stop.";
  }

  if (track === "damp" && tire !== "intermediate" && tire !== "wet") {
    return "Damp conditions favor intermediate tires for safer pace.";
  }

  if (delta <= 0) {
    return "Current setup is competitive. Extend the stint if tire wear allows.";
  }

  if (delta > 2) {
    return "Lap time loss is significant. Undercut window may be opening.";
  }

  return "Pace is acceptable, but monitor degradation and track evolution.";
}

/**
 * Run simulation via backend API or fallback to local calculation.
 */
async function runSimulation() {
  const baseLap = Number(baseLapInput.value);
  const tire = tireSelect.value;
  const track = trackSelect.value;

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
    updateUI(data.predicted_lap, data.total_delta, tire, track);
  } catch (error) {
    console.warn("API call failed, using local simulation:", error);
    localFallbackSimulation(baseLap, tire, track);
  }
}

/**
 * Local fallback simulation (no backend required).
 */
function localFallbackSimulation(baseLap, tire, track) {
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
  const totalDelta = tireDelta + trackDelta;
  const predictedLap = baseLap + totalDelta;

  updateUI(predictedLap, totalDelta, tire, track);
}

/**
 * Update UI with simulation results.
 */
function updateUI(predictedLap, totalDelta, tire, track) {
  predictedTimeEl.textContent = `${predictedLap.toFixed(2)} s`;
  deltaEl.textContent = `${totalDelta > 0 ? "+" : ""}${totalDelta.toFixed(2)} s`;
  deltaEl.classList.remove("positive", "negative");
  deltaEl.classList.add(totalDelta > 0 ? "positive" : "negative");

  strategyNoteEl.textContent = getStrategyNote(tire, track, totalDelta);
}

// Event Listeners
runBtn.addEventListener("click", runSimulation);

[tireSelect, trackSelect, baseLapInput].forEach((el) => {
  el.addEventListener("change", runSimulation);
});

// Initialize app on load
window.addEventListener("DOMContentLoaded", initializeApp);
