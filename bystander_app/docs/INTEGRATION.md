# UyirKappan — Team Integration Contract
## Module 1: Bystander Mobile Application

This document defines the integration boundaries, REST API contracts, Socket.IO real-time event schemas, authentication flows, and data models for integrating **Module 1 (Bystander Mobile Application)** with the rest of the **UyirKappan** platform (Intelligent Dispatch Engine, Driver Application, Hospital Dashboard, and Live Tracking/ETA Layer).

---

## 1. Responsibilities & Architectural Boundaries

| Module | Core Responsibility | What It Exchanges with Module 1 |
| :--- | :--- | :--- |
| **Module 1 (Bystander App)** | Emergency entry point, GPS capture, category/victim selection, client-side T0 timestamp, live ambulance tracking, and status presentation. | Produces `EmergencyRequest` submission payload; consumes tracking and status streams. |
| **Backend & Dispatch Engine** | Ambulance candidate scoring (H3 geospatial index, Dijkstra routing, ETA), request persistence, driver assignment, cascading fallback management. | Ingests requests, returns `requestId`, pushes `ASSIGNED`, `ACCEPTED`, or `FALLBACK_TRIGGERED` events. |
| **Driver Application** | Driver accept/reject actions, en-route status transitions. | Triggers `DRIVER_ACCEPTED`, `DRIVER_REJECTED`, `ARRIVED_AT_PATIENT`, `PATIENT_ONBOARD`. |
| **Live Tracking & ETA (Module 6)** | High-frequency telemetry ingestion, dynamic ETA recalculation, Socket.IO broadcast. | Emits `ambulance:location` (`LOCATION_UPDATED`) and `ambulance:route` (`ETA_UPDATED`) events. |
| **Hospital Dashboard** | Bed allocation, triage preparation, patient intake confirmation. | Updates request status to `ARRIVED_AT_HOSPITAL` and `COMPLETED`. |

> [!NOTE]
> Module 1 **does NOT** compute Dijkstra shortest paths, traffic matrices, or candidate driver scoring. It operates strictly as a consumer of standard REST APIs and Socket.IO real-time event streams.

---

## 2. Authentication & User Management Endpoints

Module 1 supports both registered user sessions (with persistent JWT tokens) and immediate emergency bypass.

### 2.1. User Registration
- **Method**: `POST`
- **Endpoint**: `/api/auth/register`
- **Request Headers**: `Content-Type: application/json`
- **Request Body**:
  ```json
  {
    "name": "Vishwak Suda",
    "phone": "+91 9876543210",
    "email": "bystander@uyirkappan.demo",
    "password": "password123",
    "role": "BYSTANDER"
  }
  ```
- **Response (201 Created)**:
  ```json
  {
    "success": true,
    "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "user": {
      "id": "USR-BYSTANDER-001",
      "name": "Vishwak Suda",
      "email": "bystander@uyirkappan.demo",
      "phone": "+91 9876543210",
      "role": "BYSTANDER"
    }
  }
  ```

---

### 2.2. User Login
- **Method**: `POST`
- **Endpoint**: `/api/auth/login`
- **Request Headers**: `Content-Type: application/json`
- **Request Body**:
  ```json
  {
    "email": "bystander@uyirkappan.demo",
    "password": "password123"
  }
  ```
- **Response (200 OK)**:
  ```json
  {
    "success": true,
    "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "user": {
      "id": "USR-BYSTANDER-001",
      "name": "Vishwak Suda",
      "email": "bystander@uyirkappan.demo",
      "phone": "+91 9876543210",
      "role": "BYSTANDER"
    }
  }
  ```

---

### 2.3. Get Current User Profile
- **Method**: `GET`
- **Endpoint**: `/api/auth/me`
- **Request Headers**:
  ```http
  Authorization: Bearer <JWT-Token>
  ```
