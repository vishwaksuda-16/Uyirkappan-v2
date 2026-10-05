/**
 * UYIRKAPPAN — DATA SOURCE PROVENANCE AND CLASSIFICATION REGISTRY
 * 
 * Formal taxonomy and enforceable trust boundaries separating:
 * - OPERATIONAL: Active database state (MongoDB / MemoryStore)
 * - SIMULATION: Modeled fleet, requests, drivers, diurnal traffic
 * - REFERENCE_BASELINE: Historical benchmark (dummy_ambulance_data.xlsx)
 * - STATIC_INFRASTRUCTURE: Road network nodes, segments, KML road geometry, hospital/base locations
 * - EXTERNAL_LIVE: Authenticated third-party APIs (Google/Mappls when configured)
 * - TEST_FIXTURE: Isolated test fixtures
 * - GENERATED: Experimental evaluation results and paired statistics
 */

const DataClassification = Object.freeze({
  OPERATIONAL: 'OPERATIONAL',
  SIMULATION: 'SIMULATION',
  REFERENCE_BASELINE: 'REFERENCE_BASELINE',
  STATIC_INFRASTRUCTURE: 'STATIC_INFRASTRUCTURE',
  EXTERNAL_LIVE: 'EXTERNAL_LIVE',
  TEST_FIXTURE: 'TEST_FIXTURE',
  GENERATED: 'GENERATED',
});

class DataContaminationError extends Error {
  constructor(message, details = {}) {
    super(message);
    this.name = 'DataContaminationError';
    this.details = details;
  }
}

/**
 * Known synthetic ambulance tokens from the 108 reference baseline dataset.
 * These must NEVER be present in the operational dispatch fleet.
 */
const REFERENCE_BASELINE_AMBULANCE_IDS = Object.freeze(['AMB-001', 'AMB-002', 'AMB-003', 'AMB-004']);

/**
 * Master inventory of all data sources in the UyirKappan platform.
 */
