import { createVirtualRoadNetwork } from "../routing/virtual-road-network.js";
import { TrafficService } from "../traffic/traffic.service.js";
import { DijkstraService } from "../routing/dijkstra.service.js";
import { NearestNodeService } from "../routing/nearest-node.service.js";
import { ETAService } from "../eta/eta.service.js";
import { TrackingService } from "./tracking.service.js";
import { TrackingETAService } from "./tracking-eta.service.js";

console.log("=== TRACKING + DYNAMIC ETA TEST ===");

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

const trackingETAService =
  new TrackingETAService(
    trackingService,
    etaService
  );

const requestId =
  "REQ-TRACK-ETA-001";

const ambulanceId =
  "A1";

const destination = {
  latitude: 13.08,
  longitude: 80.278
};

console.log("\n1. Ambulance at N1");

const result1 =
  trackingETAService
    .updateLocationAndCalculateETA(
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

console.log("Location:");
console.log(result1.location);

console.log("ETA:");
console.log(result1.eta);

console.log("\n2. Ambulance moves to N4");

const result2 =
  trackingETAService
    .updateLocationAndCalculateETA(
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

console.log("Location:");
console.log(result2.location);

console.log("ETA:");
console.log(result2.eta);

console.log("\n3. Ambulance reaches N5");

const result3 =
  trackingETAService
    .updateLocationAndCalculateETA(
      {
        ambulanceId,
        requestId,
        latitude: 13.08,
        longitude: 80.278,
        speed: 13.2,
        heading: 78.4,
        timestamp: new Date()
      },
      destination
    );

console.log("Location:");
console.log(result3.location);

console.log("ETA:");
console.log(result3.eta);

console.log("\n4. Complete tracking history");

const history =
  trackingService.getLocationHistory(
    requestId
  );

console.log(history);

console.log(
  "\nTotal location updates:",
  history.length
);

console.log("\n=== Test completed ===");