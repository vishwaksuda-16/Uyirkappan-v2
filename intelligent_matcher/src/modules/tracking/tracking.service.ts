import {
  AmbulanceTrackingStatus,
  LocationUpdate,
  TrackingState
} from "./tracking.types.js";

export class TrackingService {
  private locationHistory = new Map<
    string,
    LocationUpdate[]
  >();

  private trackingStates = new Map<
    string,
    TrackingState
  >();

  updateLocation(
    locationUpdate: LocationUpdate
  ): LocationUpdate {
    const history =
      this.locationHistory.get(
        locationUpdate.requestId
      ) ?? [];

    history.push(locationUpdate);

    this.locationHistory.set(
      locationUpdate.requestId,
      history
    );

    const existingState =
      this.trackingStates.get(
        locationUpdate.requestId
      );

    if (existingState) {
      existingState.latestLocation =
        locationUpdate;

      existingState.updatedAt =
        new Date();
    } else {
      this.trackingStates.set(
        locationUpdate.requestId,
        {
          requestId:
            locationUpdate.requestId,

          ambulanceId:
            locationUpdate.ambulanceId,

          status: "ASSIGNED",

          latestLocation:
            locationUpdate,

          updatedAt: new Date()
        }
      );
    }

    return locationUpdate;
  }

  updateStatus(
    requestId: string,
    status: AmbulanceTrackingStatus
  ): TrackingState {
    const state =
      this.trackingStates.get(
        requestId
      );

    if (!state) {
      throw new Error(
        `Tracking state for request ${requestId} not found`
      );
    }

    state.status = status;
    state.updatedAt = new Date();

    return state;
  }

  updateETA(
    requestId: string,
    estimatedMinutes: number
  ): TrackingState {
    const state =
      this.trackingStates.get(
        requestId
      );

    if (!state) {
      throw new Error(
        `Tracking state for request ${requestId} not found`
      );
    }

    state.estimatedMinutes =
      estimatedMinutes;

    state.updatedAt = new Date();

    return state;
  }

  getTrackingState(
    requestId: string
  ): TrackingState | undefined {
    return this.trackingStates.get(
      requestId
    );
  }

  getLatestLocation(
    requestId: string
  ): LocationUpdate | undefined {
    const history =
      this.locationHistory.get(
        requestId
      );

    if (
      !history ||
      history.length === 0
    ) {
      return undefined;
    }

    return history[
      history.length - 1
    ];
  }

  getLocationHistory(
    requestId: string
  ): LocationUpdate[] {
    return [
      ...(this.locationHistory.get(
        requestId
      ) ?? [])
    ];
  }

  clearTracking(
    requestId: string
  ): void {
    this.locationHistory.delete(
      requestId
    );

    this.trackingStates.delete(
      requestId
    );
  }
}