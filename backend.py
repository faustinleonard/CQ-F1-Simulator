"""
F1 What-If Race Simulator Backend
Serves race data and computes predictions based on tire/track conditions.
"""

from flask import Flask, jsonify, request
from flask_cors import CORS
import pandas as pd
import os
from datetime import datetime
import json

app = Flask(__name__)
CORS(app)

# ============================================================================
# DATA MODELS & INITIALIZATION
# ============================================================================

class RaceSimulator:
    """Core simulation engine for F1 race scenarios."""
    
    def __init__(self):
        self.tire_impact = {
            "new_soft": -0.8,
            "new_medium": -0.25,
            "new_hard": 0.2,
            "worn_soft": 1.4,
            "worn_medium": 0.9,
            "worn_hard": 0.55,
            "intermediate": 2.0,
            "wet": 3.8,
        }
        
        self.track_impact = {
            "optimal": -0.4,
            "hot": 0.7,
            "cold": 0.45,
            "green": 1.0,
            "damp": 2.4,
            "wet": 5.2,
        }

        self.tyre_compound_map = {
            "soft": "new_soft",
            "medium": "new_medium",
            "hard": "new_hard",
            "inter": "intermediate",
            "wet": "wet",
        }

        self.safety_car_risk_impact = {
            "low": 0.0,
            "medium": 0.35,
            "high": 0.85,
        }

        self.circuit_impact = {
            "monaco": 1.8,
            "monza": -1.0,
            "silverstone": -0.4,
            "spa-francorchamps": -0.2,
            "suzuka": -0.15,
            "bahrain": 0.5,
            "jeddah": 0.25,
            "albert-park": 0.4,
            "shanghai": 0.3,
        }
        
        self.strategies = self._load_strategies()

    def normalize_tire(self, tire=None, tyre_compound=None):
        """Normalize legacy tire conditions and UI tyre compounds."""
        if tyre_compound:
            return self.tyre_compound_map.get(str(tyre_compound).lower(), str(tyre_compound).lower())
        if tire:
            return str(tire).lower()
        return "new_medium"

    def normalize_safety_risk(self, safety_car_risk):
        """Normalize safety car risk labels to expected keys."""
        normalized = str(safety_car_risk or "low").strip().lower()
        return normalized if normalized in self.safety_car_risk_impact else "low"

    def normalize_circuit_key(self, circuit):
        """Get a normalized circuit key used in circuit_impact."""
        if not circuit:
            return ""
        normalized = str(circuit).strip().lower().replace("_", "-").replace(" ", "-")
        return normalized

    def calculate_driver_delta(self, driver_position):
        """Estimate pace delta from championship position."""
        if driver_position is None:
            return 0.0
        baseline_position = 10
        step_per_position = 0.06
        return (float(driver_position) - baseline_position) * step_per_position
    
    def _load_strategies(self):
        """Load predefined pit stop strategies."""
        return {
            "aggressive": {
                "pit_stops": 2,
                "fuel_load": 0.85,
                "description": "Early stops, high pace."
            },
            "balanced": {
                "pit_stops": 2,
                "fuel_load": 0.90,
                "description": "Standard strategy."
            },
            "conservative": {
                "pit_stops": 1,
                "fuel_load": 1.0,
                "description": "One stop, fuel management."
            },
            "undercut": {
                "pit_stops": 2,
                "fuel_load": 0.75,
                "description": "Early stop for undercut."
            }
        }
    
    def predict_lap_time(self, base_lap, tire, track, safety_car_risk="low", circuit=""):
        """Predict adjusted lap time from conditions."""
        tire_delta = self.tire_impact.get(tire, 0)
        track_delta = self.track_impact.get(track, 0)
        safety_key = self.normalize_safety_risk(safety_car_risk)
        safety_car_delta = self.safety_car_risk_impact[safety_key]
        circuit_key = self.normalize_circuit_key(circuit)
        circuit_delta = self.circuit_impact.get(circuit_key, 0)
        adjusted_lap = base_lap + tire_delta + track_delta + safety_car_delta + circuit_delta
        return {
            "base_lap": base_lap,
            "circuit": circuit,
            "circuit_delta": circuit_delta,
            "tire_delta": tire_delta,
            "track_delta": track_delta,
            "safety_car_risk": safety_key,
            "safety_car_delta": safety_car_delta,
            "total_delta": tire_delta + track_delta + safety_car_delta + circuit_delta,
            "predicted_lap": round(adjusted_lap, 2)
        }

    def estimate_pit_window_lap(self, tyre_compound, race_laps, safety_car_risk, track):
        """Estimate first pit window lap based on setup conditions."""
        base_ratio = {
            "soft": 0.42,
            "medium": 0.50,
            "hard": 0.58,
            "inter": 0.45,
            "wet": 0.38,
        }.get(str(tyre_compound or "medium").lower(), 0.50)

        risk_adjust = {
            "low": 0.0,
            "medium": -0.03,
            "high": -0.07,
        }.get(self.normalize_safety_risk(safety_car_risk), 0.0)

        track_adjust = {
            "optimal": 0.0,
            "hot": -0.03,
            "cold": 0.01,
            "green": -0.02,
            "damp": -0.06,
            "wet": -0.09,
        }.get(str(track or "optimal").lower(), 0.0)

        ratio = max(0.25, min(0.72, base_ratio + risk_adjust + track_adjust))
        return max(1, int(round(race_laps * ratio)))

    def build_degradation_curves(self, base_predicted_lap, race_laps):
        """Build lap-by-lap degradation curves for soft/medium/hard compounds."""
        race_laps = max(1, int(race_laps))
        rates = {
            "soft": 0.28,
            "medium": 0.18,
            "hard": 0.10,
            "inter": 0.24,
            "wet": 0.34,
        }
        initial_offset = {
            "soft": -0.25,
            "medium": 0.0,
            "hard": 0.15,
            "inter": 0.6,
            "wet": 1.1,
        }

        curves = {}
        for compound, rate in rates.items():
            points = []
            for lap in range(1, race_laps + 1):
                lap_time = base_predicted_lap + initial_offset[compound] + (lap - 1) * rate
                points.append({"lap": lap, "time": round(lap_time, 3)})
            curves[compound] = points
        return curves

    def build_pit_timeline(self, tyre_compound, race_laps, pit_window_lap, safety_car_risk):
        """Build a pit strategy timeline describing stints and compounds."""
        race_laps = max(1, int(race_laps))
        compound = str(tyre_compound or "medium").lower()
        safety_key = self.normalize_safety_risk(safety_car_risk)

        planned_stops = {
            "soft": 3,
            "medium": 2,
            "hard": 2,
            "inter": 3,
            "wet": 3,
        }.get(compound, 2)

        if safety_key == "high":
            planned_stops = min(3, planned_stops + 1)

        stop_fractions = {
            1: [0.56],
            2: [0.50, 0.78],
            3: [0.38, 0.66, 0.84],
        }
        fractions = stop_fractions.get(planned_stops, stop_fractions[2])

        safety_shift = {
            "low": 0.0,
            "medium": -0.02,
            "high": -0.05,
        }[safety_key]

        pit_laps = []
        for idx, fraction in enumerate(fractions):
            base_lap = int(round(race_laps * (fraction + safety_shift)))
            if idx == 0:
                base_lap = max(base_lap, int(pit_window_lap))
            floor_lap = pit_laps[-1] + 4 if pit_laps else 4
            cap_lap = race_laps - (planned_stops - idx)
            pit_laps.append(max(floor_lap, min(cap_lap, base_lap)))

        stint_order = {
            "soft": ["Soft", "Medium", "Hard", "Hard"],
            "medium": ["Medium", "Hard", "Hard"],
            "hard": ["Hard", "Medium", "Hard"],
            "inter": ["Inter", "Medium", "Hard", "Hard"],
            "wet": ["Wet", "Inter", "Medium", "Hard"],
        }.get(compound, ["Medium", "Hard", "Hard"])

        timeline = []
        start_lap = 1
        for idx, pit_lap in enumerate(pit_laps):
            timeline.append({
                "compound": stint_order[min(idx, len(stint_order) - 1)],
                "start_lap": start_lap,
                "end_lap": pit_lap,
            })
            start_lap = pit_lap + 1

        timeline.append({
            "compound": stint_order[min(len(pit_laps), len(stint_order) - 1)],
            "start_lap": start_lap,
            "end_lap": race_laps,
        })

        return {
            "timeline": timeline,
            "pit_stop_count": len(pit_laps),
            "strategy_label": f"{len(pit_laps)}-STOP",
        }

    def build_compound_comparison(self, base_predicted_lap, race_laps, safety_car_risk, track):
        """Build comparison metrics for all five compounds."""
        race_laps = max(1, int(race_laps))
        safety_key = self.normalize_safety_risk(safety_car_risk)

        # Baseline pace/degradation model per compound.
        specs = {
            "soft": {"offset": -0.25, "deg": 0.28, "life_ratio": 0.24},
            "medium": {"offset": 0.0, "deg": 0.18, "life_ratio": 0.36},
            "hard": {"offset": 0.15, "deg": 0.10, "life_ratio": 0.52},
            "inter": {"offset": 0.6, "deg": 0.24, "life_ratio": 0.28},
            "wet": {"offset": 1.1, "deg": 0.34, "life_ratio": 0.22},
        }

        track_delta = {
            "optimal": 0.0,
            "hot": 0.08,
            "cold": 0.03,
            "green": 0.06,
            "damp": 0.12,
            "wet": 0.2,
        }.get(str(track or "optimal").lower(), 0.0)

        risk_life_shift = {
            "low": 0.0,
            "medium": -0.03,
            "high": -0.06,
        }[safety_key]

        comparison = []
        for compound, spec in specs.items():
            avg_lap = base_predicted_lap + spec["offset"] + track_delta
            best_lap = avg_lap - 3.85

            tyre_life = int(round(race_laps * (spec["life_ratio"] + risk_life_shift)))
            tyre_life = max(10, min(race_laps - 1, tyre_life))

            optimal_stop = int(round(tyre_life * 1.15))
            optimal_stop = max(6, min(race_laps - 1, optimal_stop))

            comparison.append({
                "compound": compound,
                "avg_lap_seconds": round(avg_lap, 3),
                "best_lap_seconds": round(best_lap, 3),
                "optimal_stop_lap": optimal_stop,
                "tyre_life_laps": tyre_life,
            })

        fastest = min(comparison, key=lambda x: x["avg_lap_seconds"])["compound"]
        return {
            "comparison": comparison,
            "fastest_compound": fastest,
        }

    def build_copilot_analysis(
        self,
        tyre_compound,
        track_condition,
        safety_car_risk,
        total_delta,
        pit_window_lap,
        fastest_compound,
        driver_name=None,
    ):
        """Generate a short Copilot strategy narrative for the selected scenario."""
        tyre_label = {
            "soft": "soft",
            "medium": "medium",
            "hard": "hard",
            "inter": "inter",
            "wet": "wet",
        }.get(str(tyre_compound or "medium").lower(), "medium")

        track_label = {
            "optimal": "optimal conditions",
            "hot": "very hot asphalt",
            "cold": "cold surface",
            "green": "green track",
            "damp": "damp conditions",
            "wet": "wet conditions",
        }.get(str(track_condition or "optimal").lower(), "current conditions")

        risk_label = {
            "low": "low safety-car risk",
            "medium": "medium safety-car risk",
            "high": "high safety-car risk",
        }.get(self.normalize_safety_risk(safety_car_risk), "low safety-car risk")

        if total_delta <= -0.2:
            pace_phrase = "expect an advantage versus baseline"
        elif total_delta >= 1.2:
            pace_phrase = "expect a pace deficit versus baseline"
        else:
            pace_phrase = "expect near-baseline race pace"

        fastest_label = str(fastest_compound or "medium").capitalize()
        prefix = f"{driver_name}: " if driver_name else ""
        return (
            f"{prefix}On {tyre_label} compound with {track_label}, {pace_phrase}. "
            f"With {risk_label}, target pit around lap {pit_window_lap} for undercut coverage. "
            f"If degradation rises, {fastest_label} currently projects as the fastest average alternative."
        )
    
    def predict_race_finish(self, starting_position, strategy, num_laps, 
                           base_lap, tire, track, reliability=1.0):
        """Predict race finish position and time."""
        lap_time = self.predict_lap_time(base_lap, tire, track)["predicted_lap"]
        
        # Tire degradation simulation
        stint_length = num_laps // self.strategies[strategy]["pit_stops"]
        tire_wear_factor = 0.15 if tire.startswith("worn") else 0.08
        
        race_time = 0
        position = starting_position
        
        for i in range(num_laps):
            # Increase lap time as tires degrade
            degradation = (i % stint_length) * tire_wear_factor
            current_lap = lap_time + degradation
            race_time += current_lap
            
            # Random DNF chance increases with unreliability
            if reliability < 1.0 and i > (num_laps * 0.3):
                dnf_chance = (1 - reliability) * 0.001
                if dnf_chance > 0.5 * (1 - reliability):
                    return {
                        "status": "DNF",
                        "finish_position": None,
                        "total_time": None,
                        "laps_completed": i
                    }
        
        return {
            "status": "Finished",
            "finish_position": max(1, position - 1) if position > 1 else 1,
            "total_time": round(race_time, 2),
            "laps_completed": num_laps
        }


