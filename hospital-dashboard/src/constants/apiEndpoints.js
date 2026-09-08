/**
 * Centralized API Endpoints Configuration
 * Primary Source: Module 3 (Section 24) & Module 6 (Section 34)
 */

export const API_ENDPOINTS = {
  // Authentication
  LOGIN: '/auth/login',
  LOGOUT: '/auth/logout',
  CURRENT_USER: '/auth/me',

  // Hospital Specific Endpoints
  HOSPITAL_DETAILS: (hospitalId) => `/hospitals/${hospitalId}`,
  HOSPITAL_INCOMING: (hospitalId) => `/hospitals/${hospitalId}/incoming`,
  HOSPITAL_RESOURCES: (hospitalId) => `/hospitals/${hospitalId}/resources`,
  HOSPITAL_HISTORY: (hospitalId) => `/hospitals/${hospitalId}/emergency-history`,

  // Emergency Request & Tracking Endpoints
  EMERGENCY_DETAILS: (requestId) => `/emergency/${requestId}`,
  EMERGENCY_TRACKING: (requestId) => `/emergency/${requestId}/tracking`,
  REQUEST_ATTEMPTS: (requestId) => `/requests/${requestId}/attempts`,
  REQUEST_ETA: (requestId) => `/requests/${requestId}/eta`,
};
