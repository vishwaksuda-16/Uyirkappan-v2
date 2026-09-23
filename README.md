# 🚑 UyirKappan

### Real-Time Intelligent Emergency Response & Ambulance Coordination Platform

UyirKappan is a unified emergency response platform that connects **Bystanders, Ambulance Drivers, and Hospitals** through a real-time backend and intelligent ambulance dispatch system.

The platform enables emergency request creation, intelligent ambulance selection, driver assignment, cascading fallback, live ambulance tracking, dynamic ETA updates, hospital coordination, and complete emergency lifecycle management.

> **Project Scope:** UyirKappan is a software-based prototype and simulation platform designed to demonstrate intelligent emergency coordination. It does not replace existing emergency services such as 108.

---

## 📌 Problem

During medical emergencies, delays can occur because of:

- Manual ambulance coordination
- Unavailability or rejection of nearby ambulances
- Lack of real-time ambulance visibility
- Static or inaccurate ETA information
- Fragmented communication between bystanders, drivers, and hospitals
- Limited visibility of hospital resource availability
- Difficulty handling ambulance rejection or timeout

UyirKappan addresses these challenges through a centralized, real-time emergency coordination platform.

---

# 🎯 Objectives

- Enable quick emergency request creation by bystanders
- Automatically identify suitable ambulances
- Consider distance, travel time, traffic, and availability during dispatch
- Automatically retry with another ambulance when an assignment fails
- Provide real-time ambulance tracking
- Continuously update ETA
- Coordinate ambulance arrival information with hospitals
- Allow hospitals to monitor incoming emergencies
- Maintain emergency and dispatch history
- Provide role-based and authenticated access

---

# 🏗️ System Architecture