# ============================================================================
# SAMPLE DATA GENERATORS
# ============================================================================

def generate_mock_f1_data():
    """Generate mock F1 2025 season data for demo purposes."""
    
    races = [
        {
            "round": 1,
            "country": "Monaco",
            "circuit": "Monaco",
            "circuit_key": "monaco",
            "date": "2025-05-25",
            "laps": 78,
            "length_km": 3.337,
        },
        {
            "round": 2,
            "country": "Italy",
            "circuit": "Monza",
            "circuit_key": "monza",
            "date": "2025-09-07",
            "laps": 53,
            "length_km": 5.793,
        },
        {
            "round": 3,
            "country": "United Kingdom",
            "circuit": "Silverstone",
            "circuit_key": "silverstone",
            "date": "2025-07-06",
            "laps": 52,
            "length_km": 5.891,
        },
        {
            "round": 4,
            "country": "Belgium",
            "circuit": "Spa-Francorchamps",
            "circuit_key": "spa-francorchamps",
            "date": "2025-07-27",
            "laps": 44,
            "length_km": 7.004,
        },
        {
            "round": 5,
            "country": "Japan",
            "circuit": "Suzuka",
            "circuit_key": "suzuka",
            "date": "2025-04-06",
            "laps": 53,
            "length_km": 5.807,
        },
    ]
    
    drivers = [
        {"id": 1, "name": "Max Verstappen", "number": 1, "team": "Red Bull Racing", "position": 1},
        {"id": 2, "name": "Lando Norris", "number": 4, "team": "McLaren", "position": 2},
        {"id": 3, "name": "Charles Leclerc", "number": 16, "team": "Ferrari", "position": 3},
        {"id": 4, "name": "Oscar Piastri", "number": 81, "team": "McLaren", "position": 4},
        {"id": 5, "name": "Carlos Sainz", "number": 55, "team": "Williams", "position": 5},
        {"id": 6, "name": "George Russell", "number": 63, "team": "Mercedes", "position": 6},
        {"id": 7, "name": "Lewis Hamilton", "number": 44, "team": "Ferrari", "position": 7},
        {"id": 8, "name": "Fernando Alonso", "number": 14, "team": "Aston Martin", "position": 8},
        {"id": 9, "name": "Alex Albon", "number": 23, "team": "Williams", "position": 9},
        {"id": 10, "name": "Lance Stroll", "number": 18, "team": "Aston Martin", "position": 10},
        {"id": 11, "name": "Pierre Gasly", "number": 10, "team": "Alpine", "position": 11},
        {"id": 12, "name": "Esteban Ocon", "number": 31, "team": "Haas", "position": 12},
        {"id": 13, "name": "Yuki Tsunoda", "number": 22, "team": "RB", "position": 13},
        {"id": 14, "name": "Daniel Ricciardo", "number": 3, "team": "RB", "position": 14},
        {"id": 15, "name": "Nico Hulkenberg", "number": 27, "team": "Sauber", "position": 15},
        {"id": 16, "name": "Valtteri Bottas", "number": 77, "team": "Sauber", "position": 16},
        {"id": 17, "name": "Kevin Magnussen", "number": 20, "team": "Haas", "position": 17},
        {"id": 18, "name": "Logan Sargeant", "number": 2, "team": "Williams", "position": 18},
        {"id": 19, "name": "Guanyu Zhou", "number": 24, "team": "Sauber", "position": 19},
        {"id": 20, "name": "Oliver Bearman", "number": 87, "team": "Haas", "position": 20},
    ]
    
    return {
        "races": races,
        "drivers": drivers,
        "total_rounds": 24,
        "season": 2025
    }


