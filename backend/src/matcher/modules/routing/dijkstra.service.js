"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.DijkstraService = void 0;
const { NearestSegmentService } = require("./nearest-segment.service.js");

class DijkstraService {
    constructor(graph, traffic, nearestSegmentService) {
        this.graph = graph;
        this.traffic = traffic;
        this.nearestSegmentService = nearestSegmentService || new NearestSegmentService();
    }

    findShortestRoute(startNodeId, destinationNodeId, penalizedEdges = new Map(), graphOverride = this.graph) {
        if (!graphOverride.getNode(startNodeId)) {
            throw new Error(`Start node ${startNodeId} does not exist`);
        }
        if (!graphOverride.getNode(destinationNodeId)) {
            throw new Error(`Destination node ${destinationNodeId} does not exist`);
        }

        const distances = new Map();
        const previousNodes = new Map();
        const visited = new Set();

        for (const nodeId of graphOverride.getGraph().nodes.keys()) {
            distances.set(nodeId, Infinity);
            previousNodes.set(nodeId, null);
        }

        distances.set(startNodeId, 0);

        while (visited.size < graphOverride.getGraph().nodes.size) {
            const currentNode = this.getUnvisitedNodeWithSmallestDistance(distances, visited);
            if (!currentNode) break;
            if (currentNode === destinationNodeId) break;

            visited.add(currentNode);
            const neighbors = graphOverride.getNeighbors(currentNode);

            for (const edge of neighbors) {
                if (visited.has(edge.toNodeId)) continue;

                const currentDistance = distances.get(currentNode) ?? Infinity;
                let adjustedTravelTime = this.traffic.getAdjustedTravelTime(edge.travelTimeMinutes, edge.fromNodeId, edge.toNodeId);
                
                const edgeKey = `${edge.fromNodeId}->${edge.toNodeId}`;
                if (penalizedEdges.has(edgeKey)) {
                    adjustedTravelTime *= penalizedEdges.get(edgeKey);
                }

                const newDistance = currentDistance + adjustedTravelTime;
                const knownDistance = distances.get(edge.toNodeId) ?? Infinity;

                if (newDistance < knownDistance) {
                    distances.set(edge.toNodeId, newDistance);
                    previousNodes.set(edge.toNodeId, currentNode);
                }
            }
        }

        const destinationDistance = distances.get(destinationNodeId) ?? Infinity;
        if (destinationDistance === Infinity) {
            throw new Error(`No route found from ${startNodeId} to ${destinationNodeId}`);
        }

        const nodeIds = this.reconstructPath(startNodeId, destinationNodeId, previousNodes);
        const distanceKm = this.calculateRouteDistance(nodeIds, graphOverride);

        const waypoints = nodeIds.map(nodeId => {
            const node = graphOverride.getNode(nodeId);
            return {
                nodeId,
                name: node?.name || nodeId,
                latitude: node?.latitude || 0,
                longitude: node?.longitude || 0,
            };
        });

        return {
            nodeIds,
            distanceKm,
            travelTimeMinutes: destinationDistance,
            waypoints,
        };
    }

