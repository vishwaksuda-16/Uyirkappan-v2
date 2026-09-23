import { useState, useEffect, useCallback, useContext, useRef } from 'react';
import { AuthContext } from './authContextDef';
import { EmergencyContext } from './emergencyContextDef';
import hospitalApi from '../services/hospitalApi';
import socketService from '../services/socketService';
import { SOCKET_EVENTS } from '../constants/socketEvents';

/**
 * Web Audio synthesizer for alert / alarm chime
 */
function playEmergencyChime() {
  try {
    const AudioCtx = window.AudioContext || window.webkitAudioContext;
    if (!AudioCtx) return;
    const ctx = new AudioCtx();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(880, ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(1046, ctx.currentTime + 0.15);
    gain.gain.setValueAtTime(0.2, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.45);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + 0.45);
  } catch {
    // Audio playback blocked or unsupported in current environment
  }
}

export function EmergencyProvider({ children }) {
  const { user, hospital } = useContext(AuthContext);
  const [emergencies, setEmergencies] = useState([]);
  const [completedEmergencies, setCompletedEmergencies] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  const [notifications, setNotifications] = useState([]);
  const processedEventIds = useRef(new Set());

  const addNotification = useCallback((type, title, message, details = null) => {
    const id = `notif_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`;
    const newNotif = { id, type, title, message, details, timestamp: new Date().toISOString() };
    setNotifications((prev) => [newNotif, ...prev.slice(0, 4)]);

    // Auto-dismiss notification after 8 seconds
    setTimeout(() => {
      setNotifications((prev) => prev.filter((n) => n.id !== id));
    }, 8000);
  }, []);

  const dismissNotification = useCallback((id) => {
    setNotifications((prev) => prev.filter((n) => n.id !== id));
  }, []);

  // Fetch initial active emergencies via REST API: GET /api/hospitals/{hospitalId}/incoming
  const loadEmergencies = useCallback(async () => {
    if (!user?.hospitalId) return;
    setIsLoading(true);
    setError(null);
    try {
      const data = await hospitalApi.getIncomingEmergencies(user.hospitalId);
      const incomingList = Array.isArray(data) ? data : [];
      setEmergencies(incomingList);

      // Join individual emergency rooms for all active incoming requests: emergency:{requestId}
      incomingList.forEach((item) => {
        if (item.requestId) {
          socketService.joinEmergencyRoom(item.requestId);
        }
      });
    } catch (err) {
      if (import.meta.env?.DEV) console.error('Failed to fetch incoming emergencies:', err);
      setError(err.message || 'Unable to load incoming emergencies.');
    } finally {
      setIsLoading(false);
    }
  }, [user?.hospitalId]);

  useEffect(() => {
    loadEmergencies();
  }, [loadEmergencies]);

  // Hook up automatic state refresh on Socket.IO reconnect
  useEffect(() => {
    const unsubscribeReconnect = socketService.onReconnect(() => {
      loadEmergencies();
    });
    return () => unsubscribeReconnect();
  }, [loadEmergencies]);

  // Set up real-time WebSocket event listeners
  useEffect(() => {
    if (!user?.hospitalId) return;

    // 1. EMERGENCY_CREATED & NEW_INCOMING_EMERGENCY
    const handleNewEmergency = (data) => {
      if (!data || !data.requestId) return;

      if (data.eventId) {
        if (processedEventIds.current.has(data.eventId)) return;
        processedEventIds.current.add(data.eventId);
      }

      // Ensure only the selected destination hospital receives the inbound notification
      if (data.hospitalId && data.hospitalId !== user.hospitalId) {
        return;
      }

      setEmergencies((prev) => {
        const exists = prev.some((e) => e.requestId === data.requestId);
        if (exists) return prev;
        return [data, ...prev];
      });

      // Join emergency room: emergency:{requestId}
      socketService.joinEmergencyRoom(data.requestId);

      // Trigger audio alarm chime
      playEmergencyChime();

      // Show notification/alarm
      addNotification(
        'critical',
        '🚨 NEW INCOMING EMERGENCY',
        `${data.emergencyType || 'EMERGENCY'} alert: ${data.victimCount || 1} patient(s) en route via ${data.ambulanceId || 'Ambulance Unit'}. Initial ETA: ${data.eta || '--'} min.`,
        data
      );
    };

    // 2. AMBULANCE_ASSIGNED
    const handleAmbulanceAssigned = (data) => {
      if (!data || !data.requestId) return;

      if (data.eventId) {
        if (processedEventIds.current.has(data.eventId)) return;
        processedEventIds.current.add(data.eventId);
      }

      // Ensure only the assigned hospital processes this incoming dispatch
      if (data.hospitalId && data.hospitalId !== user.hospitalId) {
        return;
      }

      setEmergencies((prev) => {
        const exists = prev.some((item) => item.requestId === data.requestId);
        if (exists) {
          return prev.map((item) => {
            if (item.requestId === data.requestId) {
              return {
                ...item,
                ambulanceId: data.ambulanceId || item.ambulanceId,
                driverName: data.driverName || item.driverName,
                status: data.status || 'DRIVER_ACCEPTED',
                route: data.route || item.route,
                alternativeRoutes: data.alternativeRoutes || item.alternativeRoutes,
                candidateRoutes: data.candidateRoutes || item.candidateRoutes,
                decisionReason: data.decisionReason || item.decisionReason,
                updatedAt: new Date().toISOString(),
              };
            }
            return item;
          });
        }

        // Newly matched emergency arriving at this hospital
        return [{
          requestId: data.requestId,
          ambulanceId: data.ambulanceId,
          driverName: data.driverName,
          status: data.status || 'DRIVER_ACCEPTED',
          eta: data.estimatedETA || data.eta,
          route: data.route,
          alternativeRoutes: data.alternativeRoutes,
          candidateRoutes: data.candidateRoutes,
          decisionReason: data.decisionReason,
          hospitalId: data.hospitalId || user.hospitalId,
          createdAt: data.timestamp || new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        }, ...prev];
      });

      socketService.joinEmergencyRoom(data.requestId);

      addNotification(
        'info',
        '🚑 AMBULANCE ASSIGNED',
        `Unit ${data.ambulanceId} assigned to emergency ${data.requestId}.`,
        data
      );
    };

    // 3. AMBULANCE_LOCATION_UPDATED & LOCATION_UPDATED
    // Backend emits { ambulanceId, latitude, longitude } (no requestId in AMBULANCE_LOCATION_UPDATED).
    // Match by requestId if present, otherwise fall back to ambulanceId.
    const handleLocationUpdate = (payload) => {
      if (!payload) return;
      const { requestId, ambulanceId, location } = payload;
      const locData = location || payload.currentLocation || payload;

      setEmergencies((prev) =>
        prev.map((item) => {
          const matchesRequest = requestId && item.requestId === requestId;
          const matchesAmbulance = !requestId && ambulanceId && item.ambulanceId === ambulanceId;
          if (matchesRequest || matchesAmbulance) {
            return {
              ...item,
              ambulanceId: ambulanceId || item.ambulanceId,
              currentLocation: {
                ...item.currentLocation,
                ...locData,
                timestamp: locData?.timestamp || new Date().toISOString(),
              },
              location: {
                latitude: locData?.latitude ?? item.currentLocation?.latitude,
                longitude: locData?.longitude ?? item.currentLocation?.longitude,
              },
              updatedAt: new Date().toISOString(),
            };
          }
          return item;
        })
      );
    };

    // 4. ETA_UPDATED
    const handleEtaUpdate = (payload) => {
      if (!payload || !payload.requestId) return;
      // Backend emits `etaMinutes`; simulation/mock uses `eta` — support both
      const { requestId, trafficCondition, timestamp } = payload;
      const eta = payload.etaMinutes ?? payload.eta;

      setEmergencies((prev) =>
        prev.map((item) => {
          if (item.requestId === requestId) {
            return {
              ...item,
              eta: eta !== undefined ? eta : item.eta,
              trafficCondition: trafficCondition || item.trafficCondition,
              updatedAt: timestamp || new Date().toISOString(),
            };
          }
          return item;
        })
      );
      // State updated reactively without toast spam
    };

    // 5. STATUS_UPDATED
    const handleStatusUpdate = (payload) => {
      if (!payload || !payload.requestId) return;
      const { requestId, status, ambulanceId } = payload;

      setEmergencies((prev) =>
        prev.map((item) => {
          if (item.requestId === requestId) {
            return {
              ...item,
              status: status || item.status,
              ambulanceId: ambulanceId || item.ambulanceId,
              updatedAt: new Date().toISOString(),
            };
          }
          return item;
        })
      );

      if (status === 'PATIENT_ONBOARD') {
        addNotification(
          'critical',
          '🚨 PATIENT ONBOARD',
          `Patient secured in ${ambulanceId || 'ambulance'}. En route to emergency bay.`,
          payload
        );
      }
    };

    // 6. FALLBACK_STARTED
    const handleFallbackStarted = (data) => {
      if (!data || !data.requestId) return;

      addNotification(
        'warning',
        '⚠️ CASCADING FALLBACK INITIATED',
        `Dispatch reassessment in progress for ${data.requestId}. Reason: ${data.reason || 'Unit unavailable / timeout'}.`,
        data
      );
    };

    // 7. AMBULANCE_REASSIGNED & FALLBACK_ASSIGNMENT_UPDATED
    const handleFallbackUpdate = (fallbackData) => {
      if (!fallbackData || !fallbackData.requestId) return;

      const {
        requestId,
        reason,
      } = fallbackData;
      // Backend emits `ambulanceId`; simulation may use `newAmbulanceId` — support both
      const newAmbulanceId = fallbackData.ambulanceId || fallbackData.newAmbulanceId;
      const previousAmbulanceId = fallbackData.previousAmbulanceId;
      const newDriverName = fallbackData.newDriverName || fallbackData.driverName;
      const newDriverPhone = fallbackData.newDriverPhone || fallbackData.driverPhone;
      const eta = fallbackData.etaMinutes ?? fallbackData.eta;

      setEmergencies((prev) =>
        prev.map((item) => {
          if (item.requestId === requestId) {
            const updatedAttempts = [
              ...(item.attempts || []),
              {
                attemptNumber: (item.attempts?.length || 0) + 1,
                ambulanceId: newAmbulanceId,
                driverName: newDriverName,
                assignedAt: new Date().toISOString(),
                response: 'ACCEPTED',
                failureReason: null,
              },
            ];

            return {
              ...item,
              ambulanceId: newAmbulanceId,
              driverName: newDriverName || item.driverName,
              driverPhone: newDriverPhone || item.driverPhone,
              eta: eta !== undefined ? eta : item.eta,
              fallbackCount: (item.fallbackCount || 0) + 1,
              attempts: updatedAttempts,
              updatedAt: new Date().toISOString(),
            };
          }
          return item;
        })
      );

      addNotification(
        'warning',
        '⚠️ AMBULANCE REASSIGNED (FALLBACK)',
        `Previous unit ${previousAmbulanceId || 'assigned'} replaced by ${newAmbulanceId}. Reason: ${reason || 'Unit unavailable'}. New ETA: ${eta || '--'} min.`,
        fallbackData
      );
    };

    // 8. AMBULANCE_ARRIVED & HOSPITAL_ARRIVED
    const handleAmbulanceArrived = (data) => {
      if (!data || !data.requestId) return;

      setEmergencies((prev) =>
        prev.map((item) => {
          if (item.requestId === data.requestId) {
            return {
              ...item,
              status: 'ARRIVED_AT_HOSPITAL',
              updatedAt: new Date().toISOString(),
            };
          }
          return item;
        })
      );

      addNotification(
        'success',
        '🏁 AMBULANCE ARRIVED AT HOSPITAL',
        `Ambulance ${data.ambulanceId || 'unit'} has arrived at the emergency bay. Prepare immediate trauma reception.`,
        data
      );
    };

    // 9. EMERGENCY_COMPLETED & REQUEST_COMPLETED
    const handleEmergencyCompleted = (data) => {
      if (!data || !data.requestId) return;
      const completedTime = data.completedAt || new Date().toISOString();

      // Find the emergency to archive
      setEmergencies((prev) => {
        const found = prev.find((e) => e.requestId === data.requestId);
        if (found) {
          const finishedCase = {
            ...found,
            status: 'COMPLETED',
            completedAt: completedTime,
            updatedAt: completedTime,
          };
          setCompletedEmergencies((ch) => [finishedCase, ...ch]);
        }
        // Remove completed emergency from incoming list
        return prev.filter((e) => e.requestId !== data.requestId);
      });

      // Leave emergency socket room
      socketService.leaveEmergencyRoom(data.requestId);

      addNotification(
        'success',
        '✅ EMERGENCY COMPLETED',
        `Case ${data.requestId} successfully completed. Patient admitted. Case moved to Emergency History.`,
        data
      );
    };

    // 10. ROUTE_UPDATED (Journey 1 or Journey 2 dynamic route update)
    const handleRouteUpdated = (payload) => {
      if (!payload || !payload.requestId) return;
      setEmergencies((prev) =>
        prev.map((item) => {
          if (item.requestId === payload.requestId) {
            return {
              ...item,
              route: payload.route || item.route,
              alternativeRoutes: payload.alternativeRoutes || item.alternativeRoutes,
              candidateRoutes: payload.candidateRoutes || item.candidateRoutes,
              eta: payload.etaMinutes ?? payload.eta ?? item.eta,
              distanceKm: payload.distanceKm || item.distanceKm,
              decisionReason: payload.selectionReason || item.decisionReason,
              updatedAt: new Date().toISOString(),
            };
          }
          return item;
        })
      );

      addNotification(
        'info',
        '🗺️ ROUTE UPDATED',
        `Route updated for case ${payload.requestId} (${payload.phase || 'IN_TRANSIT'}). ETA: ${payload.etaMinutes || '--'} min.`,
        payload
      );
    };

    // Register listeners for all checklist Socket.IO events
    socketService.on(SOCKET_EVENTS.EMERGENCY_CREATED, handleNewEmergency);
    socketService.on(SOCKET_EVENTS.NEW_INCOMING_EMERGENCY, handleNewEmergency);
    socketService.on(SOCKET_EVENTS.AMBULANCE_ASSIGNED, handleAmbulanceAssigned);
    socketService.on(SOCKET_EVENTS.AMBULANCE_LOCATION_UPDATED, handleLocationUpdate);
    socketService.on(SOCKET_EVENTS.LOCATION_UPDATED, handleLocationUpdate);
    socketService.on(SOCKET_EVENTS.ETA_UPDATED, handleEtaUpdate);
    socketService.on(SOCKET_EVENTS.STATUS_UPDATED, handleStatusUpdate);
    socketService.on(SOCKET_EVENTS.ROUTE_UPDATED, handleRouteUpdated);
    socketService.on(SOCKET_EVENTS.PATIENT_ONBOARD, (data) =>
      handleStatusUpdate({ ...data, status: 'PATIENT_ONBOARD' })
    );
    socketService.on(SOCKET_EVENTS.FALLBACK_STARTED, handleFallbackStarted);
    socketService.on(SOCKET_EVENTS.AMBULANCE_REASSIGNED, handleFallbackUpdate);
    socketService.on(SOCKET_EVENTS.FALLBACK_ASSIGNMENT_UPDATED, handleFallbackUpdate);
    socketService.on(SOCKET_EVENTS.FALLBACK_TRIGGERED, handleFallbackUpdate);
    socketService.on(SOCKET_EVENTS.AMBULANCE_ARRIVED, handleAmbulanceArrived);
    socketService.on(SOCKET_EVENTS.HOSPITAL_ARRIVED, handleAmbulanceArrived);
    socketService.on(SOCKET_EVENTS.EMERGENCY_COMPLETED, handleEmergencyCompleted);
    socketService.on(SOCKET_EVENTS.REQUEST_COMPLETED, handleEmergencyCompleted);

    return () => {
      socketService.off(SOCKET_EVENTS.EMERGENCY_CREATED, handleNewEmergency);
      socketService.off(SOCKET_EVENTS.NEW_INCOMING_EMERGENCY, handleNewEmergency);
      socketService.off(SOCKET_EVENTS.AMBULANCE_ASSIGNED, handleAmbulanceAssigned);
      socketService.off(SOCKET_EVENTS.AMBULANCE_LOCATION_UPDATED, handleLocationUpdate);
      socketService.off(SOCKET_EVENTS.LOCATION_UPDATED, handleLocationUpdate);
      socketService.off(SOCKET_EVENTS.ETA_UPDATED, handleEtaUpdate);
      socketService.off(SOCKET_EVENTS.STATUS_UPDATED, handleStatusUpdate);
      socketService.off(SOCKET_EVENTS.ROUTE_UPDATED, handleRouteUpdated);
      socketService.off(SOCKET_EVENTS.FALLBACK_STARTED, handleFallbackStarted);
      socketService.off(SOCKET_EVENTS.AMBULANCE_REASSIGNED, handleFallbackUpdate);
      socketService.off(SOCKET_EVENTS.FALLBACK_ASSIGNMENT_UPDATED, handleFallbackUpdate);
      socketService.off(SOCKET_EVENTS.FALLBACK_TRIGGERED, handleFallbackUpdate);
      socketService.off(SOCKET_EVENTS.AMBULANCE_ARRIVED, handleAmbulanceArrived);
      socketService.off(SOCKET_EVENTS.HOSPITAL_ARRIVED, handleAmbulanceArrived);
      socketService.off(SOCKET_EVENTS.EMERGENCY_COMPLETED, handleEmergencyCompleted);
      socketService.off(SOCKET_EVENTS.REQUEST_COMPLETED, handleEmergencyCompleted);
    };
  }, [user?.hospitalId, addNotification]);

  const getEmergency = useCallback(
    (requestId) => {
      return (
        emergencies.find((e) => e.requestId === requestId) ||
        completedEmergencies.find((e) => e.requestId === requestId)
      );
    },
    [emergencies, completedEmergencies]
  );

  const triggerFallbackDemo = useCallback((requestId) => {
    socketService.triggerFallbackDemo(requestId);
  }, []);

  const triggerIncomingDemo = useCallback(() => {
    const newCase = socketService.triggerIncomingDemo(hospital?.hospitalId || user?.hospitalId || 'H001');
    return newCase;
  }, [hospital?.hospitalId, user?.hospitalId]);

  const value = {
    emergencies,
    completedEmergencies,
    isLoading,
    error,
    notifications,
    refreshEmergencies: loadEmergencies,
    getEmergency,
    dismissNotification,
    triggerFallbackDemo,
    triggerIncomingDemo,
  };

  return <EmergencyContext.Provider value={value}>{children}</EmergencyContext.Provider>;
}

export default EmergencyProvider;
