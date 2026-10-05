# UYIRKAPPAN — DATA PROVENANCE & OPERATIONAL TRUST BOUNDARY SPECIFICATION

**Version**: 1.0.0  
**Phase**: Phase 20 Hardening  
**Scope**: Full repository data assets, classification taxonomy, operational trust boundaries, and enforcement rules.

---

## 1. FORMAL CLASSIFICATION TAXONOMY

The UyirKappan emergency dispatch and hospital coordination platform enforces seven mutually exclusive data classifications:

| Classification | Definition | Live? | Operational? |
|---|---|---|---|
| **`OPERATIONAL`** | Authoritative application runtime state residing in MongoDB / MemoryStore (active emergency requests, driver assignments, bed occupancy, real-time location history). | **Yes** | **Yes** |
| **`SIMULATION`** | Modeled synthetic or historical simulation datasets used to simulate fleet availability, crew, incident scenarios, and diurnal congestion profiles. | **No** | Conditional (Initial Fleet/Traffic Model) |
| **`REFERENCE_BASELINE`** | Empirical or historical call logs (e.g., `dummy_ambulance_data.xlsx`) used exclusively for retrospective benchmarking and research validation. Strictly prohibited from dispatch or routing. | **No** | **No** |
| **`STATIC_INFRASTRUCTURE`** | Invariant spatial, facility, and topological network data (hospitals, ambulance bases, road nodes, road segments, GIS KML centerline vectors). | **No** | **Yes** (Graph/Facility Topology) |
| **`EXTERNAL_LIVE`** | Authenticated real-time streaming third-party feeds (Google Routes API, Mappls OAuth2 API) active only when verified credentials and live connections exist. | **Conditional** | **Conditional** |
| **`TEST_FIXTURE`** | Synthetic unit/integration fixtures designed exclusively for test harnesses. | **No** | **No** |
| **`GENERATED`** | Algorithmic experimental outputs, paired t-test results, summary reports, and generated evidence artifacts. | **No** | **No** |

---

## 2. DATA-SOURCE INVENTORY & CLASSIFICATION TABLE

| ID | Data Source | File / Location | Format | Classification | Live? | Operational? | Purpose & Scope |
|---|---|---|---|---|---|---|---|
| **DSRC-01** | 108 Reference Baseline Workbook | `dummy_ambulance_data.xlsx` (Root) | `.xlsx` | `REFERENCE_BASELINE` | No | No | 50 historical 108 calls (94% Madurai, 0% Chennai). Evaluation and research benchmark ONLY. |
| **DSRC-02** | 108 Evaluation CSV Subset | `Datasets/Datasets/tamil_nadu_108_evaluation.csv` | `.csv` | `REFERENCE_BASELINE` | No | No | Anonymized subset of 108 workbook for fast analytical loading. |
| **DSRC-03** | Chennai Simulation Ambulance Fleet | `Datasets/Datasets/ambulance_fleet.csv` | `.csv` | `SIMULATION` | No | Yes (Initial Seed) | 131 ambulances stationed across 40 Chennai bases with equipment capabilities. |
| **DSRC-04** | Healthcare Dispatch Centers & Bases | `Datasets/Datasets/chennai_healthcare_dispatch_dataset.csv` | `.csv` | `STATIC_INFRASTRUCTURE` | No | Yes | 30 hospitals and 40 ambulance bases in the Chennai Metropolitan Area. |
| **DSRC-05** | Hospital Capacity & Critical Care Beds | `Datasets/Datasets/hospital_capacity.csv` | `.csv` | `STATIC_INFRASTRUCTURE` | No | Yes | ER, ICU, ventilator capacity baseline for 30 Chennai hospitals. |
| **DSRC-06** | Road Network Nodes | `Datasets/Datasets/road_network_nodes.csv` | `.csv` | `STATIC_INFRASTRUCTURE` | No | Yes | 70 road network nodes forming the Chennai routing graph. |
| **DSRC-07** | Road Network Segments | `Datasets/Datasets/road_network_segments.csv` | `.csv` | `STATIC_INFRASTRUCTURE` | No | Yes | 182 road segments with physical distances and default speed limits. |
| **DSRC-08** | Diurnal Traffic Conditions | `Datasets/Datasets/traffic_conditions.csv` | `.csv` | `SIMULATION` | No | Yes | 24-hour diurnal traffic congestion multipliers for Chennai corridors. |
| **DSRC-09** | Emergency Scenario Requests | `Datasets/Datasets/emergency_requests.csv` | `.csv` | `SIMULATION` | No | No | 3,000 synthetic incident scenarios for large-scale stress testing. |
| **DSRC-10** | Historical Dispatch Assignments | `Datasets/Datasets/dispatch_assignments.csv` | `.csv` | `SIMULATION` | No | No | 3,765 scenario assignments for algorithmic reproducibility. |
| **DSRC-11** | Ambulance GPS Trajectories | `Datasets/Datasets/ambulance_gps_trajectories.csv` | `.csv` | `SIMULATION` | No | No | 10,372 synthetic GPS breadcrumbs for trajectory replay. |
| **DSRC-12** | GIS Road Centerline KML | `1ef735dc-...kml` / `chennai_road_centerline.kml` | `.kml` | `STATIC_INFRASTRUCTURE` | No | No | Vector polyline geometry for Chennai road centerlines used in map rendering. |
| **DSRC-13** | Operational DataStore | `MongoDB / MemoryStore` | DB | `OPERATIONAL` | Yes | Yes | Authoritative runtime state: active requests, assignments, driver telemetry. |
| **DSRC-14** | Google Routes Adapter | `GoogleTrafficProvider.js` | API | `EXTERNAL_LIVE` (Stub) | Conditional | Conditional | Unconfigured adapter stub; gracefully delegates to simulation when API key is missing. |
| **DSRC-15** | Mappls OAuth2 Adapter | `MapplsTrafficProvider.js` | API | `EXTERNAL_LIVE` (Stub) | Conditional | Conditional | Unconfigured adapter stub; gracefully delegates to simulation when credentials are missing. |

