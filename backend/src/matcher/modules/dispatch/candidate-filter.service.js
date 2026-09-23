"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.CandidateFilterService = void 0;
class CandidateFilterService {
    filterCandidates(ambulances, emergencyLocation, searchRadiusKm, excludedAmbulanceIds = new Set()) {
        return ambulances.filter((ambulance) => {
            if (!ambulance || !ambulance.currentLocation || !emergencyLocation) {
                return false;
            }

            const availabilityStatus = ambulance.availabilityStatus || ambulance.status || 'OFFLINE';
            // 1. Ambulance must be available
            if (availabilityStatus !== "AVAILABLE") {
                return false;
            }
            // 2. Ambulance must not have failed for this request
            if (excludedAmbulanceIds.has(ambulance.ambulanceId || ambulance.id)) {
                return false;
            }
            // 3. Ambulance must be within configured search radius
            const distance = this.calculateDistance(ambulance.currentLocation, emergencyLocation);
            return distance <= searchRadiusKm;
        });
    }
    calculateDistance(location1, location2) {
        const earthRadiusKm = 6371;
        const lat1 = this.toRadians(location1.latitude);
        const lat2 = this.toRadians(location2.latitude);
        const deltaLat = this.toRadians(location2.latitude - location1.latitude);
        const deltaLon = this.toRadians(location2.longitude - location1.longitude);
        const a = Math.sin(deltaLat / 2) ** 2 +
            Math.cos(lat1) *
                Math.cos(lat2) *
                Math.sin(deltaLon / 2) ** 2;
        const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
        return earthRadiusKm * c;
    }
    toRadians(degrees) {
        return degrees * (Math.PI / 180);
    }
}
exports.CandidateFilterService = CandidateFilterService;
