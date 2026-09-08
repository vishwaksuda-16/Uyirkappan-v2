# UyirKappan — Module 3: Hospital Emergency Operations Dashboard

> **Real-Time Advance Notification, Live Telemetry Tracking, Dynamic ETA & Resource Management**  
> Part of the **UyirKappan** Smart Emergency Response Platform.

---

## 1. Project Overview

The **Hospital Dashboard** is the hospital-side web application of UyirKappan. Its core mission is to transform the hospital from a passive destination into an active, continuously informed participant in the emergency lifecycle:

```
Ambulance Arrival ──► Hospital Learns (Conventional Approach)
                      ▼
Emergency Detected ──► Hospital Notified ──► Ambulance Dispatched ──► Hospital Prepares ──► Ambulance Arrives (UyirKappan)
```

By providing advance notification, live ambulance GPS tracking, dynamic ETA recalculation, and cascading fallback resilience, emergency room doctors and trauma teams can mobilize intensive care units, prepare operating theaters, and reserve ventilators **before** the ambulance pulls up to the bay.

---

## 2. Key Responsibilities

1. **Incoming Emergency Monitoring**: Real-time incoming emergency feed displaying case urgency (Cardiac, Trauma, Accident, etc.), victim counts, responding ambulance, and initial vs dynamic ETA.
2. **Live Ambulance Tracking**: Interactive geospatial tracking radar displaying the ambulance's real-time coordinates, speed, heading, incident origin, and hospital destination.
3. **Dynamic ETA Monitoring**: Authoritative ETA calculated continuously by the central backend, adapting in real time to traffic surges, clear corridors, and vehicle telemetry.
4. **Hospital Resource Management**: Triage bed and equipment management (`generalBeds`, `icuBeds`, `ventilators`) with optimistic UI updates and live synchronization with Intelligent Dispatch (`PATCH /api/hospitals/:id/resources`).
5. **Cascading Fallback Visibility**: Automatic handling and audit logging when an assigned ambulance times out or rejects an assignment (e.g. `AMB-03` Timeout -> `AMB-05` Accepted), keeping hospital staff informed without page reloads.
6. **Emergency Response History**: Searchable and filterable case audit logs with performance analytics measuring the project's **12-minute golden hour response benchmark**.

---

## 3. Technology Stack

- **Framework**: React 19 + Vite 8
- **Language**: JavaScript (ES2023 Modules)
- **Routing**: React Router 7 (`react-router-dom`)
- **HTTP Client**: Axios with centralized auth and error interceptors
- **Real-Time Communication**: Socket.io Client (`socket.io-client`)
- **Icons**: Lucide React
- **Linter**: Oxlint
- **Design System**: Custom Emergency Operations Center (EOC) theme built for high information density, dark-mode 24/7 readability, and tabular numerical accuracy.

---

## 4. Folder Structure

```
src/
├── assets/                       # Static brand and interface assets
├── constants/
│   ├── apiEndpoints.js           # Documented REST API route definitions
│   ├── socketEvents.js           # Real-time WebSocket event constants
│   └── statusConstants.js        # Emergency lifecycle statuses & priority tiers
├── services/
│   ├── api.js                    # Centralized Axios client with JWT interceptor
│   ├── hospitalApi.js            # Hospital endpoints (/resources, /incoming, /history)
│   ├── emergencyApi.js           # Emergency endpoints (/details, /tracking, /attempts)
│   ├── socketService.js          # Centralized WebSocket singleton & reconnection manager
│   └── mock/
│       ├── mockHospitalData.js   # Virtual hospital profiles (A, B, C) & staff logins
│       ├── mockEmergencyData.js  # Realistic incoming emergencies & route coordinates
│       └── mockSocketSimulator.js# In-memory GPS, dynamic ETA, and fallback engine
├── context/
│   ├── AuthContext.jsx           # Staff authentication & hospital affiliation
│   └── EmergencyContext.jsx      # Live emergency feed, telemetry stream, toast alerts
├── hooks/
│   ├── useAuth.js                # Auth context hook
│   ├── useEmergency.js           # Live emergency feed hook
│   ├── useSocket.js              # WebSocket connection health & reconnect hook
│   └── useHospitalResources.js   # Resource management & optimistic updates hook
├── components/
│   ├── layout/                   # Navbar, Sidebar, AppLayout, ConnectionIndicator, Toasts
│   ├── common/                   # StatusBadge, UrgencyBadge, StatCard, Modal, Spinner, Alerts
│   ├── dashboard/                # OperationalMetrics, CriticalEmergencyBanner, IncomingList
│   ├── emergency/                # Header, LifecycleTimeline, FallbackAuditTrail, ReadinessCard
│   ├── tracking/                 # AmbulanceMap (vector radar), DynamicEtaWidget
│   ├── resources/                # ResourceCard, ResourceUpdateModal
│   └── history/                  # EmergencyHistoryTable, HistoryMetricsSummary
├── pages/
│   ├── Login/                    # Staff login with quick demo credentials
│   ├── Dashboard/                # Primary emergency operations command center
│   ├── EmergencyDetails/         # Deep incident dossier & live vehicle tracking
│   ├── Resources/                # Hospital capacity allocation & guidelines
│   ├── History/                  # Past incident logs & response metrics
│   └── NotFound/                 # 404 handler
├── routes/
│   ├── AppRoutes.jsx             # React Router routing table
│   └── ProtectedRoute.jsx        # Role-based route guard (HOSPITAL_STAFF)
├── utils/
│   ├── formatters.js             # Formatters for ETA, timestamps, speed, coordinates
│   └── validators.js             # Form validation for resource integers
├── App.jsx                       # Root application provider hierarchy
├── main.jsx                      # Entrypoint
└── index.css                     # EOC Design System & CSS variables
```

