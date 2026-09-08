"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.TrackingETAService = void 0;
class TrackingETAService {
    constructor(trackingService, etaService) {
        this.trackingService = trackingService;
        this.etaService = etaService;
    }
    updateLocationAndCalculateETA(locationUpdate, destination) {
        const location = this.trackingService.updateLocation(locationUpdate);
        const eta = this.etaService.calculateETA(locationUpdate.requestId, locationUpdate.ambulanceId, {
            latitude: locationUpdate.latitude,
            longitude: locationUpdate.longitude
        }, destination);
        return {
            location,
            eta
        };
    }
    getLatestTrackingETA(requestId, ambulanceId, destination) {
        const latestLocation = this.trackingService.getLatestLocation(requestId);
        if (!latestLocation) {
            return undefined;
        }
        if (latestLocation.ambulanceId !==
            ambulanceId) {
            return undefined;
        }
        const eta = this.etaService.calculateETA(requestId, ambulanceId, {
            latitude: latestLocation.latitude,
            longitude: latestLocation.longitude
        }, destination);
        return {
            location: latestLocation,
            eta
        };
    }
}
exports.TrackingETAService = TrackingETAService;
