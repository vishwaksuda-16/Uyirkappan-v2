import {
  Ambulance,
  Location
} from "./dispatch.types.js";

export class CandidateFilterService {
  filterCandidates(
    ambulances: Ambulance[],
    emergencyLocation: Location,
    searchRadiusKm: number,
    excludedAmbulanceIds: Set<string> = new Set()
  ): Ambulance[] {
    return ambulances.filter((ambulance) => {
      // 1. Ambulance must be available
      if (ambulance.availabilityStatus !== "AVAILABLE") {
        return false;
      }

      // 2. Ambulance must not have failed for this request
      if (excludedAmbulanceIds.has(ambulance.ambulanceId)) {
        return false;
      }

      // 3. Ambulance must be within configured search radius
      const distance = this.calculateDistance(
        ambulance.currentLocation,
        emergencyLocation
      );

      return distance <= searchRadiusKm;
    });
  }

  private calculateDistance(
    location1: Location,
    location2: Location
  ): number {
    const earthRadiusKm = 6371;

    const lat1 = this.toRadians(location1.latitude);
    const lat2 = this.toRadians(location2.latitude);

    const deltaLat = this.toRadians(
      location2.latitude - location1.latitude
    );

    const deltaLon = this.toRadians(
      location2.longitude - location1.longitude
    );

    const a =
      Math.sin(deltaLat / 2) ** 2 +
      Math.cos(lat1) *
        Math.cos(lat2) *
        Math.sin(deltaLon / 2) ** 2;

    const c =
      2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

    return earthRadiusKm * c;
  }

  private toRadians(degrees: number): number {
    return degrees * (Math.PI / 180);
  }
}