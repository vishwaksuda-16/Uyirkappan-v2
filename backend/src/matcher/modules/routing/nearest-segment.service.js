"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.NearestSegmentService = void 0;
const { datasetLoader } = require("../../../data/datasetLoader.js");

function toRadians(deg) {
    return (deg * Math.PI) / 180;
}

function haversineDistanceKm(lat1, lon1, lat2, lon2) {
    const R = 6371; // Earth radius in km
    const dLat = toRadians(lat2 - lat1);
    const dLon = toRadians(lon2 - lon1);
    const a =
        Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.cos(toRadians(lat1)) * Math.cos(toRadians(lat2)) *
        Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
}

class NearestSegmentService {
    constructor() {
        datasetLoader.loadAll();
        this.nodesMap = new Map();
        for (const n of datasetLoader.roadNodes) {
            this.nodesMap.set(n.id || n.nodeId, n);
        }
        this.segments = datasetLoader.roadSegments;
    }

    /**
     * Projects an arbitrary GPS point onto the nearest road segment in the 182-segment dataset.
     * @param {{ latitude: number, longitude: number }} point
     * @returns {Object} Nearest segment projection details
     */
    findNearestRoadSegment(point) {
        if (!point || typeof point.latitude !== 'number' || typeof point.longitude !== 'number') {
            throw new Error("Invalid coordinate passed to findNearestRoadSegment");
        }

        const pLat = point.latitude;
        const pLon = point.longitude;

        let bestMatch = null;
        let shortestDistKm = Infinity;

        for (const seg of this.segments) {
            const startNode = this.nodesMap.get(seg.startNodeId);
            const endNode = this.nodesMap.get(seg.endNodeId);

            if (!startNode || !endNode) continue;

            const uLat = startNode.latitude;
            const uLon = startNode.longitude;
            const vLat = endNode.latitude;
            const vLon = endNode.longitude;

            // Equirectangular projection for perpendicular vector projection
            const latMid = toRadians((uLat + vLat) / 2);
            const cosLatMid = Math.cos(latMid);

            const dx = (vLon - uLon) * cosLatMid;
            const dy = (vLat - uLat);
            const segLenSq = dx * dx + dy * dy;

            let t = 0;
            if (segLenSq > 0) {
                const px = (pLon - uLon) * cosLatMid;
                const py = (pLat - uLat);
                t = (px * dx + py * dy) / segLenSq;
                t = Math.max(0, Math.min(1, t));
            }

            const projLat = uLat + t * (vLat - uLat);
            const projLon = uLon + t * (vLon - uLon);

            const distKm = haversineDistanceKm(pLat, pLon, projLat, projLon);

            if (distKm < shortestDistKm) {
                shortestDistKm = distKm;
                bestMatch = {
                    segmentId: seg.segmentId || seg.id,
                    segment: seg,
                    startNodeId: seg.startNodeId,
                    endNodeId: seg.endNodeId,
                    startNode,
                    endNode,
                    t,
                    projectedPoint: {
                        latitude: Math.round(projLat * 1e6) / 1e6,
                        longitude: Math.round(projLon * 1e6) / 1e6,
                    },
                    distanceToSegmentKm: Math.round(distKm * 1000) / 1000,
                    oneWay: Boolean(seg.oneWay),
                    speedLimitKmph: seg.speedLimitKmph || 30.0,
                    roadType: seg.roadType || 'City Road',
                    segmentDistanceKm: seg.distanceKm,
                };
            }
        }

        if (!bestMatch) {
            throw new Error("No road segments available for GPS projection");
        }

        return bestMatch;
    }
}

exports.NearestSegmentService = NearestSegmentService;
exports.haversineDistanceKm = haversineDistanceKm;