    findMultiRoutes(startNodeId, destinationNodeId, maxRoutes = 2, graphOverride = this.graph) {
        const primaryRoute = this.findShortestRoute(startNodeId, destinationNodeId, new Map(), graphOverride);
        const alternativeRoutes = [];

        if (primaryRoute.nodeIds.length > 2 && maxRoutes > 1) {
            try {
                // Penalize primary route edges by 75% to discover alternative corridor if one exists
                const penalizedEdges = new Map();
                for (let i = 0; i < primaryRoute.nodeIds.length - 1; i++) {
                    const u = primaryRoute.nodeIds[i];
                    const v = primaryRoute.nodeIds[i + 1];
                    penalizedEdges.set(`${u}->${v}`, 1.75);
                    penalizedEdges.set(`${v}->${u}`, 1.75);
                }

                const altRoute = this.findShortestRoute(startNodeId, destinationNodeId, penalizedEdges, graphOverride);
                // Check that alt route is genuinely different and within feasible detour threshold (<= 2.0x primary)
                const isDifferent = altRoute.nodeIds.join(',') !== primaryRoute.nodeIds.join(',');
                const isFeasible = altRoute.travelTimeMinutes <= primaryRoute.travelTimeMinutes * 2.0;
                if (isDifferent && isFeasible) {
                    alternativeRoutes.push({
                        ...altRoute,
                        routeId: 'ROUTE-ALT-1',
                        label: 'Alternative Corridor',
                        isPrimary: false,
                    });
                }
            } catch (_) {
                // If no alternative road exists, fallback to single route cleanly
            }
        }

        // Calculate weighted cost: 50% travel time, 20% distance, 20% traffic, 10% availability
        // Lower value = lower cost = better route
        const allCandidates = [primaryRoute, ...alternativeRoutes];
        const maxTime = Math.max(...allCandidates.map(r => r.travelTimeMinutes), 1);
        const maxDist = Math.max(...allCandidates.map(r => r.distanceKm), 1);

        const computeCost = (r) => {
            const timeNorm = r.travelTimeMinutes / maxTime;
            const distNorm = r.distanceKm / maxDist;
            const trafficPenalty = (r.travelTimeMinutes / Math.max(0.5, r.distanceKm)) > 1.4 ? 0.2 : 0.1;
            return Math.round((timeNorm * 0.5 + distNorm * 0.2 + trafficPenalty + 0.1) * 1000) / 1000;
        };

        const primaryCost = computeCost(primaryRoute);
        const scoredPrimary = {
            ...primaryRoute,
            routeId: 'ROUTE-PRIMARY',
            label: 'Primary Route (Fastest)',
            isPrimary: true,
            cost: primaryCost,
            score: primaryCost, // backward-compatible alias
        };

        const scoredAlts = alternativeRoutes.map((alt, idx) => {
            const altCost = computeCost(alt);
            return {
                ...alt,
                routeId: `ROUTE-ALT-${idx + 1}`,
                label: `Alternative Route ${idx + 1}`,
                isPrimary: false,
                cost: altCost,
                score: altCost, // backward-compatible alias
            };
        });

        const alternativeReason = scoredAlts.length === 0
            ? "Alternative route unavailable in supplied road-network dataset."
            : `${scoredAlts.length} alternative corridor available.`;

        let selectionReason;
        if (scoredAlts.length > 0) {
            selectionReason = `${scoredPrimary.label} selected over alternative route: lower travel time (${Math.round(scoredPrimary.travelTimeMinutes)} min vs ${Math.round(scoredAlts[0].travelTimeMinutes)} min) and optimal weighted cost (${scoredPrimary.cost} vs ${scoredAlts[0].cost}).`;
        } else {
            selectionReason = `${scoredPrimary.label} selected: optimal travel time (${Math.round(scoredPrimary.travelTimeMinutes)} min) and weighted cost (${scoredPrimary.cost}). ${alternativeReason}`;
        }

        return {
            primaryRoute: scoredPrimary,
            alternativeRoutes: scoredAlts,
            candidateRoutes: [scoredPrimary, ...scoredAlts],
            selectionReason,
            alternativeReason,
        };
    }

