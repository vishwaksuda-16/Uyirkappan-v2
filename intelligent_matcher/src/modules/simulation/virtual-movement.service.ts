import { GraphService } from "../routing/graph.service.js";
import { Route } from "../routing/route.types.js";
import { Location } from "../dispatch/dispatch.types.js";
import { LocationUpdate } from "../tracking/tracking.types.js";
import { TrackingService } from "../tracking/tracking.service.js";
import {
  VirtualMovementConfig
} from "./simulation.types.js";

export interface VirtualMovementCallbacks {
  onLocationUpdate?: (
    locationUpdate: LocationUpdate,
    destination: Location
  ) => Promise<void> | void;
}

export class VirtualMovementService {
  constructor(
    private readonly graphService: GraphService,
    private readonly trackingService: TrackingService,
    private readonly config: VirtualMovementConfig = {
      updateIntervalMs: 1000,
      acceleratedTime: false,
      speedMultiplier: 1
    }
  ) {}

  async moveAlongRoute(
    ambulanceId: string,
    requestId: string,
    route: Route,
    destination?: Location,
    callbacks?: VirtualMovementCallbacks
  ): Promise<LocationUpdate[]> {
    const updates: LocationUpdate[] = [];

    /*
     * If destination is not explicitly provided,
     * use the final node of the route.
     */
    const finalNodeId =
      route.nodeIds[route.nodeIds.length - 1];

    const finalNode =
      this.graphService.getNode(finalNodeId);

    if (!finalNode) {
      throw new Error(
        `Route destination node ${finalNodeId} not found`
      );
    }

    const movementDestination: Location =
      destination ?? {
        latitude: finalNode.latitude,
        longitude: finalNode.longitude
      };

    for (
      let i = 0;
      i < route.nodeIds.length;
      i++
    ) {
      const nodeId = route.nodeIds[i];

      const node =
        this.graphService.getNode(nodeId);

      if (!node) {
        throw new Error(
          `Route node ${nodeId} not found`
        );
      }

      const previousNodeId =
        i > 0
          ? route.nodeIds[i - 1]
          : undefined;

      let speed = 0;
      let heading = 0;

      if (previousNodeId) {
        const previousNode =
          this.graphService.getNode(
            previousNodeId
          );

        if (previousNode) {
          speed = this.calculateSpeed(
            previousNode.latitude,
            previousNode.longitude,
            node.latitude,
            node.longitude,
            route.travelTimeMinutes
          );

          heading = this.calculateHeading(
            previousNode.latitude,
            previousNode.longitude,
            node.latitude,
            node.longitude
          );
        }
      }

      const locationUpdate: LocationUpdate = {
        ambulanceId,
        requestId,
        latitude: node.latitude,
        longitude: node.longitude,
        speed,
        heading,
        timestamp: new Date()
      };

      /*
       * Store the location in the tracking service.
       */
      this.trackingService.updateLocation(
        locationUpdate
      );

      /*
       * Notify the caller so the caller can execute
       * the complete tracking + ETA + Socket.IO pipeline.
       */
      if (callbacks?.onLocationUpdate) {
        await callbacks.onLocationUpdate(
          locationUpdate,
          movementDestination
        );
      }

      updates.push(locationUpdate);

      /*
       * Wait before moving to the next point.
       * The first location is emitted immediately.
       */
      if (i < route.nodeIds.length - 1) {
        await this.delay(
          this.getUpdateInterval()
        );
      }
    }

    return updates;
  }

  private getUpdateInterval(): number {
    if (this.config.acceleratedTime) {
      return Math.max(
        100,
        this.config.updateIntervalMs /
          this.config.speedMultiplier
      );
    }

    return this.config.updateIntervalMs;
  }

  private delay(
    milliseconds: number
  ): Promise<void> {
    return new Promise(
      (resolve) =>
        setTimeout(resolve, milliseconds)
    );
  }

  private calculateSpeed(
    fromLatitude: number,
    fromLongitude: number,
    toLatitude: number,
    toLongitude: number,
    totalTravelTimeMinutes: number
  ): number {
    const distanceKm =
      this.calculateDistance(
        fromLatitude,
        fromLongitude,
        toLatitude,
        toLongitude
      );

    if (totalTravelTimeMinutes <= 0) {
      return 0;
    }

    const hours =
      totalTravelTimeMinutes / 60;

    return distanceKm / hours;
  }

  private calculateHeading(
    fromLatitude: number,
    fromLongitude: number,
    toLatitude: number,
    toLongitude: number
  ): number {
    const lat1 =
      this.toRadians(fromLatitude);

    const lat2 =
      this.toRadians(toLatitude);

    const deltaLongitude =
      this.toRadians(
        toLongitude - fromLongitude
      );

    const y =
      Math.sin(deltaLongitude) *
      Math.cos(lat2);

    const x =
      Math.cos(lat1) *
        Math.sin(lat2) -
      Math.sin(lat1) *
        Math.cos(lat2) *
        Math.cos(deltaLongitude);

    const radians =
      Math.atan2(y, x);

    const degrees =
      (radians * 180) / Math.PI;

    return (degrees + 360) % 360;
  }

  private calculateDistance(
    latitude1: number,
    longitude1: number,
    latitude2: number,
    longitude2: number
  ): number {
    const earthRadiusKm = 6371;

    const lat1 =
      this.toRadians(latitude1);

    const lat2 =
      this.toRadians(latitude2);

    const deltaLat =
      this.toRadians(
        latitude2 - latitude1
      );

    const deltaLon =
      this.toRadians(
        longitude2 - longitude1
      );

    const a =
      Math.sin(deltaLat / 2) ** 2 +
      Math.cos(lat1) *
        Math.cos(lat2) *
        Math.sin(deltaLon / 2) ** 2;

    const c =
      2 *
      Math.atan2(
        Math.sqrt(a),
        Math.sqrt(1 - a)
      );

    return earthRadiusKm * c;
  }

  private toRadians(
    degrees: number
  ): number {
    return degrees * (Math.PI / 180);
  }
}