def generate_race_results_csv():
    """Generate mock race results CSV data."""
    races = generate_mock_f1_data()["races"]
    drivers = generate_mock_f1_data()["drivers"]
    
    results = []
    for race in races[:5]:
        for idx, driver in enumerate(drivers):
            results.append({
                "Round": race["round"],
                "Country": race["country"],
                "Location": race["circuit"],
                "Event Name": f"{race['country']} GP",
                "DriverId": driver["id"],
                "DriverNumber": driver["number"],
                "Driver": driver["name"],
                "Team": driver["team"],
                "Position": idx + 1,
                "Points": max(0, 26 - idx) if idx < 10 else 0,
                "Time": f"1:30:{30 + idx}.123",
                "Status": "Finished",
                "Q1": f"1:32:{10 + idx}.456",
                "Q2": f"1:31:{20 + idx}.789",
                "Q3": f"1:30:{30 + idx}.123",
            })
    
    return pd.DataFrame(results)


def generate_lap_times_csv():
    """Generate mock lap times CSV data."""
    races = generate_mock_f1_data()["races"]
    drivers = generate_mock_f1_data()["drivers"]

    circuit_base_adjust = {
        "monaco": 1.8,
        "monza": -1.0,
        "silverstone": -0.4,
        "spa-francorchamps": -0.2,
        "suzuka": -0.15,
    }
    
    laps = []
    for race in races[:5]:
        for driver in drivers:
            for lap_num in range(1, min(31, race["laps"])):
                # Simulate lap degradation
                base_time = (
                    90.0
                    + (driver["position"] - 1) * 0.5
                    + circuit_base_adjust.get(race.get("circuit_key", ""), 0.0)
                )
                degradation = 0.1 * lap_num
                lap_time = base_time + degradation
                
                laps.append({
                    "Round": race["round"],
                    "Country": race["country"],
                    "Location": race["circuit"],
                    "Event Name": f"{race['country']} GP",
                    "DriverNumber": driver["number"],
                    "Driver": driver["name"],
                    "Team": driver["team"],
                    "Lap": lap_num,
                    "LapSeconds": round(lap_time, 3),
                    "LapTime": f"{int(lap_time)}:{int((lap_time % 1) * 60):02d}.{int(((lap_time % 1) * 60 % 1) * 1000):03d}",
                    "Position": driver["position"],
                })
    
    return pd.DataFrame(laps)


