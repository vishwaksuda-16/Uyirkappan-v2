"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ETAService = void 0;

class ETAService {
    constructor(nearestNodeService, dijkstraService) {
        this.nearestNodeService = nearestNodeService;
        this.dijkstraService = dijkstraService;
    }

    calculateETA(requestId, ambulanceId, currentLocation, destination) {
        if (typeof this.dijkstraService.findDynamicMultiRoutes !== 'function') {
            throw new Error('Exact-coordinate road routing is unavailable');
        }
        const multiRoutes = this.dijkstraService.findDynamicMultiRoutes(currentLocation, destination);

        const primary = multiRoutes.primaryRoute;

        return {
            requestId,
            ambulanceId,
            currentLocation,
            destination,
            estimatedMinutes: Math.max(1, Math.round(primary.travelTimeMinutes)),
            calculatedAt: new Date(),
            route: primary,
            alternativeRoutes: multiRoutes.alternativeRoutes || [],
            candidateRoutes: multiRoutes.candidateRoutes || [primary],
            originSegment: multiRoutes.originSegment,
            destinationSegment: multiRoutes.destinationSegment,
            selectionReason: multiRoutes.selectionReason,
            alternativeReason: multiRoutes.alternativeReason,
            cost: primary.cost,
            score: primary.score,
        };
    }
}
exports.ETAService = ETAService;
