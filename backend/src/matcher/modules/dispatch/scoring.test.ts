import {
  ScoringService,
  CandidateScoreInput
} from "./scoring.service.js";

const scoringService = new ScoringService();

const candidateA: CandidateScoreInput = {
  travelTimeMinutes: 5,
  distanceKm: 0.7,
  trafficCost: 1.0,
  availabilityPenalty: 0
};

const candidateB: CandidateScoreInput = {
  travelTimeMinutes: 10,
  distanceKm: 1.2,
  trafficCost: 2.0,
  availabilityPenalty: 0
};

const normalization = {
  maxTravelTime: 10,
  maxDistance: 1.2,
  maxTrafficCost: 2.0,
  maxAvailabilityPenalty: 1
};

const scoreA =
  scoringService.calculateScore(
    candidateA,
    normalization
  );

const scoreB =
  scoringService.calculateScore(
    candidateB,
    normalization
  );

console.log("=== Dispatch Scoring Test ===");

console.log("\nCandidate A:");
console.log(scoreA);

console.log("\nCandidate B:");
console.log(scoreB);

console.log("\nBest candidate:");

if (scoreA.totalScore < scoreB.totalScore) {
  console.log("Candidate A");
} else {
  console.log("Candidate B");
}

console.log("\n=== Test completed ===");