# ============================================================================
# GLOBAL SIMULATOR & DATA CACHE
# ============================================================================

simulator = RaceSimulator()
f1_data = generate_mock_f1_data()
race_results_df = generate_race_results_csv()
lap_times_df = generate_lap_times_csv()


def _parse_lap_time_to_seconds(lap_time):
    """Best-effort parser for lap-time strings as fallback when LapSeconds is unavailable."""
    if lap_time is None:
        return None
    value = str(lap_time).strip()
    if not value:
        return None

    try:
        if ":" in value:
            minutes_str, sec_str = value.split(":", 1)
            return float(minutes_str) * 60.0 + float(sec_str)
        return float(value)
    except (TypeError, ValueError):
        return None


def _lap_seconds_series(df):
    """Return a numeric lap-seconds series from lap dataframe."""
    if "LapSeconds" in df.columns:
        series = pd.to_numeric(df["LapSeconds"], errors="coerce")
        return series.dropna()

    parsed = df["LapTime"].apply(_parse_lap_time_to_seconds)
    parsed = pd.to_numeric(parsed, errors="coerce")
    return parsed.dropna()


def _compute_round_delta_from_data(round_num):
    """Compute circuit/round pace delta from recorded lap data for a round."""
    if round_num is None:
        return None

    round_df = lap_times_df[lap_times_df["Round"] == int(round_num)]
    if round_df.empty:
        return None

    all_series = _lap_seconds_series(lap_times_df)
    round_series = _lap_seconds_series(round_df)
    if all_series.empty or round_series.empty:
        return None

    return float(round(round_series.mean() - all_series.mean(), 3))