- **Response (200 OK)**:
  ```json
  {
    "id": "USR-BYSTANDER-001",
    "name": "Vishwak Suda",
    "email": "bystander@uyirkappan.demo",
    "phone": "+91 9876543210",
    "role": "BYSTANDER"
  }
  ```

---

## 3. Emergency Request REST Endpoints

> [!TIP]
> Module 1 defaults to `/api/emergency` and automatically supports `/api/emergency-requests` as a backwards-compatible alias.

### 3.1. Submit Emergency Request
- **Method**: `POST`
- **Endpoints**: `/api/emergency` *(Primary)* or `/api/emergency-requests` *(Alias)*
- **Headers**:
  ```http
  Content-Type: application/json
  Authorization: Bearer <Optional-JWT-Token>
  ```
- **Request Body**:
  ```json
  {
    "userId": "USR-BYSTANDER-001",
    "requesterName": "Vishwak Suda",
    "phone": "+91 9876543210",
    "emergencyType": "CRITICAL",
    "victimCount": 1,
    "patientCondition": "Patient collapsed, unresponsive",
    "notes": "Patient collapsed, unresponsive",
    "latitude": 13.082700,
    "longitude": 80.270700,
    "accuracy": 5.0,
    "address": "Chennai Central, Station Rd, Park Town, Chennai, Tamil Nadu 600003",
    "t0UserPressed": "2026-09-05T10:00:00.000Z"
  }
  ```
- **Response (201 Created)**:
  ```json
  {
    "id": "UK-20260905-0042",
    "requestId": "UK-20260905-0042",
    "userId": "USR-BYSTANDER-001",
    "emergencyType": "CRITICAL",
    "victimCount": 1,
    "status": "SEARCHING",
    "latitude": 13.082700,
    "longitude": 80.270700,
    "locationAccuracy": 5.0,
    "pickupLocation": {
      "latitude": 13.082700,
      "longitude": 80.270700,
      "address": "Chennai Central, Station Rd, Park Town, Chennai, Tamil Nadu 600003"
    },
    "createdAt": "2026-09-05T10:00:01.000Z",
    "t0UserPressed": "2026-09-05T10:00:00.000Z",
    "t1RequestReceived": "2026-09-05T10:00:01.000Z"
  }
  ```

---

### 3.2. Get Emergency Details & Status
- **Method**: `GET`
- **Endpoints**: `/api/emergency/:id` *(Primary)* or `/api/emergency-requests/:id/status` *(Alias)*
- **Response (200 OK)**:
  ```json
  {
    "id": "UK-20260905-0042",
    "requestId": "UK-20260905-0042",
    "status": "EN_ROUTE_TO_PATIENT",
    "emergencyType": "CRITICAL",
    "victimCount": 1,
    "assignedAmbulanceId": "AMB-CH-042",
    "assignedDriverName": "Karthik Raja",
    "driverPhone": "+91 98401 23456",
    "vehicleNumber": "TN 01 AB 1234",
    "etaMinutes": 6,
    "fallbackCount": 0,
    "createdAt": "2026-09-05T10:00:01.000Z"
  }
  ```

---

### 3.3. Cancel Emergency Request
- **Method**: `POST`
- **Endpoints**: `/api/emergency/:id/cancel` *(Primary)* or `/api/emergency-requests/:id/cancel` *(Alias)*
- **Allowed Statuses for Cancellation**: `CREATED`, `PENDING`, `SEARCHING`, `ASSIGNED`.
- **Request Body**:
  ```json
  {
    "reason": "Patient transported via private vehicle"
  }
  ```
- **Response (200 OK)**:
  ```json
  {
    "id": "UK-20260905-0042",
    "requestId": "UK-20260905-0042",
    "status": "CANCELLED",
    "cancellationReason": "Patient transported via private vehicle"
  }
  ```

---

### 3.4. Get User Emergency History
- **Method**: `GET`
- **Endpoint**: `/api/emergency/my`
- **Headers**:
  ```http
  Authorization: Bearer <JWT-Token>
  ```
