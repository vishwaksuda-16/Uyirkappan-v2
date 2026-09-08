"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.NearestNodeService = void 0;
class NearestNodeService {
    constructor(graph) {
        this.graph = graph;
    }
    findNearestNode(location) {
        let nearestNode = null;
        let shortestDistance = Infinity;
        for (const node of this.graph.getGraph().nodes.values()) {
            const distance = this.calculateDistance(location, {
                latitude: node.latitude,
                longitude: node.longitude
            });
            if (distance < shortestDistance) {
                shortestDistance = distance;
                nearestNode = node;
            }
        }
        if (!nearestNode) {
            throw new Error("Road graph contains no nodes");
        }
        return nearestNode;
    }
    calculateDistance(location1, location2) {
        const earthRadiusKm = 6371;
        const lat1 = this.toRadians(location1.latitude);
        const lat2 = this.toRadians(location2.latitude);
        const deltaLat = this.toRadians(location2.latitude - location1.latitude);
        const deltaLon = this.toRadians(location2.longitude - location1.longitude);
        const a = Math.sin(deltaLat / 2) ** 2 +
            Math.cos(lat1) *
                Math.cos(lat2) *
                Math.sin(deltaLon / 2) ** 2;
        const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
        return earthRadiusKm * c;
    }
    toRadians(degrees) {
        return degrees * (Math.PI / 180);
    }
}
exports.NearestNodeService = NearestNodeService;
