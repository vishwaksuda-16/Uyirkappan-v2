# UyirKappan — Real-Time Emergency Response Platform
## Module 1: Bystander Mobile Application (Backend Integration & Verification Complete)

[![Flutter](https://img.shields.io/badge/Flutter-3.29.0+-02569B?logo=flutter)](https://flutter.dev)
[![Dart](https://img.shields.io/badge/Dart-3.7.0+-0175C2?logo=dart)](https://dart.dev)
[![Material 3](https://img.shields.io/badge/Material_3-High_Contrast_Emergency-6200EE)](https://m3.material.io)
[![OpenFreeMap](https://img.shields.io/badge/Map-OpenFreeMap_MapLibre_GL-00A86B)](https://openfreemap.org)
[![Architecture](https://img.shields.io/badge/Architecture-Clean_Architecture-brightgreen)](#architecture)
[![Tests](https://img.shields.io/badge/Tests-30%2F30_Passing-brightgreen)](#testing)

**UyirKappan** is a life-critical emergency medical response platform designed for sub-second incident reporting, automated ambulance dispatch, dynamic driver routing, and hospital coordination.

**Module 1 (Bystander Mobile Application)** provides the primary emergency interface used by bystanders, witnesses, and patients. It supports 1-tap immediate dispatch, GPS location detection, manual pin adjustment, live vehicle tracking, dynamic ETA countdowns, and cascading fallback handling.

---

## 🏛 Clean Architecture & System Design

The module is built with strict decoupling following the **Repository Pattern** and **Clean Architecture**:

```
UI Layer (Screens, Widgets, Responsive Docks)
       ↓
Controller Layer (ChangeNotifier State Management)
  ├── EmergencyController   (Lifecycle, Submission, Fallback, 10 Statuses)
  ├── LocationController    (GPS Ingestion, Reverse Geocoding, Manual Pin)
  ├── AuthController        (JWT Token Storage, Login, Register, Profile)
  └── SimulationController  (Viva/Demo Engine with 4 Scenario Flows)
       ↓
Domain Layer (Pure Business Entities & Repository Contracts)
  ├── Entities: EmergencyRequest, UserProfile, LocationData, TrackingInfo
  └── Repositories: EmergencyRequestRepository, TrackingRepository
       ↓
Data Layer (DataSources & Persistence)
  ├── Adaptive DataSources  (Auto-switches between Live Backend and Simulation)
  ├── Remote DataSources    (REST HTTP Client & Socket.IO Event Listener)
  ├── Mock DataSources      (Standalone deterministic test data with 40 units)
  └── Local DataSource      (SharedPreferences for persistent session recovery)
```

---

## ⚡ Dual-Mode Operation (Live Backend vs. Offline Simulation)

Module 1 features an **Adaptive Architecture** with a one-tap switch in the top header:

- **`[⚡ LIVE BACKEND]` Mode**:
  - Connects directly to the Node.js / Express backend at `http://localhost:4000`.
  - Sends authenticated requests with `Authorization: Bearer <JWT-Token>`.
  - Connects to Socket.IO at `http://localhost:4000` and joins room `emergency:{requestId}`.
  - Subscribes to live vehicle telemetry and status updates.

- **`[🧪 SIMULATION]` Mode**:
  - Operates completely offline without requiring any backend services running.
  - Powered by `MockEmergencyRequestDataSource` and `MockTrackingDataSource`.
  - Accurately emits the exact 10 Socket.IO event payloads through simulated streams.
  - Includes 40 real-coordinate Chennai ambulances and 30 trauma centers.

---

## 🧪 4 Interactive Demonstration Scenarios

Accessible via the **"SCENARIOS"** menu in the top bar:

| Scenario | Flow Demonstrated | Backend Event Lifecycle |
| :--- | :--- | :--- |
| **Scenario 1: Normal Dispatch** | Standard dispatch with optimal candidate matching | `EMERGENCY_CREATED` → `AMBULANCE_ASSIGNED` → `ASSIGNMENT_ACCEPTED` → `AMBULANCE_LOCATION_UPDATED` → `ETA_UPDATED` → `ARRIVED_AT_PATIENT` → `PATIENT_ONBOARD` → `EN_ROUTE_TO_HOSPITAL` → `COMPLETED` |
| **Scenario 2: Driver Rejection & Fallback** | Nearest driver rejects; system cascades to secondary unit | Driver rejects → `FALLBACK_STARTED` (Attempt #1) → `AMBULANCE_REASSIGNED` to next unit → Normal journey resumes |
| **Scenario 3: Driver Timeout** | Driver does not respond within SLA; automatic cascade | 30s timeout → `FALLBACK_STARTED` (Attempt #1) → `AMBULANCE_REASSIGNED` → Live tracking resumes |
| **Scenario 4: No Ambulance Available** | Network capacity saturated (all 40 units deployed) | Searching → `NO_AMBULANCE_AVAILABLE` → Immediate self-transport hospital routing + 1-tap 108 helpline |

---

## 📋 Module 1 Verification & Specification Matrix

| # | Verification Item | Backend Contract / Standard | Status |
|---|---|---|:---:|
| **1** | **Auth & User Management** | `POST /api/auth/register`, `POST /api/auth/login`, `GET /api/auth/me`, JWT storage, demo credentials (`bystander@uyirkappan.demo` / `password123`), role: `BYSTANDER` | ✅ Verified |
| **2** | **Location Capture** | GPS location capture (`{latitude, longitude, accuracy}`), permission handling, manual pin adjustment | ✅ Verified |
| **3** | **Emergency Info Entry** | 7 emergency categories, victim stepper ($\ge 1$), input validation | ✅ Verified |
| **4** | **Create Emergency Request** | `POST /api/emergency`, payload `{ emergencyType, victimCount, pickupLocation }` | ✅ Verified |
| **5** | **Emergency Status Display** | 11 exact user-friendly statuses matching backend lifecycle states | ✅ Verified |
| **6** | **Get Emergency Details** | `GET /api/emergency/{requestId}` returning 9 core fields | ✅ Verified |
| **7** | **Live Ambulance Tracking** | Dynamic movement along route waypoints, auto-centering, driver profile | ✅ Verified |
| **8** | **Socket.IO Real-Time Events** | Listens to all 10 real-time events on room `emergency:{requestId}` | ✅ Verified |
| **9** | **ETA Display** | Formatted as `"ETA: X minutes"`, dynamic calculation on marker & dock | ✅ Verified |
| **10** | **Push Notifications** | In-app floating alert banner on dispatch, arrival, and reassignment | ✅ Verified |
| **11** | **Cancel Emergency** | `POST /api/emergency/{requestId}/cancel`, restricted to 4 early statuses | ✅ Verified |
| **12** | **Fallback Visibility** | `FALLBACK_STARTED` & `AMBULANCE_REASSIGNED`, attempt counter | ✅ Verified |
| **13** | **Request History** | Persistent storage via `SharedPreferences`, history inspection modal | ✅ Verified |
| **14** | **Voice / Toll-Free Fallback**| Direct 108 helpline integration modal with automated IVR dispatch | ✅ Verified |
| **15** | **Simulation Mode** | Dual-mode switch with 4 test scenarios and full API parity | ✅ Verified |
| **16** | **Error Handling** | HTTP 400, 401, 403, 404, 409 mapping, offline fallback | ✅ Verified |
| **17** | **API Reference** | Aligned endpoints with base URL `http://localhost:4000/api` | ✅ Verified |
| **18** | **End-to-End Flow** | Complete 19-step lifecycle verified from standby to hospital handover | ✅ Verified |
| **19** | **Screen Navigation** | Modal sheets preserving map continuity and live tracking | ✅ Verified |
| **20** | **UI/UX Requirements** | High-contrast emergency theme, zero overlaps, dark/light mode | ✅ Verified |

---

## 🗺 Map Rendering (Zero API Key Requirement)

This project uses **OpenFreeMap** with **MapLibre GL JS**:
- **Zero API Keys Required**: No Google Maps billing or API key setup needed for development or deployment.
- **Vector Styles**: Supports 3D buildings, Bright, Liberty, and Dark styles.
- **Smooth Navigation**: Route geometry rendered with Google Maps navigation blue polyline (`#4285F4`).
- **Camera Stability**: Normalized bounding box coordinates prevent antimeridian wrapping; route framing is keyed to destination legs to eliminate camera zoom jitter while vehicles are moving.

---

## 🚀 Getting Started

### 1. Prerequisites
- **Flutter SDK**: `>= 3.19.0` (Dart `>= 3.0.0`)
- **Web Browser / Mobile Emulator**: Chrome, Edge, Android Emulator, or iOS Simulator.

### 2. Install Dependencies
```bash
flutter pub get
```

### 3. Run the Application
```bash
# Run on Web (Chrome)
flutter run -d chrome

# Run on Android / iOS / Desktop
flutter run
```

### 4. Run Tests & Static Analysis
```bash
# Verify static analysis (0 errors, 0 warnings)
flutter analyze

# Run unit, controller, and widget test suites (30/30 tests pass)
flutter test
```

---

## 🔑 Demo Credentials

| Parameter | Value |
| :--- | :--- |
| **Email** | `bystander@uyirkappan.demo` |
| **Password** | `password123` |
| **Role** | `BYSTANDER` |
| **Backend URL** | `http://localhost:4000` |
| **Socket.IO URL** | `http://localhost:4000` (Namespace / Root) |

---

## 📁 Repository Structure

```
lib/
├── core/
│   ├── constants/              # ApiConstants, MapConstants, AppConstants
│   └── theme/                  # AppColors (High-contrast emergency palette)
├── data/
│   ├── datasources/
│   │   ├── adaptive/           # Adaptive data sources (switches live/simulation)
│   │   ├── local/              # RequestLocalDataSource (SharedPreferences)
│   │   ├── mock/               # MockEmergencyRequestDataSource, MockTrackingDataSource
│   │   └── remote/             # RemoteAuthDataSource, RemoteEmergencyDataSource, SocketService
│   ├── models/                 # EmergencyRequestModel, TrackingInfo, NearbyHospital
│   └── repositories/           # EmergencyRequestRepositoryImpl, TrackingRepositoryImpl
├── domain/
│   ├── entities/               # EmergencyRequest, UserProfile, RequestStatus, LocationData
│   └── repositories/           # Abstract repository contracts
├── presentation/
│   ├── controllers/            # EmergencyController, LocationController, AuthController, SimulationController
│   ├── screens/
│   │   ├── auth/               # AuthScreen (Login, Register, JWT display)
│   │   ├── home/               # HomeScreen (Map, Top Bar, Floating Actions, Bottom Dock)
│   │   ├── review/             # ReviewRequestScreen (Summary verification)
│   │   └── status/             # RequestStatusScreen
│   └── widgets/                # EmergencyButton, StatusBadge, CounterStepper, TypeGrid, MapView
└── routing/                    # AppRouter, RoutePaths
```

---

## 🤝 Team Integration Notes

- For full REST endpoint schemas, payload definitions, and Socket.IO events, consult [`docs/INTEGRATION.md`](docs/INTEGRATION.md).
- For OpenFreeMap / MapLibre architecture and coordinate references, see [`docs/OPENFREEMAP_MAPLIBRE_GUIDE.md`](docs/OPENFREEMAP_MAPLIBRE_GUIDE.md).
