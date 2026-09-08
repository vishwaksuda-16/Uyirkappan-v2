import { SocketEventsService } from "./socket-events.service.js";

import {
  EmergencyTrackingUpdate
} from "../modules/tracking/emergency-tracking.service.js";

import {
  TrackingState
} from "../modules/tracking/tracking.types.js";

import {
  ETAResult
} from "../modules/eta/eta.types.js";

export class TrackingEventsService {
  constructor(
    private readonly socketEventsService: SocketEventsService
  ) {}

  /*
   * ============================
   * LIVE TRACKING UPDATE
   * ============================
   */

  broadcastTrackingUpdate(
    update: EmergencyTrackingUpdate
  ): void {
    /*
     * 1. Ambulance location
     */
    this.socketEventsService.emitLocationUpdate(
      update.location
    );

    /*
     * 2. ETA update
     */
    const etaResult: ETAResult = {
      requestId:
        update.location.requestId,

      ambulanceId:
        update.location.ambulanceId,

      currentLocation: {
        latitude:
          update.location.latitude,

        longitude:
          update.location.longitude
      },

      destination:
        update.destination,

      estimatedMinutes:
        update.estimatedMinutes,

      calculatedAt:
        new Date(),

      route:
        update.route
    };

    this.socketEventsService.emitETAUpdate(
      etaResult
    );

    /*
     * 3. Route update
     */
    this.socketEventsService.emitRouteUpdate(
      etaResult
    );

    /*
     * 4. Tracking status
     */
    this.socketEventsService.emitStatusUpdate(
      update.trackingState
    );
  }

  /*
   * ============================
   * STATUS UPDATE
   * ============================
   */

  emitStatusUpdate(
    trackingState: TrackingState
  ): void {
    this.socketEventsService.emitStatusUpdate(
      trackingState
    );
  }

  /*
   * ============================
   * PATIENT ONBOARD
   * ============================
   */

  emitPatientOnboard(
    requestId: string,
    trackingState: TrackingState
  ): void {
    /*
     * SocketEventsService already receives
     * the complete tracking state, which
     * contains the requestId.
     */
    void requestId;

    this.socketEventsService.emitPatientOnboard(
      trackingState
    );
  }

  /*
   * ============================
   * HOSPITAL ARRIVAL
   * ============================
   */

  emitHospitalArrived(
    requestId: string,
    trackingState: TrackingState
  ): void {
    /*
     * requestId is already available
     * inside trackingState.
     */
    void requestId;

    this.socketEventsService.emitHospitalArrived(
      trackingState
    );
  }

  /*
   * ============================
   * REQUEST COMPLETED
   * ============================
   */

  emitRequestCompleted(
    requestId: string,
    trackingState: TrackingState
  ): void {
    /*
     * requestId is already available
     * inside trackingState.
     */
    void requestId;

    this.socketEventsService.emitRequestCompleted(
      trackingState
    );
  }
}