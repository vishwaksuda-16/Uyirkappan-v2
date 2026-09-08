import { Location } from "../dispatch/dispatch.types.js";
import { ETAService } from "../eta/eta.service.js";
import { ETAResult } from "../eta/eta.types.js";
import { LocationUpdate } from "./tracking.types.js";
import { TrackingService } from "./tracking.service.js";

export interface TrackingETAResult {
  location: LocationUpdate;
  eta: ETAResult;
}

export class TrackingETAService {
  constructor(
    private readonly trackingService: TrackingService,
    private readonly etaService: ETAService
  ) {}

  updateLocationAndCalculateETA(
    locationUpdate: LocationUpdate,
    destination: Location
  ): TrackingETAResult {
    const location =
      this.trackingService.updateLocation(
        locationUpdate
      );

    const eta =
      this.etaService.calculateETA(
        locationUpdate.requestId,
        locationUpdate.ambulanceId,
        {
          latitude:
            locationUpdate.latitude,
          longitude:
            locationUpdate.longitude
        },
        destination
      );

    return {
      location,
      eta
    };
  }

  getLatestTrackingETA(
    requestId: string,
    ambulanceId: string,
    destination: Location
  ): TrackingETAResult | undefined {
    const latestLocation =
      this.trackingService.getLatestLocation(
        requestId
      );

    if (!latestLocation) {
      return undefined;
    }

    if (
      latestLocation.ambulanceId !==
      ambulanceId
    ) {
      return undefined;
    }

    const eta =
      this.etaService.calculateETA(
        requestId,
        ambulanceId,
        {
          latitude:
            latestLocation.latitude,
          longitude:
            latestLocation.longitude
        },
        destination
      );

    return {
      location: latestLocation,
      eta
    };
  }
}