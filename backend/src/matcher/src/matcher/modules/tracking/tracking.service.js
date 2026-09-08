"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.TrackingService = void 0;
class TrackingService {
    constructor() {
        this.locationHistory = new Map();
        this.trackingStates = new Map();
    }
    updateLocation(locationUpdate) {
        const history = this.locationHistory.get(locationUpdate.requestId) ?? [];
        history.push(locationUpdate);
        this.locationHistory.set(locationUpdate.requestId, history);
        const existingState = this.trackingStates.get(locationUpdate.requestId);
        if (existingState) {
            existingState.latestLocation =
                locationUpdate;
            existingState.updatedAt =
                new Date();
        }
        else {
            this.trackingStates.set(locationUpdate.requestId, {
                requestId: locationUpdate.requestId,
                ambulanceId: locationUpdate.ambulanceId,
                status: "ASSIGNED",
                latestLocation: locationUpdate,
                updatedAt: new Date()
            });
        }
        return locationUpdate;
    }
    updateStatus(requestId, status) {
        const state = this.trackingStates.get(requestId);
        if (!state) {
            throw new Error(`Tracking state for request ${requestId} not found`);
        }
        state.status = status;
        state.updatedAt = new Date();
        return state;
    }
    updateETA(requestId, estimatedMinutes) {
        const state = this.trackingStates.get(requestId);
        if (!state) {
            throw new Error(`Tracking state for request ${requestId} not found`);
        }
        state.estimatedMinutes =
            estimatedMinutes;
        state.updatedAt = new Date();
        return state;
    }
    getTrackingState(requestId) {
        return this.trackingStates.get(requestId);
    }
    getLatestLocation(requestId) {
        const history = this.locationHistory.get(requestId);
        if (!history ||
            history.length === 0) {
            return undefined;
        }
        return history[history.length - 1];
    }
    getLocationHistory(requestId) {
        return [
            ...(this.locationHistory.get(requestId) ?? [])
        ];
    }
    clearTracking(requestId) {
        this.locationHistory.delete(requestId);
        this.trackingStates.delete(requestId);
    }
}
exports.TrackingService = TrackingService;
