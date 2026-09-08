import { createVirtualRoadNetwork } from "./virtual-road-network.js";

const graph = createVirtualRoadNetwork();

console.log("Virtual road network created.");

console.log(
  "N1 neighbors:",
  graph.getNeighbors("N1")
);

console.log(
  "N4 neighbors:",
  graph.getNeighbors("N4")
);

console.log(
  "Total nodes:",
  graph.getGraph().nodes.size
);