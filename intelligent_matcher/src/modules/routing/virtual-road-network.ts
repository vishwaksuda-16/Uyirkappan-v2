import { GraphService } from "./graph.service.js";

export function createVirtualRoadNetwork(): GraphService {
  const graph = new GraphService();

  // -------------------------
  // Nodes
  // -------------------------

  graph.addNode({
    nodeId: "N1",
    latitude: 13.0827,
    longitude: 80.2707
  });

  graph.addNode({
    nodeId: "N2",
    latitude: 13.0850,
    longitude: 80.2750
  });

  graph.addNode({
    nodeId: "N3",
    latitude: 13.0880,
    longitude: 80.2800
  });

  graph.addNode({
    nodeId: "N4",
    latitude: 13.0780,
    longitude: 80.2680
  });

  graph.addNode({
    nodeId: "N5",
    latitude: 13.0800,
    longitude: 80.2780
  });

  // -------------------------
  // Roads
  // -------------------------

  graph.addEdge({
    fromNodeId: "N1",
    toNodeId: "N2",
    distanceKm: 0.6,
    travelTimeMinutes: 5
  });

  graph.addEdge({
    fromNodeId: "N2",
    toNodeId: "N1",
    distanceKm: 0.6,
    travelTimeMinutes: 5
  });

  graph.addEdge({
    fromNodeId: "N2",
    toNodeId: "N3",
    distanceKm: 0.5,
    travelTimeMinutes: 4
  });

  graph.addEdge({
    fromNodeId: "N3",
    toNodeId: "N2",
    distanceKm: 0.5,
    travelTimeMinutes: 4
  });

  graph.addEdge({
    fromNodeId: "N1",
    toNodeId: "N4",
    distanceKm: 0.4,
    travelTimeMinutes: 3
  });

  graph.addEdge({
    fromNodeId: "N4",
    toNodeId: "N1",
    distanceKm: 0.4,
    travelTimeMinutes: 3
  });

  graph.addEdge({
    fromNodeId: "N4",
    toNodeId: "N5",
    distanceKm: 0.3,
    travelTimeMinutes: 2
  });

  graph.addEdge({
    fromNodeId: "N5",
    toNodeId: "N4",
    distanceKm: 0.3,
    travelTimeMinutes: 2
  });

  graph.addEdge({
    fromNodeId: "N3",
    toNodeId: "N5",
    distanceKm: 0.7,
    travelTimeMinutes: 6
  });

  graph.addEdge({
    fromNodeId: "N5",
    toNodeId: "N3",
    distanceKm: 0.7,
    travelTimeMinutes: 6
  });

  return graph;
}