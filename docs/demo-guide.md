# UyirKappan — Demonstration Guide

> A step-by-step guide for demonstrating UyirKappan to a jury, reviewer, or faculty evaluator.
> This guide covers system startup, the complete emergency lifecycle, and evaluation features.

---

## Prerequisites

Before starting the demo, ensure:

- **Node.js** ≥ 18 installed
- **Flutter** SDK installed (for mobile app demos)
- **MongoDB** running locally (optional — demo works in memory mode too)
- All dependencies installed:

```bash
# Backend
cd backend && npm install

# Hospital Dashboard
cd hospital-dashboard && npm install

# Research Portal
cd research-portal && npm install

# Mobile apps
cd bystander_app && flutter pub get
cd driver_app && flutter pub get
```

---

## Part 1 — System Startup

### 1.1 Start the Backend

```bash
cd backend

# Option A: Memory mode (no MongoDB required)
npm start

# Option B: MongoDB mode (requires running MongoDB)
set DATA_STORE_MODE=mongodb
set MONGODB_URI=mongodb://localhost:27017/uyirkappan
npm start
```

**Expected:** Server starts on `http://localhost:5000` with logs showing:
- Data store mode (memory or mongodb)
- Traffic provider: SimulationTrafficProvider
- Chennai fleet seeded (ambulances available)

### 1.2 Start the Hospital Dashboard

```bash
cd hospital-dashboard
npm run dev
```

**Expected:** Opens at `http://localhost:5173` — shows real-time hospital dashboard.

### 1.3 Start the Research Portal

```bash
cd research-portal
npm run dev
```

**Expected:** Opens at `http://localhost:5174` — shows research evaluation interface.

### 1.4 Start Mobile Apps (Emulator or Device)

```bash
# Bystander App
cd bystander_app && flutter run

# Driver App
cd driver_app && flutter run
```

---

## Part 2 — Run the Test Suite (Verification)

Demonstrate the full test suite passing before the live demo:

```bash
cd backend
npm test
```

**Expected:** 130 tests pass (22 test files covering auth, dispatch, fallback, routing, persistence, traffic, evaluation, provenance, etc.)

To show dual-mode support:

```bash
# Memory mode
npm test

# MongoDB mode
set DATA_STORE_MODE=mongodb
npm test
```

**Expected:** 130/130 pass in both modes.

---

## Part 3 — Emergency Lifecycle Demo

This is the core demonstration — a complete emergency from SOS to hospital arrival.

### Step 1: Bystander Reports Emergency

**Using the Bystander App:**
1. Open the Bystander App
2. Tap the **SOS** button
3. The app detects GPS location automatically
4. Emergency request is sent to the backend

**Using curl (alternative):**

```bash
# Register a bystander
curl -X POST http://localhost:5000/api/auth/register ^
  -H "Content-Type: application/json" ^
  -d "{\"name\":\"Demo Bystander\",\"email\":\"bystander@demo.com\",\"password\":\"demo123\",\"role\":\"bystander\"}"

# Save the JWT token from the response, then create an emergency
curl -X POST http://localhost:5000/api/emergencies ^
  -H "Content-Type: application/json" ^
  -H "Authorization: Bearer <TOKEN>" ^
  -d "{\"location\":{\"latitude\":13.0827,\"longitude\":80.2707},\"description\":\"Demo cardiac emergency\",\"severity\":\"critical\"}"
```

**What to show the jury:**
- Emergency ID is generated
- Backend logs show the dispatch engine activating

### Step 2: Intelligent Dispatch Engine

**What happens automatically:**
1. **Candidate Filtering** — Haversine spatial search finds nearby available ambulances
2. **Multi-Factor Scoring** — Each candidate scored on:
   - Distance: 50% weight
   - Equipment match: 20% weight
   - Availability status: 20% weight
   - Response time history: 10% weight
3. **Dijkstra Routing** — Shortest path computed over 70-node Chennai virtual road network with 182 road segments
4. **Traffic Integration** — SimulationTrafficProvider applies diurnal traffic patterns
5. **Baseline Comparison** — Result compared against 108 ambulance retrospective dataset

**What to show:**
- Backend logs showing candidate filtering, scoring, and routing
- The dispatch result includes: selected ambulance, route, ETA, distance, and baseline comparison

### Step 3: Driver Receives Assignment

**Using the Driver App:**
1. Driver sees incoming assignment notification
2. **15-second countdown timer** starts
3. Driver taps **Accept** or **Reject**

**If Accepted:**
- Assignment status → `ACCEPTED`
- Bystander app shows live tracking
- Hospital dashboard shows incoming ambulance