def _compute_driver_delta_from_data(driver_id, round_num=None):
    """Compute driver pace delta vs round average from recorded lap data."""
    if driver_id is None:
        return None

    driver = next((d for d in f1_data["drivers"] if d["id"] == int(driver_id)), None)
    if not driver:
        return None

    target_df = lap_times_df[lap_times_df["DriverNumber"] == int(driver["number"])]
    baseline_df = lap_times_df

    if round_num is not None:
        baseline_df = baseline_df[baseline_df["Round"] == int(round_num)]
        target_df = target_df[target_df["Round"] == int(round_num)]

    if target_df.empty or baseline_df.empty:
        return None

    driver_series = _lap_seconds_series(target_df)
    baseline_series = _lap_seconds_series(baseline_df)
    if driver_series.empty or baseline_series.empty:
        return None

    return float(round(driver_series.mean() - baseline_series.mean(), 3))


# ============================================================================
# API ENDPOINTS
# ============================================================================

@app.route("/api/health", methods=["GET"])
def health_check():
    """Health check endpoint."""
    return jsonify({"status": "healthy", "timestamp": datetime.now().isoformat()})


@app.route("/api/season", methods=["GET"])
def get_season_info():
    """Get current F1 season info."""
    return jsonify({
        "season": f1_data["season"],
        "total_rounds": f1_data["total_rounds"],
        "races": len(f1_data["races"]),
        "drivers": len(f1_data["drivers"])
    })


