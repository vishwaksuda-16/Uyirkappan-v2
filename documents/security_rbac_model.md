# UyirKappan Security & Role-Based Access Control (RBAC) Architecture

**Document Version:** 1.0  
**Phase:** Phase 16 — Security / RBAC Implementation & Forensic Audit  
**Classification:** Technical Architecture & Security Specification  
**Authority:** UyirKappan Emergency Response Platform Engineering & Forensic Audit Team  

---

## 1. Executive Summary & Core Security Principle

UyirKappan is an emergency-response and critical healthcare mobility platform connecting bystanders, emergency medical dispatchers, ambulance providers, and emergency hospital departments.

Because emergency medical telemetry and patient routing involve life-critical interventions and confidential health data, every request in the system strictly adheres to the canonical execution pipeline:

$$\mathbf{AUTHENTICATE} \longrightarrow \mathbf{AUTHORIZE} \longrightarrow \mathbf{VALIDATE} \longrightarrow \mathbf{EXECUTE} \longrightarrow \mathbf{PERSIST} \longrightarrow \mathbf{NOTIFY}$$

### Non-Negotiable Security Tenets
1. **Backend Single Source of Truth:** Clients (Flutter mobile apps, React web dashboards) are untrusted presentation layers. No access decision, routing metric, status transition, or tenant authorization is trusted from the client.
2. **Fail-Closed Default:** Any missing token, invalid signature, unassigned hospital tenant, or role mismatch results in an immediate failure (`401 Unauthorized` or `403 Forbidden`).
3. **Explicit Multi-Tenant Isolation:** Hospital facilities are distinct tenants. Staff assigned to Hospital A cannot view, mutate, or subscribe to incoming emergency streams or operational resources of Hospital B.
4. **IDOR (Insecure Direct Object Reference) Prevention:** Resource IDs (`requestId`, `assignmentId`, `hospitalId`) cannot be accessed simply by knowing their identifier. Ownership or explicit operational assignment is enforced.

---

## 2. Platform Roles & Identity Lifecycle

The platform models four distinct user roles defined in `backend/src/models/User.js`:

| Role Name | Scope & Authority | Primary Clients | Default Tenant Binding |
| :--- | :--- | :--- | :--- |
| `BYSTANDER` | Public caller requesting emergency ambulance assistance. Can create emergencies, query and cancel active emergencies they own. | Bystander Flutter App | None |
| `DRIVER` | Certified ambulance driver/paramedic responding to dispatches. Can accept/reject dispatches, stream live telemetry, update trip lifecycle. | Driver Flutter App | `ambulanceId` / `driverId` |
| `HOSPITAL_STAFF` | Emergency department triage nurse or bed manager. Can view inbound emergencies destined for their facility, update local bed/ICU/ventilator capacity. | Hospital React Dashboard | `hospitalId` (Strict Multi-Tenant Boundary) |
| `ADMIN` | System administrator with full cross-facility inspection, evaluation analysis, and platform configuration rights. | Admin & Research Portals | Global System Access |

### Registration & Privilege Escalation Hardening
- Public registration (`POST /api/auth/register`) strictly prohibits client-requested vertical privilege escalation. Any attempt to register with `role === 'ADMIN'` is rejected with `403 Forbidden` (`Admins must be provisioned internally`).
- Hospital staff accounts require an assigned, valid `hospitalId`. Unassigned hospital staff are rejected from accessing facility-specific operational bays.

---

## 3. Cryptographic Token & Authentication Model

### JSON Web Token (JWT) Specifications
- **Signing Algorithm:** Strictly pinned to `HS256`. Both token issuance and verification enforce `{ algorithms: ['HS256'] }` to eliminate algorithm-confusion attacks (e.g. `none` algorithm or asymmetric key swaps).
- **Token Payload:**
  ```json
  {
    "sub": "user-uuid-or-id",
    "role": "HOSPITAL_STAFF",
    "iat": 1791044938,
    "exp": 1791649738
  }
  ```
- **Lifespan:** Standard sessions are bound to configurable `JWT_EXPIRES_IN` (defaults to 7 days).
- **Header Structure:** Standard RFC 6750 Bearer authentication:
  ```http
  Authorization: Bearer <jwt-token>
  ```
