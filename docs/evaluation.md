# UyirKappan — Research Evaluation & Baseline Methodology

## 1. Evaluation Methodology

UyirKappan evaluates intelligent emergency coordination using a **multi-tiered simulation and empirical benchmarking framework**:
1. **Simulation Fleet Environment**: 131 ambulances positioned across 40 bases in Central Chennai responding to 3,000 synthetic incident scenarios.
2. **Dynamic Traffic Integration**: Dijkstra shortest-path calculations adjusted by diurnal traffic congestion states (`NORMAL`, `MODERATE`, `HEAVY`, `BLOCKED`).
3. **Comparative Dispatch Baselines**:
   - **Baseline 1 (Nearest Unit, Traffic-Blind)**: The ambulance with the minimum Haversine distance dispatched along the shortest Euclidean path without traffic cost adjustment.
   - **UyirKappan (Traffic-Aware Multi-Factor)**: Ambulance selected via the multi-factor scoring model (50% Time + 20% Distance + 20% Traffic + 10% Availability).

---

## 2. 108 Retrospective Baseline Analysis

### Data Origin & Characteristics
- **File**: `dummy_ambulance_data.xlsx` (Root-level reference file)
- **Record Count**: 50 retrospective emergency call logs.
- **Geographic Context**: **94% Madurai district**, 6% other regions (0% Chennai).
- **Coordinate Telemetry**: None. Records contain textual street addresses without continuous GPS tracking points.
- **Benchmark Metrics**:
  - Mean Historical Response Time: **18.4 minutes**
  - Median Response Time: **17.0 minutes**
  - Standard Benchmark Compliance ($\le 15\text{ min}$): **36.0%**

### Scientific Framing & Claim Boundaries
- The comparison between UyirKappan's simulated Chennai response times and the 108 reference dataset is **strictly non-causal**.
- The dataset serves as an empirical **response-time distribution benchmark**, establishing real-world emergency response latencies in Tamil Nadu.
- UyirKappan does **not** claim to have field-tested or reduced actual 108 ambulance response times in live operations.

---

## 3. Evaluation Metrics

### 3.1 Dispatch & Routing Performance
- **Candidate Search Latency**: Time required to filter candidates, calculate Dijkstra routes, and compute multi-factor scores ($< 15\text{ ms}$).
- **Travel Time Variance**: Difference between traffic-blind baseline routing and traffic-optimized routing.
- **Detour Resilience**: Route cost recalculation when road segments transition to `BLOCKED`.

### 3.2 Cascading Fallback Robustness
- **Timeout Sensitivity**: Automated triggering of fallback upon expiration of the 15-second driver response SLA.
- **Ledger Persistence**: Verification that all failure reasons (`REJECTED`, `TIMEOUT`) and sequential attempts are preserved in the persistent database.
- **State Integrity**: Verification that simultaneous driver acceptances are prevented via atomic database constraints (`409 Conflict`).

---

## 4. Academic Limitations

1. **Topological Simplification**: The virtual road network models 70 major intersections and transit corridors rather than a fine-grained OpenStreetMap graph.
2. **Simulated Telemetry**: GPS updates are emitted by simulated mobile telemetry clients rather than physical vehicle OBD-II modems.
3. **Geographic Non-Overlap**: The empirical baseline comprises Madurai incidents while the routing simulation models Central Chennai.
