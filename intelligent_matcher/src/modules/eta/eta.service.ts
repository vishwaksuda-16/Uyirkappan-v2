import { Location } from "../dispatch/dispatch.types.js";
import { NearestNodeService } from "../routing/nearest-node.service.js";
import { DijkstraService } from "../routing/dijkstra.service.js";
import { ETAResult } from "./eta.types.js";

export class ETAService {
  constructor(
    private readonly nearestNodeService: NearestNodeService,
    private readonly dijkstraService: DijkstraService
  ) {}

  calculateETA(
    requestId: string,
    ambulanceId: string,
    currentLocation: Location,
    destination: Location
  ): ETAResult {
    const ambulanceNode =
      this.nearestNodeService.findNearestNode(
        currentLocation
      );

    const destinationNode =
      this.nearestNodeService.findNearestNode(
        destination
      );

    const route =
      this.dijkstraService.findShortestRoute(
        ambulanceNode.nodeId,
        destinationNode.nodeId
      );

    return {
      requestId,
      ambulanceId,
      currentLocation,
      destination,
      estimatedMinutes:
        route.travelTimeMinutes,
      calculatedAt: new Date(),
      route
    };
  }
}