- **Socket.IO Handshake Authentication:** Real-time socket connections pass the JWT via `socket.handshake.auth.token` or `socket.handshake.headers.authorization`. Sockets with missing or invalid tokens are rejected at the handshake layer prior to connection establishment.

---

## 4. End-to-End RBAC & API Authorization Matrix

Every route in `backend/src/routes/` is audited and bound to strict role middleware (`authMiddleware`, `requireRole`, and resource-level access control):

| HTTP Method | Route Endpoint | Required Roles | Ownership / Multi-Tenant Rule | Error Code |
| :--- | :--- | :--- | :--- | :--- |
| `POST` | `/api/auth/register` | Anonymous | Role validated; `ADMIN` registration blocked | `400` / `403` |
| `POST` | `/api/auth/login` | Anonymous | Validates email & hashed password | `401` |
| `GET` | `/api/auth/me` | Authenticated | Returns authenticated user identity and role | `401` |
| `POST` | `/api/emergencies` | `BYSTANDER`, `ADMIN` | Authenticated user is bound as requester | `401`, `400` |
| `GET` | `/api/emergencies/:id` | Authenticated | Requester, assigned driver, assigned destination hospital staff, or `ADMIN` | `401`, `403`, `404` |
| `GET` | `/api/emergencies/:id/tracking`| Authenticated | Requester, assigned driver, assigned destination hospital staff, or `ADMIN` | `401`, `403`, `404` |
| `POST` | `/api/emergencies/:id/cancel` | `BYSTANDER`, `ADMIN` | Requester or `ADMIN` only | `401`, `403`, `404` |
| `GET` | `/api/driver/assignment` | `DRIVER` | Active dispatch assigned specifically to authenticated driver | `401`, `403` |
| `POST` | `/api/driver/accept` | `DRIVER` | Active dispatch assigned specifically to authenticated driver | `401`, `403`, `404` |
| `POST` | `/api/driver/reject` | `DRIVER` | Active dispatch assigned specifically to authenticated driver | `401`, `403`, `404` |
| `POST` | `/api/driver/status` | `DRIVER` | Updates trip lifecycle (`EN_ROUTE_PICKUP`, `PATIENT_LOADED`, `COMPLETED`) | `401`, `403`, `404` |
| `PATCH` | `/api/ambulances/:id/status` | `DRIVER`, `ADMIN` | Ambulance driver assigned to vehicle or `ADMIN` | `401`, `403` |
| `GET` | `/api/hospitals/:id/resources` | Authenticated | Public reference for matching or tenant staff; mutating requires tenant check | `401` |
| `PATCH` | `/api/hospitals/:id/resources` | `HOSPITAL_STAFF`, `ADMIN` | `user.hospitalId === id` (or `ADMIN`). Cross-tenant modification forbidden | `401`, `403`, `404` |
| `GET` | `/api/hospitals/:id/incoming` | `HOSPITAL_STAFF`, `ADMIN` | `user.hospitalId === id` (or `ADMIN`). Cross-tenant inspection forbidden | `401`, `403`, `404` |
| `GET` | `/api/hospitals/:id/history` | `HOSPITAL_STAFF`, `ADMIN` | `user.hospitalId === id` (or `ADMIN`). Cross-tenant history inspection forbidden | `401`, `403`, `404` |
| `POST` | `/api/system/reset-demo` | `ADMIN`, `HOSPITAL_STAFF` | Authenticated administrative or hospital staff simulation control | `401`, `403` |
| `GET` | `/api/evaluation/*` | Authenticated | Baseline evaluation, research metrics, and model benchmarks | `401` |

---

## 5. Insecure Direct Object Reference (IDOR) Hardening

### 5.1 Emergency Dossier Isolation (`canAccess`)
Previously, an attacker who obtained an emergency `requestId` could query `/api/emergencies/:id` and `/api/emergencies/:id/tracking`.  
**Hardened Implementation:**
```javascript
const canAccess = (user, request) => {
  if (!user || !request) return false;
  if (user.role === 'ADMIN') return true;
  if (user.role === 'BYSTANDER' && request.userId && user.id === request.userId) return true;
  if (user.role === 'DRIVER') {
    return Boolean(
      (user.ambulanceId && request.assignedAmbulanceId === user.ambulanceId) ||
      (request.driverId && (user.id === request.driverId || user.driverId === request.driverId))
    );
  }
  if (user.role === 'HOSPITAL_STAFF') {
    if (!user.hospitalId || !request.destinationHospitalId) return false;
    return isHospitalMatch(user.hospitalId, request.destinationHospitalId);
  }
  return false;
};
```
Any caller failing `canAccess` receives `403 Forbidden` (`Access to this emergency record is forbidden`).

