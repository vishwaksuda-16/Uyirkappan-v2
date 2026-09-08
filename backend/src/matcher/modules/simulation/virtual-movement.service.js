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
        for (let i = 0; i < route.nodeIds.length; i++) {
            const nodeId = route.nodeIds[i];
            const node = this.graphService.getNode(nodeId);
            if (!node) {
                throw new Error(`Route node ${nodeId} not found`);
            }
            const previousNodeId = i > 0
                ? route.nodeIds[i - 1]
                : undefined;
            let speed = 0;
            let heading = 0;
            if (previousNodeId) {
                const previousNode = this.graphService.getNode(previousNodeId);
                if (previousNode) {
                    speed = this.calculateSpeed(previousNode.latitude, previousNode.longitude, node.latitude, node.longitude, route.travelTimeMinutes);
                    heading = this.calculateHeading(previousNode.latitude, previousNode.longitude, node.latitude, node.longitude);
                }
            }
            const locationUpdate = {
                ambulanceId,
                requestId,
                latitude: node.latitude,
                longitude: node.longitude,
                speed,
                heading,
                timestamp: new Date()
            };
            /*
             * Store the location in the tracking service.
             */
            this.trackingService.updateLocation(locationUpdate);
            /*
             * Notify the caller so the caller can execute
             * the complete tracking + ETA + Socket.IO pipeline.
             */
            if (callbacks?.onLocationUpdate) {
                await callbacks.onLocationUpdate(locationUpdate, movementDestination);
            }
            updates.push(locationUpdate);
            /*
             * Wait before moving to the next point.
             * The first location is emitted immediately.
             */
            if (i < route.nodeIds.length - 1) {
                await this.delay(this.getUpdateInterval());
            }
        }
        return updates;
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
    calculateSpeed(fromLatitude, fromLongitude, toLatitude, toLongitude, totalTravelTimeMinutes) {
        const distanceKm = this.calculateDistance(fromLatitude, fromLongitude, toLatitude, toLongitude);
        if (totalTravelTimeMinutes <= 0) {
            return 0;
        }
        const hours = totalTravelTimeMinutes / 60;
        return distanceKm / hours;
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
