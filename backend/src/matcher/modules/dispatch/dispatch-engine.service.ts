import {
  Ambulance,
  DispatchDecision,
  EmergencyRequest
} from "./dispatch.types.js";

import { CandidateFilterService } from "./candidate-filter.service.js";

import {
  ScoringService,
  CandidateScoreInput
} from "./scoring.service.js";

import { ETAService } from "../eta/eta.service.js";

export class DispatchEngineService {
  constructor(
    private readonly candidateFilterService: CandidateFilterService,
    private readonly etaService: ETAService,
    private readonly scoringService: ScoringService
  ) {}

  dispatch(
    request: EmergencyRequest,
    ambulances: Ambulance[],
    searchRadiusKm: number,
    excludedAmbulanceIds: Set<string> = new Set()
  ): DispatchDecision {

    // 1. Filter available ambulance candidates
    const candidates =
      this.candidateFilterService.filterCandidates(
        ambulances,
        request.pickupLocation,
        searchRadiusKm,
        excludedAmbulanceIds
      );

    if (candidates.length === 0) {
      throw new Error("NO_AMBULANCE_AVAILABLE");
    }

    // 2. Calculate ETA and route for every candidate
    const candidateData = candidates.map(
      (ambulance) => {
        const eta =
          this.etaService.calculateETA(
            request.requestId,
            ambulance.ambulanceId,
            ambulance.currentLocation,
            request.pickupLocation
          );

        return {
          ambulance,
          eta
        };
      }
    );

    // 3. Find maximum values for normalization
    const maxTravelTime = Math.max(
      ...candidateData.map(
        (candidate) =>
          candidate.eta.estimatedMinutes
      )
    );

    const maxDistance = Math.max(
      ...candidateData.map(
        (candidate) =>
          candidate.eta.route.distanceKm
      )
    );

    // 4. Calculate traffic cost
    const trafficCosts =
      candidateData.map((candidate) => {
        const route = candidate.eta.route;

        if (route.distanceKm <= 0) {
          return 0;
        }

        return (
          route.travelTimeMinutes /
          route.distanceKm
        );
      });

    const maxTrafficCost = Math.max(
      ...trafficCosts
    );

    // Availability penalty
    // Candidates have already been filtered
    // to AVAILABLE status.
    const maxAvailabilityPenalty = 1;

    // 5. Calculate score for every candidate
    const scoredCandidates =
      candidateData.map(
        (candidate, index) => {

          const scoreInput: CandidateScoreInput = {
            travelTimeMinutes:
              candidate.eta.estimatedMinutes,

            distanceKm:
              candidate.eta.route.distanceKm,

            trafficCost:
              trafficCosts[index],

            availabilityPenalty: 0
          };

          const score =
            this.scoringService.calculateScore(
              scoreInput,
              {
                maxTravelTime,
                maxDistance,
                maxTrafficCost,
                maxAvailabilityPenalty
              }
            );

          return {
            ambulance: candidate.ambulance,
            eta: candidate.eta,
            score
          };
        }
      );

    // 6. Rank candidates
    // Lower score = better candidate
    scoredCandidates.sort(
      (a, b) =>
        a.score.totalScore -
        b.score.totalScore
    );

    // 7. Select best candidate
    const bestCandidate =
      scoredCandidates[0];

    if (!bestCandidate) {
      throw new Error(
        "NO_AMBULANCE_AVAILABLE"
      );
    }

    // 8. Create dispatch decision
    return {
      requestId: request.requestId,

      selectedAmbulanceId:
        bestCandidate.ambulance.ambulanceId,

      pickupLocation:
        request.pickupLocation,

      estimatedTravelTime:
        bestCandidate.eta.estimatedMinutes,

      route:
        bestCandidate.eta.route,

      distance:
        bestCandidate.eta.route.distanceKm,

      score:
        bestCandidate.score.totalScore,

      generatedAt: new Date()
    };
  }
}