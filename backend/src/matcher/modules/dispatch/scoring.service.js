"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ScoringService = void 0;
class ScoringService {
    constructor(weights = {
        travelTime: 0.50,
        distance: 0.20,
        traffic: 0.20,
        availability: 0.10
    }) {
        this.weights = weights;
    }
    calculateScore(candidate, normalization) {
        const travelTimeScore = this.normalize(candidate.travelTimeMinutes, normalization.maxTravelTime);
        const distanceScore = this.normalize(candidate.distanceKm, normalization.maxDistance);
        const trafficScore = this.normalize(candidate.trafficCost, normalization.maxTrafficCost);
        const availabilityScore = this.normalize(candidate.availabilityPenalty, normalization.maxAvailabilityPenalty);
        const totalScore = this.weights.travelTime * travelTimeScore +
            this.weights.distance * distanceScore +
            this.weights.traffic * trafficScore +
            this.weights.availability * availabilityScore;
        return {
            travelTimeScore,
            distanceScore,
            trafficScore,
            availabilityScore,
            totalScore
        };
    }
    normalize(value, maximum) {
        if (maximum <= 0) {
            return 0;
        }
        return value / maximum;
    }
}
exports.ScoringService = ScoringService;