- **Response (200 OK)**:
  ```json
  [
    {
      "id": "UK-20260905-0042",
      "emergencyType": "CRITICAL",
      "status": "COMPLETED",
      "createdAt": "2026-09-05T10:00:01.000Z",
      "victimCount": 1
    }
  ]
  ```

---

## 4. Request Status Lifecycle Enum

The lifecycle strictly conforms to the following state codes:

```
CREATED
   ↓
PENDING
   ↓
SEARCHING ────────────→ NO_AMBULANCE_AVAILABLE (Terminal: 108 helpline offered)
   ↓
ASSIGNED
   ↓ (Driver Rejects / Timeout → FALLBACK_STARTED → Re-enters SEARCHING)
ACCEPTED
   ↓
EN_ROUTE_TO_PATIENT (or EN_ROUTE)
   ↓
ARRIVED_AT_PATIENT (or ARRIVED)
   ↓
PATIENT_ONBOARD
   ↓
EN_ROUTE_TO_HOSPITAL
   ↓
ARRIVED_AT_HOSPITAL
   ↓
COMPLETED (Terminal)

* CANCELLED can occur from any active state prior to ACCEPTED / EN_ROUTE.
```

### Status Mapping Reference Table

| Status String | UI Display Name | Description |
| :--- | :--- | :--- |
| `CREATED` | Request Created | Client initialized emergency record. |
| `PENDING` | Request Submitted | Received by server, awaiting dispatch processing. |
| `SEARCHING` | Locating Nearest Unit | Dispatch engine querying H3 spatial index and candidate scoring. |
| `ASSIGNED` | Ambulance Assigned | Vehicle candidate matched; driver alert dispatched. |
| `ACCEPTED` | Driver Accepted | Driver confirmed dispatch on Driver App. |
| `EN_ROUTE_TO_PATIENT` | En Route to Scene | Ambulance actively navigating to patient GPS coordinates. |
| `ARRIVED_AT_PATIENT` | Arrived at Scene | Ambulance on scene; paramedics providing immediate care. |
| `PATIENT_ONBOARD` | Patient Onboard | Victim loaded; ambulance preparing transit to hospital. |
| `EN_ROUTE_TO_HOSPITAL` | En Route to Hospital | Ambulance heading to assigned trauma emergency bay. |
| `ARRIVED_AT_HOSPITAL` | Arrived at Hospital | Vehicle arrived at hospital emergency receiving area. |
| `COMPLETED` | Mission Completed | Patient handed over, case successfully closed. |
| `CANCELLED` | Request Cancelled | Bystander or operator cancelled request. |
| `NO_AMBULANCE_AVAILABLE` | No Units Available | All fleet units busy; provides direct 108 helpline fallback. |

---

## 5. Real-Time Socket.IO Event Contract

Module 1 connects to the backend Socket.IO server at `http://localhost:4000` (or `API_BASE_URL`):

- **Transport**: `websocket`, `polling` fallback
- **Auth Handshake**: `{ token: "<JWT-Token>" }`
- **Room Subscription**: On request submission or session recovery, Module 1 emits:
  ```json
  // Event: "join:request" (alias "join_room")
  {
    "requestId": "UK-20260905-0042"
  }
  ```

### Inbound Server Events Handled by Module 1

