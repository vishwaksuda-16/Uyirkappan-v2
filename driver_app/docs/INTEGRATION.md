# UyirKappan — Module 2: Driver / Ambulance Provider Application
## Integration & Architecture Guide

This document serves as the technical integration specification for connecting the **Module 2 Driver Application** with the central **UyirKappan Backend** and **Intelligent Dispatch Engine**.

---

## 1. System Architecture & Separation of Concerns

```
┌────────────────────────────────────────────────────────┐
│               PRESENTATION LAYER (UI)                  │
│   • LoginScreen                • DashboardScreen       │
│   • AssignmentReceivedScreen   • ActiveNavigationScreen│
│   • DriverProfileScreen        • SimulationControls    │
└───────────────────────────┬────────────────────────────┘
                            │
┌───────────────────────────▼────────────────────────────┐
│               STATE MANAGEMENT LAYER                   │
│   • AuthState                  • DriverState           │
│   • NavigationState            • DriverStateMachine    │
└───────────────────────────┬────────────────────────────┘
                            │
┌───────────────────────────▼────────────────────────────┐
│                  REPOSITORY LAYER                      │
│   • DriverRepository (Abstract Contract)               │
│   • DriverRepositoryImpl                               │
└─────────────┬────────────────────────────┬─────────────┘
              │                            │
┌─────────────▼───────────────┐ ┌──────────▼─────────────┐
│      SIMULATION LAYER       │ │      REAL API LAYER    │
│  • SimulatedApiService      │ │  • RealApiService      │
│  • SimulatedSocketService   │ │  • RealSocketService   │
│  • SimulatedLocationService │ │  • SharedPreferences   │
│  • RoadNetwork (Chennai)    │ │    Token Storage       │
└─────────────────────────────┘ └────────────────────────┘
```

The presentation layer interacts exclusively with `AuthState`, `DriverState`, and `NavigationState`. Neither widgets nor UI state have direct dependencies on HTTP clients, WebSockets, or simulation timers.

---

## 2. Driver Lifecycle State Machine

The driver operational lifecycle strictly enforces the finite-state transitions documented in the specification:

```
                      ┌───────────────┐
                      │    OFFLINE    │
                      └───────┬───────┘
                              │
                      ┌───────▼───────┐
           ┌──────────┤   AVAILABLE   │◄──────────────┐
           │          └───────┬───────┘               │
           │                  │ (Dispatch Inbound)    │
           │          ┌───────▼──────────────┐        │
           │          │ ASSIGNMENT_RECEIVED  │        │
           │          └───────┬──────────────┘        │
           │                  │                       │
           │       ┌──────────┼──────────┐            │
           │       │ (Accept) │ (Reject) │ (Timeout)  │
           │       │          ▼          ▼            │
           │       │       REJECTED   TIMEOUT         │
           │       │          │          │            │
           │       │          └────┬─────┘            │
           │       │               ▼                  │
           │       │        Cascading Fallback        │
           │       │        Engine Dispatches Next    │
           │       │               │                  │
           │       │               └──────────────────┤
           │       ▼                                  │
           │  ┌──────────────┐                        │
           │  │   ACCEPTED   │                        │
           │  └───────┬──────┘                        │
           │          ▼                               │
           │  ┌──────────────────────┐                │
           │  │ EN_ROUTE_TO_PATIENT  │                │
           │  └───────┬──────────────┘                │
           │          ▼                               │
           │  ┌──────────────────────┐                │
           │  │  ARRIVED_AT_PATIENT  │                │
           │  └───────┬──────────────┘                │
           │          ▼                               │
           │  ┌──────────────────────┐                │
           │  │   PATIENT_ONBOARD    │                │
           │  └───────┬──────────────┘                │
           │          ▼ (Hospital Assigned)           │
           │  ┌──────────────────────┐                │
           │  │ EN_ROUTE_TO_HOSPITAL │                │
           │  └───────┬──────────────┘                │
           │          ▼                               │
           │  ┌──────────────────────┐                │
           │  │ ARRIVED_AT_HOSPITAL  │                │
           │  └───────┬──────────────┘                │
           │          ▼                               │
           │  ┌──────────────┐                        │
           │  │  COMPLETED   │                        │
           │  └───────┬──────┘                        │
           │          └───────────────────────────────┘
           ▼
(Driver toggles OFFLINE)
```

### Transition Verification Rules:
- Direct jumps across phases (e.g. `AVAILABLE` → `PATIENT_ONBOARD`) are prevented by `DriverStateMachine.validateTransition()`, throwing `InvalidStateTransitionException`.
- Status mapping:
  - `AVAILABLE`, `COMPLETED`, `REJECTED`, `TIMEOUT` → Ambulance Availability: `AVAILABLE`
  - `ACCEPTED`, `EN_ROUTE_TO_PATIENT`, `ARRIVED_AT_PATIENT`, `PATIENT_ONBOARD`, `EN_ROUTE_TO_HOSPITAL`, `ARRIVED_AT_HOSPITAL` → Ambulance Availability: `BUSY`
  - `OFFLINE` → Ambulance Availability: `OFFLINE`

---

## 3. Environment & Configuration

Runtime configuration is managed via `lib/core/config/app_config.dart`. Configuration values can be supplied at compile-time using `--dart-define`:

| Variable | Description | Default |
|---|---|---|
| `APP_MODE` | Operating mode: `simulation` or `real` | `simulation` |
| `API_BASE_URL` | Central REST backend URL | `http://localhost:5000/api` |
| `SOCKET_URL` | Central WebSocket server URL | `http://localhost:5000` |

