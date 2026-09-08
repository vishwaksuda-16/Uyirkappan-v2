"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.FallbackService = void 0;
class FallbackService {
    constructor() {
        this.attempts = new Map();
        this.excludedAmbulances = new Map();
    }
    recordAttempt(requestId, ambulanceId) {
        const requestAttempts = this.attempts.get(requestId) ?? [];
        /*
         * Do not create another pending attempt
         * for the same ambulance.
         */
        const pendingAttempt = requestAttempts.find((attempt) => attempt.ambulanceId ===
            ambulanceId &&
            !attempt.response);
        if (pendingAttempt) {
            throw new Error(`Ambulance ${ambulanceId} already has a pending assignment attempt for request ${requestId}`);
        }
        const attempt = {
            requestId,
            attemptNumber: requestAttempts.length + 1,
            ambulanceId,
            assignedAt: new Date()
        };
        requestAttempts.push(attempt);
        this.attempts.set(requestId, requestAttempts);
        return attempt;
    }
    recordResponse(requestId, ambulanceId, response, failureReason) {
        const requestAttempts = this.attempts.get(requestId);
        if (!requestAttempts) {
            throw new Error(`No assignment attempts found for request ${requestId}`);
        }
        const attempt = [...requestAttempts]
            .reverse()
            .find((item) => item.ambulanceId ===
            ambulanceId &&
            !item.response);
        if (!attempt) {
            throw new Error(`No pending assignment found for ambulance ${ambulanceId}`);
        }
        attempt.response =
            response;
        attempt.responseAt =
            new Date();
        if (response === "REJECTED" ||
            response === "TIMEOUT") {
            attempt.failureReason =
                failureReason ??
                    response;
            this.excludeAmbulance(requestId, ambulanceId);
        }
        return attempt;
    }
    excludeAmbulance(requestId, ambulanceId) {
        const excluded = this.excludedAmbulances.get(requestId) ?? new Set();
        excluded.add(ambulanceId);
        this.excludedAmbulances.set(requestId, excluded);
    }
    getExcludedAmbulances(requestId) {
        return (this.excludedAmbulances.get(requestId) ?? new Set());
    }
    getAttempts(requestId) {
        return [
            ...(this.attempts.get(requestId) ?? [])
        ];
    }
    clearRequest(requestId) {
        this.attempts.delete(requestId);
        this.excludedAmbulances.delete(requestId);
    }
}
exports.FallbackService = FallbackService;
