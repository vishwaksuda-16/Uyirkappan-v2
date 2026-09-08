import { Location } from "../dispatch/dispatch.types.js";
import { ETAService } from "../eta/eta.service.js";
import { Route } from "../routing/route.types.js";
import {
  AmbulanceTrackingStatus,
  LocationUpdate,
  TrackingState
} from "./tracking.types.js";
import { TrackingService } from "./tracking.service.js";

export interface EmergencyTrackingUpdate {
  status: AmbulanceTrackingStatus;
  location: LocationUpdate;
  destination: Location;
  estimatedMinutes: number;
  route: Route;
  trackingState: TrackingState;
}

export class EmergencyTrackingService {
  constructor(
    private readonly trackingService: TrackingService,
    private readonly etaService: ETAService
  ) {}

  acceptAssignment(
    requestId: string
  ): TrackingState {
    return this.trackingService.updateStatus(
      requestId,
      "ACCEPTED"
    );
  }

  startJourney(
    requestId: string
  ): TrackingState {
    return this.trackingService.updateStatus(
      requestId,
      "EN_ROUTE_TO_PATIENT"
    );
  }

  processLocationUpdate(
    locationUpdate: LocationUpdate,
    destination: Location
  ): EmergencyTrackingUpdate {
    const storedLocation =
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

    this.trackingService.updateETA(
      locationUpdate.requestId,
      eta.estimatedMinutes
    );

    let status:
      | AmbulanceTrackingStatus
      | undefined;

    if (eta.estimatedMinutes === 0) {
      status = "ARRIVED_AT_PATIENT";

      this.trackingService.updateStatus(
        locationUpdate.requestId,
        status
      );
    }

    const trackingState =
      this.trackingService.getTrackingState(
        locationUpdate.requestId
      );

    if (!trackingState) {
      throw new Error(
        `Tracking state for request ${locationUpdate.requestId} not found`
      );
    }

    return {
      status:
        status ??
        trackingState.status,

      location: storedLocation,

      destination,

      estimatedMinutes:
        eta.estimatedMinutes,

      route: eta.route,

      trackingState
    };
  }

  patientOnboarded(
    requestId: string
  ): TrackingState {
    return this.trackingService.updateStatus(
      requestId,
      "PATIENT_ONBOARD"
    );
  }

  startHospitalJourney(
    requestId: string
  ): TrackingState {
    return this.trackingService.updateStatus(
      requestId,
      "EN_ROUTE_TO_HOSPITAL"
    );
  }

  hospitalArrived(
    requestId: string
  ): TrackingState {
    return this.trackingService.updateStatus(
      requestId,
      "ARRIVED_AT_HOSPITAL"
    );
  }

  completeEmergency(
    requestId: string
  ): TrackingState {
    const state =
      this.trackingService.updateStatus(
        requestId,
        "COMPLETED"
      );

    state.estimatedMinutes = 0;

    return state;
  }
}