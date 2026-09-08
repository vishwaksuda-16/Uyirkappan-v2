import apiClient from './api.js';
import { API_ENDPOINTS } from '../constants/apiEndpoints.js';

export const hospitalApi = {
  /**
   * Fetch hospital profile and operational details
   * GET /api/hospitals/:id
   */
  async getHospital(hospitalId) {
    const data = await apiClient.get(API_ENDPOINTS.HOSPITAL_DETAILS(hospitalId));
    return data;
  },

  /**
   * Fetch active incoming emergencies routed to this hospital
   * GET /api/hospitals/:id/incoming
   */
  async getIncomingEmergencies(hospitalId) {
    const data = await apiClient.get(API_ENDPOINTS.HOSPITAL_INCOMING(hospitalId));
    return Array.isArray(data) ? data : (data?.incoming || data?.data || []);
  },

  /**
   * Fetch current bed and ventilator resource counts
   * GET /api/hospitals/:id/resources
   */
  async getResources(hospitalId) {
    const data = await apiClient.get(API_ENDPOINTS.HOSPITAL_RESOURCES(hospitalId));
    // Backend wraps: { success: true, resources: { generalBeds, icuBeds, ventilators } }
    return data?.resources || data;
  },

  /**
   * Update hospital resource availability (General beds, ICU beds, Ventilators)
   * PATCH /api/hospitals/:id/resources
   */
  async updateResources(hospitalId, payload) {
    const formattedPayload = {
      generalBeds: Number(payload.generalBeds),
      icuBeds: Number(payload.icuBeds),
      ventilators: Number(payload.ventilators),
    };

    const data = await apiClient.patch(API_ENDPOINTS.HOSPITAL_RESOURCES(hospitalId), formattedPayload);
    // Backend wraps PATCH: { success: true, hospital: { resources: { generalBeds, icuBeds, ventilators } } }
    return data?.hospital?.resources || data?.resources || data;
  },

  /**
   * Fetch historical emergency cases treated at this hospital
   * GET /api/hospitals/:id/emergency-history
   */
  async getEmergencyHistory(hospitalId, params = {}) {
    const data = await apiClient.get(API_ENDPOINTS.HOSPITAL_HISTORY(hospitalId), { params });
    return Array.isArray(data) ? data : (data?.history || data?.data || []);
  },
};

export default hospitalApi;
