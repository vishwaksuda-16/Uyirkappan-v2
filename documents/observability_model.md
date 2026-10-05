# UyirKappan Observability Architecture & Implementation Model
**Phase 17 — Production Observability, Distributed Correlation & Forensic Auditing**

---

## 1. Executive Summary & Design Principles

The UyirKappan Unified Emergency Response Platform provides mission-critical dispatch and coordination across bystanders, ambulances, and hospital emergency departments. Observability in UyirKappan is engineered to provide end-to-end auditability and diagnostic precision without external heavy infrastructure dependencies (such as ELK, Prometheus, or Grafana).

### Core Principles
1. **Lightweight In-Process Architecture**: Built purely with native Node.js primitives, high-performance structured streaming, and ring buffering.
2. **Deterministic Primary Correlation Key (`requestId`)**: Every distributed operation originating from an emergency request preserves the canonical `requestId` through initial dispatch, driver handshakes, telemetry streams, cascading fallback, and arrival/completion.
3. **Multi-Key Correlatable Schema**: Along with `requestId`, records link `correlationId`, `assignmentId`, `ambulanceId`, `driverId`, `hospitalId`, `eventId`, and `sequenceNumber`.
4. **Zero-Leak Data Hygiene**: Sensitive fields—including JWT tokens, passwords, MongoDB connection URI credentials, and Authorization headers—are automatically redacted before serialization or console output.
5. **Backend Authoritative Provenance**: GPS telemetry distinguishes live device feeds (`REAL`) from synthetic simulations (`SIMULATION`) and actively detects stale updates exceeding 45 seconds.

---

## 2. Structured Log Schema & Taxonomy

Logs emitted by the system adhere to a standardized JSON schema designed for machine ingestion, high-speed filtering, and human readability.

### Canonical Schema

```json
{
  "timestamp": "2026-10-03T17:22:46.722Z",
  "level": "INFO",
  "service": "backend",
  "event": "DISPATCH_SCORING_COMPLETED",
  "requestId": "REQ-OBS-1791048166722",
  "correlationId": "corr-musnu24r-f29lyy",
  "assignmentId": "ASSIGN-OBS-1791048166725-1",
  "ambulanceId": "AMB-TEST-2",
  "driverId": "driver-2",
  "hospitalId": "H001",
  "eventId": "evt-REQ-OBS-1791048166722-019",
  "sequenceNumber": 19,
  "durationMs": 1,
  "message": "Dispatch scoring completed for emergency REQ-OBS-1791048166722 in 1ms",
  "metadata": {}
}
```

### Log Levels
* **DEBUG**: High-frequency telemetry coordinates, periodic heartbeat ticks, granular calculation steps.
* **INFO**: Request creations, lifecycle transitions, state reconciliations, Socket.IO connections/disconnections, and successful dispatch events.
* **WARN**: Driver rejections, assignment timeouts, cascading fallback triggers, stale telemetry warnings (>45s), and unauthorized access attempts.
* **ERROR**: Unhandled exceptions, database connection errors, dispatch algorithm exhaustion, and unrecoverable network failures.

---

## 3. Distributed Request Correlation Pipeline

### HTTP Ingress Correlation
Every HTTP request entering Express is processed by the `correlationMiddleware`:
1. Checks for incoming `X-Correlation-Id` or `X-Request-Id` headers.
2. If absent, generates an internal collision-resistant correlation token (`corr-<timestamp>-<random>`).
3. Sets `res.setHeader('X-Correlation-Id', correlationId)` for client traceability.
4. Tracks total response duration in milliseconds and logs `HTTP_REQUEST_COMPLETED` with status code, route, method, and latency.

### Socket.IO Event Correlation
All real-time Socket.IO events emitted by `NotificationService` inject distributed correlation metadata:
* `eventId`: Unique event ID formatted as `evt-<requestId>-<seq3>`.
* `sequenceNumber`: Monotonically increasing integer per request room.
* `timestamp`: ISO-8601 string stamped at the moment of broadcast.
* `requestId`: The primary emergency entity key.

---

## 4. Emergency Lifecycle & Cascading Fallback Invariance

### Lifecycle Progression
The platform tracks each transition through `LIFECYCLE_TRANSITION` events:
1. `CREATED` (Initiated by bystander)
2. `SEARCHING` (Intelligent matcher evaluating fleet)
3. `ASSIGNED` / `DISPATCHED` (Driver notified with 1500ms timeout)
4. `DRIVER_ACCEPTED` (Driver confirms assignment)
5. `EN_ROUTE_TO_PATIENT` (First journey leg)
6. `ARRIVED_AT_PATIENT` (On scene)
7. `PATIENT_ONBOARD` (Second journey leg begins)
8. `EN_ROUTE_TO_HOSPITAL` (Transit to receiving facility)
9. `ARRIVED_AT_HOSPITAL` (Arrival and triage)
10. `COMPLETED` (Emergency resolved, fleet unit released)

### Fallback Invariance Rule
When a driver rejects an assignment or times out:
* `FALLBACK_TRIGGERED` is logged with the original `requestId` and `failedAmbulanceId`.
* Real-time `FALLBACK_STARTED` is emitted to the bystander and receiving hospital rooms.
* The failed ambulance is released cleanly (`AVAILABLE`, all request ties cleared).
* Next best ambulance is chosen; `FALLBACK_REASSIGNED` is logged with identical `requestId` and incremented `attemptNumber`.
* **Critical Invariance**: The `requestId` is **NEVER** regenerated or mutated during cascading fallback.

---

## 5. GPS Telemetry Provenance & Stale Detection

### Multi-Cue Provenance Standards
Telemetry payloads must carry explicit provenance metadata:
* `provider`: `'real'` | `'simulation'`
* `gpsSource`: `'DEVICE'` | `'SIMULATION'`
* `isSimulated`: `boolean`
* `accuracy`: numeric accuracy radius in meters.

### Stale Telemetry Detection
* A configurable threshold (`logging.staleTelemetryThresholdSeconds = 45s`) evaluates incoming location timestamps against server clock.
* Telemetry arriving with `deltaSeconds > 45s` immediately triggers a `STALE_GPS_DETECTED` warning log, alerting dispatchers to network dead zones or GPS hardware lag.

---

## 6. Security, RBAC & Redaction Architecture

### Canonical Error Codes (`backend/src/utils/errors.js`)
* `AUTHENTICATION_ERROR` (401)
* `AUTHORIZATION_ERROR` (403)
* `NOT_FOUND` (404)
* `CONFLICT` (409)
* `VALIDATION_ERROR` (400)
* `DISPATCH_ERROR` (500)
* `DATABASE_ERROR` (500)
* `INTERNAL_ERROR` (500)

### Masking & Redaction Rules
* Log sanitization scans string and nested object properties.
* Keys matching `/password|token|secret|authorization|bearer|cookie/i` have their values masked to `[REDACTED]`.
* Database connection URIs containing credentials (`mongodb://user:pass@host...`) are scrubbed before logging.

---

## 7. System Health & Readiness Endpoints

The system provides lightweight liveness and readiness endpoints:
* `GET /api/health` and `GET /api/system/health`: Reports process uptime, memory usage, store mode (`memory` or `mongodb`), and operational state.
* `GET /api/readiness` and `GET /api/system/readiness`: Performs deep health checks against critical dependencies (database connection, socket server status, dataset initialization). Returns HTTP 200 when ready, HTTP 503 if any subsystem is unavailable.