@app.route("/api/races", methods=["GET"])
def get_races():
    """Get all races for the season."""
    return jsonify(f1_data["races"])


@app.route("/api/races/<int:round_num>", methods=["GET"])
def get_race(round_num):
    """Get specific race by round number."""
    race = next((r for r in f1_data["races"] if r["round"] == round_num), None)
    if not race:
        return jsonify({"error": "Race not found"}), 404
    return jsonify(race)


@app.route("/api/drivers", methods=["GET"])
def get_drivers():
    """Get all drivers."""
    return jsonify(f1_data["drivers"])


@app.route("/api/drivers/<int:driver_id>", methods=["GET"])
def get_driver(driver_id):
    """Get specific driver by ID."""
    driver = next((d for d in f1_data["drivers"] if d["id"] == driver_id), None)
    if not driver:
        return jsonify({"error": "Driver not found"}), 404
    return jsonify(driver)


@app.route("/api/race-results", methods=["GET"])
def get_race_results():
    """Get race results (supports filtering by round)."""
    round_num = request.args.get("round", type=int)
    
    if round_num:
        filtered = race_results_df[race_results_df["Round"] == round_num]
        return jsonify(filtered.to_dict("records"))
    
    return jsonify(race_results_df.to_dict("records"))


@app.route("/api/lap-times", methods=["GET"])
def get_lap_times():
    """Get lap times (supports filtering by round and driver)."""
    round_num = request.args.get("round", type=int)
    driver_num = request.args.get("driver", type=int)
    
    filtered = lap_times_df.copy()
    
    if round_num:
        filtered = filtered[filtered["Round"] == round_num]
    if driver_num:
        filtered = filtered[filtered["DriverNumber"] == driver_num]
    
    return jsonify(filtered.to_dict("records"))


