import apiClient from './api.js';
import { API_ENDPOINTS } from '../constants/apiEndpoints.js';

export const emergencyApi = {
  /**
   * Fetch full operational details of a specific emergency
   * GET /api/emergency/:requestId
   */
  async getEmergencyDetails(requestId) {
    const data = await apiClient.get(API_ENDPOINTS.EMERGENCY_DETAILS(requestId));
    return data?.request || data;
  },

  /**
   * Fetch live ambulance telemetry, coordinates, and route
   * GET /api/emergency/:requestId/tracking
   */
  async getEmergencyTracking(requestId) {
    const data = await apiClient.get(API_ENDPOINTS.EMERGENCY_TRACKING(requestId));
    // Unwrap backend envelope: { success, tracking: {...} }
    const tracking = data?.tracking || data;
    // Normalize location property if provided as currentLocation or flat
    if (tracking && !tracking.location && tracking.currentLocation) {
      tracking.location = {
        latitude: tracking.currentLocation.latitude,
        longitude: tracking.currentLocation.longitude,
      };
    }
    return tracking;
  },

  /**
   * Fetch cascading fallback attempt history for audit trail
   * GET /api/requests/:requestId/attempts
   */
  async getRequestAttempts(requestId) {
    const data = await apiClient.get(API_ENDPOINTS.REQUEST_ATTEMPTS(requestId));
    return Array.isArray(data) ? data : data?.attempts || [];
  },
};

export default emergencyApi;