```text
                         ┌──────────────────────────┐
                         │       BYSTANDER APP      │
                         │      Flutter / Dart      │
                         │                          │
                         │ • Create Emergency       │
                         │ • GPS Location           │
                         │ • Track Ambulance        │
                         │ • View ETA               │
                         │ • Emergency Status       │
                         └────────────┬─────────────┘
                                      │
                                      │ REST API
                                      │ Socket.IO
                                      ▼
┌───────────────────────────────────────────────────────────────────────┐
│                         UYIRKAPPAN BACKEND                            │
│                                                                       │
│                         Node.js + Express                             │
│                                                                       │
│  ┌────────────────┐   ┌────────────────┐   ┌──────────────────────┐   │
│  │ Authentication  │   │ Emergency API  │   │ Hospital / Driver   │   │
│  │ JWT + RBAC      │   │ Management     │   │ APIs                │   │
│  └────────────────┘   └────────────────┘   └──────────────────────┘   │
│                                                                       │
│  ┌──────────────────────┐    ┌────────────────────────────────────┐   │
│  │ Intelligent Dispatch │    │ Live Tracking / ETA / Fallback     │   │
│  │                      │    │                                    │   │
│  │ • Candidate Filter   │    │ • GPS Updates                      │   │
│  │ • Multi-factor Score │    │ • Dynamic ETA                      │   │
│  │ • Route Calculation  │    │ • Cascading Fallback               │   │
│  │ • Ambulance Selection│    │ • Attempt Tracking                 │   │
│  └──────────────────────┘    └────────────────────────────────────┘   │
│                                                                       │
│                         Socket.IO                                     │
└───────────────┬───────────────────────┬───────────────────────────────┘
                │                       │
                │ REST API              │ Socket.IO
                ▼                       ▼
     ┌────────────────────┐   ┌──────────────────────────────┐
     │    DRIVER APP      │   │     HOSPITAL DASHBOARD       │
     │   Flutter / Dart   │   │       React + Vite           │
     │                    │   │                              │
     │ • Assignments      │   │ • Incoming Emergencies       │
     │ • Accept / Reject  │   │ • Live Ambulance Map         │
     │ • GPS Telemetry    │   │ • Dynamic ETA                │
     │ • Status Updates   │   │ • Resource Management        │
     │ • Navigation       │   │ • Emergency History          │
     └────────────────────┘   └──────────────────────────────┘

                              │
                              ▼
                    ┌──────────────────────┐
                    │       MongoDB        │
                    │                      │
                    │ • Users              │
                    │ • Emergencies        │
                    │ • Ambulances         │
                    │ • Assignments        │
                    │ • Hospitals          │
                    │ • Request Attempts   │
                    │ • Location History   │
                    └──────────────────────┘


## 🧩 System Modules

### Module 1 — Bystander Mobile Application

**Technology:** Flutter + Dart

The Bystander App is the primary interface for reporting emergencies.

#### Features
- One-tap emergency request
- GPS-based location capture
- Manual location adjustment
- Emergency type selection
- Victim count selection
- Emergency request submission
- Ambulance assignment visibility
- Live ambulance tracking
- Dynamic ETA
- Emergency status updates
- Fallback visibility
- Direct 108 emergency call option

#### Emergency Types
- Accident
- Cardiac
- Breathing
- Unconscious
- Trauma
- General Medical
- Other

**Verification:** ✅ 33 / 33 tests passed

---

### Module 2 — Driver / Ambulance Provider Application

**Technology:** Flutter + Dart

The Driver App allows ambulance providers to receive and manage emergency assignments.

#### Features
- Driver authentication
- Real-time assignment notification
- Assignment accept / reject
- Assignment timeout handling
- Cascading fallback support
- GPS location reporting
- Ambulance availability management
- Emergency status updates
- Navigation support
- Dynamic ETA
- Complete emergency lifecycle

#### Driver Status Flow

AVAILABLE
    │
    ▼
ASSIGNMENT_RECEIVED
    │
    ├── REJECT / TIMEOUT
    │        │
    │        ▼
    │   FALLBACK
    │
    ▼
DRIVER_ACCEPTED
    │
    ▼
EN_ROUTE_TO_PATIENT
    │
    ▼
ARRIVED_AT_PATIENT
    │
    ▼
PATIENT_ONBOARD
    │
    ▼
EN_ROUTE_TO_HOSPITAL
    │
    ▼
ARRIVED_AT_HOSPITAL
    │
    ▼
COMPLETED
    │
    ▼
AVAILABLE


**Verification:** ✅ 27 / 27 tests passed

---

### Module 3 — Hospital Dashboard

**Technology:** React + Vite + Leaflet

The Hospital Dashboard provides hospital staff with real-time visibility of incoming emergencies and ambulance movement.

#### Features
- Hospital staff authentication
- Hospital information
- Incoming emergency feed
- Live ambulance map
- Dynamic ETA
- Ambulance assignment visibility
- Ambulance reassignment visibility
- Emergency status tracking
- Emergency history
- Hospital resource management
- Resource readiness indicators
- Real-time notifications
- Socket.IO connection monitoring

#### Hospital Resources
- General Beds
- ICU Beds
- Ventilators

#### Live Information

For each incoming emergency:
- Request ID
- Emergency type
- Victim count
- Assigned ambulance
- Current status
- Current ETA
- Ambulance location
- Patient pickup location
- Hospital destination

**Verification:** ✅ 25 / 25 tests passed

---

### Module 4 — Backend & Data Management

**Technology:** Node.js + Express + MongoDB + Socket.IO

The backend acts as the central coordinator for the entire UyirKappan system.

#### Responsibilities
- Authentication
- Authorization
- Emergency request management
- Ambulance management
- Assignment management
- Driver status management
- Hospital management
- Resource management
- Dispatch coordination
- Fallback handling
- ETA calculation
- Live tracking
- Socket.IO communication
- Emergency history
- Request attempt tracking

#### Authentication

JWT-based authentication is used for secure API access.

#### Supported Roles
- BYSTANDER
- DRIVER
- HOSPITAL_STAFF
- ADMIN

#### Data Storage

MongoDB is used for persistent storage. The backend also supports an in-memory data store for development and simulation.

**Verification:** ✅ 10 / 10 backend tests passed

---

### Module 5 — Intelligent Dispatch Engine

The Intelligent Dispatch Engine selects the most suitable ambulance for an emergency.

#### Dispatch Factors

The ambulance selection process considers:

| Factor | Weight |
|--------|--------|
| Travel Time | 50% |
| Distance | 20% |
| Traffic | 20% |
| Availability | 10% |

#### Dispatch Process


Emergency Created
       │
       ▼
Find Available Ambulances
       │
       ▼
Filter Candidates
       │
       ▼
Calculate Route
       │
       ▼
Calculate Travel Time
       │
       ▼
Evaluate Traffic
       │
       ▼
Calculate Multi-Factor Score
       │
       ▼
Rank Candidates
       │
       ▼
Select Best Ambulance
       │
       ▼
Create Assignment

#### Routing

The prototype uses Dijkstra's shortest-path algorithm over a virtual road network.

#### Traffic States
- NORMAL
- MODERATE
- HEAVY
- BLOCKED

**Verification:** ✅ 42 / 42 specification sections verified

---

### Module 6 — Live Tracking, ETA & Cascading Fallback

This module provides real-time coordination after an emergency is created.

#### Live Tracking

Ambulance GPS locations are continuously sent to the backend and propagated to connected clients using Socket.IO.

Driver GPS
    │
    ▼
Backend
    │
    ▼
Socket.IO
    │
    ├── Bystander App
    │
    └── Hospital Dashboard


#### Dynamic ETA

ETA is recalculated based on the latest ambulance location and route information.

#### Cascading Fallback

If an ambulance:
- Rejects an assignment
- Fails to respond within the timeout period
- Becomes unavailable

the backend automatically attempts to assign another suitable ambulance.


AMB-001 Assigned
       │
       ▼
Driver Rejects / Timeout
       │
       ▼
FALLBACK_STARTED
       │
       ▼
Search Next Candidate
       │
       ▼
AMB-002 Assigned
       │
       ▼
Driver Accepts
       │
       ▼
Live Tracking Continues

#### Attempt Tracking

Every dispatch attempt is recorded to provide an audit trail.

**Verification:** ✅ 40 / 40 specification sections verified

---

## 🔄 Complete Emergency Flow

1. Bystander creates emergency
             │
             ▼
2. Backend creates emergency request
             │
             ▼
3. Emergency enters SEARCHING state
             │
             ▼
4. Dispatch engine finds candidate ambulances
             │
             ▼
5. Ambulance is selected using multi-factor scoring
             │
             ▼
6. Driver receives assignment
             │
             ├───────────────┐
             │               │
          ACCEPT           REJECT/TIMEOUT
             │               │
             │               ▼
             │        Cascading Fallback
             │               │
             │               ▼
             │        Next Ambulance
             │
             ▼
7. DRIVER_ACCEPTED
             │
             ▼
8. EN_ROUTE_TO_PATIENT
             │
             ▼
9. GPS + ETA updates
             │
             ▼
10. ARRIVED_AT_PATIENT
             │
             ▼
11. PATIENT_ONBOARD
             │
             ▼
12. EN_ROUTE_TO_HOSPITAL
             │
             ▼
13. ARRIVED_AT_HOSPITAL
             │
             ▼
14. COMPLETED
             │
             ▼
15. Ambulance becomes AVAILABLE

---

## 📡 Real-Time Communication

UyirKappan uses Socket.IO for real-time communication between the backend and connected applications.

### Server → Client Events

| Event | Purpose |
|-------|---------|
| `EMERGENCY_CREATED` | New emergency created |
| `AMBULANCE_ASSIGNED` | Ambulance assigned |
| `ASSIGNMENT_ACCEPTED` | Driver accepted assignment |
| `ASSIGNMENT_REJECTED` | Driver rejected assignment |
| `AMBULANCE_LOCATION_UPDATED` | Ambulance GPS update |
| `ETA_UPDATED` | ETA changed |
| `STATUS_UPDATED` | Emergency status changed |
| `FALLBACK_STARTED` | Fallback process started |
| `AMBULANCE_REASSIGNED` | New ambulance assigned |
| `AMBULANCE_ARRIVED` | Ambulance arrived |
| `EMERGENCY_COMPLETED` | Emergency completed |

### Client → Server Events

| Event | Purpose |
|-------|---------|
| `join_emergency` | Join emergency-specific room |
| `leave_emergency` | Leave emergency-specific room |

### Socket Rooms
- `hospital:{hospitalId}`
- `emergency:{requestId}`

---

## 🔐 Authentication & Authorization

UyirKappan uses JWT authentication and role-based access control.


User
 │
 ▼
Login
 │
 ▼
JWT Token
 │
 ▼
Authenticated API Request
 │
 ▼
Role Verification
 │
 ├── BYSTANDER
 ├── DRIVER
 ├── HOSPITAL_STAFF
 └── ADMIN


Hospital APIs additionally verify that the authenticated hospital staff member belongs to the requested hospital.

---

## 🔗 REST API Reference

### Authentication

| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST` | `/api/auth/register` | Register user |
| `POST` | `/api/auth/login` | Login and receive JWT |
| `GET` | `/api/auth/me` | Get authenticated user |