---

## 3. OPERATIONAL TRUST BOUNDARY

```
┌─────────────────────────────────────────────────────────────┐
│                   OPERATIONAL TRUST BOUNDARY                │
│                                                             │
│   Bystander App          Driver App        Hospital Portal  │
│         │                    │                    │         │
│         ▼                    ▼                    ▼         │
│   ┌─────────────────────────────────────────────────────┐   │
│   │              AUTHORITATIVE DATASTORE                │   │
│   │               (MongoDB / MemoryStore)               │   │
│   │  - Emergencies: UK-2026-XXXX                        │   │
│   │  - Fleet: AMB0001–AMB0131 (Chennai GPS)             │   │
│   │  - Assignments, Attempts, LocationHistory           │   │
│   └──────────────────────────┬──────────────────────────┘   │
│                              │                              │
│                              ▼                              │
│   ┌─────────────────────────────────────────────────────┐   │
│   │            INTELLIGENT DISPATCH ENGINE              │   │
│   │  - Multi-Factor Candidate Scoring                   │   │
│   │  - Traffic-Aware Dynamic Dijkstra Routing           │   │
│   └─────────────────────────────────────────────────────┘   │
└──────────────────────────────▲──────────────────────────────┘
                               │
               ┌───────────────┴───────────────┐
               │                               │
┌──────────────┴──────────────┐ ┌──────────────┴──────────────┐
│    STATIC INFRASTRUCTURE    │ │      SIMULATION INPUTS      │
│  - 70 Road Nodes (Chennai)  │ │  - 131 Fleet Units (Base)   │
│  - 182 Road Segments        │ │  - 24-hr Diurnal Traffic    │
│  - 30 Hospitals / 40 Bases  │ │  - GPS Telemetry Simulator  │
└─────────────────────────────┘ └─────────────────────────────┘

═══════════════════════════════════════════════════════════════
                 STRICT ISOLATION FIREWALL
═══════════════════════════════════════════════════════════════

┌─────────────────────────────────────────────────────────────┐
│                 REFERENCE & EVALUATION BOUNDARY             │
│                                                             │
│   ┌────────────────────────┐   ┌────────────────────────┐   │
│   │   108 Reference Data   │   │   Scenario Requests    │   │
│   │  dummy_ambulance_data  │   │ emergency_requests.csv │   │
│   │  (50 Madurai cases)    │   │  (3,000 scenarios)     │   │
│   └───────────┬────────────┘   └───────────┬────────────┘   │
│               │                            │                │
│               ▼                            ▼                │
│   ┌─────────────────────────────────────────────────────┐   │
│   │       EVALUATION & RESEARCH ENGINE (Read-Only)      │   │
│   │  - /api/evaluation/baseline                         │   │
│   │  - /api/evaluation/108-comparison                   │   │
│   │  - Research Portal Overview                         │   │
│   └─────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────┘
```

### Boundary Enforcement Rules
1. **Rule 1 (Zero Reference Contamination)**: Tokens `AMB-001` through `AMB-004` and 13-digit Madurai case IDs are programmatically blocked by `assertOperationalAmbulanceBoundary` and `assertOperationalEmergencyBoundary`.
2. **Rule 2 (Geographic Bounds)**: All operational ambulances must reside within Chennai latitude/longitude coordinates ($12.5^\circ \le \text{lat} \le 13.5^\circ$, $79.5^\circ \le \text{lon} \le 80.5^\circ$).
3. **Rule 3 (Zero Live Mocking)**: Simulation traffic is explicitly labeled `isLive: false`, `source: 'SIMULATED_TRAFFIC'`. External adapters report `NOT_CONFIGURED` without valid credentials.
4. **Rule 4 (Read-Only Evaluation)**: Evaluation service calls never mutate or insert operational records into MongoDB or MemoryStore.

---

## 4. SCIENTIFIC INTEGRITY & TERMINOLOGY GUIDELINES

- **Do Not Claim**: "131 real Chennai ambulances" $\to$ **Use**: "131 simulated Chennai ambulance fleet units positioned at 40 strategic bases".
- **Do Not Claim**: "Live Chennai traffic" $\to$ **Use**: "Diurnal simulation traffic model calibrated from Chennai hourly patterns".
- **Do Not Claim**: "Live 108 integration" $\to$ **Use**: "108 historical reference baseline comparison (Madurai sample)".
- **Do Not Claim**: "Real-time road network" $\to$ **Use**: "Static 70-node topological road network of Chennai urban corridors".
