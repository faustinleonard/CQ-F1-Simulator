# F1 Simulator API Documentation

Base URL: `http://localhost:5000/api`

## Endpoints

### Health & Info

#### GET /health
Health check endpoint.
```json
Response:
{
  "status": "healthy",
  "timestamp": "2025-03-28T10:30:00.123456"
}
```

#### GET /season
Get current F1 season information.
```json
Response:
{
  "season": 2025,
  "total_rounds": 24,
  "races": 24,
  "drivers": 8
}
```

---

### Races

#### GET /races
Get all races for the season.
```json
Response: [
  {
    "round": 1,
    "country": "Bahrain",
    "circuit": "Bahrain International Circuit",
    "date": "2025-03-02",
    "laps": 57
  },
  ...
]
```

#### GET /races/{round_num}
Get a specific race by round number.
```
GET /races/1

Response:
{
  "round": 1,
  "country": "Bahrain",
  "circuit": "Bahrain International Circuit",
  "date": "2025-03-02",
  "laps": 57
}
```

---

### Drivers

#### GET /drivers
Get all drivers.
```json
Response: [
  {
    "id": 1,
    "name": "Max Verstappen",
    "number": 1,
    "team": "Red Bull Racing",
    "position": 1
  },
  ...
]
```

#### GET /drivers/{driver_id}
Get a specific driver by ID.
```
GET /drivers/1

Response:
{
  "id": 1,
  "name": "Max Verstappen",
  "number": 1,
  "team": "Red Bull Racing",
  "position": 1
}
```

---

### Race Data

#### GET /race-results?round={round_num}
Get race results (optionally filtered by round).
```json
Response: [
  {
    "Round": 1,
    "Country": "Bahrain",
    "Location": "Bahrain International Circuit",
    "DriverNumber": 1,
    "Driver": "Max Verstappen",
    "Position": 1,
    "Points": 25,
    "Status": "Finished",
    ...
  },
  ...
]
```

#### GET /lap-times?round={round_num}&driver={driver_num}
Get lap times (optionally filtered by round and/or driver).
```json
Response: [
  {
    "Round": 1,
    "Driver": "Max Verstappen",
    "DriverNumber": 1,
    "Lap": 1,
    "LapTime": "1:35:123.456",
    "Position": 1,
    ...
  },
  ...
]
```

---

### Simulation Endpoints

#### POST /simulate/lap
Simulate a single lap prediction based on conditions.

Request Body:
```json
{
  "base_lap": 90.5,
  "tire_condition": "new_soft",
  "track_condition": "optimal"
}
```

Response:
```json
{
  "base_lap": 90.5,
  "tire_delta": -0.8,
  "track_delta": -0.4,
  "total_delta": -1.2,
  "predicted_lap": 89.3
}
```

#### POST /simulate/race
Simulate full race prediction with strategy.

Request Body:
```json
{
  "starting_position": 3,
  "strategy": "balanced",
  "num_laps": 57,
  "base_lap": 90.5,
  "tire_condition": "new_medium",
  "track_condition": "optimal",
  "reliability": 0.98
}
```

Response:
```json
{
  "status": "Finished",
  "finish_position": 2,
  "total_time": 5146.35,
  "laps_completed": 57
}
```

##### Available Strategies:
- `aggressive` - Early stops, high pace (2 stops)
- `balanced` - Standard strategy (2 stops)
- `conservative` - One stop, fuel management (1 stop)
- `undercut` - Early stop for undercut (2 stops)

---

### Reference Data

#### GET /strategies
Get available pit stop strategies.
```json
Response:
{
  "aggressive": {
    "pit_stops": 2,
    "fuel_load": 0.85,
    "description": "Early stops, high pace."
  },
  ...
}
```

#### GET /tire-compounds
Get available tire compounds.
```json
Response:
{
  "soft": {
    "name": "Soft",
    "deg_rate": 0.15,
    "peak_performance": "immediate"
  },
  ...
}
```

#### GET /track-conditions
Get available track conditions.
```json
Response:
{
  "optimal": {
    "description": "Optimal grip, dry track",
    "grip_level": 1.0
  },
  ...
}
```

---

### Statistics

#### GET /statistics/avg-lap-time?round={round_num}
Get average lap times by round.
```json
Response: [
  {
    "round": 1,
    "country": "Bahrain",
    "lap_count": 456,
    "unique_drivers": 8
  },
  ...
]
```

#### GET /statistics/driver-performance
Get driver performance statistics.
```json
Response: [
  {
    "driver_id": 1,
    "name": "Max Verstappen",
    "team": "Red Bull Racing",
    "races_completed": 5,
    "total_points": 125,
    "best_finish": 1,
    "dnf_count": 0
  },
  ...
]
```

---

## Error Responses

### 400 - Bad Request
```json
{
  "error": "Missing required fields"
}
```

### 404 - Not Found
```json
{
  "error": "Endpoint not found"
}
```

### 500 - Internal Server Error
```json
{
  "error": "Internal server error",
  "details": "error message"
}
```

---

## Example Usage

### Python
```python
import requests

# Simulate a lap time
response = requests.post(
    "http://localhost:5000/api/simulate/lap",
    json={
        "base_lap": 90.5,
        "tire_condition": "new_soft",
        "track_condition": "optimal"
    }
)
print(response.json())
```

### JavaScript / Fetch
```javascript
const response = await fetch('http://localhost:5000/api/simulate/lap', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({
    base_lap: 90.5,
    tire_condition: 'new_soft',
    track_condition: 'optimal'
  })
});
const data = await response.json();
console.log(data);
```

### cURL
```bash
curl -X POST http://localhost:5000/api/simulate/lap \
  -H "Content-Type: application/json" \
  -d '{"base_lap": 90.5, "tire_condition": "new_soft", "track_condition": "optimal"}'
```
