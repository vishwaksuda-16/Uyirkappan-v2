# UyirKappan — System Design & Algorithmic Specifications

## 1. Emergency Lifecycle State Machine

The platform coordinates emergency states across the backend, bystander app, driver app, and hospital dashboard:

```text
    ┌────────────────────────────────────────────────────────┐
    │                        CREATED                         │
    └───────────────────────────┬────────────────────────────┘
                                │ Matcher locates candidates
    ┌───────────────────────────▼────────────────────────────┐
    │                       SEARCHING                        │
    └───────────────────────────┬────────────────────────────┘
                                │ Optimal unit selected
    ┌───────────────────────────▼────────────────────────────┐
    │                        ASSIGNED                        │
    └───────────┬───────────────────────────────┬────────────┘
                │ Driver accepts                │ Driver rejects / 15s timeout
                │                               ▼
                │                    ┌──────────────────────┐
                │                    │  Cascading Fallback  │
                │                    │  (Attempt Logged)    │
                │                    └──────────┬───────────┘
                │                               │ Next candidate selected
                │                               ▼
                │                    ┌──────────────────────┐
                │                    │       ASSIGNED       │
                │                    └──────────┬───────────┘
                ▼                               │
    ┌───────────────────────────────────────────▼────────────┐
    │                        ACCEPTED                        │
    └───────────────────────────┬────────────────────────────┘
                                │ Driver starts driving to scene
    ┌───────────────────────────▼────────────────────────────┐
    │                  EN_ROUTE_TO_PATIENT                   │
    └───────────────────────────┬────────────────────────────┘
                                │ Driver arrives at scene
    ┌───────────────────────────▼────────────────────────────┐
    │                   ARRIVED_AT_PATIENT                   │
    └───────────────────────────┬────────────────────────────┘
                                │ Patient stabilized & boarded
    ┌───────────────────────────▼────────────────────────────┐
    │                     PATIENT_ONBOARD                    │
    └───────────────────────────┬────────────────────────────┘
                                │ Inbound to emergency department
    ┌───────────────────────────▼────────────────────────────┐
    │                  EN_ROUTE_TO_HOSPITAL                  │
    └───────────────────────────┬────────────────────────────┘
                                │ Arrived at hospital bay
    ┌───────────────────────────▼────────────────────────────┐
    │                   ARRIVED_AT_HOSPITAL                  │
    └───────────────────────────┬────────────────────────────┘
                                │ Handover confirmed & beds updated
    ┌───────────────────────────▼────────────────────────────┐
    │                       COMPLETED                        │
    │              (Ambulance returns to AVAILABLE)          │
    └────────────────────────────────────────────────────────┘
```

---

## 2. Intelligent Dispatch Algorithm

