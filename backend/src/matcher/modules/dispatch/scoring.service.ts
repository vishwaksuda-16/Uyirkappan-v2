export interface ScoringWeights {
  travelTime: number;
  distance: number;
  traffic: number;
  availability: number;
}

export interface CandidateScoreInput {
  travelTimeMinutes: number;
  distanceKm: number;
  trafficCost: number;
  availabilityPenalty: number;
}

export interface CandidateScoreResult {
  travelTimeScore: number;
  distanceScore: number;
  trafficScore: number;
  availabilityScore: number;
  totalScore: number;
}

export class ScoringService {
  constructor(
    private readonly weights: ScoringWeights = {
      travelTime: 0.50,
      distance: 0.20,
      traffic: 0.20,
      availability: 0.10
    }
  ) {}

  calculateScore(
    candidate: CandidateScoreInput,
    normalization: {
      maxTravelTime: number;
      maxDistance: number;
      maxTrafficCost: number;
      maxAvailabilityPenalty: number;
    }
  ): CandidateScoreResult {
    const travelTimeScore =
      this.normalize(
        candidate.travelTimeMinutes,
        normalization.maxTravelTime
      );

    const distanceScore =
      this.normalize(
        candidate.distanceKm,
        normalization.maxDistance
      );

    const trafficScore =
      this.normalize(
        candidate.trafficCost,
        normalization.maxTrafficCost
      );

    const availabilityScore =
      this.normalize(
        candidate.availabilityPenalty,
        normalization.maxAvailabilityPenalty
      );

    const totalScore =
      this.weights.travelTime * travelTimeScore +
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

  private normalize(
    value: number,
    maximum: number
  ): number {
    if (maximum <= 0) {
      return 0;
    }

    return value / maximum;
  }
}