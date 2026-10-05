# UyirKappan — REST & Real-Time API Reference

**Base URL**: `http://localhost:5000/api`  
**WebSocket Server**: `http://localhost:5000` (Socket.IO v4+)

All protected endpoints require an HTTP header:
```http
Authorization: Bearer <JWT-Token>
```

---

## 1. Authentication Endpoints (`/api/auth`)

### 1.1 Register User
- **Method**: `POST /api/auth/register`
- **Body**:
  ```json
  {
    "name": "Kumar Sundaram",
    "phone": "+91 98401 23456",
    "email": "user@uyirkappan.demo",
    "password": "password123",
    "role": "BYSTANDER"
  }
  ```
- **Response (`201 Created`)**:
  ```json
  {
    "success": true,
    "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6...",
    "user": { "id": "USR-001", "name": "Kumar Sundaram", "role": "BYSTANDER" }
  }
  ```

### 1.2 Login User
- **Method**: `POST /api/auth/login`
- **Body**: `{ "email": "staff@uyirkappan.demo", "password": "password123" }`
- **Response (`200 OK`)**:
  ```json
  {
    "success": true,
    "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6...",
    "user": { "id": "STAFF-001", "role": "HOSPITAL_STAFF", "hospitalId": "H001" }
  }
  ```

### 1.3 Get Current User Profile
- **Method**: `GET /api/auth/me`
- **Response (`200 OK`)**: Authenticated user record.

---

## 2. Emergency Management (`/api/emergency`)

### 2.1 Create Emergency Incident
- **Method**: `POST /api/emergency`
- **Roles**: `BYSTANDER`, `ADMIN`
- **Body**:
  ```json
  {
    "emergencyType": "CARDIAC",
    "victimCount": 1,
    "pickupLocation": { "latitude": 13.0330, "longitude": 80.2210 }
  }
  ```
- **Response (`201 Created`)**:
  ```json
  {
    "success": true,
    "requestId": "UK-2026-000001",
    "status": "ASSIGNED",
    "ambulanceId": "AMB0001",
    "driverId": "DRV0001",
    "assignmentId": "ASSIGN-001",
    "destinationHospitalId": "H002",
    "eta": 4
  }
  ```

### 2.2 Get Emergency Details
- **Method**: `GET /api/emergency/:requestId`
- **Response (`200 OK`)**: Complete emergency request object including attempts and status.

### 2.3 Cancel Emergency
- **Method**: `POST /api/emergency/:requestId/cancel`
- **Body**: `{ "reason": "Patient stable" }`

### 2.4 Live Tracking Stream
- **Method**: `GET /api/emergency/:requestId/tracking`
- **Response (`200 OK`)**: Current ambulance coordinates, bearing, dynamic ETA, and destination hospital.

---

## 3. Driver & Assignment Endpoints (`/api/assignments`, `/api/driver`)

### 3.1 Get Driver Active Assignment
- **Method**: `GET /api/driver/assignment`
- **Roles**: `DRIVER`
- **Response (`200 OK`)**: Active pending/accepted assignment with route waypoints and timeout countdown.

### 3.2 Accept Assignment
- **Method**: `POST /api/assignments/:id/accept`
- **Roles**: `DRIVER`
- **Response (`200 OK`)**: Updated assignment with `status: "ACCEPTED"`. Double-accept attempts return `409 Conflict`.

### 3.3 Reject Assignment
- **Method**: `POST /api/assignments/:id/reject`
- **Roles**: `DRIVER`
- **Body**: `{ "reason": "Mechanical failure" }`
- **Response (`200 OK`)**: Triggers cascading fallback and frees ambulance.

### 3.4 Update Emergency Status
- **Method**: `PATCH /api/assignments/:id/status`
- **Roles**: `DRIVER`
- **Body**: `{ "status": "EN_ROUTE_TO_PATIENT" }`
- **Valid Progression**:
  `EN_ROUTE_TO_PATIENT` $\rightarrow$ `ARRIVED_AT_PATIENT` $\rightarrow$ `PATIENT_ONBOARD` $\rightarrow$ `EN_ROUTE_TO_HOSPITAL` $\rightarrow$ `ARRIVED_AT_HOSPITAL`.

