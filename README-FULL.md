# F1 What-If Race Simulator

A full-stack web application for simulating Formula 1 race scenarios based on tire and track conditions. Built with a Flask backend and vanilla HTML/CSS/JavaScript frontend.

## 📋 Project Structure

```
CQ-F1-Simulator/
├── index.html              # Frontend UI
├── styles.css              # Frontend styling
├── script.js               # Frontend logic (connects to backend)
├── backend.py              # Flask API server
├── config.py               # Configuration settings
├── requirements.txt        # Python dependencies
├── app.py                  # Original F1 data collector (uses FastF1 API)
├── api-docs.md             # Complete API documentation
└── README.md               # This file
```

## 🎯 Features

### Frontend (HTML/CSS/JS)
- **Tire Condition Dropdown**: Select from 8 tire options (Soft, Medium, Hard variants, Intermediate, Wet)
- **Track Condition Dropdown**: Choose from 6 track scenarios (Optimal, Hot, Cold, Green, Damp, Wet)
- **Real-time Predictions**: Get lap time predictions based on selected conditions
- **Strategy Insights**: Context-aware strategy recommendations based on setup
- **Responsive Design**: Works seamlessly on desktop and mobile devices
- **F1-Themed UI**: Racing-inspired gradient backgrounds and typography

### Backend (Flask)
- **RESTful API**: 20+ endpoints for race data and simulations
- **Race Simulation Engine**: Calculates lap times with tire degradation modeling
- **Mock Data**: Pre-loaded with 2025 F1 season data (5 races, 8 drivers)
- **CORS Enabled**: Allows frontend on different ports to communicate
- **Strategy System**: 4 predefined pit stop strategies
- **Statistics**: Driver performance aggregation and lap time analysis

## 🚀 Quick Start

### Prerequisites
- Python 3.8+
- pip (Python package manager)
- Modern web browser

### 1. Install Dependencies

```bash
pip install -r requirements.txt
```

### 2. Start the Backend Server

```bash
python backend.py
```

Expected output:
```
🏎️  F1 What-If Race Simulator Backend
==================================================
Starting server on http://localhost:5000
API documentation: http://localhost:5000/api/health
==================================================
```

### 3. Open Frontend in Browser

Open `index.html` in your web browser or run a local HTTP server:

```bash
# Using Python 3
python -m http.server 8000

# Then navigate to http://localhost:8000
```

The frontend will automatically attempt to connect to the backend at `http://localhost:5000`.

## 📡 How It Works

### Data Flow

```
User Input (Frontend)
  ↓
baseLap, tire_condition, track_condition
  ↓
POST /api/simulate/lap (Backend)
  ↓
RaceSimulator calculates prediction
  ↓
Response: predicted_lap, total_delta
  ↓
Display Results (Frontend)
```

### Tire Impact Model

Each tire compound affects lap time differently:

| Tire Type | Impact (sec) | Use Case |
|-----------|--------------|----------|
| New Soft | -0.8 | Qualifying, early race |
| New Medium | -0.25 | Most races |
| New Hard | +0.2 | Some circuits |
| Worn Soft | +1.4 | Late race (high deg) |
| Worn Medium | +0.9 | Coming home |
| Worn Hard | +0.55 | Fence sitter |
| Intermediate | +2.0 | Light rain |
| Full Wet | +3.8 | Heavy rain |

### Track Condition Impact

Track conditions add additional lap time penalties:

| Condition | Impact (sec) | Description |
|-----------|--------------|-------------|
| Optimal | -0.4 | Perfect grip |
| Hot | +0.7 | Increased degradation |
| Cold | +0.45 | Reduced grip, sliding |
| Green | +1.0 | Low grip circuit |
| Damp | +2.4 | Intermediate conditions |
| Wet | +5.2 | Full wet |

### Example Simulation

**Input:**
- Base Lap: 90.0 seconds
- Tire: New Soft (-0.8s)
- Track: Optimal (-0.4s)

**Calculation:**
```
Predicted Lap = 90.0 + (-0.8) + (-0.4) = 88.8 seconds
Total Delta = -1.2 seconds
```

**Output:**
```
Predicted Lap Time: 88.8 s
Time Delta: -1.2 s ✓ (green = faster)
Strategy Note: "Current setup is competitive..."
```

## 🔌 API Endpoints

### Core Simulation
- `POST /api/simulate/lap` - Single lap prediction
- `POST /api/simulate/race` - Full race simulation