### Emergency

| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST` | `/api/emergency` | Create emergency |
| `GET` | `/api/emergency/:requestId` | Get emergency details |
| `POST` | `/api/emergency/:requestId/cancel` | Cancel emergency |
| `GET` | `/api/emergency/:requestId/tracking` | Get tracking information |

### Driver

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/api/driver/assignment` | Get active assignment |
| `POST` | `/api/assignments/:id/accept` | Accept assignment |
| `POST` | `/api/assignments/:id/reject` | Reject assignment |
| `PATCH` | `/api/assignments/:id/status` | Update emergency status |

### Ambulance

| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST` | `/api/ambulances/:id/location` | Update GPS location |
| `PATCH` | `/api/ambulances/:id/status` | Update ambulance status |

### Hospital

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/api/hospitals/:id` | Get hospital details |
| `GET` | `/api/hospitals/:id/incoming` | Get incoming emergencies |
| `GET` | `/api/hospitals/:id/resources` | Get hospital resources |
| `PATCH` | `/api/hospitals/:id/resources` | Update resources |
| `GET` | `/api/hospitals/:id/emergency-history` | Get emergency history |

---

## 🗄️ Database Models

The backend contains the following primary models:

- `User`
- `Hospital`
- `Ambulance`
- `EmergencyRequest`
- `Assignment`
- `RequestAttempt`
- `LocationHistory`

