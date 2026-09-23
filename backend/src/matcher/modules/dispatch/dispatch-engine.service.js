"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.DispatchEngineService = void 0;
class DispatchEngineService {
    constructor(candidateFilterService, etaService, scoringService, dijkstraService) {
        this.candidateFilterService = candidateFilterService;
        this.etaService = etaService;
        this.scoringService = scoringService;
        this.dijkstraService = dijkstraService;
    }
    dispatch(request, ambulances, searchRadiusKm, excludedAmbulanceIds = new Set()) {
        // 1. Filter available ambulance candidates
        const candidates = this.candidateFilterService.filterCandidates(ambulances, request.pickupLocation, searchRadiusKm, excludedAmbulanceIds);
        if (candidates.length === 0) {
            throw new Error("NO_AMBULANCE_AVAILABLE");
        }
        // 2. Calculate ETA and route for every candidate
        const candidateData = candidates.map((ambulance) => {
            const eta = this.etaService.calculateETA(request.requestId, ambulance.ambulanceId, ambulance.currentLocation, request.pickupLocation);
            return {
                ambulance,
                eta
            };
        });
        // 3. Find maximum values for normalization
        const maxTravelTime = Math.max(...candidateData.map((candidate) => candidate.eta.route.travelTimeMinutes || candidate.eta.estimatedMinutes), 1);
        const maxDistance = Math.max(...candidateData.map((candidate) => candidate.eta.route.distanceKm), 1);
        // 4. Calculate traffic cost (min/km, normalized for short approach distances)
        const trafficCosts = candidateData.map((candidate) => {
            const route = candidate.eta.route;
            if (route.distanceKm <= 2.0) {
                return 1.0;
            }
            return (route.travelTimeMinutes /
                route.distanceKm);
        });
        const maxTrafficCost = Math.max(...trafficCosts, 1.0);
        // Availability penalty
        // Candidates have already been filtered
        // to AVAILABLE status.
        const maxAvailabilityPenalty = 1;
        // 5. Calculate score for every candidate
        const scoredCandidates = candidateData.map((candidate, index) => {
            const scoreInput = {
                travelTimeMinutes: candidate.eta.route.travelTimeMinutes || candidate.eta.estimatedMinutes,
                distanceKm: candidate.eta.route.distanceKm,
                trafficCost: trafficCosts[index],
                availabilityPenalty: 0
            };
            const score = this.scoringService.calculateScore(scoreInput, {
                maxTravelTime,
                maxDistance,
                maxTrafficCost,
                maxAvailabilityPenalty
            });
            return {
                ambulance: candidate.ambulance,
                eta: candidate.eta,
                score
            };
        });
        // 6. Rank candidates
        // Lower score = better candidate
        scoredCandidates.sort((a, b) => a.score.totalScore -
            b.score.totalScore);
        // 7. Select best candidate
        const bestCandidate = scoredCandidates[0];
        if (!bestCandidate) {
            throw new Error("NO_AMBULANCE_AVAILABLE");
        }

        const candidateSummary = scoredCandidates.map((c, idx) => ({
            ambulanceId: c.ambulance.ambulanceId,
            rank: idx + 1,
            distanceKm: c.eta.route.distanceKm,
            estimatedMinutes: c.eta.estimatedMinutes,
            cost: Math.round(c.score.totalScore * 1000) / 1000,
            score: Math.round(c.score.totalScore * 1000) / 1000,
            costBreakdown: c.score,
            scoreBreakdown: c.score,
            status: idx === 0 ? 'SELECTED' : 'REJECTED',
            rejectionReason: idx === 0 ? null : (c.score.travelTimeScore > bestCandidate.score.travelTimeScore ? 'Higher Travel Time' : 'Higher Weighted Cost')
        }));

        let decisionReason = `${bestCandidate.ambulance.ambulanceId} selected as optimal responder with lowest multi-factor dispatch cost (${(bestCandidate.score.totalScore).toFixed(3)}) and estimated ETA of ${bestCandidate.eta.estimatedMinutes} min.`;
        if (scoredCandidates.length > 1) {
            const runnerUp = scoredCandidates[1];
            if (runnerUp.eta.route.distanceKm < bestCandidate.eta.route.distanceKm) {
                decisionReason += ` Although ${runnerUp.ambulance.ambulanceId} was closer (${runnerUp.eta.route.distanceKm} km vs ${bestCandidate.eta.route.distanceKm} km), ${bestCandidate.ambulance.ambulanceId} was preferred due to faster traffic-adjusted travel time (${bestCandidate.eta.estimatedMinutes} min vs ${runnerUp.eta.estimatedMinutes} min).`;
            }
        }

        // 9. Compute baseline comparison (nearest ambulance + shortest-distance route)
        let baselineRoute = null;
        let baselineEta = null;
        let baselineDistance = null;
        let baselineAmbulanceId = null;
        let etaImprovementPct = null;

        try {
            // Find geographically nearest ambulance (baseline: no traffic awareness)
            const toRad = (deg) => (deg * Math.PI) / 180;
            const haversineDist = (from, to) => {
                const R = 6371;
                const dLat = toRad(to.latitude - from.latitude);
                const dLng = toRad(to.longitude - from.longitude);
                const a = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(from.latitude)) * Math.cos(toRad(to.latitude)) * Math.sin(dLng / 2) ** 2;
                return 2 * R * Math.asin(Math.sqrt(a));
            };

            // Find nearest among all eligible candidates
            let nearestCandidate = null;
            let nearestDist = Infinity;
            for (const cd of candidateData) {
                const d = haversineDist(cd.ambulance.currentLocation, request.pickupLocation);
                if (d < nearestDist) {
                    nearestDist = d;
                    nearestCandidate = cd;
                }
            }

            if (nearestCandidate) {
                baselineAmbulanceId = nearestCandidate.ambulance.ambulanceId;
                // Compute the nearest ambulance's shortest-distance route without traffic weighting.
                const route = this.dijkstraService.findDynamicBaselineRoute(
                    nearestCandidate.ambulance.currentLocation,
                    request.pickupLocation
                );
                baselineEta = Math.max(1, Math.round(route.travelTimeMinutes));
                baselineDistance = route.distanceKm;
                baselineRoute = route;

                // If nearest is different from selected, compute improvement
                if (baselineAmbulanceId !== bestCandidate.ambulance.ambulanceId) {
                    etaImprovementPct = Math.round(
                        ((baselineEta - bestCandidate.eta.estimatedMinutes) / Math.max(1, baselineEta)) * 100 * 10
                    ) / 10;
                    decisionReason += ` Baseline (nearest ambulance ${baselineAmbulanceId}) would take ${baselineEta} min; UyirKappan saves ${Math.abs(baselineEta - bestCandidate.eta.estimatedMinutes).toFixed(1)} min (${Math.abs(etaImprovementPct)}% improvement).`;
                } else {
                    // Same ambulance but may have different routing
                    etaImprovementPct = 0;
                    decisionReason += ` Nearest ambulance is also the traffic-optimized choice.`;
                }
            }
        } catch (baselineErr) {
            // Baseline comparison is non-critical
            console.warn('[Dispatch] Baseline comparison failed:', baselineErr.message);
        }

        // 10. Create dispatch decision
        return {
            requestId: request.requestId,
            selectedAmbulanceId: bestCandidate.ambulance.ambulanceId,
            pickupLocation: request.pickupLocation,
            estimatedTravelTime: bestCandidate.eta.estimatedMinutes,
            route: bestCandidate.eta.route,
            alternativeRoutes: bestCandidate.eta.alternativeRoutes || [],
            candidateRoutes: bestCandidate.eta.candidateRoutes || [],
            distance: bestCandidate.eta.route.distanceKm,
            cost: bestCandidate.score.totalScore,
            score: bestCandidate.score.totalScore,
            costBreakdown: bestCandidate.score,
            scoreBreakdown: bestCandidate.score,
            decisionReason,
            candidates: candidateSummary,
            baselineRoute,
            baselineEta,
            baselineDistance,
            baselineAmbulanceId,
            etaImprovementPct,
            generatedAt: new Date()
        };
    }
}
exports.DispatchEngineService = DispatchEngineService;