const DATA_SOURCE_INVENTORY = Object.freeze([
  {
    id: 'DSRC-01',
    name: '108 Reference Baseline Workbook',
    source: 'dummy_ambulance_data.xlsx',
    location: 'root (dummy_ambulance_data.xlsx)',
    format: 'xlsx',
    classification: DataClassification.REFERENCE_BASELINE,
    isLive: false,
    isOperational: false,
    hasCoordinates: false,
    geographicScope: 'Tamil Nadu Historical Sample (94% Madurai, 2% Nilgiris, 2% Pudukottai, 2% Thiruvannamalai)',
    primaryDistrict: 'Madurai',
    rowCount: 50,
    allowedPipelines: ['EvaluationService', 'ResearchPortal', 'BaselineTests'],
    prohibitedPipelines: ['OperationalDispatch', 'FleetSeeding', 'DijkstraRouting', 'DriverApp'],
    description: 'Anonymized retrospective sample of 50 Tamil Nadu 108 cases used strictly for calibration and evaluation benchmarks.',
  },
  {
    id: 'DSRC-02',
    name: '108 Reference Evaluation CSV',
    source: 'tamil_nadu_108_evaluation.csv',
    location: 'Datasets/Datasets/tamil_nadu_108_evaluation.csv',
    format: 'csv',
    classification: DataClassification.REFERENCE_BASELINE,
    isLive: false,
    isOperational: false,
    hasCoordinates: false,
    geographicScope: 'Tamil Nadu Historical Sample (94% Madurai)',
    primaryDistrict: 'Madurai',
    rowCount: 50,
    allowedPipelines: ['EvaluationService', 'ResearchPortal'],
    prohibitedPipelines: ['OperationalDispatch', 'FleetSeeding'],
    description: 'Anonymized analytical subset derived from dummy_ambulance_data.xlsx for fast non-binary evaluation loading.',
  },
  {
    id: 'DSRC-03',
    name: 'Chennai Simulation Ambulance Fleet',
    source: 'ambulance_fleet.csv',
    location: 'Datasets/Datasets/ambulance_fleet.csv',
    format: 'csv',
    classification: DataClassification.SIMULATION,
    isLive: false,
    isOperational: true, // Seeds operational simulation fleet
    hasCoordinates: true,
    geographicScope: 'Chennai Metropolitan Area (40 Bases, 131 Ambulances)',
    primaryDistrict: 'Chennai',
    rowCount: 131,
    allowedPipelines: ['OperationalStoreSeed', 'DispatchEngine', 'DriverPortal'],
    prohibitedPipelines: ['ClinicalTrialEvaluation'],
    description: 'Simulated Chennai ambulance fleet stationed at 40 strategic bases with realistic equipment capabilities and baseline locations.',
  },
  {
    id: 'DSRC-04',
    name: 'Healthcare Dispatch Centers & Bases',
    source: 'chennai_healthcare_dispatch_dataset.csv',
    location: 'Datasets/Datasets/chennai_healthcare_dispatch_dataset.csv',
    format: 'csv',
    classification: DataClassification.STATIC_INFRASTRUCTURE,
    isLive: false,
    isOperational: true,
    hasCoordinates: true,
    geographicScope: 'Chennai Metropolitan Area (30 Hospitals, 40 Ambulance Bases)',
    primaryDistrict: 'Chennai',
    rowCount: 70,
    allowedPipelines: ['OperationalStoreSeed', 'HospitalDashboard', 'DispatchEngine'],
    prohibitedPipelines: [],
    description: 'Static geographic and facility infrastructure for Chennai hospitals and ambulance bases.',
  },
  {
    id: 'DSRC-05',
    name: 'Hospital Capacity & Critical Care Beds',
    source: 'hospital_capacity.csv',
    location: 'Datasets/Datasets/hospital_capacity.csv',
    format: 'csv',
    classification: DataClassification.STATIC_INFRASTRUCTURE,
    isLive: false,
    isOperational: true,
    hasCoordinates: false,
    geographicScope: 'Chennai Hospitals',
    primaryDistrict: 'Chennai',
    rowCount: 30,
    allowedPipelines: ['OperationalStoreSeed', 'HospitalService', 'DispatchMatcher'],
    prohibitedPipelines: [],
    description: 'Baseline critical care bed, ICU, and ventilator capacity for 30 Chennai emergency hospitals.',
  },
  {
    id: 'DSRC-06',
    name: 'Road Network Nodes',
    source: 'road_network_nodes.csv',
    location: 'Datasets/Datasets/road_network_nodes.csv',
    format: 'csv',
    classification: DataClassification.STATIC_INFRASTRUCTURE,
    isLive: false,
    isOperational: true,
    hasCoordinates: true,
    geographicScope: 'Chennai Urban Corridors',
    primaryDistrict: 'Chennai',
    rowCount: 70,
    allowedPipelines: ['DijkstraRouting', 'NetworkVisualization', 'MapRender'],
    prohibitedPipelines: [],
    description: 'Topological intersection and facility nodes forming the Chennai routing graph.',
  },
  {
    id: 'DSRC-07',
    name: 'Road Network Segments',
    source: 'road_network_segments.csv',
    location: 'Datasets/Datasets/road_network_segments.csv',
    format: 'csv',
    classification: DataClassification.STATIC_INFRASTRUCTURE,
    isLive: false,
    isOperational: true,
    hasCoordinates: false,
    geographicScope: 'Chennai Urban Corridors',
    primaryDistrict: 'Chennai',
    rowCount: 182,
    allowedPipelines: ['DijkstraRouting', 'NetworkVisualization'],
    prohibitedPipelines: [],
    description: 'Topological edges with physical distances and default speed limits between Chennai road network nodes.',
  },
  {
    id: 'DSRC-08',
    name: 'Diurnal Traffic Conditions',
    source: 'traffic_conditions.csv',
    location: 'Datasets/Datasets/traffic_conditions.csv',
    format: 'csv',
    classification: DataClassification.SIMULATION,
    isLive: false,
    isOperational: true, // Used by SimulationTrafficProvider
    hasCoordinates: false,
    geographicScope: 'Chennai Diurnal Hourly Congestion Curve',
    primaryDistrict: 'Chennai',
    rowCount: 48,
    allowedPipelines: ['SimulationTrafficProvider', 'DijkstraRouting', 'DispatchEngine'],
    prohibitedPipelines: [],
    description: 'Hourly empirical traffic multipliers (NORMAL=1.0, MODERATE=1.35, HEAVY=2.1) representing Chennai weekday/weekend traffic.',
  },
  {
    id: 'DSRC-09',
    name: 'Emergency Scenario Requests',
    source: 'emergency_requests.csv',
    location: 'Datasets/Datasets/emergency_requests.csv',
    format: 'csv',
    classification: DataClassification.SIMULATION,
    isLive: false,
    isOperational: false, // Used for offline experiments and stress testing
    hasCoordinates: true,
    geographicScope: 'Chennai Incidents',
    primaryDistrict: 'Chennai',
    rowCount: 3000,
    allowedPipelines: ['ExperimentEngine', 'ScenarioReplay', 'ResearchPortal'],
    prohibitedPipelines: ['LiveBystanderDispatch'],
    description: '3,000 synthetic emergency requests across Chennai sectors for large-scale algorithmic evaluation.',
  },
  {
    id: 'DSRC-10',
    name: 'Historical Dispatch Assignments',
    source: 'dispatch_assignments.csv',
    location: 'Datasets/Datasets/dispatch_assignments.csv',
    format: 'csv',
    classification: DataClassification.SIMULATION,
    isLive: false,
    isOperational: false,
    hasCoordinates: false,
    geographicScope: 'Chennai Simulations',
    primaryDistrict: 'Chennai',
    rowCount: 3765,
    allowedPipelines: ['ExperimentEngine', 'EvaluationService'],
    prohibitedPipelines: ['LiveDriverDispatch'],
    description: 'Pre-computed scenario dispatch assignment logs for benchmark consistency checks.',
  },
  {
    id: 'DSRC-11',
    name: 'Ambulance GPS Trajectories',
    source: 'ambulance_gps_trajectories.csv',
    location: 'Datasets/Datasets/ambulance_gps_trajectories.csv',
    format: 'csv',
    classification: DataClassification.SIMULATION,
    isLive: false,
    isOperational: false,
    hasCoordinates: true,
    geographicScope: 'Chennai Navigation Corridors',
    primaryDistrict: 'Chennai',
    rowCount: 10372,
    allowedPipelines: ['TrajectoryReplay', 'TelemetryVisualizer'],
    prohibitedPipelines: ['LiveDriverTelemetry'],
    description: 'Simulated time-series GPS coordinate breadcrumbs for replay demonstrations.',
  },
  {
    id: 'DSRC-12',
    name: 'GIS Road Centerline KML',
    source: 'chennai_road_centerline.kml / 1ef735dc-2397-4dc3-88e8-d98ea0b8339b.kml',
    location: 'root & Datasets/Spatial/chennai_road_centerline.kml',
    format: 'kml',
    classification: DataClassification.STATIC_INFRASTRUCTURE,
    isLive: false,
    isOperational: false,
    hasCoordinates: true,
    geographicScope: 'Chennai GIS Road Vector Centerlines',
    primaryDistrict: 'Chennai',
    rowCount: 60382,
    allowedPipelines: ['RoadGeometryService', 'MapRendering', 'SpatialSnapping', 'KmlAugmentedRouting'],
    prohibitedPipelines: ['LiveTrafficStream', 'RealtimeFleetTracking'],
    description: 'High-resolution GIS spatial road polyline vectors (60,382 LineStrings, 741,740 coordinates) used for map overlays, road geometry boundaries, and sub-millisecond GPS spatial snapping.',
  },
  {
    id: 'DSRC-13',
    name: 'Active Runtime DataStore (MongoDB / MemoryStore)',
    source: 'process.env.DATA_STORE_MODE (mongodb | memory)',
    location: 'mongodb://localhost:27017/uyirkappan OR in-memory JavaScript Heap',
    format: 'database',
    classification: DataClassification.OPERATIONAL,
    isLive: true,
    isOperational: true,
    hasCoordinates: true,
    geographicScope: 'Active Application Runtime',
    primaryDistrict: 'Chennai',
    rowCount: null,
    allowedPipelines: ['EmergencyLifecycle', 'IntelligentMatcher', 'DriverApp', 'HospitalDashboard', 'BystanderApp'],
    prohibitedPipelines: [],
    description: 'The single authoritative source of truth for active emergencies, driver assignments, and fleet statuses.',
  },
]);

