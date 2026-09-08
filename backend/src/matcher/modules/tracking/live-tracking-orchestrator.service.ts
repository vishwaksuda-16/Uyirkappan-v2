import { Location } from "../dispatch/dispatch.types.js";
import { EmergencyTrackingService } from "./emergency-tracking.service.js";
import { LocationUpdate } from "./tracking.types.js";
import { TrackingEventsService } from "../../websocket/tracking-events.service.js";

export class LiveTrackingOrchestratorService {
  constructor(
    private readonly emergencyTrackingService: EmergencyTrackingService,
    private readonly trackingEventsService: TrackingEventsService
  ) {}

  async processLocationUpdate(
    locationUpdate: LocationUpdate,
    destination: Location
  ): Promise<void> {
    const trackingUpdate =
      this.emergencyTrackingService.processLocationUpdate(
        locationUpdate,
        destination
      );

    this.trackingEventsService.broadcastTrackingUpdate(
      trackingUpdate
    );
  }

  acceptAssignment(
    requestId: string
  ): void {
    const state =
      this.emergencyTrackingService.acceptAssignment(
        requestId
      );

    this.trackingEventsService.emitStatusUpdate(
      state
    );
  }

  startJourney(
    requestId: string
  ): void {
    const state =
      this.emergencyTrackingService.startJourney(
        requestId
      );

    this.trackingEventsService.emitStatusUpdate(
      state
    );
  }

  patientOnboarded(
    requestId: string
  ): void {
    const state =
      this.emergencyTrackingService.patientOnboarded(
        requestId
      );

    this.trackingEventsService.emitPatientOnboard(
      requestId,
      state
    );
  }

  startHospitalJourney(
    requestId: string
  ): void {
    const state =
      this.emergencyTrackingService.startHospitalJourney(
        requestId
      );

    this.trackingEventsService.emitStatusUpdate(
      state
    );
  }

  hospitalArrived(
    requestId: string
  ): void {
    const state =
      this.emergencyTrackingService.hospitalArrived(
        requestId
      );

    this.trackingEventsService.emitHospitalArrived(
      requestId,
      state
    );
  }

  completeEmergency(
    requestId: string
  ): void {
    const state =
      this.emergencyTrackingService.completeEmergency(
        requestId
      );

    this.trackingEventsService.emitRequestCompleted(
      requestId,
      state
    );
  }
}