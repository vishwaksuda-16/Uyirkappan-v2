"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ETAService = void 0;

class ETAService {
    constructor(nearestNodeService, dijkstraService) {
        this.nearestNodeService = nearestNodeService;
        this.dijkstraService = dijkstraService;
    }

    calculateETA(requestId, ambulanceId, currentLocation, destination) {
        let multiRoutes;
        try {
            multiRoutes = this.dijkstraService.findDynamicMultiRoutes(currentLocation, destination);
        } catch (_) {
            const ambulanceNode = this.nearestNodeService.findNearestNode(currentLocation);
            const destinationNode = this.nearestNodeService.findNearestNode(destination);
            try {
                multiRoutes = this.dijkstraService.findMultiRoutes(ambulanceNode.nodeId, destinationNode.nodeId);
            } catch (__) {
                const fallbackRoute = this.dijkstraService.findShortestRoute(ambulanceNode.nodeId, destinationNode.nodeId);
                multiRoutes = {
                    primaryRoute: { ...fallbackRoute, routeId: 'ROUTE-PRIMARY', isPrimary: true, cost: 0.1, score: 0.1 },
                    alternativeRoutes: [],
                    candidateRoutes: [{ ...fallbackRoute, routeId: 'ROUTE-PRIMARY', isPrimary: true, cost: 0.1, score: 0.1 }],
                    selectionReason: "Primary route selected.",
                    alternativeReason: "Alternative route unavailable in supplied road-network dataset.",
                };
            }
        }

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
