# UyirKappan Four-Level Automated Testing Strategy
**Project:** UyirKappan — Unified Emergency Response Platform  
**Phase:** 18 — Automated Testing Architecture, Verification & Quality Assurance  
**Version:** 1.0 (Production & Benchmark Grade)

---

## 1. Executive Testing Strategy & Philosophy

UyirKappan is a mission-critical emergency response platform connecting bystanders in distress, ambulance emergency medical technicians (EMTs), and receiving hospital triage teams. Testing emergency response systems demands mathematical rigor, temporal reliability, and distributed consensus verification.

The UyirKappan Automated Testing Strategy organizes quality verification into a **Four-Level Testing Model**:

```
        ┌────────────────────────────────────────────────────────┐
        │  LEVEL 4: END-TO-END / ACCEPTANCE (10 Canonical Flows) │
        │      Full User Workflows, Concurrency & Chaos-Lite    │
        ├────────────────────────────────────────────────────────┤
        │  LEVEL 3: REAL-TIME / SYSTEM TESTING                   │
        │      Socket.IO Handshake, Rooms, Reconnect, Provenance │
        ├────────────────────────────────────────────────────────┤
        │  LEVEL 2: INTEGRATION TESTING                          │
        │      HTTP Ingress, Controllers, Services, Datastore    │
        ├────────────────────────────────────────────────────────┤
        │  LEVEL 1: UNIT TESTING                                 │
        │      Dispatch Scoring, Dijkstra, Haversine, Traffic    │
        └────────────────────────────────────────────────────────┘
```

---

## 2. The Four Testing Levels

### Level 1 — Unit Testing
- **Scope**: Tests pure mathematical algorithms, domain scoring, routing mechanics, formatters, and utility functions in complete isolation.
- **Key Target Modules**:
  - `ScoringService`: Enforces deterministic weighting:
    $$\text{Score} = 0.50 \cdot T_{\text{norm}} + 0.20 \cdot D_{\text{norm}} + 0.20 \cdot C_{\text{traffic}} + 0.10 \cdot P_{\text{avail}}$$
  - `DijkstraService`: Validates graph shortest-path computation, segment snapping, and turn costs.
  - `SimulationTrafficProvider`: Validates multipliers:
    - Normal: $1.0\times$
    - Moderate: $1.35\times$
    - Heavy: $2.1\times$
    - Blocked: $\infty$ (forces dynamic detouring).
  - `KmlParser` & `SpatialIndex`: Geometry normalization and coordinate bounds.
  - `Security Utilities`: JWT token issuance, verification, and algorithm pinning (`HS256`).
  - `Logger`: Automated redaction of passwords, tokens, Authorization headers, and Mongo URIs.

### Level 2 — Integration Testing
- **Scope**: Tests cross-layer interactions between Express routes, security middleware, application services, and underlying datastores (`MemoryStore` and `MongoStore`).
- **Key Target Workflows**:
  - `Authentication & Protected Routes`: JWT validation, claims extraction, role-based guards.
  - `Hospital Multi-Tenant Isolation`: Strict boundary enforcement preventing Hospital Staff of Facility A from accessing or mutating resources/emergencies of Facility B.
  - `Emergency Creation & Persistence`: Bystander creation, road-node snapping, initial dispatch assignment creation.
  - `Driver Response & Stage Lifecycle`: Acceptance and step-by-step lifecycle progression.
  - `Cascading Fallback`: Failed assignment recording and next-best candidate assignment.

### Level 3 — Real-Time / System Testing
- **Scope**: Validates bidirectional WebSocket synchronization across the distributed actor mesh.
- **Key Target Contracts**:
  - `Handshake Authentication`: Enforces Bearer JWT verification during Socket.IO connection.
  - `Room Authorization`: Automatically places sockets into authorized rooms (`user:{userId}`, `driver:{ambulanceId}`, `hospital:{hospitalId}`, `emergency:{requestId}`). Explicitly blocks unauthorized room subscriptions.
  - `Event Metadata Invariance`: Injects canonical `eventId` (`evt-<requestId>-<seq>`), `sequenceNumber` (`seqNum`), `timestamp`, and `requestId`.
  - `Socket Reconnection`: Seamless room rejoining and state recovery upon reconnect without duplicate listener leakage.
  - `Telemetry Provenance`: Real-time GPS streams preserve `provider` (`real` vs `simulation`) and `gpsSource`.

