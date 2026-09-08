"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.LiveTrackingOrchestratorService = void 0;
class LiveTrackingOrchestratorService {
    constructor(emergencyTrackingService, trackingEventsService) {
        this.emergencyTrackingService = emergencyTrackingService;
        this.trackingEventsService = trackingEventsService;
    }
    async processLocationUpdate(locationUpdate, destination) {
        const trackingUpdate = this.emergencyTrackingService.processLocationUpdate(locationUpdate, destination);
        this.trackingEventsService.broadcastTrackingUpdate(trackingUpdate);
    }
    acceptAssignment(requestId) {
        const state = this.emergencyTrackingService.acceptAssignment(requestId);
        this.trackingEventsService.emitStatusUpdate(state);
    }
    startJourney(requestId) {
        const state = this.emergencyTrackingService.startJourney(requestId);
        this.trackingEventsService.emitStatusUpdate(state);
    }
    patientOnboarded(requestId) {
        const state = this.emergencyTrackingService.patientOnboarded(requestId);
        this.trackingEventsService.emitPatientOnboard(requestId, state);
    }
    startHospitalJourney(requestId) {
        const state = this.emergencyTrackingService.startHospitalJourney(requestId);
        this.trackingEventsService.emitStatusUpdate(state);
    }
    hospitalArrived(requestId) {
        const state = this.emergencyTrackingService.hospitalArrived(requestId);
        this.trackingEventsService.emitHospitalArrived(requestId, state);
    }
    completeEmergency(requestId) {
        const state = this.emergencyTrackingService.completeEmergency(requestId);
        this.trackingEventsService.emitRequestCompleted(requestId, state);
    }
}
exports.LiveTrackingOrchestratorService = LiveTrackingOrchestratorService;
