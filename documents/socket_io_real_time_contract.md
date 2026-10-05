# UyirKappan Socket.IO Real-Time Communication Contract

**Platform:** UyirKappan Unified Emergency Response Platform  
**Architecture Role:** Authoritative Distributed Real-Time Event Bus  
**Protocol:** Socket.IO v4 (WebSocket primary, HTTP long-polling fallback)  
**Security & Scope:** Token-authenticated connections, room-isolated delivery, backend-authoritative state  
**Last Forensic Audit:** Phase 14

---

## 1. System Architecture & Information Flow

UyirKappan uses the backend as the **single source of truth**. Clients (Bystander Mobile, Driver Mobile, Hospital Dashboard) never calculate dispatch decisions, Dijkstra routes, or ETAs independently.

```text
       Client Action (REST Request)
                   │
                   ▼
       Backend State Transition
                   │
                   ▼
          Persistence Layer
       (MongoStore / MemoryStore)
                   │
                   ▼
        NotificationService (wrapper)
                   │
                   ▼
        Socket.IO Server Engine
       (Room-scoped Event Delivery)
       ┌───────────┼───────────┐
       ▼           ▼           ▼
  Bystander     Driver      Hospital
   Mobile       Mobile      Dashboard
```

### Critical Invariant: State Precedes Event
A Socket.IO event is **never** emitted speculatively. The state transition is validated, authorized, and persisted to the datastore *before* the corresponding event is pushed into room channels.

---

## 2. Connection Lifecycle & Authentication

### 2.1 Handshake Authentication
All Socket.IO connections require a valid JWT bearer token provided in the handshake auth object:
```javascript
const socket = io('http://localhost:5000', {
  auth: { token: '<JWT_TOKEN>' },
  transports: ['websocket', 'polling']
});
```

### 2.2 Server Handshake Validation (`backend/src/sockets/socket.server.js`)
1. Decodes and verifies the JWT token using standard HMAC SHA-256.
2. Resolves the user identity from datastore (`store.findUserById(payload.sub)`).
3. Rejects invalid, expired, or absent tokens with `Error('Authentication failed')`.
4. Automatically joins authorized private rooms based on authenticated role:
   - `user:${user.id}` (All users)
   - `driver:${ambulance.id}`, `ambulance:${ambulance.id}`, `driver:${user.id}` (If `user.role === 'DRIVER'`)
   - `hospital:${user.hospitalId}` (If `user.role === 'HOSPITAL_STAFF'`)

---

## 3. Room Hierarchy & Channel Scoping

| Room Pattern | Purpose | Authorized Joiners | Auto-Joined on Auth |
|---|---|---|---|
| `user:{userId}` | Private alerts and direct notifications to a specific user | Specific user | Yes |
| `driver:{ambulanceId}` | Dispatch and route updates assigned to a specific ambulance | Assigned driver / vehicle | Yes |
| `ambulance:{ambulanceId}` | Vehicle telemetry and operational status stream | Assigned driver / vehicle | Yes |
| `hospital:{hospitalId}` | Inbound emergency bay telemetry, hospital-bound ambulance updates | Staff of facility `hospitalId` | Yes |
| `emergency:{requestId}` | Shared corridor room for parties involved in an active emergency | Requester, assigned driver, destination hospital | Explicit client event: `join_emergency` |

---

## 4. Socket.IO Event Inventory & Payload Specifications

### 4.1 Canonical Server-to-Client Events