---

## 4. Ambulance Telemetry (`/api/ambulances`)

### 4.1 Post GPS Telemetry
- **Method**: `POST /api/ambulances/:id/location`
- **Roles**: `DRIVER`, `ADMIN`
- **Body**:
  ```json
  {
    "latitude": 13.0750,
    "longitude": 80.2650,
    "speed": 45,
    "heading": 120
  }
  ```
- **Response (`200 OK`)**: Recalculates dynamic ETA and broadcasts `AMBULANCE_LOCATION_UPDATED`.

### 4.2 Update Ambulance Availability
- **Method**: `PATCH /api/ambulances/:id/status`
- **Body**: `{ "status": "AVAILABLE" }` (or `BUSY`, `OFFLINE`)

---

## 5. Hospital Management (`/api/hospitals`)

### 5.1 Inbound Emergency Queue
- **Method**: `GET /api/hospitals/:id/incoming`
- **Response (`200 OK`)**: Array of active inbound emergencies targeted to this hospital.

### 5.2 Get Hospital Capacity
- **Method**: `GET /api/hospitals/:id/resources`
- **Response (`200 OK`)**: `{ "generalBeds": 45, "icuBeds": 7, "ventilators": 4 }`

### 5.3 Update Hospital Capacity
- **Method**: `PATCH /api/hospitals/:id/resources`
- **Roles**: `HOSPITAL_STAFF`, `ADMIN`
- **Body**: `{ "icuBeds": 6 }`

### 5.4 Completed Emergency History
- **Method**: `GET /api/hospitals/:id/emergency-history`
- **Response (`200 OK`)**: Chronological archive of completed patient handovers.

---

## 6. Evaluation & System Status (`/api/evaluation`, `/api/system`)

- `GET /api/health`: Comprehensive health check with database mode, dataset counts, and traffic provider status.
- `GET /api/data-status`: Reports all 10 authoritative entity counts.
- `GET /api/provenance`: Data source tier mappings and trust boundary rules.
- `GET /api/evaluation/baseline/metadata`: Metadata from `dummy_ambulance_data.xlsx` (50 retrospective cases).
- `GET /api/evaluation/baseline/records`: Paged historical 108 cases.
- `GET /api/evaluation/baseline/comparison`: Benchmark response time comparison.

---

## 7. Socket.IO Real-Time Gateway

### Connection & Authentication
```javascript
const socket = io('http://localhost:5000', {
  auth: { token: 'eyJhbGciOiJIUzI1NiIsInR5cCI6...' }
});
```

### Client $\rightarrow$ Server Events
- `join_emergency`: `{ requestId: "UK-2026-000001" }`
- `join:hospital`: `{ hospitalId: "H001" }`

### Server $\rightarrow$ Client Events
| Event Name | Purpose | Target Channel |
| :--- | :--- | :--- |
| `EMERGENCY_CREATED` | Alert when incident is registered | Emergency & Hospital rooms |
| `AMBULANCE_ASSIGNED` | Notify driver of incoming dispatch alert | Driver socket |
| `ASSIGNMENT_ACCEPTED` | Confirm driver accepted mission | Emergency & Hospital rooms |
| `ASSIGNMENT_REJECTED` | Notify that driver rejected | Emergency room |
| `ASSIGNMENT_TIMEOUT` | Driver failed to respond within 15s | Emergency room |
| `FALLBACK_STARTED` | Cascading re-dispatch initiated | Emergency room |
| `AMBULANCE_LOCATION_UPDATED` | Live GPS coordinate & dynamic ETA stream | Emergency & Hospital rooms |
| `STATUS_UPDATED` | Lifecycle transition update | Emergency & Hospital rooms |
| `EMERGENCY_COMPLETED` | Patient delivered to hospital | Emergency & Hospital rooms |