@app.route("/api/simulate/lap", methods=["POST"])
def simulate_lap():
    """
    Simulate a single lap prediction.
    
    Body:
    {
        "base_lap": float,
        "tire_condition": string,        # legacy key
        "tyre_compound": string,         # soft|medium|hard|inter|wet
        "track_condition": string,
        "safety_car_risk": string,       # low|medium|high
        "circuit": string,
        "round": int
    }
    """
    data = request.get_json()

    if not data or "base_lap" not in data or "track_condition" not in data:
        return jsonify({"error": "Missing required fields"}), 400

    tyre_compound = data.get("tyre_compound")
    tire_condition = simulator.normalize_tire(data.get("tire_condition"), tyre_compound)

    driver_id = data.get("driver_id")
    selected_driver = None
    driver_delta = 0.0
    if driver_id is not None:
        selected_driver = next((d for d in f1_data["drivers"] if d["id"] == int(driver_id)), None)
        if selected_driver:
            data_driver_delta = _compute_driver_delta_from_data(driver_id, data.get("round"))
            if data_driver_delta is not None:
                driver_delta = data_driver_delta
            else:
                driver_delta = simulator.calculate_driver_delta(selected_driver.get("position"))

    round_num = data.get("round")
    selected_race = None
    if round_num is not None:
        selected_race = next((r for r in f1_data["races"] if r["round"] == int(round_num)), None)

    circuit = data.get("circuit")
    if selected_race:
        circuit = selected_race.get("circuit_key", selected_race.get("circuit", circuit))

    if not circuit:
        circuit = "monaco"
    
    track_condition = str(data["track_condition"]).lower()
    safety_car_risk = data.get("safety_car_risk", "low")

    base_lap = float(data["base_lap"])

    result = simulator.predict_lap_time(
        base_lap,
        tire_condition,
        track_condition,
        safety_car_risk,
        circuit,
    )

    # If round data exists, prefer data-derived round delta over static circuit map.
    round_delta_data = _compute_round_delta_from_data(round_num)
    if round_delta_data is not None:
        result["circuit_delta"] = round_delta_data

    tire_delta = float(result["tire_delta"])
    track_delta = float(result["track_delta"])
    safety_delta = float(result["safety_car_delta"])
    circuit_delta = float(result["circuit_delta"])

    total_delta_exact = tire_delta + track_delta + safety_delta + circuit_delta + float(driver_delta)
    predicted_lap_exact = base_lap + total_delta_exact

    result["base_lap"] = base_lap
    result["total_delta"] = round(total_delta_exact, 3)
    result["predicted_lap"] = round(predicted_lap_exact, 3)

    race_laps = 50
    if selected_race and "laps" in selected_race:
        race_laps = int(selected_race["laps"])

    pit_window_lap = simulator.estimate_pit_window_lap(
        tyre_compound,
        race_laps,
        safety_car_risk,
        track_condition,
    )

    race_total_seconds = round(predicted_lap_exact * race_laps, 3)
    degradation_curves = simulator.build_degradation_curves(predicted_lap_exact, race_laps)
    pit_strategy = simulator.build_pit_timeline(
        tyre_compound,
        race_laps,
        pit_window_lap,
        safety_car_risk,
    )
    compound_comparison = simulator.build_compound_comparison(
        predicted_lap_exact,
        race_laps,
        safety_car_risk,
        track_condition,
    )

    result["tyre_compound"] = tyre_compound
    result["tire_condition"] = tire_condition
    result["round"] = round_num
    result["driver_id"] = driver_id
    result["driver_delta"] = round(driver_delta, 3)
    result["selected_driver"] = selected_driver
    result["race_laps"] = race_laps
    result["pit_window_lap"] = pit_window_lap
    result["pit_window_reason"] = "Undercut window"
    result["race_total_seconds"] = race_total_seconds
    result["degradation_curves"] = degradation_curves
    result["pit_strategy_timeline"] = pit_strategy["timeline"]
    result["pit_stop_count"] = pit_strategy["pit_stop_count"]
    result["strategy_label"] = pit_strategy["strategy_label"]
    result["compound_comparison"] = compound_comparison["comparison"]
    result["fastest_compound"] = compound_comparison["fastest_compound"]
    result["copilot_analysis"] = simulator.build_copilot_analysis(
        tyre_compound,
        track_condition,
        safety_car_risk,
        result["total_delta"],
        pit_window_lap,
        compound_comparison["fastest_compound"],
        selected_driver["name"] if selected_driver else None,
    )
    
    return jsonify(result)


@app.route("/api/simulate/race", methods=["POST"])
def simulate_race():
    """
    Simulate full race prediction.
    
    Body:
    {
        "starting_position": int,
        "strategy": string (aggressive|balanced|conservative|undercut),
        "num_laps": int,
        "base_lap": float,
        "tire_condition": string,
        "track_condition": string,
        "reliability": float (0-1, optional)
    }
    """
    data = request.get_json()
    
    required = ["starting_position", "strategy", "num_laps", "base_lap", 
                "tire_condition", "track_condition"]
    if not data or not all(k in data for k in required):
        return jsonify({"error": f"Missing required fields: {required}"}), 400
    
    reliability = float(data.get("reliability", 1.0))
    
    result = simulator.predict_race_finish(
        int(data["starting_position"]),
        data["strategy"],
        int(data["num_laps"]),
        float(data["base_lap"]),
        data["tire_condition"],
        data["track_condition"],
        reliability
    )
    
    return jsonify(result)


@app.route("/api/strategies", methods=["GET"])
def get_strategies():
    """Get available pit stop strategies."""
    return jsonify(simulator.strategies)


@app.route("/api/statistics/avg-lap-time", methods=["GET"])
def get_avg_lap_time():
    """Get average lap times by round."""
    round_num = request.args.get("round", type=int)
    
    filtered = lap_times_df.copy()
    if round_num:
        filtered = filtered[filtered["Round"] == round_num]
    
    # Parse lap times (simplified; in production, use better parsing)
    avg_by_round = []
    for round_id in filtered["Round"].unique():
        round_data = filtered[filtered["Round"] == round_id]
        race_info = next(r for r in f1_data["races"] if r["round"] == round_id)
        avg_by_round.append({
            "round": round_id,
            "country": race_info["country"],
            "lap_count": len(round_data),
            "unique_drivers": round_data["Driver"].nunique()
        })
    
    return jsonify(sorted(avg_by_round, key=lambda x: x["round"]))


