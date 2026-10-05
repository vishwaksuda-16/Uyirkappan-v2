# UyirKappan — Backend

Production-grade emergency dispatch backend supporting dual persistence modes (MongoDB / in-memory), intelligent ambulance dispatch with multi-factor scoring, Dijkstra shortest-path routing over a virtual road network, cascading fallback with persistent attempt ledger, pluggable traffic providers, and real-time Socket.IO coordination.

---

## Quick Start

```bash
cd backend
npm install

# Memory mode (default)
npm start

# MongoDB mode
DATA_STORE_MODE=mongodb MONGODB_URI=mongodb://localhost:27017/uyirkappan npm start

# Run tests
npm test
```

Server runs at http://localhost:5000

---

## Architecture

- **Express + Socket.IO Server**: Powers real-time bidirectional communication and RESTful APIs for the bystander application, driver/ambulance interface, and hospital emergency dashboard.
- **14 Route Groups**:
  - `auth`: User authentication, session management, and JWT token issuance.
  - `users`: User profile retrieval and management.
  - `ambulances`: Fleet status tracking, capability configuration, and live GPS updates.
  - `hospitals`: Hospital directory, trauma center details, and bed availability.
  - `emergencies`: Emergency incident lifecycle creation, updates, and state transitions.
  - `driver`: Driver operational workflows (accept, reject, arrive, complete).
  - `dispatch`: Intelligent matching triggers and manual dispatch overrides.
  - `tracking`: Live telemetry streaming and waypoint tracking.
  - `evaluation`: Performance analytics and comparative benchmark metrics.
  - `traffic`: Real-time traffic condition queries and speed adjustment factors.
  - `baseline`: 108 ambulance baseline dataset ingestion and comparative benchmarking.
  - `provenance`: Audit logging and data origin tracking.
  - `health`: Server health, readiness, and liveness probes.
  - `config`: Operational system configuration and status inspection.
- **6 Data Models**:
  - `User`: System actors (bystanders, drivers, hospital staff, dispatchers).
  - `Ambulance`: Vehicle telemetry, current status, type, equipment level, and location.
  - `Hospital`: Medical facility metadata, department capacity, and geolocation.
  - `Emergency`: Incident priority, location, bystander contact, and lifecycle status.
  - `RequestAttempt`: Persistent attempt ledger recording dispatch iterations, rejections, and timeouts.
  - `LocationHistory`: Historical breadcrumb logs for route tracing and telemetry analysis.
- **Dual Persistence**: Seamless switching between MongoDB (via Mongoose) and an in-memory store, controlled by the `DATA_STORE_MODE` environment variable (`memory` or `mongodb`).
- **Intelligent Matcher**:
  - Candidate filtering using Haversine radial distance thresholding.
  - Multi-factor scoring engine:
    - Distance: 50%
    - Equipment: 20%
    - Availability: 20%
    - Response Time: 10%
  - Dijkstra shortest-path routing over a 70-node, 182-segment virtual road network.
- **Cascading Fallback**: On driver `REJECT` or `TIMEOUT`, the system records the attempt in the persistent attempt ledger, excludes previously tried ambulances, and automatically re-dispatches to the next best candidate.
- **Pluggable Traffic Providers**: Features `SimulationTrafficProvider` (active dynamic traffic modeling) alongside extensible adapters for external providers (`Google` / `Mappls`, configured as `NOT_CONFIGURED` stubs).
- **108 Ambulance Baseline Dataset Comparison**: Ingests and benchmarks dispatch results against the 108 ambulance baseline dataset for empirical research evaluation.
- **Data Provenance Tracking**: Tracks data lineage with explicit source classification (`operational`, `simulation`, `reference`, and `static`).

---

## Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `PORT` | `5000` | Server port |
| `DATA_STORE_MODE` | `memory` | `memory` or `mongodb` |
| `MONGODB_URI` | `mongodb://localhost:27017/uyirkappan` | MongoDB connection string |
| `JWT_SECRET` | `(random)` | JWT signing secret |
| `DRIVER_RESPONSE_TIMEOUT_MS` | `15000` | Driver response timeout |
| `TRAFFIC_PROVIDER` | `simulation` | Active traffic provider |
| `TRAFFIC_PROVIDER_FALLBACK` | `simulation` | Fallback traffic provider |
| `DATASET_DIR` | `./Datasets` | Operational dataset directory |
| `BASELINE_DATASET_PATH` | `./dummy_ambulance_data.xlsx` | 108 baseline dataset path |
| `LOG_LEVEL` | `info` | Logging level |
| `MONGO_CONNECT_TIMEOUT_MS` | `5000` | MongoDB connection timeout |
| `MONGO_SERVER_SELECTION_TIMEOUT_MS` | `5000` | MongoDB server selection timeout |

---

## Testing

- **Test Suite**: 22 test files, 130 tests total.
- **Dual-Mode Regression**: Validated in both Memory and MongoDB modes.
- **Test Areas**: Auth, CRUD, dispatch, fallback cascade, concurrent accept protection, timeout/race protection, socket reconnect, MongoDB persistence, baseline comparison, traffic provider, data provenance, health check, and config.

```bash
# Memory mode (default)
npm test

# MongoDB mode
DATA_STORE_MODE=mongodb npm test
```

---

## API Reference

See [docs/api.md](../docs/api.md) for the complete REST and Socket.IO API reference.

---

## Project Documentation

- [Architecture](../docs/architecture.md)
- [System Design](../docs/system-design.md)
- [API Reference](../docs/api.md)
- [Evaluation Methodology](../docs/evaluation.md)
- [Testing Guide](../docs/testing.md)