# UyirKappan — Module 2: Driver / Ambulance Provider Application

A production-quality Flutter application serving as the operational interface for ambulance drivers participating in the **UyirKappan** intelligent emergency-response ecosystem.

---

## 🚑 Key Capabilities

- **Strict Driver Lifecycle Finite-State Machine**:
  Enforces all documented state transitions: `OFFLINE` ➔ `AVAILABLE` ➔ `ASSIGNMENT_RECEIVED` ➔ `ACCEPTED` ➔ `EN_ROUTE_TO_PATIENT` ➔ `ARRIVED_AT_PATIENT` ➔ `PATIENT_ONBOARD` ➔ `EN_ROUTE_TO_HOSPITAL` ➔ `ARRIVED_AT_HOSPITAL` ➔ `COMPLETED` ➔ `AVAILABLE`.
- **Assignment Response with 15-Second Countdown**:
  Visual countdown dial enforcing timely driver responses. Auto-triggers `TIMEOUT` and cascading fallback if unanswered within the configured timeout period.
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

### 2. Run with Deployed Backend (Simulation GPS - Safe Default)
```bash
flutter run -d chrome \
  --dart-define=APP_MODE=real \
  --dart-define=LOCATION_PROVIDER=simulation \
  --dart-define=API_BASE_URL=<YOUR_DEPLOYED_BACKEND_URL>/api \
  --dart-define=SOCKET_URL=<YOUR_DEPLOYED_BACKEND_URL>
```

### 3. Run on Physical Device with Real GPS
```bash
flutter run -d <device-id> \
  --dart-define=APP_MODE=real \
  --dart-define=LOCATION_PROVIDER=real \
  --dart-define=API_BASE_URL=<YOUR_DEPLOYED_BACKEND_URL>/api \
  --dart-define=SOCKET_URL=<YOUR_DEPLOYED_BACKEND_URL>
```

#### Android GPS Permissions
The app declares `ACCESS_FINE_LOCATION` and `ACCESS_COARSE_LOCATION` in `android/app/src/main/AndroidManifest.xml`.
When running with `LOCATION_PROVIDER=real`:
- The app checks and requests foreground runtime permissions via `geolocator`.
- The real-time HUD displays `GPS LIVE` (Green) when locked.
- If GPS permissions are denied or location services are disabled, the system automatically transitions to `GPS SIMULATION` (Cyan) to prevent app disruption during demonstrations.
- The `GpsQualityFilter` validates coordinates, staleness, and prevents impossible kinematic displacement ($> 180\text{ km/h}$). Signals with accuracy $> 100\text{m}$ are badged as `GPS DEGRADED` (Amber).

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
