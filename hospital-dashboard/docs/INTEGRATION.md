# UyirKappan — Module 3: Hospital Dashboard Integration Specification

This document describes the exact REST API contracts, WebSocket payloads, authentication expectations, and system lifecycle events consumed by the **Hospital Dashboard (Module 3)**.

---

## 1. Authentication & Role Verification

### Staff Login
- **Endpoint**: `POST /api/auth/login`
- **Headers**: `Content-Type: application/json`
- **Request Body**:
  ```json
  {
    "email": "er.apollo@uyirkappan.org",
    "password": "your_secure_password",
    "hospitalId": "H01"
  }
  ```
- **Expected Response (`200 OK`)**:
  ```json
  {
    "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "user": {
      "id": "STAFF-001",
      "name": "Dr. A. Sundaram, MD",
      "badgeId": "ER-CHIEF-84",
      "email": "er.apollo@uyirkappan.org",
      "role": "HOSPITAL_STAFF",
      "department": "Emergency Medicine & Trauma",
      "hospitalId": "H01",
      "hospitalName": "Apollo Trauma & Emergency Center"
    }
  }
  ```

---

## 2. Hospital REST Endpoints

### 2.1 Get Hospital Details
- **Endpoint**: `GET /api/hospitals/:id`
- **Response**:
  ```json
  {
    "hospitalId": "H01",
    "name": "Apollo Trauma & Emergency Center",
    "tier": "Level 1 Trauma Center",
    "contactNumber": "+91 44 2829 0200",
    "emergencyHelpline": "1066",
    "address": "Greams Road, Thousand Lights, Chennai, TN 600006",
    "location": {
      "latitude": 13.0604,
      "longitude": 80.2496
    }
  }
  ```

### 2.2 Get Active Incoming Emergencies
- **Endpoint**: `GET /api/hospitals/:id/incoming`
- **Response (`200 OK`)**:
  ```json
  [
    {
      "requestId": "UK-2026-0001",
      "emergencyType": "CARDIAC",
      "victimCount": 1,
      "ambulanceId": "AMB-04",
      "driverName": "R. Kannan",
      "driverPhone": "+91 98401 22345",
      "hospitalId": "H01",
      "status": "EN_ROUTE_TO_HOSPITAL",
      "eta": 6,
      "initialEta": 10,
      "trafficCondition": "MODERATE",
      "currentLocation": {
        "latitude": 13.0658,
        "longitude": 80.2541,
        "speed": 46,
        "heading": 205,
        "address": "Anna Salai near Thousand Lights, Chennai",
        "timestamp": "2026-09-05T04:12:00.000Z"
      },
      "incidentLocation": {
        "latitude": 13.0827,
        "longitude": 80.2707,
        "address": "Near Central Railway Station, Chennai"
      },
      "patientNotes": "STEMI confirmed, automated CPR & Heparin administered.",
      "fallbackCount": 1,
      "createdAt": "2026-09-05T04:02:00.000Z",
      "updatedAt": "2026-09-05T04:12:00.000Z"
    }
  ]
  ```

### 2.3 Get Current Hospital Resources
- **Endpoint**: `GET /api/hospitals/:id/resources`
- **Response**:
  ```json
  {
    "hospitalId": "H01",
    "generalBeds": 14,
    "totalGeneralBeds": 25,
    "icuBeds": 3,
    "totalIcuBeds": 8,
    "ventilators": 2,
    "totalVentilators": 5,
    "updatedAt": "2026-09-05T04:10:00.000Z"
  }
  ```

### 2.4 Update Hospital Resource Availability
- **Endpoint**: `PATCH /api/hospitals/:id/resources`
- **Request Body**:
  ```json
  {
    "generalBeds": 12,
    "icuBeds": 2,
    "ventilators": 2
  }
  ```
- **Response (`200 OK`)**:
  ```json
  {
    "hospitalId": "H01",
    "generalBeds": 12,
    "icuBeds": 2,
    "ventilators": 2,
    "updatedAt": "2026-09-05T04:35:00.000Z"
  }
  ```

### 2.5 Get Emergency Response History
- **Endpoint**: `GET /api/hospitals/:id/emergency-history`
- **Query Params**: `?type=CARDIAC&page=1&limit=20`
- **Response**: Array of completed emergency request objects.

