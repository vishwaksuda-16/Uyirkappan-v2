import { createVirtualRoadNetwork } from "./virtual-road-network.js";
import { NearestNodeService } from "./nearest-node.service.js";

const graph = createVirtualRoadNetwork();

const nearestNodeService = new NearestNodeService(graph);

const testLocations = [
  {
    name: "Location near N1",
    latitude: 13.0827,
    longitude: 80.2707
  },
  {
    name: "Location near N4",
    latitude: 13.0781,
    longitude: 80.2681
  },
  {
    name: "Location near N5",
    latitude: 13.0801,
    longitude: 80.2781
  }
];

console.log("=== Nearest Node Test ===");

for (const location of testLocations) {
  const nearestNode =
    nearestNodeService.findNearestNode(location);

  console.log(
    `${location.name} → ${nearestNode.nodeId}`
  );
}

console.log("=== Test completed ===");