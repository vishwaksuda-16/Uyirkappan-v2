import { createVirtualRoadNetwork } from "../routing/virtual-road-network.js";
import { TrafficService } from "../traffic/traffic.service.js";
import { DijkstraService } from "../routing/dijkstra.service.js";
import { NearestNodeService } from "../routing/nearest-node.service.js";
import { ETAService } from "../eta/eta.service.js";
import { TrackingService } from "./tracking.service.js";
import { EmergencyTrackingService } from "./emergency-tracking.service.js";

console.log(
  "=== PATIENT TO HOSPITAL JOURNEY TEST ==="
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
  "REQ-HOSPITAL-001";

const ambulanceId =
  "A1";

/*
 * Patient location = N5
 */
const patientLocation = {
  latitude: 13.08,
  longitude: 80.278
};

/*
 * Hospital location = N3
 */
const hospitalLocation = {
  latitude: 13.088,
  longitude: 80.28
};

/*
 * Create initial tracking state
 * at the patient location.
 */
trackingService.updateLocation({
  ambulanceId,
  requestId,
  latitude: patientLocation.latitude,
  longitude: patientLocation.longitude,
  speed: 0,
  heading: 0,
  timestamp: new Date()
});

console.log("\n1. Ambulance arrived at patient");

const patientArrival =
  emergencyTrackingService
    .processLocationUpdate(
      {
        ambulanceId,
        requestId,
        latitude: patientLocation.latitude,
        longitude: patientLocation.longitude,
        speed: 0,
        heading: 0,
        timestamp: new Date()
      },
      patientLocation
    );

console.log(
  "Status:",
  patientArrival.status
);

console.log(
  "ETA:",
  patientArrival.estimatedMinutes,
  "minutes"
);

/*
 * Patient is loaded into ambulance.
 */
console.log(
  "\n2. Patient onboarded"
);

const onboardState =
  emergencyTrackingService.patientOnboarded(
    requestId
  );

console.log(
  "Status:",
  onboardState.status
);

/*
 * Ambulance starts journey to hospital.
 */
console.log(
  "\n3. Ambulance starts hospital journey"
);

const hospitalJourneyState =
  emergencyTrackingService
    .startHospitalJourney(
      requestId
    );

console.log(
  "Status:",
  hospitalJourneyState.status
);

/*
 * Calculate hospital route.
 */
const hospitalETA =
  etaService.calculateETA(
    requestId,
    ambulanceId,
    patientLocation,
    hospitalLocation
  );

console.log(
  "\nHospital route:"
);

console.log(
  hospitalETA.route
);

console.log(
  "Hospital ETA:",
  hospitalETA.estimatedMinutes,
  "minutes"
);

/*
 * Simulate ambulance reaching hospital.
 */
console.log(
  "\n4. Ambulance reaches hospital"
);

const hospitalArrival =
  emergencyTrackingService
    .processLocationUpdate(
      {
        ambulanceId,
        requestId,
        latitude: hospitalLocation.latitude,
        longitude: hospitalLocation.longitude,
        speed: 0,
        heading: 0,
        timestamp: new Date()
      },
      hospitalLocation
    );

console.log(
  "Location processed:"
);

console.log(
  hospitalArrival.location
);

console.log(
  "ETA:",
  hospitalArrival.estimatedMinutes,
  "minutes"
);

/*
 * Mark hospital arrival.
 */
const arrivedHospital =
  emergencyTrackingService
    .hospitalArrived(
      requestId
    );

console.log(
  "Status:",
  arrivedHospital.status
);

/*
 * Complete emergency.
 */
console.log(
  "\n5. Complete emergency"
);

const completed =
  emergencyTrackingService
    .completeEmergency(
      requestId
    );

console.log(
  "Status:",
  completed.status
);

console.log(
  "ETA:",
  completed.estimatedMinutes,
  "minutes"
);

/*
 * Final state.
 */
console.log(
  "\n6. Final tracking state"
);

console.log(
  trackingService.getTrackingState(
    requestId
  )
);

console.log(
  "\n=== Test completed ==="
);