---

## 3. Emergency & Tracking REST Endpoints

### 3.1 Get Single Emergency Details
- **Endpoint**: `GET /api/emergency/:requestId`

### 3.2 Get Live Vehicle Telemetry
- **Endpoint**: `GET /api/emergency/:requestId/tracking`

### 3.3 Get Cascading Fallback Attempts Audit Trail
- **Endpoint**: `GET /api/requests/:requestId/attempts`
- **Response**:
  ```json
  [
    {
      "attemptNumber": 1,
      "ambulanceId": "AMB-02",
      "driverName": "S. Selvam",
      "assignedAt": "2026-09-05T04:02:10.000Z",
      "responseAt": "2026-09-05T04:02:25.000Z",
      "response": "TIMEOUT",
      "failureReason": "Driver non-response within 15s dispatch window"
    },
    {
      "attemptNumber": 2,
      "ambulanceId": "AMB-04",
      "driverName": "R. Kannan",
      "assignedAt": "2026-09-05T04:02:28.000Z",
      "responseAt": "2026-09-05T04:02:35.000Z",
      "response": "ACCEPTED",
      "failureReason": null
    }
  ]
  ```

---

## 4. Real-Time WebSocket Architecture

The dashboard connects to `VITE_SOCKET_URL` (default: `http://localhost:5000`) using `socket.io-client`.

### Room Subscriptions
Upon authentication, the client joins the hospital room:
```javascript
socket.emit('subscribe_hospital', { hospitalId: 'H01' });
```

### Event Specifications

#### 1. `NEW_INCOMING_EMERGENCY`
Emitted by backend when an emergency is routed toward the hospital.
```json
{
  "requestId": "UK-2026-0005",
  "emergencyType": "TRAUMA",
  "victimCount": 2,
  "ambulanceId": "AMB-09",
  "driverName": "E. Balaji",
  "driverPhone": "+91 98841 33445",
  "hospitalId": "H01",
  "status": "EN_ROUTE_TO_HOSPITAL",
  "eta": 8,
  "currentLocation": {
    "latitude": 13.055,
    "longitude": 80.245,
    "speed": 48,
    "heading": 180,
    "address": "Mount Road Junction, Chennai",
    "timestamp": "2026-09-05T04:30:00.000Z"
  }
}
```

#### 2. `LOCATION_UPDATED` (or `AMBULANCE_LOCATION_UPDATED`)
Emitted periodically as the ambulance moves (e.g. every 1-3 seconds).
```json
{
  "requestId": "UK-2026-0001",
  "ambulanceId": "AMB-04",
  "location": {
    "latitude": 13.0645,
    "longitude": 80.2520,
    "speed": 50,
    "heading": 210,
    "address": "Anna Salai approaching Greams Road",
    "timestamp": "2026-09-05T04:31:02.000Z"
  }
}
```

#### 3. `ETA_UPDATED`
Emitted whenever the ETA engine recalculates travel time due to traffic or progress.
```json
{
  "requestId": "UK-2026-0001",
  "eta": 5,
  "trafficCondition": "MODERATE",
  "timestamp": "2026-09-05T04:31:10.000Z"
}
```

#### 4. `STATUS_UPDATED`
Emitted during lifecycle transitions (`PATIENT_ONBOARD`, `EN_ROUTE_TO_HOSPITAL`, `ARRIVED_AT_HOSPITAL`, `COMPLETED`).
```json
{
  "requestId": "UK-2026-0001",
  "status": "PATIENT_ONBOARD",
  "ambulanceId": "AMB-04"
}
```

#### 5. `FALLBACK_ASSIGNMENT_UPDATED` (or `FALLBACK_TRIGGERED`)
Emitted when driver timeout or rejection triggers cascading fallback.
```json
{
  "requestId": "UK-2026-0001",
  "previousAmbulanceId": "AMB-03",
  "previousDriverName": "S. Selvam",
  "newAmbulanceId": "AMB-05",
  "newDriverName": "P. Murugan",
  "newDriverPhone": "+91 94440 11223",
  "reason": "Driver response timeout (15s elapsed)",
  "eta": 9,
  "status": "EN_ROUTE_TO_HOSPITAL",
  "timestamp": "2026-09-05T04:32:00.000Z"
}
```