/**
 * Guard: Enforces that an ambulance record entering the operational fleet
 * originates from the valid simulation fleet or live vehicle provider, and is NEVER
 * contaminated with 108 reference baseline tokens.
 */
function assertOperationalAmbulanceBoundary(ambulance) {
  if (!ambulance) {
    throw new DataContaminationError('Ambulance record is null or undefined');
  }

  const ambId = String(ambulance.id || ambulance.ambulanceId || '').trim();

  // Reject reference baseline tokens
  if (REFERENCE_BASELINE_AMBULANCE_IDS.includes(ambId)) {
    throw new DataContaminationError(
      `CONTAMINATION REJECTED: Reference baseline token '${ambId}' cannot enter operational ambulance fleet. Reference data is restricted to evaluation pipelines.`,
      { rejectedId: ambId, classification: DataClassification.REFERENCE_BASELINE }
    );
  }

  // Reject non-Chennai coordinates for operational fleet
  if (ambulance.currentLocation) {
    const { latitude, longitude } = ambulance.currentLocation;
    if (typeof latitude === 'number' && typeof longitude === 'number') {
      const inChennaiBounds = latitude >= 12.5 && latitude <= 13.5 && longitude >= 79.5 && longitude <= 80.5;
      if (!inChennaiBounds) {
        throw new DataContaminationError(
          `GEOGRAPHIC INTEGRITY REJECTED: Ambulance '${ambId}' coordinates (${latitude}, ${longitude}) fall outside Chennai operational boundary.`,
          { rejectedId: ambId, coordinates: ambulance.currentLocation }
        );
      }
    }
  }

  return true;
}

