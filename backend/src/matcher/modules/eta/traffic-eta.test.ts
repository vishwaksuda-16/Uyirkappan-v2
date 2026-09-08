import { createVirtualRoadNetwork } from "../routing/virtual-road-network.js";
import { TrafficService } from "../traffic/traffic.service.js";
import { DijkstraService } from "../routing/dijkstra.service.js";
import { NearestNodeService } from "../routing/nearest-node.service.js";
import { ETAService } from "./eta.service.js";

console.log("=== TRAFFIC-AWARE ETA TEST ===");

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

const requestId =
  "REQ-TRAFFIC-001";

const ambulanceId =
  "A1";

const ambulanceLocation = {
  latitude: 13.078,
  longitude: 80.268
};

const destination = {
  latitude: 13.08,
  longitude: 80.278
};

console.log("\n1. Normal traffic");

const normalETA =
  etaService.calculateETA(
    requestId,
    ambulanceId,
    ambulanceLocation,
    destination
  );

console.log(
  "Route:",
  normalETA.route.nodeIds
);

console.log(
  "ETA:",
  normalETA.estimatedMinutes,
  "minutes"
);

console.log(
  "Distance:",
  normalETA.route.distanceKm,
  "km"
);

console.log("\n2. Heavy traffic on N4 → N5");

trafficService.setTrafficState(
  "N4",
  "N5",
  "HEAVY"
);

const heavyTrafficETA =
  etaService.calculateETA(
    requestId,
    ambulanceId,
    ambulanceLocation,
    destination
  );

console.log(
  "Route:",
  heavyTrafficETA.route.nodeIds
);

console.log(
  "ETA:",
  heavyTrafficETA.estimatedMinutes,
  "minutes"
);

console.log(
  "Distance:",
  heavyTrafficETA.route.distanceKm,
  "km"
);

console.log("\n3. Block N4 → N5");

trafficService.setTrafficState(
  "N4",
  "N5",
  "BLOCKED"
);

const blockedRoadETA =
  etaService.calculateETA(
    requestId,
    ambulanceId,
    ambulanceLocation,
    destination
  );

console.log(
  "Route:",
  blockedRoadETA.route.nodeIds
);

console.log(
  "ETA:",
  blockedRoadETA.estimatedMinutes,
  "minutes"
);

console.log(
  "Distance:",
  blockedRoadETA.route.distanceKm,
  "km"
);

console.log(
  "\n=== Test completed ==="
);