---

## 5. Installation & Setup

### Prerequisites
- Node.js (v18.0.0 or higher recommended)
- npm (v9.0.0 or higher)

### Installation
```bash
cd D:\UyirKappan\hospital-dashboard
npm install
```

### Running in Development Mode
```bash
npm run dev
```
The application will launch on `http://localhost:5173` (or the next available port).

### Building for Production
```bash
npm run build
```
Generates optimized static assets in the `dist/` folder.

### Running Oxlint
```bash
npm run lint
```

---

## 6. Environment Variables

Create or configure `.env` in the project root:

```env
# Central UyirKappan Backend REST API
VITE_API_BASE_URL=http://localhost:5000/api

# Central UyirKappan Real-Time WebSocket Server
VITE_SOCKET_URL=http://localhost:5000

# Optional: Google Maps JavaScript API key (if using Google Maps provider)
# VITE_GOOGLE_MAPS_API_KEY=your_key_here
```

---

## 7. Dual-Mode Architecture: Production & Offline Demo

The dashboard is engineered to function seamlessly in two environments:

1. **Connected Mode (Central Backend Running)**:
   - Authenticates against `POST /api/auth/login`.
   - Fetches initial state from `GET /api/hospitals/:id/incoming` and `GET /api/hospitals/:id/resources`.
   - Subscribes via Socket.io to the hospital room (`subscribe_hospital`).
   - Receives live GPS updates (`LOCATION_UPDATED`), ETA changes (`ETA_UPDATED`), and cascading fallback events (`FALLBACK_ASSIGNMENT_UPDATED`).

2. **Isolated Simulation Mode (Development / Offline / Academic Demonstration)**:
   - If the backend is unreachable or during demonstration without a local backend server running, the dashboard's service layer (`src/services/mock/`) engages automatically.
   - The in-memory simulation engine (`mockSocketSimulator.js`) streams live GPS coordinates, recalculates dynamic ETA with simulated traffic variations, and allows staff to test resource modifications.
   - **Interactive Demo Buttons** in the top navbar allow immediate manual triggering of:
     - `Simulate Incoming`: Emits a new high-priority inbound emergency.
     - `Simulate Fallback`: Demonstrates cascading fallback when an assigned ambulance times out and is replaced by another unit.

---

## 8. Pre-Configured Evaluation Staff Accounts

When logging into the dashboard on `/login`, you can either type your credentials or click any of the **Evaluation Quick Accounts**:

| Staff Member | Badge ID | Role | Hospital Facility |
|---|---|---|---|
| **Dr. A. Sundaram, MD** | ER-CHIEF-84 | `HOSPITAL_STAFF` | Apollo Trauma & Emergency Center (H01) |
| **Nurse Priya Raman, RN** | TRIAGE-09 | `HOSPITAL_STAFF` | Madras Medical Mission Super Specialty (H02) |
| **Dr. K. Vignesh, MS** | SURG-RES-21 | `HOSPITAL_STAFF` | MIOT International Multi-Speciality (H03) |

---

## 9. Security & Access Control

- **Token Storage**: JWT tokens are safely handled via `localStorage` and injected automatically through Axios request interceptors into the `Authorization: Bearer <token>` header.
- **Role Enforcement**: Protected routes enforce `HOSPITAL_STAFF` role verification via `ProtectedRoute.jsx`.
- **Facility Isolation**: Hospital staff are strictly authorized to view and modify only their affiliated hospital's emergency cases and resource allocations.
