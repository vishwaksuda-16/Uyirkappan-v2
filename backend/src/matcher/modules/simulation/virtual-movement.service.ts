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

    const nodes = route.nodeIds.map((nodeId) => {
      const node = this.graphService.getNode(nodeId);
      if (!node) {
        throw new Error(`Route node ${nodeId} not found`);
      }
      return node;
    });

    let totalDistanceKm = 0;
    const segmentDistances: number[] = [];
    for (let i = 1; i < nodes.length; i++) {
      const distance = this.calculateDistance(
        nodes[i - 1].latitude,
        nodes[i - 1].longitude,
        nodes[i].latitude,
        nodes[i].longitude
      );
      segmentDistances.push(distance);
      totalDistanceKm += distance;
    }

    const routeDistanceKm = totalDistanceKm;
    const routeRoadDistanceKm =
      route.distanceKm > 0 ? route.distanceKm : totalDistanceKm;
    const simulationSpeed = this.config.acceleratedTime
      ? Math.max(0.1, this.config.speedMultiplier)
      : 1;

    const firstNode = nodes[0];
    await this.emitLocationUpdate(
      ambulanceId,
      requestId,
      firstNode.latitude,
      firstNode.longitude,
      0,
      0,
      movementDestination,
      callbacks,
      updates
    );

    for (let i = 1; i < nodes.length; i++) {
      const from = nodes[i - 1];
      const to = nodes[i];
      const segmentDistanceKm = segmentDistances[i - 1];
      const segmentTravelTimeMinutes =
        route.travelTimeMinutes *
        (routeDistanceKm > 0
          ? segmentDistanceKm / routeDistanceKm
          : 1 / (nodes.length - 1));
      const segmentDurationMs = segmentTravelTimeMinutes * 60_000;
      const wallDurationMs = segmentDurationMs / simulationSpeed;
      const segmentRoadDistanceKm =
        routeDistanceKm > 0
          ? routeRoadDistanceKm * (segmentDistanceKm / routeDistanceKm)
          : segmentDistanceKm;
      const speed =
        segmentDurationMs > 0
          ? segmentRoadDistanceKm / (segmentDurationMs / 3_600_000)
          : 0;
      const heading = this.calculateHeading(
        from.latitude,
        from.longitude,
        to.latitude,
        to.longitude
      );
      let elapsedMs = 0;

      while (elapsedMs < wallDurationMs) {
        const stepMs = Math.min(
          this.getUpdateInterval(),
          wallDurationMs - elapsedMs
        );
        await this.delay(stepMs);
        elapsedMs += stepMs;
        const progress =
          wallDurationMs > 0 ? elapsedMs / wallDurationMs : 1;

        await this.emitLocationUpdate(
          ambulanceId,
          requestId,
          from.latitude + (to.latitude - from.latitude) * progress,
          from.longitude + (to.longitude - from.longitude) * progress,
          speed,
          heading,
          movementDestination,
          callbacks,
          updates
        );
      }
    }

    return updates;
  }

  private async emitLocationUpdate(
    ambulanceId: string,
    requestId: string,
    latitude: number,
    longitude: number,
    speed: number,
    heading: number,
    destination: Location,
    callbacks: VirtualMovementCallbacks | undefined,
    updates: LocationUpdate[]
  ): Promise<void> {
    const locationUpdate: LocationUpdate = {
      ambulanceId,
      requestId,
      latitude,
      longitude,
      speed,
      heading,
      timestamp: new Date()
    };

    this.trackingService.updateLocation(locationUpdate);
    if (callbacks?.onLocationUpdate) {
      await callbacks.onLocationUpdate(locationUpdate, destination);
    }
    updates.push(locationUpdate);
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