### Level 4 — End-to-End / Acceptance Testing
- **Scope**: Complete end-to-end simulations of entire emergency lifecycles reflecting realistic production and disaster response conditions.
- **10 Canonical E2E Scenarios**:
  1. *Normal Emergency*: SOS $\to$ Searching $\to$ Dispatched $\to$ Accepted $\to$ En Route to Patient $\to$ On Scene $\to$ Patient Onboard $\to$ En Route to Hospital $\to$ Arrived at Hospital $\to$ Completed.
  2. *Cascading Fallback*: Driver rejects $\to$ Fallback triggered $\to$ RequestId preserved $\to$ Unit B assigned $\to$ Completed.
  3. *Candidate Exhaustion*: Fleet occupied $\to$ Dispatch fails $\to$ `NO_AMBULANCE_AVAILABLE` $\to$ No infinite loops.
  4. *Cross-Hospital Tenant Isolation*: Unauthorized query attempts via REST, WebSockets, or path parameters strictly rejected.
  5. *Driver Ownership Enforcement*: Driver A cannot accept, reject, or modify Driver B's assignments or telemetry.
  6. *Real GPS Telemetry Provenance*: `provider: 'real'`, `isSimulated: false`.
  7. *Simulation GPS Telemetry Provenance*: `provider: 'simulation'`, `isSimulated: true`.
  8. *Stale Telemetry Alerting*: Updates lagging $>45$ seconds fire `STALE_GPS_DETECTED` warnings.
  9. *Traffic Simulation Multipliers*: Multipliers dynamically alter ETA while preserving simulation provenance.
  10. *Socket Reconnection During Active Trip*: Client disconnects mid-journey, reconnects, rejoins room, and synchronizes state.

---

## 3. Failure, Chaos-Lite & Concurrency Testing

### Chaos-Lite Failure Testing
The system is subjected to controlled failure modes without external infrastructure chaos tooling:
- Expired and malformed JWT tokens.
- Cross-tenant injection and IDOR attempts.
- Invalid GPS coordinate formats (out-of-range, NaN, future timestamps).
- Driver response timeouts (1500ms SLA).
- Socket connection drops and mid-trip reconnects.
- Exhausted fleet pools.

### Concurrency & Race Condition Testing
- Simultaneous emergency creation from multiple callers generates collision-free, monotonic `requestId`s.
- Atomic ambulance assignment locking prevents two dispatchers or emergencies from acquiring the same ambulance concurrently.
- Fallback reassignment runs atomically with single-assignment guarantees.

---

## 4. Test Environment & Data Isolation

1. **Centralized Configuration**: All tests run through the centralized configuration module (`backend/src/config/index.js`), strictly disabling live network pings, third-party SMS/voice gateways, or external map billing.
2. **Datastore State Isolation**: Tests execute against ephemeral in-memory stores or isolated test MongoDB databases, resetting state before each suite.
3. **Data Provenance Integrity**:
   - `dummy_ambulance_data.xlsx` is strictly classified as **REFERENCE / BASELINE** data and never treated as live operational state.
   - Chennai KML geometry is treated as static reference road geometry.
   - Traffic data is classified as simulated benchmark conditions.

---

## 5. Coverage Analysis & Classification Methodology

UyirKappan measures coverage across functional boundaries rather than relying solely on raw line coverage:
- **COVERED**: Tested at both unit/integration and real-time/E2E levels with explicit assertions.
- **PARTIALLY COVERED**: Tested under simulated conditions where hardware interfaces are abstracted.
- **NOT COVERED**: Intentionally excluded or out-of-scope external vendor systems.
- **NOT APPLICABLE (N/A)**: Capabilities non-existent or irrelevant to the software layer.

---

## 6. Defect Classification Scheme

- **P0 (Critical)**: Vulnerability allowing cross-tenant data access, unhandled crash causing process termination, or corrupted `requestId` lifecycle.
- **P1 (Major)**: Broken emergency lifecycle step, dispatch calculation error, or missing fallback reassignment.
- **P2 (Moderate)**: Inaccurate non-critical log metadata, minor UI lag, or missing non-blocking field.
- **P3 (Minor)**: Documentation typos, minor cosmetic spacing, or debug notice formatting.
