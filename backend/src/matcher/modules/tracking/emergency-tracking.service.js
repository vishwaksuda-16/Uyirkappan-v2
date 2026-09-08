"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.EmergencyTrackingService = void 0;
class EmergencyTrackingService {
    constructor(trackingService, etaService) {
        this.trackingService = trackingService;
        this.etaService = etaService;
    }
    acceptAssignment(requestId) {
        return this.trackingService.updateStatus(requestId, "ACCEPTED");
    }
    startJourney(requestId) {
        return this.trackingService.updateStatus(requestId, "EN_ROUTE_TO_PATIENT");
    }
    processLocationUpdate(locationUpdate, destination) {
        const storedLocation = this.trackingService.updateLocation(locationUpdate);
        const eta = this.etaService.calculateETA(locationUpdate.requestId, locationUpdate.ambulanceId, {
            latitude: locationUpdate.latitude,
            longitude: locationUpdate.longitude
        }, destination);
        this.trackingService.updateETA(locationUpdate.requestId, eta.estimatedMinutes);
        let status;
        if (eta.estimatedMinutes === 0) {
            status = "ARRIVED_AT_PATIENT";
            this.trackingService.updateStatus(locationUpdate.requestId, status);
        }
        const trackingState = this.trackingService.getTrackingState(locationUpdate.requestId);
        if (!trackingState) {
            throw new Error(`Tracking state for request ${locationUpdate.requestId} not found`);
        }
        return {
            status: status ??
                trackingState.status,
            location: storedLocation,
            destination,
            estimatedMinutes: eta.estimatedMinutes,
            route: eta.route,
            trackingState
        };
    }
    patientOnboarded(requestId) {
        return this.trackingService.updateStatus(requestId, "PATIENT_ONBOARD");
    }
    startHospitalJourney(requestId) {
        return this.trackingService.updateStatus(requestId, "EN_ROUTE_TO_HOSPITAL");
    }
    hospitalArrived(requestId) {
        return this.trackingService.updateStatus(requestId, "ARRIVED_AT_HOSPITAL");
    }
    completeEmergency(requestId) {
        const state = this.trackingService.updateStatus(requestId, "COMPLETED");
        state.estimatedMinutes = 0;
        return state;
    }
}
exports.EmergencyTrackingService = EmergencyTrackingService;
