import { GraphService } from "./graph.service.js";
import { Location } from "../dispatch/dispatch.types.js";
import { RouteNode } from "./route.types.js";

export class NearestNodeService {
  constructor(private readonly graph: GraphService) {}

  findNearestNode(location: Location): RouteNode {
    let nearestNode: RouteNode | null = null;
    let shortestDistance = Infinity;

    for (const node of this.graph.getGraph().nodes.values()) {
      const distance = this.calculateDistance(
        location,
        {
          latitude: node.latitude,
          longitude: node.longitude
        }
      );

      if (distance < shortestDistance) {
        shortestDistance = distance;
        nearestNode = node;
      }
    }

    if (!nearestNode) {
      throw new Error("Road graph contains no nodes");
    }

    return nearestNode;
  }

  private calculateDistance(
    location1: Location,
    location2: Location
  ): number {
    const earthRadiusKm = 6371;

    const lat1 = this.toRadians(location1.latitude);
    const lat2 = this.toRadians(location2.latitude);

    const deltaLat = this.toRadians(
      location2.latitude - location1.latitude
    );

    const deltaLon = this.toRadians(
      location2.longitude - location1.longitude
    );

    const a =
      Math.sin(deltaLat / 2) ** 2 +
      Math.cos(lat1) *
        Math.cos(lat2) *
        Math.sin(deltaLon / 2) ** 2;

    const c =
      2 * Math.atan2(
        Math.sqrt(a),
        Math.sqrt(1 - a)
      );

    return earthRadiusKm * c;
  }

  private toRadians(degrees: number): number {
    return degrees * (Math.PI / 180);
  }
}