### Relationship Overview

User
 │
 ├── Bystander
 ├── Driver
 └── Hospital Staff
          │
          ▼
       Hospital
          │
          ▼
      Ambulances

Bystander
    │
    ▼
EmergencyRequest
    │
    ├── Assignment
    │       │
    │       ▼
    │    Ambulance
    │
    ├── RequestAttempt
    │
    └── LocationHistory

---

## 📁 Project Structure

Uyirkappan/
│
├── backend/
│   ├── src/
│   │   ├── config/
│   │   │   ├── database.js
│   │   │   └── environment.js
│   │   │
│   │   ├── controllers/
│   │   │   ├── ambulance.controller.js
│   │   │   ├── assignment.controller.js
│   │   │   ├── auth.controller.js
│   │   │   ├── emergency.controller.js
│   │   │   └── hospital.controller.js
│   │   │
│   │   ├── data/
│   │   │   ├── memoryStore.js
│   │   │   └── mongoStore.js
│   │   │
│   │   ├── middleware/
│   │   │   ├── auth.middleware.js
│   │   │   └── role.middleware.js
│   │   │
│   │   ├── models/
│   │   │   ├── Ambulance.js
│   │   │   ├── Assignment.js
│   │   │   ├── EmergencyRequest.js
│   │   │   ├── Hospital.js
│   │   │   ├── LocationHistory.js
│   │   │   ├── RequestAttempt.js
│   │   │   └── User.js
│   │   │
│   │   ├── routes/
│   │   │   ├── ambulance.routes.js
│   │   │   ├── assignment.routes.js
│   │   │   ├── auth.routes.js
│   │   │   ├── driver.routes.js
│   │   │   ├── emergency.routes.js
│   │   │   └── hospital.routes.js
│   │   │
│   │   ├── services/
│   │   │   ├── ambulance.service.js
│   │   │   ├── assignment.service.js
│   │   │   ├── dispatch.service.js
│   │   │   ├── driverNotification.js
│   │   │   ├── emergency.service.js
│   │   │   ├── eta.service.js
│   │   │   ├── fallback.service.js
│   │   │   ├── hospital.service.js
│   │   │   └── notification.service.js
│   │   │
│   │   ├── sockets/
│   │   │   └── socket.server.js
│   │   │
│   │   ├── simulation/
│   │   │   ├── ambulance.simulator.js
│   │   │   ├── client.js
│   │   │   ├── emergency.simulator.js
│   │   │   └── simulate.js
│   │   │
│   │   ├── utils/
│   │   │   ├── idGen.js
│   │   │   ├── logger.js
│   │   │   └── security.js
│   │   │
│   │   └── app.js
│   │
│   └── package.json
│
├── bystander_app/
│   ├── lib/
│   └── pubspec.yaml
│
├── driver_app/
│   ├── lib/
│   └── pubspec.yaml
│
├── hospital-dashboard/
│   ├── src/
│   │   ├── assets/
│   │   ├── components/
│   │   │   ├── common/
│   │   │   ├── dashboard/
│   │   │   ├── emergency/
│   │   │   ├── history/
│   │   │   ├── layout/
│   │   │   ├── resources/
│   │   │   └── tracking/
│   │   │
│   │   ├── constants/
│   │   ├── context/
│   │   ├── hooks/
│   │   ├── pages/
│   │   ├── routes/
│   │   ├── services/
│   │   └── utils/
│   │
│   └── package.json
│
├── docs/
│   ├── API.md
│   └── SOCKET_EVENTS.md
│
└── README.md