    /**
     * Builds a dynamic routing graph by projecting arbitrary GPS origin and destination onto the nearest road segments
     * and injecting temporary ORIGIN_GPS and DEST_GPS nodes respecting one-way road constraints.
     */
    buildDynamicGraph(originLocation, destinationLocation) {
        const origProj = this.nearestSegmentService.findNearestRoadSegment(originLocation);
        const destProj = this.nearestSegmentService.findNearestRoadSegment(destinationLocation);

        const baseGraph = this.graph.getGraph();
        const dynNodes = new Map(baseGraph.nodes);
        const dynEdges = new Map();
        for (const [k, v] of baseGraph.edges.entries()) {
            dynEdges.set(k, [...v]);
        }

        // Inject temporary origin node
        dynNodes.set('ORIGIN_GPS', {
            nodeId: 'ORIGIN_GPS',
            name: originLocation.name || 'Ambulance Current Location',
            latitude: originLocation.latitude,
            longitude: originLocation.longitude,
        });
        dynEdges.set('ORIGIN_GPS', []);

        // Inject temporary destination node
        dynNodes.set('DEST_GPS', {
            nodeId: 'DEST_GPS',
            name: destinationLocation.name || 'Patient Pickup Location',
            latitude: destinationLocation.latitude,
            longitude: destinationLocation.longitude,
        });
        dynEdges.set('DEST_GPS', []);

        const approachSpeedKmph = 25.0; // Local approach speed to/from road segment
        const origApproachTime = (origProj.distanceToSegmentKm / approachSpeedKmph) * 60;
        const destApproachTime = (destProj.distanceToSegmentKm / approachSpeedKmph) * 60;

        // 1. Connect ORIGIN_GPS to road segment nodes
        const segO = origProj.segment;
        const speedO = segO.speedLimitKmph > 0 ? segO.speedLimitKmph : 30.0;
        
        // Forward along segment direction towards endNodeId
        const distToEndO = (1 - origProj.t) * origProj.segmentDistanceKm;
        const timeToEndO = (distToEndO / speedO) * 60;
        dynEdges.get('ORIGIN_GPS').push({
            fromNodeId: 'ORIGIN_GPS',
            toNodeId: origProj.endNodeId,
            distanceKm: origProj.distanceToSegmentKm + distToEndO,
            travelTimeMinutes: origApproachTime + timeToEndO,
        });

        // If two-way, can also head backwards towards startNodeId
        if (!origProj.oneWay) {
            const distToStartO = origProj.t * origProj.segmentDistanceKm;
            const timeToStartO = (distToStartO / speedO) * 60;
            dynEdges.get('ORIGIN_GPS').push({
                fromNodeId: 'ORIGIN_GPS',
                toNodeId: origProj.startNodeId,
                distanceKm: origProj.distanceToSegmentKm + distToStartO,
                travelTimeMinutes: origApproachTime + timeToStartO,
            });
        }

        // 2. Connect road network nodes to DEST_GPS
        const segD = destProj.segment;
        const speedD = segD.speedLimitKmph > 0 ? segD.speedLimitKmph : 30.0;

        // Arriving from startNodeId towards destination
        const distFromStartD = destProj.t * destProj.segmentDistanceKm;
        const timeFromStartD = (distFromStartD / speedD) * 60;
        if (!dynEdges.has(destProj.startNodeId)) dynEdges.set(destProj.startNodeId, []);
        dynEdges.get(destProj.startNodeId).push({
            fromNodeId: destProj.startNodeId,
            toNodeId: 'DEST_GPS',
            distanceKm: distFromStartD + destProj.distanceToSegmentKm,
            travelTimeMinutes: timeFromStartD + destApproachTime,
        });

        // If two-way, can also arrive from endNodeId
        if (!destProj.oneWay) {
            const distFromEndD = (1 - destProj.t) * destProj.segmentDistanceKm;
            const timeFromEndD = (distFromEndD / speedD) * 60;
            if (!dynEdges.has(destProj.endNodeId)) dynEdges.set(destProj.endNodeId, []);
            dynEdges.get(destProj.endNodeId).push({
                fromNodeId: destProj.endNodeId,
                toNodeId: 'DEST_GPS',
                distanceKm: distFromEndD + destProj.distanceToSegmentKm,
                travelTimeMinutes: timeFromEndD + destApproachTime,
            });
        }

        // 3. Same-segment direct connection if feasible
        if (origProj.segmentId === destProj.segmentId) {
            const canDirect = !origProj.oneWay || destProj.t >= origProj.t;
            if (canDirect) {
                const directDist = Math.abs(destProj.t - origProj.t) * origProj.segmentDistanceKm;
                const directTime = (directDist / speedO) * 60;
                dynEdges.get('ORIGIN_GPS').push({
                    fromNodeId: 'ORIGIN_GPS',
                    toNodeId: 'DEST_GPS',
                    distanceKm: origProj.distanceToSegmentKm + directDist + destProj.distanceToSegmentKm,
                    travelTimeMinutes: origApproachTime + directTime + destApproachTime,
                });
            }
        }

        const dynamicGraph = {
            getNode: (id) => dynNodes.get(id),
            getNeighbors: (id) => dynEdges.get(id) || [],
            getGraph: () => ({ nodes: dynNodes, edges: dynEdges }),
        };

        return { dynamicGraph, origProj, destProj };
    }