| Event Name | Scope / Room | Direction | Triggering Condition | Key Payload Fields |
|---|---|---|---|---|
| `EMERGENCY_CREATED` | `user:{requesterId}`, `emergency:{requestId}`, `hospital:{hospitalId}` | S $\rightarrow$ C | New emergency created via `POST /api/emergency` | `requestId`, `emergencyType`, `status`, `victimCount`, `location` |
| `AMBULANCE_ASSIGNED` | `driver:{ambulanceId}`, `emergency:{requestId}`, `hospital:{hospitalId}` | S $\rightarrow$ C | Matcher assigns unit to emergency | `requestId`, `assignmentId`, `ambulanceId`, `driverId`, `eta` |
| `NEW_ASSIGNMENT` | `driver:{ambulanceId}` | S $\rightarrow$ C | Dedicated driver notification alias for assigned emergency | `requestId`, `assignmentId`, `emergencyType`, `pickupLocation` |
| `ASSIGNMENT_ACCEPTED` | `emergency:{requestId}` | S $\rightarrow$ C | Driver confirms response via `POST /api/assignments/:id/accept` | `assignmentId`, `requestId`, `ambulanceId`, `status: 'ACCEPTED'` |
| `ASSIGNMENT_REJECTED` | `emergency:{requestId}` | S $\rightarrow$ C | Driver declines response via `POST /api/assignments/:id/reject` | `assignmentId`, `requestId`, `ambulanceId`, `reason` |
| `FALLBACK_STARTED` | `emergency:{requestId}`, `hospital:{hospitalId}` | S $\rightarrow$ C | Unit declines or response timer expires (15s timeout) | `requestId`, `failedAmbulanceId` |
| `AMBULANCE_REASSIGNED`| `emergency:{requestId}`, `hospital:{hospitalId}` | S $\rightarrow$ C | Intelligent Matcher selects next best candidate | `requestId`, `ambulanceId`, `assignmentId`, `attemptNumber` |
| `AMBULANCE_LOCATION_UPDATED` | `emergency:{requestId}`, `hospital:{hospitalId}` | S $\rightarrow$ C | Driver posts telemetry update | `ambulanceId`, `latitude`, `longitude`, `speed`, `heading`, `provider`, `isSimulated` |
| `ETA_UPDATED` | `emergency:{requestId}` | S $\rightarrow$ C | Central Dijkstra / Traffic engine recalculates ETA | `requestId`, `eta`, `updatedAt` |
| `ROUTE_UPDATED` | `emergency:{requestId}`, `driver:{ambulanceId}`, `hospital:{hospitalId}` | S $\rightarrow$ C | Route geometry constructed/updated | `requestId`, `waypoints`, `distanceKm`, `travelTimeMinutes` |
| `STATUS_UPDATED` | `emergency:{requestId}`, `user:{requesterId}` | S $\rightarrow$ C | Lifecycle phase transition | `requestId`, `status`, `timestamp` |
| `AMBULANCE_ARRIVED` | `emergency:{requestId}`, `hospital:{hospitalId}` | S $\rightarrow$ C | Ambulance arrives at patient or hospital | `requestId`, `ambulanceId`, `locationType` |
| `PATIENT_ONBOARD` | `emergency:{requestId}` | S $\rightarrow$ C | Patient loaded into ambulance | `requestId`, `ambulanceId`, `status: 'PATIENT_ONBOARD'` |
| `EMERGENCY_COMPLETED` | `emergency:{requestId}`, `user:{requesterId}`, `hospital:{hospitalId}` | S $\rightarrow$ C | Patient transfer completed | `requestId`, `status: 'COMPLETED'`, `completedAt` |
| `DEMO_RESET` / `SYSTEM_RESET` | Global broadcast | S $\rightarrow$ C | System/demo data reset command | `resetTime`, `message` |

### 4.2 Client-to-Server Commands

| Event Name | Direction | Handler | Description |
|---|---|---|---|
| `join_emergency` / `join-emergency` | C $\rightarrow$ S | `socket.join('emergency:' + id)` | Joins the real-time room for tracking an emergency |
| `leave_emergency` / `leave-emergency` | C $\rightarrow$ S | `socket.leave('emergency:' + id)` | Leaves the real-time emergency room |
| `join:hospital` | C $\rightarrow$ S | `socket.join('hospital:' + id)` | Explicit hospital facility room subscription |
| `leave:hospital` | C $\rightarrow$ S | `socket.leave('hospital:' + id)` | Leaves hospital facility room |
| `location:update` | C $\rightarrow$ S | Updates datastore and emits `AMBULANCE_LOCATION_UPDATED` | Telemetry packet from driver app |
| `TRIGGER_FALLBACK_DEMO` | C $\rightarrow$ S | Triggers simulation fallback cascade | Demo simulation trigger |
| `TRIGGER_INCOMING_DEMO` | C $\rightarrow$ S | Simulates inbound emergency packet | Demo simulation trigger |

---

## 5. Event Sequence & Idempotency Safeguards

To prevent duplicate processing or out-of-order event issues:
1. `NotificationService` automatically injects an `eventId` (`evt-${emergencyId}-${seq}`) and sequential `sequenceNumber` on room emissions.
2. Web consumers maintain a processed events cache (`Set`) to suppress duplicate executions.
3. Mobile clients filter sequential lifecycle stages, preventing backwards state transitions (e.g., ignoring a stale `ASSIGNED` if `EN_ROUTE_TO_HOSPITAL` is already reached).

---

## 6. Resilience & Reconnection Protocol

1. **Auto-Reconnection**: Clients are configured with exponential backoff (`reconnectionDelay: 1000ms`, `maxReconnectionAttempts: 9999`).
2. **Room Rejoin**:
   - Private rooms (`user:*`, `driver:*`, `hospital:*`) are auto-joined by the server during reconnection handshake.
   - Active emergency rooms (`emergency:*`) are rejoined automatically by client socket services (`bystander_app`, `driver_app`, `hospital-dashboard`).
3. **State Reconciliation**: Following reconnection, clients issue a REST sync request (`GET /api/emergency/:id` or `GET /api/driver/assignment`) to reconcile backend state in case packets were dropped during network downtime.

---

## 7. Forensic Verification Matrix

| Invariant | Target | Status |
|---|---|---|
| Backend State Authority | REST commit precedes Socket.IO emit | ✅ VERIFIED |
| Role-Scoped Isolation | Hospital A cannot receive Hospital B's bay updates | ✅ VERIFIED |
| GPS Provenance | `provider` / `isSimulated` preserved across real-time payload | ✅ VERIFIED |
| Stale Telemetry Protection | 45-second freshness indicator enforced on frontends | ✅ VERIFIED |
| Lifecycle Continuity | 8 canonical lifecycle states synchronized without skipping | ✅ VERIFIED |
| Dual-Datastore Parity | Identical Socket.IO behavior in MongoStore and MemoryStore | ✅ VERIFIED |
| Clean Listener Teardown | Zero leaked event listeners upon unmount/dispose | ✅ VERIFIED |
