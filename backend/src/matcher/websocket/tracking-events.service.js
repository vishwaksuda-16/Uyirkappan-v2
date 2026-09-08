"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.TrackingEventsService = void 0;
class TrackingEventsService {
    constructor(socketEventsService) {
        this.socketEventsService = socketEventsService;
    }
    /*
     * ============================
     * LIVE TRACKING UPDATE
     * ============================
     */
    broadcastTrackingUpdate(update) {
        /*
         * 1. Ambulance location
         */
        this.socketEventsService.emitLocationUpdate(update.location);
        /*
         * 2. ETA update
         */
        const etaResult = {
            requestId: update.location.requestId,
            ambulanceId: update.location.ambulanceId,
            currentLocation: {
                latitude: update.location.latitude,
                longitude: update.location.longitude
            },
            destination: update.destination,
            estimatedMinutes: update.estimatedMinutes,
            calculatedAt: new Date(),
            route: update.route
        };
        this.socketEventsService.emitETAUpdate(etaResult);
        /*
         * 3. Route update
         */
        this.socketEventsService.emitRouteUpdate(etaResult);
        /*
         * 4. Tracking status
         */
        this.socketEventsService.emitStatusUpdate(update.trackingState);
    }
    /*
     * ============================
     * STATUS UPDATE
     * ============================
     */
    emitStatusUpdate(trackingState) {
        this.socketEventsService.emitStatusUpdate(trackingState);
    }
    /*
     * ============================
     * PATIENT ONBOARD
     * ============================
     */
    emitPatientOnboard(requestId, trackingState) {
        /*
         * SocketEventsService already receives
         * the complete tracking state, which
         * contains the requestId.
         */
        void requestId;
        this.socketEventsService.emitPatientOnboard(trackingState);
    }
    /*
     * ============================
     * HOSPITAL ARRIVAL
     * ============================
     */
    emitHospitalArrived(requestId, trackingState) {
        /*
         * requestId is already available
         * inside trackingState.
         */
        void requestId;
        this.socketEventsService.emitHospitalArrived(trackingState);
    }
    /*
     * ============================
     * REQUEST COMPLETED
     * ============================
     */
    emitRequestCompleted(requestId, trackingState) {
        /*
         * requestId is already available
         * inside trackingState.
         */
        void requestId;
        this.socketEventsService.emitRequestCompleted(trackingState);
    }
}
exports.TrackingEventsService = TrackingEventsService;