**If Rejected or Timeout:**
- Cascading fallback activates automatically
- Previous ambulance is excluded
- Dispatch re-runs for next best candidate
- Attempt recorded in RequestAttempt ledger

### Step 4: Real-Time Tracking

**What to show on Hospital Dashboard:**
- Incoming emergency appears in real-time feed
- Ambulance ETA updates via Socket.IO
- Hospital can see ambulance approach on the interface

**What to show on Bystander App:**
- Live ambulance tracking
- ETA countdown
- Driver information displayed

### Step 5: Emergency Resolution

The emergency completes when the ambulance arrives and the driver marks the emergency as completed.

---

## Part 4 — Cascading Fallback Demo

This demonstrates the system's resilience when drivers reject or don't respond.

1. Create an emergency (as in Step 1)
2. Let the first driver assignment **timeout** (wait 15 seconds without accepting)
3. **Show the jury:**
   - Backend automatically excludes the first ambulance
   - Records the attempt in the RequestAttempt ledger
   - Re-dispatches to the next best ambulance
   - The new assignment has a different ambulance ID
4. Repeat to show multiple fallback levels

---

## Part 5 — Research & Evaluation Features

### 5.1 Baseline Comparison (108 Dataset)

Navigate to the Research Portal and show:
- The 108 ambulance retrospective dataset analysis
- How UyirKappan's dispatch compares to traditional nearest-ambulance dispatch
- Evaluation metrics: response time, routing distance, scoring breakdown

### 5.2 Data Provenance

```bash
curl http://localhost:5000/api/provenance/sources
```

**Expected:** Returns the classification of all data sources:
- `operational` — runtime ambulance/hospital/emergency state
- `simulation` — traffic simulation, fleet seeding
- `reference` — 108 baseline dataset
- `static` — virtual road network, hospital coordinates

### 5.3 Traffic Provider Status

```bash
curl http://localhost:5000/api/traffic/status
```

**Expected:** Shows SimulationTrafficProvider as active, with Google/Mappls as NOT_CONFIGURED stubs.

---

## Part 6 — Architecture & Technical Depth

If the jury asks about technical architecture, reference:

| Topic | Documentation |
|-------|--------------|
| System Architecture | [architecture.md](architecture.md) |
| Dispatch Algorithm & Routing | [system-design.md](system-design.md) |
| Complete API Reference | [api.md](api.md) |
| Research Evaluation | [evaluation.md](evaluation.md) |
| Test Suite & Coverage | [testing.md](testing.md) |

### Key Technical Points

1. **Dual Persistence** — Same codebase runs with MongoDB or in-memory store, controlled by a single environment variable
2. **Pluggable Traffic** — Architecture supports swapping SimulationTrafficProvider for Google/Mappls without code changes
3. **Honest Boundaries** — Simulation traffic is explicitly labelled as simulation; no claims of live traffic integration
4. **130-Test Regression Suite** — 22 test files covering dispatch, fallback, concurrency, persistence, provenance, and more
5. **Research Integrity** — 108 baseline dataset is used for comparison only, never mixed into operational dispatch

---

## Part 7 — Common Jury Questions

### "Is this using real traffic data?"
No. The system uses a SimulationTrafficProvider with a diurnal traffic model. Google Maps and Mappls adapters exist as architecture stubs but are explicitly NOT_CONFIGURED. The system is honest about this boundary.

### "How does the dispatch algorithm work?"
Multi-factor scoring: Distance (50%), Equipment (20%), Availability (20%), Response Time (10%). Candidates are filtered by Haversine radius, scored, and routed via Dijkstra's algorithm over a 70-node virtual road network representing Chennai.

### "What happens when a driver doesn't respond?"
Cascading fallback: the system records the attempt, excludes the non-responsive ambulance, and re-dispatches to the next best candidate. This continues until an ambulance accepts or all candidates are exhausted.

### "Is this a real deployment?"
No. This is a research prototype demonstrating the architecture, algorithms, and coordination patterns for emergency ambulance dispatch. The virtual road network, simulation traffic, and fleet seeding are explicitly labelled as simulation components.

### "How does the 108 baseline work?"
The `dummy_ambulance_data.xlsx` file contains retrospective data on 108 ambulance operations. UyirKappan uses this as a reference/baseline to compare its dispatch decisions against traditional nearest-ambulance dispatch, demonstrating potential improvements in response time and routing optimality.

---

## Shutdown

```bash
# Stop all running processes with Ctrl+C
# Backend, Hospital Dashboard, Research Portal, and mobile apps
```

---

> **Note:** This guide assumes the demo is run locally. For remote demonstrations, replace `localhost` with the appropriate server address and ensure network connectivity between all components.
