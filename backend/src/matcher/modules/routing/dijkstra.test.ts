import { createVirtualRoadNetwork } from "./virtual-road-network.js";
import { DijkstraService } from "./dijkstra.service.js";
import { TrafficService } from "../traffic/traffic.service.js";

const graph = createVirtualRoadNetwork();
const traffic = new TrafficService();

const dijkstra = new DijkstraService(graph, traffic);

const route = dijkstra.findShortestRoute("N1", "N5");

console.log("Shortest route:");
console.log(route);