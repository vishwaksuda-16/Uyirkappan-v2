# UyirKappan — Verification & Testing Guide

## 1. Test Suite Summary

Every subsystem in the UyirKappan repository contains automated test suites that validate functionality against the project specifications:

| Component | Test Suite Path | Runner | Total Tests | Pass Rate |
| :--- | :--- | :--- | :---: | :---: |
| **Backend (MongoDB Mode)** | `backend/test/*.test.js` | Node.js Test Runner | **165** | **100%** |
| **Backend (MemoryStore Mode)** | `backend/test/*.test.js` | Node.js Test Runner | **165** | **100%** |
| **Bystander Mobile App** | `bystander_app/test/` | Flutter Test | **46** | **100%** |
| **Driver Mobile App** | `driver_app/test/` | Flutter Test | **42** | **100%** |
| **Hospital Dashboard (Checklist Suite)** | `hospital-dashboard/test/checklist_verification.test.js` | Node.js Test Runner | **19** | **100%** |
| **End-to-End Lifecycle** | `hospital-dashboard/test/perfect_scenario_e2e.test.js` | Node.js Script | **9 Steps** | **100%** |

---

## 2. Running Backend Test Suites

### 2.1 Dual-Mode Regression Testing
The backend test suite executes 18 distinct sub-suites covering authentication, Dijkstra routing, intelligent matching, cascading fallback, MongoDB persistence, socket reconnect reconciliation, data provenance, location validation, and road-based routing with KML geometry.

```powershell
# 1. MongoDB Persistence Mode
cd backend
$env:DATA_STORE_MODE="mongodb"
npm test

# 2. In-Memory Mode
$env:DATA_STORE_MODE="memory"
npm test
```
- `test/road_based_routing_kml.test.js`: Validates `KmlParser`, `SpatialIndex` (421 cells, $< 10\text{ms}$ query latency), `ExistingGraphRoutingProvider` (70 nodes / 182 segments / 351 edges), `KmlAugmentedRoutingProvider` with road snapping, and deterministic Chennai benchmarks.
- `test/hospital_dashboard_comprehensive.test.js`: Validates Hospital Staff authentication, RBAC authorization, hospital data isolation (`H001` vs `H002`), bed and ventilator allocation limits, inbound emergency feeds, attempts audit endpoints, telemetry provenance, and Socket.IO delivery.

### 2.2 Cold Restart Persistence Suite
Validates that emergency records, driver assignments, and cascading fallback request attempts survive a full process termination:
```powershell
cd backend
node test/restart_persistence.test.js
```

---

## 3. Running Frontend Test Suites

### 3.1 Bystander Mobile App
Validates state controllers, GPS reverse geocoding, SOS submission, GPS provenance disclosures, stale telemetry notifications, cascading fallback notifications, and multi-viewport responsive layouts ($320\text{px}$–$414\text{px}$):
```powershell
cd bystander_app
flutter analyze
flutter test
```
- `test/widgets/bystander_lifecycle_and_provenance_test.dart`: Validates `GpsProvenanceBadge` (`● GPS LIVE (REAL)` vs `○ GPS SIMULATION`), `StaleTelemetryBanner` ($> 45\text{s}$ lag warning), cascading fallback reassignment notifications with preserved `requestId`, 7 canonical lifecycle states, cancellation modals, and zero-overflow rendering on compact $320\text{px} \times 568\text{px}$ displays.
- `test/widgets/phone_environment_test.dart`: Validates clean rendering without `RenderFlex` overflow across 5 standard phone viewport dimensions ($320\text{px} \times 568\text{px}$ to $414\text{px} \times 896\text{px}$).

### 3.2 Driver Mobile App
Validates the 10-state driver lifecycle finite-state machine, 15-second response countdown, multi-screen layouts ($320\text{px}$–$768\text{px}$), and the location provider subsystem (hardware GPS permission states, quality filtering, and fallback):
```powershell
cd driver_app
flutter analyze
flutter test
```
- `test/location_provider_test.dart`: Validates `RealGpsLocationProvider`, `SimulationLocationProvider`, `GpsQualityFilter` (bounds, staleness, accuracy, jumps), and `RealLocationService` fallback orchestration.


### 3.3 Hospital Dashboard
Validates triage intake cards, bed resource allocation, and live Socket.IO connection recovery:
```powershell
cd hospital-dashboard
npm test
```

### 3.4 Perfect Scenario End-to-End Lifecycle Test
Executes a synchronized, deterministic test simulating Bystander creation, Intelligent Dispatch selection, Driver acceptance, GPS telemetry, patient onboarding, hospital arrival, and resource restoration:
```powershell
# Ensure backend is running on port 5000
cd hospital-dashboard
node test/perfect_scenario_e2e.test.js
```