---

## 🛠️ Technology Stack

| Layer | Technology |
|-------|------------|
| **Backend** | Node.js |
| **API** | Express.js |
| **Database** | MongoDB |
| **Development Storage** | In-Memory Store |
| **Real-Time** | Socket.IO |
| **Authentication** | JWT |
| **Password Security** | bcrypt |
| **Bystander App** | Flutter / Dart |
| **Driver App** | Flutter / Dart |
| **Hospital Dashboard** | React / Vite |
| **Maps** | Leaflet |
| **Routing** | Dijkstra Algorithm |
| **API Documentation** | Swagger / OpenAPI |
| **Backend Testing** | Node Test Runner |
| **Mobile Testing** | Flutter Test |
| **Dashboard Testing** | React Testing Library |

---

## 🚀 Installation & Setup

### Prerequisites

Install:
- Node.js 18+
- npm
- MongoDB or MongoDB Atlas
- Flutter SDK 3.19+
- Git

### 1. Start Backend

```bash
cd backend
npm install
npm run dev

Backend:

http://localhost:5000

Health Check:

http://localhost:5000/api/health

Swagger:

http://localhost:5000/api-docs
2. Start Bystander App
cd bystander_app
flutter pub get
flutter run

For web:

flutter run -d chrome
3. Start Driver App
cd driver_app
flutter pub get
flutter run

For web:

flutter run -d chrome
4. Start Hospital Dashboard
cd hospital-dashboard
npm install
npm run dev

Dashboard:

http://localhost:5173
🔑 Demo Credentials

All demo accounts use:

Password: password123
Role	Email
Bystander	bystander@uyirkappan.demo
Driver 1	driver1@uyirkappan.demo
Driver 2	driver2@uyirkappan.demo
Driver 3	driver3@uyirkappan.demo
Driver 4	driver4@uyirkappan.demo
Driver 5	driver5@uyirkappan.demo
Hospital Staff	staff@uyirkappan.demo
Admin	admin@uyirkappan.demo

Hospital Staff:

Hospital ID: HOSP-01
Hospital: Apollo Trauma & Emergency Center
🧪 Testing
Backend
cd backend
npm test

Expected:

10 / 10 tests passed
Bystander App
cd bystander_app
flutter test

Expected:

33 / 33 tests passed
Driver App
cd driver_app
flutter test

Expected:

27 / 27 tests passed
Hospital Dashboard
cd hospital-dashboard
npm test

Expected:

25 / 25 tests passed
🔄 End-to-End Integration

The complete platform operates as follows:

                    BYSTANDER
                       │
                       │ Create Emergency
                       ▼
                  ┌──────────┐
                  │ BACKEND  │
                  └────┬─────┘
                       │
                       ▼
              Intelligent Dispatch
                       │
                       ▼
               Ambulance Selected
                       │
                       ▼
                 DRIVER APP
                       │
                ┌──────┴──────┐
                │             │
             ACCEPT        REJECT/TIMEOUT
                │             │
                │             ▼
                │          FALLBACK
                │             │
                │             ▼
                │       Next Ambulance
                │
                ▼
          Driver Accepted
                │
                ▼
        GPS + Status Updates
                │
                ├───────────────► BYSTANDER
                │
                └───────────────► HOSPITAL
                                      │
                                      ▼
                              Live Dashboard
                                      │
                                      ▼
                              Hospital Arrival
                                      │
                                      ▼
                                  COMPLETED
🏥 Hospital Dashboard Integration

The Hospital Dashboard communicates with the backend using:

REST API
POST /api/auth/login

GET /api/hospitals/:id
GET /api/hospitals/:id/incoming
GET /api/hospitals/:id/resources
PATCH /api/hospitals/:id/resources
GET /api/hospitals/:id/emergency-history

GET /api/emergency/:requestId
GET /api/emergency/:requestId/tracking
Socket.IO

The dashboard connects using the authenticated JWT token and subscribes to hospital and emergency rooms.

Real-time events include:

EMERGENCY_CREATED
AMBULANCE_ASSIGNED
AMBULANCE_LOCATION_UPDATED
ETA_UPDATED
STATUS_UPDATED
FALLBACK_STARTED
AMBULANCE_REASSIGNED
AMBULANCE_ARRIVED
EMERGENCY_COMPLETED
📊 Verification Status
Module	Verification	Status
Bystander App	33 / 33 tests	✅ Verified
Driver App	27 / 27 tests	✅ Verified
Hospital Dashboard	25 / 25 tests	✅ Verified
Backend	10 / 10 tests	✅ Verified
Intelligent Dispatch	42 / 42 sections	✅ Verified
Tracking / ETA / Fallback	40 / 40 sections	✅ Verified
📈 Project Highlights
Intelligent Ambulance Selection

Ambulances are evaluated using:

Travel Time → 50%
Distance    → 20%
Traffic     → 20%
Availability→ 10%
Cascading Fallback
Assignment
    ↓
Accept?
 ┌──┴──┐
YES    NO / TIMEOUT
 │          │
 │          ▼
 │       Next Candidate
 │          │
 └──────────┘
       ↓
Live Tracking
Real-Time Coordination
GPS Update
    ↓
Backend
    ↓
Socket.IO
    ├── Bystander
    └── Hospital
📚 Documentation

Additional documentation:

docs/
├── API.md
└── SOCKET_EVENTS.md

Swagger API documentation is available while the backend is running at:

http://localhost:5000/api-docs
⚠️ Prototype & Simulation Scope

UyirKappan is developed as an academic software prototype.

The intelligent dispatch engine uses a simulated road network and simulated ambulance environment for demonstrating:

Ambulance selection
Route calculation
Traffic-aware dispatch
Dynamic ETA
Cascading fallback
Real-time tracking
Hospital coordination

The system does not claim to replace or replicate the operational infrastructure of existing emergency services such as 108.

Performance targets demonstrated through simulation should not be interpreted as real-world Chennai emergency response guarantees.

👥 Project Modules
Module	Responsibility
Module 1	Bystander Mobile Application
Module 2	Driver / Ambulance Provider Application
Module 3	Hospital Dashboard
Module 4	Backend & Data Management
Module 5	Intelligent Dispatch Engine
Module 6	Live Tracking, ETA & Cascading Fallback
👨‍💻 Contributors
UyirKappan Team

A collaborative project covering:

Mobile Application Development
Backend & API Development
Real-Time Distributed Systems
Geospatial Computing
Intelligent Dispatch
Hospital Coordination
Live Tracking
Emergency Response Simulation
📄 License

This project is developed for academic and research purposes.

MIT License.

🚑 UyirKappan
Intelligent Coordination. Real-Time Tracking. Faster Emergency Response.

From emergency request to hospital arrival — one connected platform.