/**
 * Guard: Ensures emergency requests entering the dispatch pipeline
 * are live operational or valid scenario requests, and not 108 reference baseline cases.
 */
function assertOperationalEmergencyBoundary(emergency) {
  if (!emergency) {
    throw new DataContaminationError('Emergency record is null or undefined');
  }

  const reqId = String(emergency.requestId || emergency.id || '').trim();

  // Reject 13-digit Madurai 108 case IDs (e.g. 2025110104332)
  if (/^202511\d{7}$/.test(reqId)) {
    throw new DataContaminationError(
      `CONTAMINATION REJECTED: Historical 108 case ID '${reqId}' cannot enter operational dispatch pipeline.`,
      { rejectedId: reqId, classification: DataClassification.REFERENCE_BASELINE }
    );
  }

  return true;
}

/**
 * Audits store state to verify complete separation of operational and reference data.
 */
async function auditOperationalStatePurity(store) {
  if (!store) return { pure: true, errors: [] };
  const errors = [];

  const ambs = await store.getAmbulances();
  for (const a of ambs) {
    const id = a.id || a.ambulanceId;
    if (REFERENCE_BASELINE_AMBULANCE_IDS.includes(id)) {
      errors.push(`Operational fleet contains reference baseline token ${id}`);
    }
  }

  return {
    pure: errors.length === 0,
    fleetCount: ambs.length,
    errors,
  };
}

module.exports = {
  DataClassification,
  DataContaminationError,
  REFERENCE_BASELINE_AMBULANCE_IDS,
  DATA_SOURCE_INVENTORY,
  assertOperationalAmbulanceBoundary,
  assertOperationalEmergencyBoundary,
  auditOperationalStatePurity,
};
