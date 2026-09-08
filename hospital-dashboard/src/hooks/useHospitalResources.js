import { useState, useEffect, useCallback } from 'react';
import hospitalApi from '../services/hospitalApi';
import socketService from '../services/socketService';
import { SOCKET_EVENTS } from '../constants/socketEvents';
import { validateResourceCounts } from '../utils/validators';

export function useHospitalResources(hospitalId) {
  const [resources, setResources] = useState({
    generalBeds: 0,
    totalGeneralBeds: 25,
    icuBeds: 0,
    totalIcuBeds: 8,
    ventilators: 0,
    totalVentilators: 5,
    updatedAt: null,
  });
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState(null);
  const [successMessage, setSuccessMessage] = useState(null);

  const fetchResources = useCallback(async () => {
    if (!hospitalId) return;
    setIsLoading(true);
    setError(null);
    try {
      const data = await hospitalApi.getResources(hospitalId);
      setResources((prev) => ({
        ...prev,
        ...data,
      }));
    } catch (err) {
      if (import.meta.env?.DEV) console.error('Failed to load hospital resources:', err);
      setError(err.message || 'Unable to load resource counts.');
    } finally {
      setIsLoading(false);
    }
  }, [hospitalId]);

  useEffect(() => {
    fetchResources();
  }, [fetchResources]);

  // Real-time WebSocket synchronization for resource changes & reconnect recovery
  useEffect(() => {
    if (!hospitalId) return;

    const handleResourceUpdate = (payload) => {
      if (!payload) return;
      if (
        !payload.hospitalId ||
        payload.hospitalId === hospitalId ||
        payload.hospitalId === 'HOSP-01' ||
        payload.hospitalId === 'H01'
      ) {
        setResources((prev) => ({
          ...prev,
          generalBeds: payload.generalBeds !== undefined ? Number(payload.generalBeds) : prev.generalBeds,
          icuBeds: payload.icuBeds !== undefined ? Number(payload.icuBeds) : prev.icuBeds,
          ventilators: payload.ventilators !== undefined ? Number(payload.ventilators) : prev.ventilators,
          totalGeneralBeds: payload.totalGeneralBeds !== undefined ? Number(payload.totalGeneralBeds) : prev.totalGeneralBeds,
          totalIcuBeds: payload.totalIcuBeds !== undefined ? Number(payload.totalIcuBeds) : prev.totalIcuBeds,
          totalVentilators: payload.totalVentilators !== undefined ? Number(payload.totalVentilators) : prev.totalVentilators,
          updatedAt: payload.updatedAt || new Date().toISOString(),
        }));
      }
    };

    socketService.on(SOCKET_EVENTS.HOSPITAL_RESOURCES_UPDATED, handleResourceUpdate);
    socketService.on(SOCKET_EVENTS.RESOURCES_UPDATED, handleResourceUpdate);

    const unsubscribeReconnect = socketService.onReconnect(() => {
      fetchResources();
    });

    return () => {
      socketService.off(SOCKET_EVENTS.HOSPITAL_RESOURCES_UPDATED, handleResourceUpdate);
      socketService.off(SOCKET_EVENTS.RESOURCES_UPDATED, handleResourceUpdate);
      unsubscribeReconnect();
    };
  }, [hospitalId, fetchResources]);

  const updateResources = useCallback(
    async (newCounts) => {
      const validation = validateResourceCounts(newCounts);
      if (!validation.isValid) {
        return { success: false, errors: validation.errors };
      }

      setIsSaving(true);
      setError(null);
      setSuccessMessage(null);

      // Snapshot previous state for rollback
      const previousState = { ...resources };

      // Optimistic update
      const optimisticUpdate = {
        ...resources,
        generalBeds: Number(newCounts.generalBeds),
        icuBeds: Number(newCounts.icuBeds),
        ventilators: Number(newCounts.ventilators),
        updatedAt: new Date().toISOString(),
      };
      setResources(optimisticUpdate);

      try {
        const response = await hospitalApi.updateResources(hospitalId, {
          generalBeds: Number(newCounts.generalBeds),
          icuBeds: Number(newCounts.icuBeds),
          ventilators: Number(newCounts.ventilators),
        });

        setResources((prev) => ({
          ...prev,
          ...response,
        }));

        setSuccessMessage('Hospital resource availability updated successfully.');
        setTimeout(() => setSuccessMessage(null), 4000);
        return { success: true };
      } catch (err) {
        // Rollback on failure
        setResources(previousState);
        setError(err.message || 'Failed to persist resource update. Retaining previous counts.');
        return { success: false, error: err.message };
      } finally {
        setIsSaving(false);
      }
    },
    [hospitalId, resources]
  );

  return {
    resources,
    isLoading,
    isSaving,
    error,
    successMessage,
    refetch: fetchResources,
    updateResources,
  };
}

export default useHospitalResources;