    /**
     * Validates route geometry ensuring continuity, non-NaN values, bounding box, and proximity to endpoints.
     */
    validateRouteGeometry(route, source, destination) {
        if (!route || !Array.isArray(route.waypoints) || route.waypoints.length < 2) {
            return { valid: false, reason: 'Route contains less than 2 waypoints' };
        }
        const first = route.waypoints[0];
        const last = route.waypoints[route.waypoints.length - 1];
        if (isNaN(first.latitude) || isNaN(first.longitude) || isNaN(last.latitude) || isNaN(last.longitude)) {
            return { valid: false, reason: 'NaN coordinate detected in route geometry' };
        }
        if (first.latitude < 12.0 || first.latitude > 14.0 || first.longitude < 79.0 || first.longitude > 81.0) {
            return { valid: false, reason: 'First coordinate outside valid Chennai latitude/longitude bounds' };
        }
        if (last.latitude < 12.0 || last.latitude > 14.0 || last.longitude < 79.0 || last.longitude > 81.0) {
            return { valid: false, reason: 'Last coordinate outside valid Chennai latitude/longitude bounds' };
        }

        const toRad = (deg) => (deg * Math.PI) / 180;
        const calcDistKm = (p1, p2) => {
            const R = 6371;
            const dLat = toRad(p2.latitude - p1.latitude);
            const dLng = toRad(p2.longitude - p1.longitude);
            const a = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(p1.latitude)) * Math.cos(toRad(p2.latitude)) * Math.sin(dLng / 2) ** 2;
            return 2 * R * Math.asin(Math.sqrt(a));
        };