### Switching to Real Backend
To switch from simulation mode to the live backend server:
```bash
flutter run -d chrome --dart-define=APP_MODE=real --dart-define=API_BASE_URL=https://api.uyirkappan.org/api --dart-define=SOCKET_URL=https://api.uyirkappan.org
```

---

## 4. REST API Integration Endpoints

All REST communication is abstracted in `lib/services/api/api_service.dart`. When `APP_MODE=real`, `RealApiService` executes the following contracts:

### 1. Driver Authentication
- **Endpoint**: `POST /api/drivers/login`
- **Request Body**:
  ```json
  {
    "driverId": "DRV-003",
    "password": "password123"
  }
  ```
- **Response** (`200 OK`):
  ```json
  {
    "driverId": "DRV-003",
    "name": "Karthik Subramanian",
    "providerId": "SIM-PROVIDER-01",
    "ambulanceId": "AMB-003",
    "phone": "+91 98401 23456",
    "availability": "OFFLINE",
    "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6..."
  }
  ```

### 2. Driver Profile
- **Endpoint**: `GET /api/drivers/me`
- **Headers**: `Authorization: Bearer <token>`
- **Response** (`200 OK`): Current `Driver` JSON.

### 3. Update Ambulance Availability
- **Endpoint**: `PATCH /api/ambulances/:id/status`
- **Request Body**:
  ```json
  {
    "availability": "AVAILABLE",
    "status": "AVAILABLE"
  }
  ```
- **Response** (`200 OK`): Updated `Ambulance` record.

### 4. Accept Assignment
- **Endpoint**: `POST /api/assignments/:id/accept`
- **Response** (`200 OK`): Updated `Assignment` record with `status: "ACCEPTED"`.

### 5. Reject Assignment
- **Endpoint**: `POST /api/assignments/:id/reject`
- **Request Body**:
  ```json
  {
    "reason": "Driver declined"
  }
  ```
- Triggers backend cascading fallback.

### 6. Update Assignment Status
- **Endpoint**: `POST /api/assignments/:id/status`
- **Request Body**:
  ```json
  {
    "status": "EN_ROUTE_TO_PATIENT"
  }
  ```
- Supported values: `EN_ROUTE_TO_PATIENT`, `ARRIVED_AT_PATIENT`, `PATIENT_ONBOARD`, `EN_ROUTE_TO_HOSPITAL`, `ARRIVED_AT_HOSPITAL`, `COMPLETED`.

### 7. Post Location Telemetry
- **Endpoint**: `POST /api/ambulances/:id/location`
- **Request Body**:
  ```json
  {
    "latitude": 13.0827,
    "longitude": 80.2707,
    "timestamp": "2026-09-05T12:00:00.000Z",
    "speed": 42.5,
    "heading": 135.0,
    "ambulanceId": "AMB-003",
    "requestId": "UK-000001"
  }
  ```

### 8. Get Assignment Route
- **Endpoint**: `GET /api/assignments/:id/route`
- **Response** (`200 OK`): `RouteModel` with ordered waypoints.

---

## 5. Real-Time Socket Events

Centralized in `lib/services/socket/socket_service.dart`.

### Inbound Events (Backend ➔ Driver App):
1. `ASSIGNMENT_RECEIVED`:
   Payload: Emergency assignment details. Triggers high-urgency alert modal and 10s countdown.
2. `ASSIGNMENT_CANCELLED`:
   Payload: `{ "requestId": "UK-000001" }`. Cleans up active emergency and returns ambulance to `AVAILABLE`.
3. `ETA_UPDATED`:
   Payload: `{ "newEtaMinutes": 11 }`. Dynamically updates HUD and displays traffic congestion banner.
4. `ROUTE_UPDATED`:
   Payload: `RouteModel`. Reroutes vector road canvas (e.g. road blockage detour).
5. `HOSPITAL_ASSIGNED`:
   Payload: `Hospital`. Updates destination hospital (e.g., Apollo Emergency Care H1).

### Outbound Events (Driver App ➔ Backend):
1. `location:update`:
   Continuous stream of `AmbulanceLocation` objects (lat, lng, speed, heading, timestamp).
2. `status:update`:
   Status changes broadcast to dispatch and hospital dashboards.
3. `assignment:response`:
   Emits `ACCEPTED` or `REJECTED`.

---

## 6. Simulation Center & Evaluation Scenarios

For research evaluation and deterministic testing, tap **Simulation Center** on the Dashboard:
- **Manual Mode (Mode A)**: Evaluator clicks Accept, Reject, or lets countdown expire.
- **Automated Fallback Demo (Mode B)**:
  Executes the cascading fallback sequence documented in Sections 11 & 27:
  - Attempt 1: `AMB-003` ➔ `TIMEOUT`
  - Attempt 2: `AMB-005` ➔ `REJECTED`
  - Attempt 3: `AMB-002` ➔ `ACCEPTED` (dispatches to app)
- **Traffic Spikes**: Injects +3 minute delay, recalculating dynamic ETA.
- **Road Blockage**: Reroutes path around Central Flyover via Chintadripet Link.
- **Speed Multiplier**: Fast-forward simulation at `1x`, `2x`, or `5x` speed.
- **Auditable Log**: View historical attempts with timestamps and outcomes.

---

## 7. Security & Authorization

- Session tokens (JWT) are securely stored in persistent local storage.
- Authorization boundary: Drivers are bound to their authorized vehicle (`DRV-003` ➔ `AMB-003`). Any attempt to operate or modify vehicles outside the authenticated driver's scope is prohibited.
