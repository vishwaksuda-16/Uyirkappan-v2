"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.SocketEventsService = void 0;
class SocketEventsService {
    constructor(io) {
        this.io = io;
    }
    getEmergencyRoom(requestId) {
        return `emergency:${requestId}`;
    }
    emitLocationUpdate(location) {
        const room = this.getEmergencyRoom(location.requestId);
        this.io
            .to(room)
            .emit("AMBULANCE_LOCATION_UPDATED", location);
    }
    emitETAUpdate(eta) {
        const room = this.getEmergencyRoom(eta.requestId);
        this.io
            .to(room)
            .emit("ETA_UPDATED", eta);
    }
    emitStatusUpdate(trackingState) {
        const room = this.getEmergencyRoom(trackingState.requestId);
        this.io
            .to(room)
            .emit("STATUS_UPDATED", trackingState);
    }
    emitRouteUpdate(eta) {
        const room = this.getEmergencyRoom(eta.requestId);
        this.io
            .to(room)
            .emit("ROUTE_UPDATED", eta.route);
    }
    emitAssignmentCreated(requestId, assignment) {
        const room = this.getEmergencyRoom(requestId);
        this.io
            .to(room)
            .emit("ASSIGNMENT_CREATED", assignment);
    }
    emitAssignmentAccepted(requestId, assignment) {
        const room = this.getEmergencyRoom(requestId);
        this.io
            .to(room)
            .emit("ASSIGNMENT_ACCEPTED", assignment);
    }
    emitAssignmentRejected(requestId, assignment) {
        const room = this.getEmergencyRoom(requestId);
        this.io
            .to(room)
            .emit("ASSIGNMENT_REJECTED", assignment);
    }
    emitAssignmentTimeout(requestId, assignment) {
        const room = this.getEmergencyRoom(requestId);
        this.io
            .to(room)
            .emit("ASSIGNMENT_TIMEOUT", assignment);
    }
    emitFallbackStarted(requestId, data) {
        const room = this.getEmergencyRoom(requestId);
        this.io
            .to(room)
            .emit("FALLBACK_STARTED", data);
    }
    emitFallbackAssignmentCreated(requestId, assignment) {
        const room = this.getEmergencyRoom(requestId);
        this.io
            .to(room)
            .emit("FALLBACK_ASSIGNMENT_CREATED", assignment);
    }
    emitPatientOnboard(trackingState) {
        const room = this.getEmergencyRoom(trackingState.requestId);
        this.io
            .to(room)
            .emit("PATIENT_ONBOARD", trackingState);
    }
    emitHospitalArrived(trackingState) {
        const room = this.getEmergencyRoom(trackingState.requestId);
        this.io
            .to(room)
            .emit("HOSPITAL_ARRIVED", trackingState);
    }
    emitRequestCompleted(trackingState) {
        const room = this.getEmergencyRoom(trackingState.requestId);
        this.io
            .to(room)
            .emit("REQUEST_COMPLETED", trackingState);
    }
}
exports.SocketEventsService = SocketEventsService;
