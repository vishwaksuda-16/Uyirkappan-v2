import { Server } from "socket.io";

import {
  LocationUpdate,
  TrackingState
} from "../modules/tracking/tracking.types.js";

import { ETAResult } from "../modules/eta/eta.types.js";

export class SocketEventsService {
  constructor(
    private readonly io: Server
  ) {}

  private getEmergencyRoom(
    requestId: string
  ): string {
    return `emergency:${requestId}`;
  }

  emitLocationUpdate(
    location: LocationUpdate
  ): void {
    const room =
      this.getEmergencyRoom(
        location.requestId
      );

    this.io
      .to(room)
      .emit(
        "AMBULANCE_LOCATION_UPDATED",
        location
      );
  }

  emitETAUpdate(
    eta: ETAResult
  ): void {
    const room =
      this.getEmergencyRoom(
        eta.requestId
      );

    this.io
      .to(room)
      .emit(
        "ETA_UPDATED",
        eta
      );
  }

  emitStatusUpdate(
    trackingState: TrackingState
  ): void {
    const room =
      this.getEmergencyRoom(
        trackingState.requestId
      );

    this.io
      .to(room)
      .emit(
        "STATUS_UPDATED",
        trackingState
      );
  }

  emitRouteUpdate(
    eta: ETAResult
  ): void {
    const room =
      this.getEmergencyRoom(
        eta.requestId
      );

    this.io
      .to(room)
      .emit(
        "ROUTE_UPDATED",
        eta.route
      );
  }

  emitAssignmentCreated(
    requestId: string,
    assignment: unknown
  ): void {
    const room =
      this.getEmergencyRoom(
        requestId
      );

    this.io
      .to(room)
      .emit(
        "ASSIGNMENT_CREATED",
        assignment
      );
  }

  emitAssignmentAccepted(
    requestId: string,
    assignment: unknown
  ): void {
    const room =
      this.getEmergencyRoom(
        requestId
      );

    this.io
      .to(room)
      .emit(
        "ASSIGNMENT_ACCEPTED",
        assignment
      );
  }

  emitAssignmentRejected(
    requestId: string,
    assignment: unknown
  ): void {
    const room =
      this.getEmergencyRoom(
        requestId
      );

    this.io
      .to(room)
      .emit(
        "ASSIGNMENT_REJECTED",
        assignment
      );
  }

  emitAssignmentTimeout(
    requestId: string,
    assignment: unknown
  ): void {
    const room =
      this.getEmergencyRoom(
        requestId
      );

    this.io
      .to(room)
      .emit(
        "ASSIGNMENT_TIMEOUT",
        assignment
      );
  }

  emitFallbackStarted(
    requestId: string,
    data: unknown
  ): void {
    const room =
      this.getEmergencyRoom(
        requestId
      );

    this.io
      .to(room)
      .emit(
        "FALLBACK_STARTED",
        data
      );
  }

  emitFallbackAssignmentCreated(
    requestId: string,
    assignment: unknown
  ): void {
    const room =
      this.getEmergencyRoom(
        requestId
      );

    this.io
      .to(room)
      .emit(
        "FALLBACK_ASSIGNMENT_CREATED",
        assignment
      );
  }

  emitPatientOnboard(
    trackingState: TrackingState
  ): void {
    const room =
      this.getEmergencyRoom(
        trackingState.requestId
      );

    this.io
      .to(room)
      .emit(
        "PATIENT_ONBOARD",
        trackingState
      );
  }

  emitHospitalArrived(
    trackingState: TrackingState
  ): void {
    const room =
      this.getEmergencyRoom(
        trackingState.requestId
      );

    this.io
      .to(room)
      .emit(
        "HOSPITAL_ARRIVED",
        trackingState
      );
  }

  emitRequestCompleted(
    trackingState: TrackingState
  ): void {
    const room =
      this.getEmergencyRoom(
        trackingState.requestId
      );

    this.io
      .to(room)
      .emit(
        "REQUEST_COMPLETED",
        trackingState
      );
  }
}