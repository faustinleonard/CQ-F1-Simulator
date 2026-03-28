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

const baseLapInput = document.getElementById("baseLap");
const tireSelect = document.getElementById("tireCondition");
const trackSelect = document.getElementById("trackCondition");
const runBtn = document.getElementById("simulateBtn");
const predictedTimeEl = document.getElementById("predictedTime");
const deltaEl = document.getElementById("timeDelta");
const strategyNoteEl = document.getElementById("strategyNote");

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

function runSimulation() {
  const baseLap = Number(baseLapInput.value);
  const tire = tireSelect.value;
  const track = trackSelect.value;

  if (!Number.isFinite(baseLap) || baseLap <= 0) {
    strategyNoteEl.textContent = "Enter a valid base lap time before simulation.";
    return;
  }

  const tireDelta = tireImpact[tire] ?? 0;
  const trackDelta = trackImpact[track] ?? 0;
  const totalDelta = tireDelta + trackDelta;
  const predictedLap = baseLap + totalDelta;

  predictedTimeEl.textContent = `${predictedLap.toFixed(2)} s`;
  deltaEl.textContent = `${totalDelta > 0 ? "+" : ""}${totalDelta.toFixed(2)} s`;
  deltaEl.classList.remove("positive", "negative");
  deltaEl.classList.add(totalDelta > 0 ? "positive" : "negative");

  strategyNoteEl.textContent = getStrategyNote(tire, track, totalDelta);
}

runBtn.addEventListener("click", runSimulation);

[tireSelect, trackSelect, baseLapInput].forEach((el) => {
  el.addEventListener("change", runSimulation);
});

runSimulation();
