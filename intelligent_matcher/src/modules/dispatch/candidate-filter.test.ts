import { CandidateFilterService } from "./candidate-filter.service.js";
import { Ambulance } from "./dispatch.types.js";

const filterService = new CandidateFilterService();

const ambulances: Ambulance[] = [
  {
    ambulanceId: "A1",
    currentLocation: {
      latitude: 13.0827,
      longitude: 80.2707
    },
    availabilityStatus: "AVAILABLE",
    driverId: "D1",
    capabilities: ["BASIC"]
  },

  {
    ambulanceId: "A2",
    currentLocation: {
      latitude: 13.0850,
      longitude: 80.2750
    },
    availabilityStatus: "BUSY",
    driverId: "D2",
    capabilities: ["ICU"]
  },

  {
    ambulanceId: "A3",
    currentLocation: {
      latitude: 13.0880,
      longitude: 80.2800
    },
    availabilityStatus: "AVAILABLE",
    driverId: "D3",
    capabilities: ["BASIC"]
  },

  {
    ambulanceId: "A4",
    currentLocation: {
      latitude: 13.0780,
      longitude: 13.2680
    },
    availabilityStatus: "OFFLINE",
    driverId: "D4",
    capabilities: ["ICU"]
  }
];

const emergencyLocation = {
  latitude: 13.0820,
  longitude: 80.2710
};

const candidates = filterService.filterCandidates(
  ambulances,
  emergencyLocation,
  5
);

console.log("Available candidates:");

for (const ambulance of candidates) {
  console.log(ambulance.ambulanceId);
}