@app.route("/api/statistics/driver-performance", methods=["GET"])
def get_driver_performance():
    """Get driver performance stats."""
    driver_stats = []
    
    for driver in f1_data["drivers"]:
        driver_races = race_results_df[race_results_df["DriverNumber"] == driver["number"]]
        total_points = driver_races["Points"].sum()
        
        driver_stats.append({
            "driver_id": driver["id"],
            "name": driver["name"],
            "team": driver["team"],
            "races_completed": len(driver_races[driver_races["Status"] == "Finished"]),
            "total_points": int(total_points),
            "best_finish": int(driver_races["Position"].min()) if len(driver_races) > 0 else None,
            "dnf_count": len(driver_races[driver_races["Status"].str.contains("DNF|Retired|Accident", na=False)])
        })
    
    return jsonify(sorted(driver_stats, key=lambda x: x["total_points"], reverse=True))


@app.route("/api/tire-compounds", methods=["GET"])
def get_tire_compounds():
    """Get available tire compounds and their properties."""
    compounds = {
        "soft": {"name": "Soft", "deg_rate": 0.15, "peak_performance": "immediate"},
        "medium": {"name": "Medium", "deg_rate": 0.10, "peak_performance": "lap_5"},
        "hard": {"name": "Hard", "deg_rate": 0.08, "peak_performance": "lap_10"},
        "intermediate": {"name": "Intermediate", "deg_rate": 0.12, "peak_performance": "damp_only"},
        "wet": {"name": "Full Wet", "deg_rate": 0.18, "peak_performance": "rain_only"},
    }
    return jsonify(compounds)


@app.route("/api/track-conditions", methods=["GET"])
def get_track_conditions():
    """Get available track conditions."""
    conditions = {
        "optimal": {"description": "Optimal grip, dry track", "grip_level": 1.0},
        "hot": {"description": "Very hot asphalt", "grip_level": 0.85},
        "cold": {"description": "Cold surface", "grip_level": 0.90},
        "green": {"description": "Green/low grip track", "grip_level": 0.75},
        "damp": {"description": "Damp track, no standing water", "grip_level": 0.65},
        "wet": {"description": "Wet track, standing water", "grip_level": 0.45},
    }
    return jsonify(conditions)


@app.route("/api/safety-car-risks", methods=["GET"])
def get_safety_car_risks():
    """Get available safety car risk levels."""
    return jsonify({
        "low": {"label": "Low (10%)", "impact": simulator.safety_car_risk_impact["low"]},
        "medium": {"label": "Medium (35%)", "impact": simulator.safety_car_risk_impact["medium"]},
        "high": {"label": "High (60%)", "impact": simulator.safety_car_risk_impact["high"]},
    })


@app.route("/api/race-config", methods=["GET"])
def get_race_config():
    """Get all UI options for race configuration."""
    return jsonify({
        "drivers": f1_data["drivers"],
        "races": f1_data["races"],
        "track_conditions": {
            "optimal": "Optimal Grip",
            "hot": "Very Hot Asphalt",
            "cold": "Cold Surface",
            "green": "Green Track",
            "damp": "Damp",
            "wet": "Wet",
        },
        "safety_car_risk": {
            "low": "Low (10%)",
            "medium": "Medium (35%)",
            "high": "High (60%)",
        },
        "tyre_compounds": ["soft", "medium", "hard", "inter", "wet"],
    })


# ============================================================================
# ERROR HANDLERS
# ============================================================================

@app.errorhandler(404)
def not_found(error):
    return jsonify({"error": "Endpoint not found"}), 404


@app.errorhandler(500)
def internal_error(error):
    return jsonify({"error": "Internal server error", "details": str(error)}), 500


# ============================================================================
# ENTRY POINT
# ============================================================================

if __name__ == "__main__":
    print("🏎️  F1 What-If Race Simulator Backend")
    print("=" * 50)
    print("Starting server on http://localhost:5000")
    print("API documentation: http://localhost:5000/api/health")
    print("=" * 50)
    app.run(debug=True, host="0.0.0.0", port=5000)
