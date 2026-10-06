"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.VirtualMovementService = void 0;
class VirtualMovementService {
    constructor(graphService, trackingService, config = {
        updateIntervalMs: 1000,
        acceleratedTime: false,
        speedMultiplier: 1
    }) {
        this.graphService = graphService;
        this.trackingService = trackingService;
        this.config = config;
    }
    async moveAlongRoute(ambulanceId, requestId, route, destination, callbacks) {
        const updates = [];
        /*
         * If destination is not explicitly provided,
         * use the final node of the route.
         */
        const finalNodeId = route.nodeIds[route.nodeIds.length - 1];
        const finalNode = this.graphService.getNode(finalNodeId);
        if (!finalNode) {
            throw new Error(`Route destination node ${finalNodeId} not found`);
        }
        const movementDestination = destination ?? {
            latitude: finalNode.latitude,
            longitude: finalNode.longitude
        };
        const nodes = route.nodeIds.map((nodeId) => {
            const node = this.graphService.getNode(nodeId);
            if (!node) {
                throw new Error(`Route node ${nodeId} not found`);
            }
            return node;
        });
        let totalDistanceKm = 0;
        const segmentDistances = [];
        for (let i = 1; i < nodes.length; i++) {
            const distance = this.calculateDistance(nodes[i - 1].latitude, nodes[i - 1].longitude, nodes[i].latitude, nodes[i].longitude);
            segmentDistances.push(distance);
            totalDistanceKm += distance;
        }
        const routeDistanceKm = totalDistanceKm;
        const routeRoadDistanceKm = route.distanceKm > 0 ? route.distanceKm : totalDistanceKm;
        const simulationSpeed = this.config.acceleratedTime
            ? Math.max(0.1, this.config.speedMultiplier)
            : 1;
        const firstNode = nodes[0];
        await this.emitLocationUpdate(ambulanceId, requestId, firstNode.latitude, firstNode.longitude, 0, 0, movementDestination, callbacks, updates);
        for (let i = 1; i < nodes.length; i++) {
            const from = nodes[i - 1];
            const to = nodes[i];
            const segmentDistanceKm = segmentDistances[i - 1];
            const segmentTravelTimeMinutes = route.travelTimeMinutes *
                (routeDistanceKm > 0
                    ? segmentDistanceKm / routeDistanceKm
                    : 1 / (nodes.length - 1));
            const segmentDurationMs = segmentTravelTimeMinutes * 60000;
            const wallDurationMs = segmentDurationMs / simulationSpeed;
            const segmentRoadDistanceKm = routeDistanceKm > 0
                ? routeRoadDistanceKm * (segmentDistanceKm / routeDistanceKm)
                : segmentDistanceKm;
            const speed = segmentDurationMs > 0
                ? segmentRoadDistanceKm / (segmentDurationMs / 3600000)
                : 0;
            const heading = this.calculateHeading(from.latitude, from.longitude, to.latitude, to.longitude);
            let elapsedMs = 0;
            while (elapsedMs < wallDurationMs) {
                const stepMs = Math.min(this.getUpdateInterval(), wallDurationMs - elapsedMs);
                await this.delay(stepMs);
                elapsedMs += stepMs;
                const progress = wallDurationMs > 0 ? elapsedMs / wallDurationMs : 1;
                await this.emitLocationUpdate(ambulanceId, requestId, from.latitude + (to.latitude - from.latitude) * progress, from.longitude + (to.longitude - from.longitude) * progress, speed, heading, movementDestination, callbacks, updates);
            }
        }
        return updates;
    }
    async emitLocationUpdate(ambulanceId, requestId, latitude, longitude, speed, heading, destination, callbacks, updates) {
        const locationUpdate = {
            ambulanceId,
            requestId,
            latitude,
            longitude,
            speed,
            heading,
            timestamp: new Date()
        };
        this.trackingService.updateLocation(locationUpdate);
        if (callbacks?.onLocationUpdate) {
            await callbacks.onLocationUpdate(locationUpdate, destination);
        }
        updates.push(locationUpdate);
    }
    getUpdateInterval() {
        if (this.config.acceleratedTime) {
            return Math.max(100, this.config.updateIntervalMs /
                this.config.speedMultiplier);
        }
        return this.config.updateIntervalMs;
    }
    delay(milliseconds) {
        return new Promise((resolve) => setTimeout(resolve, milliseconds));
    }
    calculateHeading(fromLatitude, fromLongitude, toLatitude, toLongitude) {
        const lat1 = this.toRadians(fromLatitude);
        const lat2 = this.toRadians(toLatitude);
        const deltaLongitude = this.toRadians(toLongitude - fromLongitude);
        const y = Math.sin(deltaLongitude) *
            Math.cos(lat2);
        const x = Math.cos(lat1) *
            Math.sin(lat2) -
            Math.sin(lat1) *
                Math.cos(lat2) *
                Math.cos(deltaLongitude);
        const radians = Math.atan2(y, x);
        const degrees = (radians * 180) / Math.PI;
        return (degrees + 360) % 360;
    }
    calculateDistance(latitude1, longitude1, latitude2, longitude2) {
        const earthRadiusKm = 6371;
        const lat1 = this.toRadians(latitude1);
        const lat2 = this.toRadians(latitude2);
        const deltaLat = this.toRadians(latitude2 - latitude1);
        const deltaLon = this.toRadians(longitude2 - longitude1);
        const a = Math.sin(deltaLat / 2) ** 2 +
            Math.cos(lat1) *
                Math.cos(lat2) *
                Math.sin(deltaLon / 2) ** 2;
        const c = 2 *
            Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
        return earthRadiusKm * c;
    }
    toRadians(degrees) {
        return degrees * (Math.PI / 180);
    }
}
exports.VirtualMovementService = VirtualMovementService;