| Event Name | Aliases Supported | Trigger Condition | Payload Schema |
| :--- | :--- | :--- | :--- |
| `emergency:assigned` | `AMBULANCE_ASSIGNED` | Dispatch engine assigns vehicle | `{"ambulanceId": "AMB-CH-042", "driverName": "Karthik Raja", "driverPhone": "+91 98401 23456", "vehicleNumber": "TN 01 AB 1234"}` |
| `emergency:status` | `STATUS_UPDATED`, `STATUS_CHANGE` | Any lifecycle transition | `{"requestId": "UK-20260905-0042", "status": "EN_ROUTE_TO_PATIENT"}` |
| `ambulance:location` | `LOCATION_UPDATED` | Driver telemetry broadcast (1–5 Hz) | `{"latitude": 13.0852, "longitude": 80.2731, "heading": 180, "speedKmH": 48.5, "timestamp": "2026-09-05T10:02:15.000Z"}` |
| `ambulance:route` | `ETA_UPDATED` | Dynamic ETA recalculation | `{"routeWaypoints": [[80.2780, 13.0900], [80.2707, 13.0827]], "etaMinutes": 6, "distanceMeters": 2100}` |
| `fallback:started` | `FALLBACK_STARTED`, `FALLBACK_TRIGGERED` | Driver rejection or 30s timeout | `{"attempt": 1, "previousAmbulanceId": "AMB-CH-011", "status": "SEARCHING"}` |
| `emergency:completed` | `REQUEST_COMPLETED` | Hospital handover confirmed | `{"requestId": "UK-20260905-0042", "status": "COMPLETED"}` |
| `emergency:cancelled` | `REQUEST_CANCELLED` | Request cancelled | `{"requestId": "UK-20260905-0042", "status": "CANCELLED", "reason": "..."}` |
| `emergency:no_ambulance` | `NO_AMBULANCE_AVAILABLE` | Zero units available | `{"requestId": "UK-20260905-0042", "status": "NO_AMBULANCE_AVAILABLE"}` |

---

## 6. Evaluation Timestamp Metrics (T0 — T6)

To support response time benchmarking and viva evaluations:
- **T0**: Time bystander taps "Request Ambulance" on mobile app (`t0UserPressed`).
- **T1**: Time backend receives and registers emergency request (`t1RequestReceived`).
- **T2**: Time dispatch candidate matching algorithm completes.
- **T3**: Time assignment notification is dispatched to driver device.
- **T4**: Time driver accepts assignment.
- **T5**: Time ambulance wheels roll en route to scene.
- **T6**: Time ambulance arrives at patient GPS location.

**Derived Performance Metrics**:
- $\text{Dispatch Latency} = T3 - T0$
- $\text{Driver Response Time} = T4 - T3$
- $\text{Travel Time} = T6 - T5$
- $\text{Total Response Time} = T6 - T0$

---

## 7. Dual-Mode Operation (Live Backend vs. Offline Simulation)

Module 1 features an **Adaptive Architecture** with a one-tap switch in the top header:

- **`[⚡ LIVE BACKEND]` Mode**:
  - Connects to the real Node.js / Express backend at `http://localhost:4000`.
  - Uses `RemoteEmergencyRequestDataSource` and `RemoteTrackingDataSource`.
  - Transmits JWT token in `Authorization: Bearer <token>` headers.
  - Subscribes to live Socket.IO events.

- **`[🧪 SIMULATION]` Mode**:
  - Operates completely offline with zero backend or database dependencies.
  - Powered by `MockEmergencyRequestDataSource` and `MockTrackingDataSource`.
  - Simulates the exact 10 Socket.IO event payloads through Dart `StreamController`s.
  - Includes 40 real-coordinate Chennai ambulances and 30 trauma centers.

### Environment Configuration Flags
You can configure the backend target at compile or run time via `--dart-define`:
```bash
# Connect to custom live backend URL
flutter run -d chrome --dart-define=API_BASE_URL=https://api.uyirkappan.org --dart-define=IS_SIMULATION=false

# Default development backend (http://localhost:4000)
flutter run -d chrome
```

---

## 8. Verification & Test Credentials

| Parameter | Demo Value |
| :--- | :--- |
| **Email** | `bystander@uyirkappan.demo` |
| **Password** | `password123` |
| **Role** | `BYSTANDER` |
| **Backend REST Base** | `http://localhost:4000/api` |
| **Socket.IO Host** | `http://localhost:4000` |
