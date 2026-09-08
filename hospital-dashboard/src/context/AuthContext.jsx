import { useState, useEffect, useCallback } from 'react';
import apiClient from '../services/api';
import socketService from '../services/socketService';
import { API_ENDPOINTS } from '../constants/apiEndpoints';
import { AuthContext } from './authContextDef';

const STORAGE_TOKEN_KEY = 'uyirkappan_token';
const STORAGE_USER_KEY = 'uyirkappan_user';

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(null);
  const [hospital, setHospital] = useState(null);
  const [isLoading, setIsLoading] = useState(true);

  // Initialize session from storage
  useEffect(() => {
    try {
      const storedToken = localStorage.getItem(STORAGE_TOKEN_KEY);
      const storedUser = localStorage.getItem(STORAGE_USER_KEY);

      if (storedToken && storedUser) {
        const parsedUser = JSON.parse(storedUser);
        setUser(parsedUser);
        setToken(storedToken);

        // Hospital info is embedded in the stored user object from the login response
        setHospital(parsedUser.hospital || null);

        // Initialize socket connection
        socketService.connect(storedToken);
        socketService.subscribeHospital(parsedUser.hospitalId);
      }
    } catch (e) {
      if (import.meta.env?.DEV) console.error('Failed to restore session:', e);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const login = useCallback(async ({ email, password, hospitalId }) => {
    setIsLoading(true);
    try {
      // Attempt production backend authentication: POST /api/auth/login
      const loginPayload = { email, password };
      if (hospitalId) {
        loginPayload.hospitalId = hospitalId;
      }

      const response = await apiClient.post(API_ENDPOINTS.LOGIN, loginPayload);

      const authToken = response.token || response.jwt || response.accessToken || response.data?.token;
      const rawUser = response.user || response.data?.user || response;
      const authUser = {
        id: rawUser.id || rawUser.userId || 'STAFF-001',
        name: rawUser.name || 'Dr. A. Sundaram, MD',
        badgeId: rawUser.badgeId || 'ER-CHIEF-01',
        email: rawUser.email || email,
        role: rawUser.role || 'HOSPITAL_STAFF',
        department: rawUser.department || 'Emergency Medicine',
        hospitalId: rawUser.hospitalId || hospitalId || 'HOSP-01',
        hospitalName: rawUser.hospitalName || 'Apollo Trauma & Emergency Center',
      };

      // Verify Role: Must be HOSPITAL_STAFF
      if (authUser.role !== 'HOSPITAL_STAFF') {
        throw new Error('Access Denied: Account lacks HOSPITAL_STAFF operational role.');
      }

      // Use hospital data from the login response if provided
      const activeHospital = rawUser.hospital || null;

      setUser(authUser);
      setToken(authToken);
      setHospital(activeHospital);

      localStorage.setItem(STORAGE_TOKEN_KEY, authToken);
      localStorage.setItem(STORAGE_USER_KEY, JSON.stringify(authUser));

      // Connect socket & subscribe to this hospital's channel
      socketService.connect(authToken);
      socketService.subscribeHospital(authUser.hospitalId);

      return { success: true, user: authUser };
    } finally {
      setIsLoading(false);
    }
  }, []);

  const logout = useCallback(() => {
    if (user?.hospitalId) {
      socketService.unsubscribeHospital(user.hospitalId);
    }
    socketService.disconnect();

    setUser(null);
    setToken(null);
    setHospital(null);

    localStorage.removeItem(STORAGE_TOKEN_KEY);
    localStorage.removeItem(STORAGE_USER_KEY);
  }, [user]);

  const value = {
    user,
    token,
    hospital,
    isAuthenticated: !!token && !!user,
    isLoading,
    login,
    logout,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export default AuthProvider;
