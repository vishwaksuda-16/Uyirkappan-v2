import { createVirtualRoadNetwork } from "../routing/virtual-road-network.js";
import { GraphService } from "../routing/graph.service.js";
import { DijkstraService } from "../routing/dijkstra.service.js";
import { NearestNodeService } from "../routing/nearest-node.service.js";
import { TrafficService } from "../traffic/traffic.service.js";
import { ETAService } from "./eta.service.js";

const graph: GraphService = createVirtualRoadNetwork();

const traffic = new TrafficService();

const nearestNodeService =
  new NearestNodeService(graph);

const dijkstraService =
  new DijkstraService(graph, traffic);

const etaService =
  new ETAService(
    nearestNodeService,
    dijkstraService
  );

const result = etaService.calculateETA(
  "REQ001",
  "A1",
  {
    latitude: 13.0827,
    longitude: 80.2707
  },
  {
    latitude: 13.0800,
    longitude: 80.2780
  }
);

console.log("=== ETA Test ===");

console.log("Request ID:", result.requestId);
console.log("Ambulance ID:", result.ambulanceId);

console.log(
  "Current location:",
  result.currentLocation
);

console.log(
  "Destination:",
  result.destination
);

console.log(
  "Route:",
  result.route.nodeIds
);

console.log(
  "Distance:",
  result.route.distanceKm,
  "km"
);

console.log(
  "Estimated travel time:",
  result.estimatedMinutes,
  "minutes"
);

console.log(
  "Calculated at:",
  result.calculatedAt
);

console.log("=== Test completed ===");