### 5.2 Hospital Multi-Tenant Isolation (`ownsHospital`)
Hospital staff are bound to their facility:
```javascript
const ownsHospital = (user, hospitalId) => {
  if (!user) return false;
  if (user.role === 'ADMIN') return true;
  if (user.role === 'HOSPITAL_STAFF' && user.hospitalId) {
    return isHospitalMatch(user.hospitalId, hospitalId);
  }
  return false;
};
```
Attempts by Staff from Hospital 2 (`H002`) to view incoming patient bays, update bed counts, or audit historical runs of Hospital 1 (`H001`) are rejected with `403 Forbidden` (`Forbidden: You can only access your own hospital's data`).

---

## 6. Socket.IO Real-Time Authorization & Tenant Scoping

Real-time WebSockets operate under the identical security guarantees as REST endpoints.

### 6.1 Handshake Authentication
Every connecting socket verifies its JWT at the handshake boundary. Unauthenticated connections are dropped immediately with `Authentication error`.

### 6.2 Role Room Provisioning
Upon verified connection, the socket is bound to role-scoped broadcast channels:
```javascript
socket.join(`role:${user.role.toLowerCase()}`);
if (user.role === 'HOSPITAL_STAFF' && user.hospitalId) {
  socket.join(`hospital:${user.hospitalId}`);
}
```

### 6.3 Secure Room Subscriptions (`handleJoin`)
Clients cannot join arbitrary rooms via socket events:
1. **`join:hospital`:** A user can ONLY join `hospital:<id>` if `user.role === 'ADMIN'` or `user.hospitalId === id`. Cross-facility spying emits an `error` event: `Forbidden: Cannot join room for another hospital`.
2. **`emergency:<id>` / `join_emergency`:** Sockets can only subscribe to emergency broadcast channels if authorized by `canAccess(socket.user, emergency)`. Bystander 2 cannot listen to Bystander 1's live tracking stream.

### 6.4 Event Sender Authorization
Clients cannot forge dispatch or location telemetry:
- **`location:update`:** Only authorized `DRIVER` or `ADMIN` sockets can emit location telemetry. Non-driver sockets are rejected with `Forbidden: Only drivers may emit location updates`.

---

## 7. Security Error Contract & Defensive Responses

The API adheres to a standardized, deterministic error contract:

| Error Condition | HTTP Status | Response Payload Shape | Security Rationale |
| :--- | :--- | :--- | :--- |
| **Missing or Malformed Bearer Token** | `401 Unauthorized` | `{ success: false, message: "Authentication required", error: "Authentication required" }` | Informs client that identity credentials are missing |
| **Expired or Corrupt JWT** | `401 Unauthorized` | `{ success: false, message: "Invalid or expired token", error: "Invalid or expired token" }` | Informs client to refresh credentials |
| **Insufficient Role Privilege** | `403 Forbidden` | `{ success: false, message: "Forbidden: insufficient permissions", error: "Forbidden: insufficient permissions" }` | Confirms identity was recognized but privileges are lacking |
| **Cross-Tenant or Cross-Emergency Access Attempt** | `403 Forbidden` | `{ success: false, message: "Forbidden: You can only access your own hospital's data" }` | Denies access without leaking record contents |
| **Resource Not Found** | `404 Not Found` | `{ success: false, message: "Emergency request not found" }` | Returned when record genuinely does not exist |

---

## 8. Data Store Parity (`MongoStore` & `MemoryStore`)

All security middleware functions (`authMiddleware`, `requireRole`, `canAccess`, `ownsHospital`) operate symmetrically across both storage backends:
- In production with `MongoStore`, user credentials, hospital bindings, and access checks query MongoDB models with indexed lookups.
- In test/fallback mode with `MemoryStore`, identical field lookups and authorization rules execute against memory collections.
- Zero security enforcement is bypassed when operating in memory-store mode.
