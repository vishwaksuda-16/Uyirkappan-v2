import {
  Ambulance,
  EmergencyRequest
} from "./dispatch.types.js";

import { CandidateFilterService } from "./candidate-filter.service.js";

import {
  ScoringService
} from "./scoring.service.js";

import { DispatchEngineService } from "./dispatch-engine.service.js";

import { createVirtualRoadNetwork } from "../routing/virtual-road-network.js";

import { DijkstraService } from "../routing/dijkstra.service.js";

import { NearestNodeService } from "../routing/nearest-node.service.js";

import { TrafficService } from "../traffic/traffic.service.js";

import { ETAService } from "../eta/eta.service.js";


/*
 * Create routing components
 */

const graph =
  createVirtualRoadNetwork();

const traffic =
  new TrafficService();

const nearestNodeService =
  new NearestNodeService(graph);

const dijkstraService =
  new DijkstraService(
    graph,
    traffic
  );

const etaService =
  new ETAService(
    nearestNodeService,
    dijkstraService
  );


/*
 * Create dispatch components
 */

const candidateFilterService =
  new CandidateFilterService();

const scoringService =
  new ScoringService();

const dispatchEngine =
  new DispatchEngineService(
    candidateFilterService,
    etaService,
    scoringService
  );


/*
 * Emergency request
 */

const emergency: EmergencyRequest = {
  requestId: "REQ001",

  emergencyType:
    "CARDIAC_EMERGENCY",

  victimCount: 1,

  pickupLocation: {
    latitude: 13.0800,
    longitude: 80.2780
  },

  createdAt: new Date(),

  priority: "CRITICAL"
};


/*
 * Virtual ambulance fleet
 */

const ambulances: Ambulance[] = [
  {
    ambulanceId: "A1",

    currentLocation: {
      latitude: 13.0827,
      longitude: 80.2707
    },

    availabilityStatus:
      "AVAILABLE",

    driverId: "D1",

    capabilities: [
      "BASIC",
      "OXYGEN"
    ]
  },

  {
    ambulanceId: "A2",

    currentLocation: {
      latitude: 13.0850,
      longitude: 80.2750
    },

    availabilityStatus:
      "AVAILABLE",

    driverId: "D2",

    capabilities: [
      "ICU"
    ]
  },

  {
    ambulanceId: "A3",

    currentLocation: {
      latitude: 13.0780,
      longitude: 80.2680
    },

    availabilityStatus:
      "AVAILABLE",

    driverId: "D3",

    capabilities: [
      "BASIC"
    ]
  },

  {
    ambulanceId: "A4",

    currentLocation: {
      latitude: 13.0880,
      longitude: 80.2800
    },

    availabilityStatus:
      "BUSY",

    driverId: "D4",

    capabilities: [
      "ICU"
    ]
  }
];


/*
 * Run dispatch
 */

const decision =
  dispatchEngine.dispatch(
    emergency,
    ambulances,
    5
  );


/*
 * Display result
 */

console.log(
  "=== INTELLIGENT DISPATCH TEST ==="
);

console.log(
  "\nSelected ambulance:",
  decision.selectedAmbulanceId
);

console.log(
  "Estimated travel time:",
  decision.estimatedTravelTime,
  "minutes"
);

console.log(
  "Distance:",
  decision.distance,
  "km"
);

console.log(
  "Route:",
  decision.route.nodeIds
);

console.log(
  "Score:",
  decision.score
);

console.log(
  "Generated at:",
  decision.generatedAt
);

console.log(
  "\n=== Test completed ==="
);