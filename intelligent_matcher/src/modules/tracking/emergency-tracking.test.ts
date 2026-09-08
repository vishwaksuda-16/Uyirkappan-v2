import { createVirtualRoadNetwork } from "../routing/virtual-road-network.js";
import { TrafficService } from "../traffic/traffic.service.js";
import { DijkstraService } from "../routing/dijkstra.service.js";
import { NearestNodeService } from "../routing/nearest-node.service.js";
import { ETAService } from "../eta/eta.service.js";
import { TrackingService } from "./tracking.service.js";
import { EmergencyTrackingService } from "./emergency-tracking.service.js";

console.log(
  "=== COMPLETE EMERGENCY TRACKING TEST ==="
);

const graph =
  createVirtualRoadNetwork();

const trafficService =
  new TrafficService();

const dijkstraService =
  new DijkstraService(
    graph,
    trafficService
  );

const nearestNodeService =
  new NearestNodeService(graph);

const etaService =
  new ETAService(
    nearestNodeService,
    dijkstraService
  );

const trackingService =
  new TrackingService();

const emergencyTrackingService =
  new EmergencyTrackingService(
    trackingService,
    etaService
  );

const requestId =
  "REQ-FULL-TRACK-001";

const ambulanceId =
  "A1";

const destination = {
  latitude: 13.08,
  longitude: 80.278
};

/*
 * Step 1:
 * Create initial tracking state.
 */
console.log(
  "\n1. Creating initial ambulance location..."
);

trackingService.updateLocation({
  ambulanceId,
  requestId,
  latitude: 13.0827,
  longitude: 80.2707,
  speed: 0,
  heading: 0,
  timestamp: new Date()
});

console.log(
  trackingService.getTrackingState(
    requestId
  )
);

/*
 * Step 2:
 * Driver accepts assignment.
 */
console.log(
  "\n2. Driver accepts assignment..."
);

const acceptedState =
  emergencyTrackingService.acceptAssignment(
    requestId
  );

console.log(
  "Status:",
  acceptedState.status
);

/*
 * Step 3:
 * Ambulance starts moving.
 */
console.log(
  "\n3. Ambulance starts journey..."
);

const enRouteState =
  emergencyTrackingService.startJourney(
    requestId
  );

console.log(
  "Status:",
  enRouteState.status
);

/*
 * Step 4:
 * Ambulance reaches N1.
 */
console.log(
  "\n4. Ambulance at N1..."
);

const update1 =
  emergencyTrackingService.processLocationUpdate(
    {
      ambulanceId,
      requestId,
      latitude: 13.0827,
      longitude: 80.2707,
      speed: 0,
      heading: 0,
      timestamp: new Date()
    },
    destination
  );

console.log(
  "Status:",
  update1.status
);

console.log(
  "ETA:",
  update1.estimatedMinutes,
  "minutes"
);

console.log(
  "Route:",
  update1.route.nodeIds
);

/*
 * Step 5:
 * Ambulance reaches N4.
 */
console.log(
  "\n5. Ambulance moves to N4..."
);

const update2 =
  emergencyTrackingService.processLocationUpdate(
    {
      ambulanceId,
      requestId,
      latitude: 13.078,
      longitude: 80.268,
      speed: 7.2,
      heading: 209.2,
      timestamp: new Date()
    },
    destination
  );

console.log(
  "Status:",
  update2.status
);

console.log(
  "ETA:",
  update2.estimatedMinutes,
  "minutes"
);

console.log(
  "Route:",
  update2.route.nodeIds
);

/*
 * Step 6:
 * Ambulance reaches N5 / patient.
 */
console.log(
  "\n6. Ambulance reaches patient..."
);

const update3 =
  emergencyTrackingService.processLocationUpdate(
    {
      ambulanceId,
      requestId,
      latitude: 13.08,
      longitude: 80.278,
      speed: 0,
      heading: 78.4,
      timestamp: new Date()
    },
    destination
  );

console.log(
  "Status:",
  update3.status
);

console.log(
  "ETA:",
  update3.estimatedMinutes,
  "minutes"
);

console.log(
  "Route:",
  update3.route.nodeIds
);

/*
 * Final tracking state.
 */
console.log(
  "\n7. Final tracking state..."
);

console.log(
  trackingService.getTrackingState(
    requestId
  )
);

/*
 * Location history.
 */
console.log(
  "\n8. Location history..."
);

const history =
  trackingService.getLocationHistory(
    requestId
  );

console.log(history);

console.log(
  "\nTotal location updates:",
  history.length
);

console.log(
  "\n=== Test completed ==="
);