The dispatch decision is executed in [`DispatchEngineService`](file:///c:/Users/lenovo/Desktop/Uyirkappan-v2/backend/src/matcher/modules/dispatch/dispatch-engine.service.js):

### Step 1: Candidate Filtering
Ambulances are evaluated against three filtering criteria:
1. `status === 'AVAILABLE'` (only idle units eligible).
2. `excludedAmbulanceIds.has(ambulanceId) === false` (units that previously rejected or timed out on this emergency request are excluded).
3. $\text{HaversineDistance}(\text{AmbulanceLocation}, \text{PickupLocation}) \le \text{SearchRadiusKm}$.

### Step 2: Route & Travel Time Calculation
For each candidate:
1. The Dijkstra routing engine maps the ambulance and pickup location to their nearest road network nodes.
2. The traffic-weighted shortest path is computed, returning distance ($D_{\text{km}}$) and travel time ($T_{\text{min}}$).
3. Traffic cost ($C_{\text{traffic}}$) is computed as $\frac{T_{\text{min}}}{D_{\text{km}}}$ for routes exceeding $2.0\text{ km}$, or defaulted to $1.0$ for short approach distances.

### Step 3: Multi-Factor Scoring
Values are normalized against candidate population maximums:
$$T_{\text{score}} = \frac{T_{\text{min}}}{\max(T_{\text{min}}, 1)}$$
$$D_{\text{score}} = \frac{D_{\text{km}}}{\max(D_{\text{km}}, 1)}$$
$$C_{\text{score}} = \frac{C_{\text{traffic}}}{\max(C_{\text{traffic}}, 1.0)}$$
$$P_{\text{score}} = \frac{\text{Penalty}}{\max(\text{Penalty}, 1)}$$

The final composite score is calculated using authoritative weights:
$$\text{Total Score} = 0.50 \times T_{\text{score}} + 0.20 \times D_{\text{score}} + 0.20 \times C_{\text{score}} + 0.10 \times P_{\text{score}}$$

Candidates are ranked ascending by score; the candidate with the lowest total score is selected for assignment.

---

## 3. Dijkstra Routing & Road-Based Network Architecture

### 3.1 Topology & Edge Cost Formulation
- **Topology**: 70 road network nodes (`H001`–`H030` corresponding to hospitals, `A001`–`A040` corresponding to ambulance stations) connected by 182 physical road segments yielding 351 directed graph edges.
- **Edge Cost Formulation**:
  $$\text{Edge Cost} = \text{LengthKm} \times \text{TrafficMultiplier}$$
- **Detour Handling**: If a road segment condition is set to `BLOCKED`, its multiplier is $\infty$, causing Dijkstra's priority queue to find an alternate route around the blockage.

### 3.2 GIS Road Centerline KML Audit & Limitations
The platform incorporates reference GIS centerline geometry (`1ef735dc-2397-4dc3-88e8-d98ea0b8339b.kml` / `chennai_road_centerline.kml`):
- **Empirical Scale**: 34,042 Placemarks, 60,382 LineStrings, 741,740 coordinates.
- **Bounding Box**: $[12.852250, 80.134055]$ to $[13.232146, 80.330845]$.
- **Critical Graph Limitations**:
  1. *Zero Directionality*: 0 one-way or turn restriction tags exist.
  2. *Zero Speed Limits*: No speed classifications or highway hierarchies exist.
  3. *Zero Elevation / Layering*: 2D crossings lack bridge, tunnel, or flyover z-levels (preventing automatic intersection derivation).
  4. *Endpoint Discontinuity*: 78.61% of LineString endpoints are isolated and do not touch other endpoints.
  Consequently, raw KML centerlines serve as **Layer A (High-Resolution Source Geometry)** rather than a standalone unvalidated graph.

### 3.3 GPS-to-Road Snapping Pipeline (`SpatialIndex`)
To bridge arbitrary GPS coordinates to road centerlines:
1. **Grid Partitioning**: A 2D spatial grid partitions the Chennai bounding box into 421 cells ($0.01^\circ \approx 1.1\text{ km}$).
2. **Sub-Millisecond Search**: Queries scan only the target cell and 8 adjacent cells (avoiding full 741k coordinate scans).
3. **Equirectangular Projection**: Calculates perpendicular projection vector $t \in [0, 1]$ onto line segments with cosine latitude correction.
4. **Tolerance Gating**: Maximum snapping distance is enforced ($500\text{m}$ default). Coordinates exceeding tolerance retain original values with `isSnapped: false`.

### 3.4 Pluggable Routing Provider Abstraction
- `ROUTING_GRAPH_SOURCE=existing` (Default): Solves Dijkstra paths over the verified 70-node / 182-segment network.
- `ROUTING_GRAPH_SOURCE=kml_augmented`: Pre-snaps origin and destination coordinates to real KML road centerlines, attaching rich snapping metadata to route dossiers.

---

## 4. Cascading Fallback & Persistent Ledger

When an assignment cannot be fulfilled:
1. **Driver Action**: The driver taps **Reject** on their mobile app, or fails to respond before the **15-second response countdown** expires.
2. **Attempt Recording**: The backend records the attempt in `RequestAttempt`:
   ```json
   {
     "requestId": "UK-2026-000001",
     "attemptNumber": 1,
     "ambulanceId": "AMB0001",
     "driverId": "DRV0001",
     "response": "REJECTED",
     "reason": "Driver unavailable",
     "timestamp": "2026-10-03T00:15:00.000Z"
   }
   ```
3. **Ambulance Release**: The failed ambulance's assignment is cleared, and its status is restored to `AVAILABLE` so it can receive other emergencies.
4. **Exclusion & Re-query**: The failed ambulance is added to the emergency's exclusion set. The matcher is re-executed with eligible candidates.
5. **Reassignment**: Assignment Attempt #2 is created on the **same emergency request ID**.
6. **Socket Broadcast**: `FALLBACK_STARTED` and `AMBULANCE_ASSIGNED` events are emitted, informing the bystander and notifying the next driver without requiring user re-entry.
 
---

## 5. Real GPS & Telemetry Ingestion Pipeline

```
[Hardware GPS Chip] ──> [Geolocator Platform Interface] ──> [RealGpsLocationProvider]
                                                                     │
                                                                     ▼
                                                          [GpsQualityFilter]
                                                           • Lat/Lng Bounds [-90, 90], [-180, 180]
                                                           • Freshness Check (max 30s stale)
                                                           • Kinematic Check (max 180 km/h)
                                                           • Accuracy Check (> 100m degraded)
                                                                     │
                                                                     ▼
                                                          [RealLocationService]
                                                           (Automatic Fallback to
                                                            SimulationLocationProvider)
                                                                     │
                                                                     ▼ HTTP PATCH /api/ambulances/:id/location
                                                           [Backend Express API]
                                                           • RBAC / Ownership verification
                                                           • Coordinate & Timestamp Validation
                                                                     │
                                             ┌───────────────────────┴───────────────────────┐
                                             ▼                                               ▼
                                  [LocationHistory / Mongo]                    [Socket.IO Broadcast]
                                  • Audit trail with accuracy                  • AMBULANCE_LOCATION_UPDATED
                                                                               • Bystander, Hospital, Driver
```

1. **Hardware Position Capture**: `RealGpsLocationProvider` uses high-accuracy location settings with a 3-meter distance filter.
2. **Quality Evaluation**: `GpsQualityFilter` filters out impossible kinematic teleportation ($> 50\text{ m/s}$ / $> 180\text{ km/h}$) and flags degraded signals ($> 100\text{m}$ horizontal accuracy).
3. **Graceful Fallback**: If device location services are disabled or permissions are denied, `RealLocationService` automatically falls back to `SimulationLocationProvider`, ensuring zero disruption to navigation demonstrations.
4. **Backend Ingestion & Broadcast**: The backend validates driver ownership and coordinates, writes to `LocationHistory` (with accuracy), and emits real-time updates to connected emergency rooms.
