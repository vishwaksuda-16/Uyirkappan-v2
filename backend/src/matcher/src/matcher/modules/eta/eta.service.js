"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ETAService = void 0;
class ETAService {
    constructor(nearestNodeService, dijkstraService) {
        this.nearestNodeService = nearestNodeService;
        this.dijkstraService = dijkstraService;
    }
    calculateETA(requestId, ambulanceId, currentLocation, destination) {
        const ambulanceNode = this.nearestNodeService.findNearestNode(currentLocation);
        const destinationNode = this.nearestNodeService.findNearestNode(destination);
        const route = this.dijkstraService.findShortestRoute(ambulanceNode.nodeId, destinationNode.nodeId);
        return {
            requestId,
            ambulanceId,
            currentLocation,
            destination,
            estimatedMinutes: route.travelTimeMinutes,
            calculatedAt: new Date(),
            route
        };
    }
}
exports.ETAService = ETAService;
