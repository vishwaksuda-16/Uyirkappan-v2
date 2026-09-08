import { GraphService } from "./graph.service.js";
import { Route } from "./route.types.js";
import { TrafficService } from "../traffic/traffic.service.js";

export class DijkstraService {
  constructor(
    private readonly graph: GraphService,
    private readonly traffic: TrafficService
  ) {}

  findShortestRoute(
    startNodeId: string,
    destinationNodeId: string
  ): Route {
    // Validate start node
    if (!this.graph.getNode(startNodeId)) {
      throw new Error(
        `Start node ${startNodeId} does not exist`
      );
    }

    // Validate destination node
    if (!this.graph.getNode(destinationNodeId)) {
      throw new Error(
        `Destination node ${destinationNodeId} does not exist`
      );
    }

    // Stores the shortest known travel time
    // from the start node to every other node
    const distances = new Map<string, number>();

    // Stores the previous node used to reach
    // each node through the shortest path
    const previousNodes = new Map<string, string | null>();

    // Stores nodes that have already been processed
    const visited = new Set<string>();

    // Initialize all nodes
    for (const nodeId of this.graph.getGraph().nodes.keys()) {
      distances.set(nodeId, Infinity);
      previousNodes.set(nodeId, null);
    }

    // Distance from start node to itself is zero
    distances.set(startNodeId, 0);

    while (
      visited.size < this.graph.getGraph().nodes.size
    ) {
      // Find the unvisited node with the smallest
      // currently known travel time
      const currentNode =
        this.getUnvisitedNodeWithSmallestDistance(
          distances,
          visited
        );

      // No more reachable nodes
      if (!currentNode) {
        break;
      }

      // Destination reached
      if (currentNode === destinationNodeId) {
        break;
      }

      visited.add(currentNode);

      // Get roads connected to current node
      const neighbors =
        this.graph.getNeighbors(currentNode);

      for (const edge of neighbors) {
        // Ignore already processed nodes
        if (visited.has(edge.toNodeId)) {
          continue;
        }

        const currentDistance =
          distances.get(currentNode) ?? Infinity;

        // Get traffic-adjusted travel time
        const adjustedTravelTime =
          this.traffic.getAdjustedTravelTime(
            edge.travelTimeMinutes,
            edge.fromNodeId,
            edge.toNodeId
          );

        // Calculate new possible distance
        const newDistance =
          currentDistance + adjustedTravelTime;

        const knownDistance =
          distances.get(edge.toNodeId) ?? Infinity;

        // If this route is faster, update it
        if (newDistance < knownDistance) {
          distances.set(
            edge.toNodeId,
            newDistance
          );

          previousNodes.set(
            edge.toNodeId,
            currentNode
          );
        }
      }
    }

    // Get final shortest travel time
    const destinationDistance =
      distances.get(destinationNodeId) ?? Infinity;

    // No route available
    if (destinationDistance === Infinity) {
      throw new Error(
        `No route found from ${startNodeId} to ${destinationNodeId}`
      );
    }

    // Reconstruct route
    const nodeIds = this.reconstructPath(
      startNodeId,
      destinationNodeId,
      previousNodes
    );

    // Calculate physical distance
    const distanceKm =
      this.calculateRouteDistance(nodeIds);

    return {
      nodeIds,
      distanceKm,
      travelTimeMinutes: destinationDistance
    };
  }

  /**
   * Finds the unvisited node with the smallest
   * currently known travel time.
   */
  private getUnvisitedNodeWithSmallestDistance(
    distances: Map<string, number>,
    visited: Set<string>
  ): string | null {
    let smallestNode: string | null = null;
    let smallestDistance = Infinity;

    for (const [
      nodeId,
      distance
    ] of distances.entries()) {
      // Skip nodes already processed
      if (visited.has(nodeId)) {
        continue;
      }

      // Find smallest distance
      if (distance < smallestDistance) {
        smallestDistance = distance;
        smallestNode = nodeId;
      }
    }

    return smallestNode;
  }

  /**
   * Reconstructs the route by walking backwards
   * from destination to start.
   */
  private reconstructPath(
    startNodeId: string,
    destinationNodeId: string,
    previousNodes: Map<string, string | null>
  ): string[] {
    const path: string[] = [];

    let currentNode: string | null =
      destinationNodeId;

    while (currentNode !== null) {
      path.unshift(currentNode);

      // We reached the starting node
      if (currentNode === startNodeId) {
        break;
      }

      currentNode =
        previousNodes.get(currentNode) ?? null;
    }

    return path;
  }

  /**
   * Calculates the physical distance of the
   * selected route.
   */
  private calculateRouteDistance(
    nodeIds: string[]
  ): number {
    let totalDistance = 0;

    for (
      let i = 0;
      i < nodeIds.length - 1;
      i++
    ) {
      const fromNode = nodeIds[i];
      const toNode = nodeIds[i + 1];

      const edge = this.graph
        .getNeighbors(fromNode)
        .find(
          (candidate) =>
            candidate.toNodeId === toNode
        );

      if (!edge) {
        throw new Error(
          `Road edge ${fromNode} → ${toNode} does not exist`
        );
      }

      totalDistance += edge.distanceKm;
    }

    return totalDistance;
  }
}