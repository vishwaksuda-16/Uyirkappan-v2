# Phase 12 — Research Portal Implementation & Forensic Audit Report

**Date:** 2026-10-03  
**Status:** ✅ COMPLETE  
**Auditor / Engineer:** Senior Research-Platform Engineer & Forensic Auditor (Antigravity)

---

## 1. Executive Summary

Phase 12 upgraded and completed the **Research Portal (`research-portal`)** for the **UyirKappan Unified Emergency Response Platform**. 
The Research Portal serves as the primary academic and evaluation interface, isolating proof catalogs, evaluation summaries, and empirical visualizations away from the operational hospital command surface.

Key achievements of Phase 12:
1. **Dedicated Provenance & Limitations Interface**:
   - Created and integrated [`ProvenanceLimitationsPage.jsx`](file:///c:/Users/lenovo/Desktop/Uyirkappan-v2/research-portal/src/pages/ProvenanceLimitationsPage.jsx), exposing the full Data Provenance Matrix across all subsystems.
   - Explicitly clarified that the active dispatcher utilizes **Haversine coordinate snapping + Dijkstra shortest-path routing**, while H3 geospatial indexing remains an architectural design concept rather than the current runtime matching loop.
   - Clearly categorized `dummy_ambulance_data.xlsx` as a **REFERENCE / BASELINE** dataset rather than live fleet data, and classified the 33.7 MB Chennai KML as **STATIC REFERENCE GEOMETRY**.
   - Transparently documented system boundaries: simulated traffic conditions (`isLive: false`), research-oriented evaluation, and non-causal contextual comparisons with the 108 reference sample.
2. **Navigation & Route Enhancements**:
   - Updated `research-portal/src/App.jsx` with an accessible navigation item (`Provenance & limits`), full routing integration, and responsive layout hardening.
3. **Research Portal Dedicated Verification Suite**:
   - Built [`test/phase12_research_portal.test.js`](file:///c:/Users/lenovo/Desktop/Uyirkappan-v2/research-portal/test/phase12_research_portal.test.js) with 9 formal unit and contract checks verifying scoring weights, provenance classifications, 108 baseline parameters, stale telemetry rules, and canonical lifecycle sequences.
   - All 9/9 tests pass cleanly.
4. **Production Build & Regression Integrity**:
   - Vite production build of `research-portal` passes in 1.08s with zero errors.
   - All existing test suites across the platform continue to pass at 100%:
     - Research Portal: **9/9 passed**
     - Hospital Verification: **19/19 passed** (6 offline skipped as designed)
     - Hospital Phase 11 Suite: **11/11 passed**
     - Backend Node.js: **165/165 passed** (18 test suites)
     - Driver App Flutter: **69/69 passed**
     - Bystander App Flutter: **46/46 passed**

---

## 2. Phase Objective

The objective of Phase 12 was to complete the Research Portal as a defensible, honest, and evidence-driven evaluation interface for researchers, examiners, and jury members. 
The portal provides transparent access to system architecture, experimental results, and data provenance while strictly adhering to backend authority and avoiding unsupported claims of clinical superiority or live traffic operations.

---

## 3. Repository Baseline

Before modifying any source code, baseline measurements were recorded:
- **Research Portal Directory**: Existed at `research-portal/` with React 19 + Vite 8.
- **Initial Build**: `npm run build` compiled cleanly.
- **Initial Test Suite**: No dedicated test suite existed within `research-portal/test/`.
- **Backend Test Baseline**: 165/165 passed across 18 test suites.
- **Hospital Dashboard Baseline**: 19 checklist tests + 11 Phase 11 tests passed.
- **Driver App Baseline**: 69/69 tests passed.
- **Bystander App Baseline**: 46/46 tests passed.

---

## 4. Existing Research Portal Audit

The audit revealed that `research-portal` was cleanly structured:
- Provided an `OverviewPage` summarizing road network counts and linking to evidence pages.
- Leveraged shared evidence modules (`EvidenceWorkflow`, `EvidenceMatching`, `EvidenceRouteComparison`, `EvidenceLiveTracking`, `EvidenceFallback`) located in `hospital-dashboard/src/pages/Evidence/`.
- Embedded live backend links to standalone HTML visualizations (`/network-map.html`, `/traffic-visualization.html`, `/comparison-dashboard.html`).
- **Gaps Identified**:
  - Lacked an explicit dedicated Provenance and Limitations dashboard.
  - Did not clearly differentiate the active Haversine + Dijkstra implementation from the documented H3 architectural concept.
  - Lacked a dedicated frontend verification test suite.

---

## 5. Research Portal Information Architecture

The upgraded Research Portal is organized across the following core views:
```text
RESEARCH PORTAL
│
├── Research Overview (OverviewPage.jsx)
│   ├── Dataset-backed Metrics (70 nodes, 182 segments, 3,000 cases)
│   ├── 108 Reference Baseline Summary
│   └── Proof Catalogue Quick-Launch (E1 - E5)
│
├── Results & Experiments (ExperimentalResultsPage.jsx)
│   ├── Dispatch Evaluation Metrics
│   └── Empirical Latency & Travel-Time Reductions
│
├── Proof Catalogue (EvidencePage.jsx)
│   ├── E1: End-to-End Emergency Coordination
│   ├── E2: Ambulance Matching Multi-factor Evaluation
│   ├── E3: Route Comparison & Geometry Snapping
│   ├── E4: Live Telemetry & Dynamic ETA
│   └── E5: Cascading Fallback Dispatch
│
└── Provenance & Limits (ProvenanceLimitationsPage.jsx) [NEW]
    ├── Authoritative Data Provenance Matrix
    ├── Dispatch Scoring Weights & Formula
    ├── Fact vs Documented Design (Haversine/Dijkstra vs H3)
    ├── 108 Baseline Honest Boundaries
    ├── Known Geospatial & Deployment Limitations
    └── Evaluation Reproducibility Checklist
```

---

## 6. Authoritative Data Provenance Matrix

Every subsystem artifact is explicitly classified in the Research Portal:

| Artifact / Subsystem | Scope & Metrics | Classification | Data Source | Scientific Notes |
|---|---|---|---|---|
| **Road Network Graph** | 70 nodes, 182 segments, 351 edges | `STATIC / DERIVED` | Chennai road network dataset (JSON/Graph) | Primary topology for Dijkstra path computation and traffic weighting. |
| **Road Geometry KML** | 34,042 Placemarks, 60,382 LineStrings, 741,740 coords (~33.7 MB) | `STATIC REFERENCE` | Chennai GIS Open Data (KML format) | Reference polyline geometry for route visualization. Lacks one-way, lane, and elevation metadata. |
| **Ambulance Reference Fleet** | 30 pre-registered ambulances, 30 hospital points | `REFERENCE / BASELINE` | `dummy_ambulance_data.xlsx` | Reference baseline; NOT active live GPS operational fleet. |
| **Traffic Conditions** | Dynamic multipliers (1.0x, 1.35x, 2.1x, Infinity) | `SIMULATED TRAFFIC` | `SimulationTrafficProvider` (`isLive: false`) | Pluggable architecture ready for live TomTom/Google Maps API integration. |
| **GPS Telemetry Provider** | Real vs Simulation Provider | `REAL / SIMULATION` | Flutter Location Provider & Backend Engine | Multi-cue distinction: `● GPS LIVE (REAL)` vs `○ GPS SIMULATION` with 45s staleness rule. |
| **108 Historical Benchmark** | 50 emergency incidents (94% Madurai, 6% Other) | `REFERENCE BASELINE` | `dummy_ambulance_data.xlsx` (108 records) | Mean: 11.08m, Benchmark: 14.58m, 72% compliance. Non-causal contextual reference. |
| **Dispatch Scoring Formula** | 50% Time, 20% Dist, 20% Traffic, 10% Avail | `DETERMINISTIC MODEL` | `AmbulanceMatchingService` | Weighted cost index; uses Haversine + Dijkstra. |

---

## 7. Dispatch Evaluation & Mathematical Model

The dispatch evaluation transparently displays the mathematical formulation executed by `AmbulanceMatchingService`:
$$\text{Score} = 0.50 \times \text{TravelTimeScore} + 0.20 \times \text{DistanceScore} + 0.20 \times \text{TrafficScore} + 0.10 \times \text{AvailabilityScore}$$

- **Travel Time (50%)**: Derived via Dijkstra traversal time over edge distance divided by dynamic segment speed.
- **Distance (20%)**: Spatial proximity between candidate vehicle and emergency coordinates.
- **Traffic (20%)**: Evaluated using edge congestion multipliers from the traffic provider.
- **Availability (10%)**: Unit operational status weighting.

---

## 8. Fallback Dispatch Evaluation (E5)

The cascading fallback sequence preserves the canonical `requestId` without requiring bystander intervention:
$$\text{Emergency Request} \rightarrow \text{Candidate Unit} \rightarrow \text{Timeout (15s) / Reject} \rightarrow \text{Audit Log} \rightarrow \text{Next Best Unit Reassigned}$$
This workflow is independently verifiable through the E5 proof module.

---

## 9. 108 Baseline Honest Boundary

The 108 ambulance sample from `dummy_ambulance_data.xlsx` is presented strictly as a contextual benchmark:
- **Sample Size**: 50 records.
- **Geography**: 94% Madurai district (47 cases), not Chennai metropolitan arterial roads.
- **Response Metrics**: Mean response of 11.08 minutes; 72% met the 14.58-minute benchmark.
- **Research Honesty**: UyirKappan makes **no** claims of causal clinical superiority, mortality reduction, or replacement of the 108 emergency service.

---

## 10. Research Limitations & Future Work

Documented directly in the portal:
1. **Geospatial & Routing Limits**: Static KML reference lacks turn prohibitions, bridge elevations, and dynamic lane changes.
2. **Traffic Simulation**: Real-time traffic is simulated via deterministic edge multipliers rather than live commercial API streams.
3. **Clinical & Operational Boundary**: Prototype coordination system; not an EHR, FHIR/HL7 clinical decision engine, or active 108 production dispatch center.
4. **Future Work**: Integration of live commercial traffic feeds (TomTom/Google), physical device multi-node testing, and FHIR standard interoperability.

---

## 11. Test Evidence & Verification Results

### Summary of Executed Suites:
| Test Suite | Command | Total Tests | Passed | Failed | Status |
|---|---|---|---|---|---|
| **Research Portal** | `node test/phase12_research_portal.test.js` | 9 | 9 | 0 | ✅ PASS |
| **Research Portal Build** | `npm run build` | 1955 modules | - | 0 errors | ✅ PASS |
| **Hospital Checklist** | `node test/checklist_verification.test.js` | 19 | 19 | 0 | ✅ PASS |
| **Hospital Phase 11 Suite**| `node test/phase11_ui_ux.test.js` | 11 | 11 | 0 | ✅ PASS |
| **Backend Core** | `npm test` | 165 | 165 | 0 | ✅ PASS |
| **Driver App** | `flutter test` | 69 | 69 | 0 | ✅ PASS |
| **Bystander App** | `flutter test` | 46 | 46 | 0 | ✅ PASS |

---

## 12. Files Modified & Created

### Modified:
- [`research-portal/src/App.jsx`](file:///c:/Users/lenovo/Desktop/Uyirkappan-v2/research-portal/src/App.jsx) (Added route and navigation item for Provenance & Limitations)

### Created:
- [`research-portal/src/pages/ProvenanceLimitationsPage.jsx`](file:///c:/Users/lenovo/Desktop/Uyirkappan-v2/research-portal/src/pages/ProvenanceLimitationsPage.jsx) (Comprehensive provenance matrix, limitations, and reproducibility guide)
- [`research-portal/test/phase12_research_portal.test.js`](file:///c:/Users/lenovo/Desktop/Uyirkappan-v2/research-portal/test/phase12_research_portal.test.js) (Verification suite for Phase 12 claims and contracts)
- [`documents/phase12_research_portal_report.md`](file:///c:/Users/lenovo/Desktop/Uyirkappan-v2/documents/phase12_research_portal_report.md) (Forensic audit report)

---

## 13. Scope & Research Honesty Audit

- **No Client-side Routing or Dispatch**: All routes, scores, and ETAs are backend-authoritative.
- **No Fabricated Data**: Provenance explicitly labels data sources as REFERENCE, SIMULATION, STATIC, or DERIVED.
- **No Unsubstantiated H3 Claims**: Active matcher is explicitly documented as Haversine + Dijkstra.
- **No Unsupported Superiority Claims**: 108 comparison is categorized strictly as a reference benchmark.

---

## 14. Final Acceptance Gate

| Checkpoint | Target | Actual | Result |
|---|---|---|---|
| Research Portal Build | 0 errors | 0 errors (1.08s) | ✅ PASS |
| Research Portal Tests | 9 pass | 9 pass | ✅ PASS |
| Backend Regression | 165 pass | 165 pass | ✅ PASS |
| Driver App Regression | 69 pass | 69 pass | ✅ PASS |
| Bystander App Regression | 46 pass | 46 pass | ✅ PASS |
| Hospital Dashboard Regression | 30 pass | 30 pass | ✅ PASS |
| Documentation Synchronized | Yes | Yes | ✅ PASS |

**PHASE 12 STATUS: COMPLETE ✅**
