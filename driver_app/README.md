# UyirKappan — Module 2: Driver / Ambulance Provider Application

A production-quality Flutter application serving as the operational interface for ambulance drivers participating in the **UyirKappan** intelligent emergency-response ecosystem.

---

## 🚑 Key Capabilities

- **Strict Driver Lifecycle Finite-State Machine**:
  Enforces all documented state transitions: `OFFLINE` ➔ `AVAILABLE` ➔ `ASSIGNMENT_RECEIVED` ➔ `ACCEPTED` ➔ `EN_ROUTE_TO_PATIENT` ➔ `ARRIVED_AT_PATIENT` ➔ `PATIENT_ONBOARD` ➔ `EN_ROUTE_TO_HOSPITAL` ➔ `ARRIVED_AT_HOSPITAL` ➔ `COMPLETED` ➔ `AVAILABLE`.
- **Assignment Response with 10-Second Countdown**:
  Visual countdown dial enforcing timely driver responses. Auto-triggers `TIMEOUT` and cascading fallback if unanswered within 10 seconds.
- **Cascading Fallback Dispatching**:
  Reproduces the exact multi-ambulance fallback sequence (`AMB-003` ➔ `AMB-005` ➔ `AMB-002`) with an auditable dispatch attempts log for research evaluation.
- **Tactical Vector Navigation Canvas**:
  Full-screen Flutter vector-rendered road network (Chennai nodes: `Node 10` to `Node 24`, `Hospital H1`), animated vehicle marker with dynamic heading rotation, pulse rings, and waypoint badges.
- **Smooth Continuous Telemetry & Dynamic ETA**:
  Periodic location streaming with latitude, longitude, speed, heading, and distance-based dynamic ETA recalculation.
- **Dynamic Traffic & Road Block Rerouting**:
  Injectable traffic delays (+3 min ETA) and road blockage detours (via Chintadripet Link).
- **Dual-Mode Pluggable Architecture**:
  Seamlessly operates in **Simulation Mode** (zero backend dependency) or **Real Backend Mode** via clean abstractions (`ApiService`, `SocketService`, `DriverRepository`).

---

## 🚀 Quick Start

### 1. Run in Simulation Mode (Default)
```bash
flutter pub get
flutter run -d chrome
```

### 2. Run with Real Backend
```bash
flutter run -d chrome \
  --dart-define=APP_MODE=real \
  --dart-define=API_BASE_URL=https://api.uyirkappan.org/api \
  --dart-define=SOCKET_URL=https://api.uyirkappan.org
```

---

## 🧪 Testing & Verification

Run static analysis:
```bash
flutter analyze
```

Run test suite (State Machine, Telemetry, and Widget Tests):
```bash
flutter test
```

---

## 📖 Architecture & Integration

For complete API contracts, WebSocket events, and state diagrams, see [docs/INTEGRATION.md](docs/INTEGRATION.md).