### Reference Data
- `GET /api/races` - List all races
- `GET /api/drivers` - List all drivers
- `GET /api/strategies` - Available pit stop strategies
- `GET /api/tire-compounds` - Tire properties
- `GET /api/track-conditions` - Track condition details

### Statistics
- `GET /api/race-results` - Historical race results
- `GET /api/lap-times` - All lap times
- `GET /api/statistics/driver-performance` - Driver stats
- `GET /api/statistics/avg-lap-time` - Track analysis

See [api-docs.md](api-docs.md) for complete endpoint documentation and examples.

## 🛠️ Configuration

Edit `config.py` to customize:

```python
# Enable/disable debug mode
DEBUG = True/False

# CORS allowed origins
CORS_ALLOW_ORIGINS = ["http://localhost:3000", ...]

# Session timeout
PERMANENT_SESSION_LIFETIME = timedelta(hours=24)
```

## 📊 Using Real F1 2025 Data

The included `app.py` can fetch real F1 2025 season data using the FastF1 API:

```bash
python app.py
```

This generates:
 - `RaceResults.csv` - All race results with qualifying times
- `LapTimes.csv` - Complete lap time data
- `RaceResults.parquet` - Optimized binary format
- `LapTimes.parquet` - Optimized binary format

You can load these CSVs into the backend for real data:

```python
import pandas as pd

race_results_df = pd.read_csv('RaceResults.csv')
lap_times_df = pd.read_csv('LapTimes.csv')
```

## 🧪 Testing the API

### Using cURL
```bash
# Test lap prediction
curl -X POST http://localhost:5000/api/simulate/lap \
  -H "Content-Type: application/json" \
  -d '{
    "base_lap": 90.5,
    "tire_condition": "new_soft",
    "track_condition": "optimal"
  }'
```

### Using Python
```python
import requests

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

### Using JavaScript/Fetch
```javascript
const response = await fetch('http://localhost:5000/api/simulate/lap', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    base_lap: 90.5,
    tire_condition: 'new_soft',
    track_condition: 'optimal'
  })
});
console.log(await response.json());
```

## 🐛 Troubleshooting

### Backend won't start
```
Error: Address already in use
```
**Solution:** The port 5000 is in use. Either kill the process or change the port in `backend.py`:
```python
app.run(debug=True, host="0.0.0.0", port=5001)  # Use 5001 instead
```

### Frontend shows "Backend unavailable"
**Solution:** Make sure the backend is running on `http://localhost:5000`. Check:
1. Backend server is running (`python backend.py`)
2. Frontend API_BASE URL matches backend port in `script.js`
3. CORS is enabled (it is by default)

### CORS errors
**Solution:** The backend has CORS enabled by default. If still getting errors, add your frontend domain to `config.py`:
```python
CORS_ALLOW_ORIGINS = ["http://localhost:3000", "http://yourdomain.com"]
```

## 🔄 Deployment

### Docker (Optional)
Create a `Dockerfile` to containerize the app:

```dockerfile
FROM python:3.11-slim

WORKDIR /app
COPY requirements.txt .
RUN pip install -r requirements.txt

COPY . .

ENV FLASK_ENV=production
CMD ["python", "backend.py"]
```

Build and run:
```bash
docker build -t f1-simulator .
docker run -p 5000:5000 f1-simulator
```

### Production Considerations
1. Use environment variables for secrets: `SECRET_KEY`, `DATABASE_URL`
2. Enable `SESSION_COOKIE_SECURE = True` for HTTPS
3. Use Gunicorn for production WSGI server:
   ```bash
   pip install gunicorn
   gunicorn -w 4 -b 0.0.0.0:5000 backend:app
   ```
4. Add a reverse proxy (Nginx/Apache) for SSL/TLS termination

## 📚 Future Enhancements

- [ ] Fuel load simulation
- [ ] Weather forecast integration
- [ ] Multi-lap stint degradation
- [ ] Driver skill profiles
- [ ] Safety car and VSC effects
- [ ] DRS overtake scenarios
- [ ] Historical race comparison
- [ ] Team radio integration
- [ ] Real-time telemetry display
- [ ] Machine learning lap time predictions

## 📄 License

Created for CodeQuantum 2026 at UTSA.

## 🏁 Credits

- Data collection: FastF1 API
- Frontend: Vanilla HTML/CSS/JavaScript
- Backend: Flask + Pandas
- Inspiration: F1 Strategy Group

---

**Need Help?**

1. Check [api-docs.md](api-docs.md) for API details
2. Review config.py for configuration options
3. Examine backend.py for data models and simulation logic
4. Check browser console for JavaScript errors
5. Check terminal for backend errors

✨ Happy racing!