        if (source && typeof source.latitude === 'number' && typeof source.longitude === 'number') {
            const dSource = calcDistKm(first, source);
            if (dSource > 2.0) {
                return { valid: false, reason: `First coordinate is ${dSource.toFixed(2)} km from source (> 2.0 km tolerance)` };
            }
        }
        if (destination && typeof destination.latitude === 'number' && typeof destination.longitude === 'number') {
            const dDest = calcDistKm(last, destination);
            if (dDest > 2.0) {
                return { valid: false, reason: `Last coordinate is ${dDest.toFixed(2)} km from destination (> 2.0 km tolerance)` };
            }
        }
        return { valid: true, reason: 'OK' };
    }

    /**
     * Calculates the shortest dynamic route between arbitrary origin and destination coordinates.
     */
    findDynamicRoute(originLocation, destinationLocation, options = {}) {
        const { dynamicGraph, origProj, destProj } = this.buildDynamicGraph(originLocation, destinationLocation);
        const route = this.findShortestRoute('ORIGIN_GPS', 'DEST_GPS', new Map(), dynamicGraph);
        const validation = this.validateRouteGeometry(route, originLocation, destinationLocation);
        return {
            ...route,
            distanceKm: route.distanceKm,
            estimatedTimeMin: Math.max(1, Math.round(route.travelTimeMinutes * 10) / 10),
            edgeCount: Math.max(1, (route.nodeIds?.length || 1) - 1),
            trafficExposure: route.travelTimeMinutes > (route.distanceKm * 1.5) ? 'High' : (route.travelTimeMinutes > (route.distanceKm * 1.2) ? 'Moderate' : 'Low'),
            routeNodeIds: route.nodeIds,
            routeCoordinates: route.waypoints.map(w => ({ latitude: w.latitude, longitude: w.longitude })),
            validation,
            originSegment: origProj,
            destinationSegment: destProj,
            originLocation,
            destinationLocation,
        };
    }

    /**
     * Calculates primary and genuine alternative routes between arbitrary origin and destination coordinates.
     */
    findDynamicMultiRoutes(originLocation, destinationLocation, options = {}) {
        const { dynamicGraph, origProj, destProj } = this.buildDynamicGraph(originLocation, destinationLocation);
        const multi = this.findMultiRoutes('ORIGIN_GPS', 'DEST_GPS', 2, dynamicGraph);
        const enrich = (r) => ({
            ...r,
            distanceKm: r.distanceKm,
            estimatedTimeMin: Math.max(1, Math.round(r.travelTimeMinutes * 10) / 10),
            edgeCount: Math.max(1, (r.nodeIds?.length || 1) - 1),
            trafficExposure: r.travelTimeMinutes > (r.distanceKm * 1.5) ? 'High' : (r.travelTimeMinutes > (r.distanceKm * 1.2) ? 'Moderate' : 'Low'),
            routeNodeIds: r.nodeIds,
            routeCoordinates: r.waypoints.map(w => ({ latitude: w.latitude, longitude: w.longitude })),
            validation: this.validateRouteGeometry(r, originLocation, destinationLocation),
        });
        const enrichedPrimary = enrich(multi.primaryRoute);
        const enrichedAlts = (multi.alternativeRoutes || []).map(enrich);
        return {
            ...multi,
            primaryRoute: enrichedPrimary,
            alternativeRoutes: enrichedAlts,
            candidateRoutes: [enrichedPrimary, ...enrichedAlts],
            originSegment: origProj,
            destinationSegment: destProj,
            originLocation,
            destinationLocation,
        };
    }

    /**
     * Baseline shortest-distance route.
     *
     * Selection deliberately ignores congestion (the baseline's policy), but
     * its ETA is evaluated using the same live traffic as the optimized route.
     * This makes the experiment a like-for-like response-time comparison:
     * shortest distance versus traffic-aware routing, not free-flow versus
     * congested travel.
     */
    findBaselineRoute(startNodeId, destinationNodeId, graphOverride = this.graph) {
        if (!graphOverride.getNode(startNodeId)) {
            throw new Error(`Start node ${startNodeId} does not exist`);
        }
        if (!graphOverride.getNode(destinationNodeId)) {
            throw new Error(`Destination node ${destinationNodeId} does not exist`);
        }

        const distances = new Map();
        const previousNodes = new Map();
        const visited = new Set();

        for (const nodeId of graphOverride.getGraph().nodes.keys()) {
            distances.set(nodeId, Infinity);
            previousNodes.set(nodeId, null);
        }

        distances.set(startNodeId, 0);

        while (visited.size < graphOverride.getGraph().nodes.size) {
            const currentNode = this.getUnvisitedNodeWithSmallestDistance(distances, visited);
            if (!currentNode) break;
            if (currentNode === destinationNodeId) break;

            visited.add(currentNode);
            const neighbors = graphOverride.getNeighbors(currentNode);

            for (const edge of neighbors) {
                if (visited.has(edge.toNodeId)) continue;

                const currentDistance = distances.get(currentNode) ?? Infinity;
                const newDistance = currentDistance + (edge.distanceKm || 1.0);
                const knownDistance = distances.get(edge.toNodeId) ?? Infinity;

                if (newDistance < knownDistance) {
                    distances.set(edge.toNodeId, newDistance);
                    previousNodes.set(edge.toNodeId, currentNode);
                }
            }
        }

        const destinationDistance = distances.get(destinationNodeId) ?? Infinity;
        if (destinationDistance === Infinity) {
            throw new Error(`No baseline route found from ${startNodeId} to ${destinationNodeId}`);
        }

        const nodeIds = this.reconstructPath(startNodeId, destinationNodeId, previousNodes);
        const distanceKm = Math.round(destinationDistance * 100) / 100;

        let freeFlowTravelTimeMinutes = 0;
        let travelTimeMinutes = 0;
        for (let i = 0; i < nodeIds.length - 1; i++) {
            const u = nodeIds[i];
            const v = nodeIds[i + 1];
            const edge = graphOverride.getNeighbors(u).find(e => e.toNodeId === v);
            if (edge) {
                freeFlowTravelTimeMinutes += edge.travelTimeMinutes;
                travelTimeMinutes += this.traffic.getAdjustedTravelTime(
                    edge.travelTimeMinutes,
                    edge.fromNodeId,
                    edge.toNodeId
                );
            }
        }
        travelTimeMinutes = Math.round(travelTimeMinutes * 10) / 10;
        freeFlowTravelTimeMinutes = Math.round(freeFlowTravelTimeMinutes * 10) / 10;

        const waypoints = nodeIds.map(nodeId => {
            const node = graphOverride.getNode(nodeId);
            return {
                nodeId,
                name: node?.name || nodeId,
                latitude: node?.latitude || 0,
                longitude: node?.longitude || 0,
            };
        });

        return {
            routeId: 'ROUTE-BASELINE',
            label: 'Baseline Route (Shortest Distance)',
            isBaseline: true,
            nodeIds,
            distanceKm,
            travelTimeMinutes: Math.max(1, travelTimeMinutes),
            freeFlowTravelTimeMinutes: Math.max(1, freeFlowTravelTimeMinutes),
            waypoints,
        };
    }

    /**
     * Calculates baseline route between arbitrary origin and destination coordinates.
     */
    findDynamicBaselineRoute(originLocation, destinationLocation) {
        const { dynamicGraph, origProj, destProj } = this.buildDynamicGraph(originLocation, destinationLocation);
        const route = this.findBaselineRoute('ORIGIN_GPS', 'DEST_GPS', dynamicGraph);
        const validation = this.validateRouteGeometry(route, originLocation, destinationLocation);
        return {
            ...route,
            distanceKm: route.distanceKm,
            estimatedTimeMin: Math.max(1, Math.round(route.travelTimeMinutes * 10) / 10),
            edgeCount: Math.max(1, (route.nodeIds?.length || 1) - 1),
            trafficExposure: route.travelTimeMinutes > (route.distanceKm * 1.5) ? 'High' : (route.travelTimeMinutes > (route.distanceKm * 1.2) ? 'Moderate' : 'Low'),
            routeNodeIds: route.nodeIds,
            routeCoordinates: route.waypoints.map(w => ({ latitude: w.latitude, longitude: w.longitude })),
            validation,
            originSegment: origProj,
            destinationSegment: destProj,
            originLocation,
            destinationLocation,
        };
    }


    getUnvisitedNodeWithSmallestDistance(distances, visited) {
        let smallestNode = null;
        let smallestDistance = Infinity;
        for (const [nodeId, distance] of distances.entries()) {
            if (visited.has(nodeId)) continue;
            if (distance < smallestDistance) {
                smallestDistance = distance;
                smallestNode = nodeId;
            }
        }
        return smallestNode;
    }

    reconstructPath(startNodeId, destinationNodeId, previousNodes) {
        const path = [];
        let currentNode = destinationNodeId;
        while (currentNode !== null) {
            path.unshift(currentNode);
            if (currentNode === startNodeId) break;
            currentNode = previousNodes.get(currentNode) ?? null;
        }
        return path;
    }

    calculateRouteDistance(nodeIds, graphOverride = this.graph) {
        let totalDistance = 0;
        for (let i = 0; i < nodeIds.length - 1; i++) {
            const fromNode = nodeIds[i];
            const toNode = nodeIds[i + 1];
            const edge = graphOverride
                .getNeighbors(fromNode)
                .find((candidate) => candidate.toNodeId === toNode);
            if (!edge) {
                throw new Error(`Road edge ${fromNode} → ${toNode} does not exist`);
            }
            totalDistance += edge.distanceKm;
        }
        return Math.round(totalDistance * 100) / 100;
    }
}
exports.DijkstraService = DijkstraService;
