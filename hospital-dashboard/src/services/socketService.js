import { io } from 'socket.io-client';
import { SOCKET_EVENTS } from '../constants/socketEvents.js';

/**
 * Centralized Real-Time WebSocket Service
 * Primary Source: Module 3 (Section 20, 25, 30) & Checklist Section 9, 19
 */

class SocketService {
  constructor() {
    this.socket = null;
    this.status = 'disconnected'; // 'connected' | 'reconnecting' | 'disconnected'
    this.statusListeners = new Set();
    this.reconnectListeners = new Set();
    this.eventHandlers = new Map();
    this.currentHospitalId = null;
    this.activeEmergencyRooms = new Set();
    this.token = null;
  }

  /**
   * Connect to central WebSocket server
   * Pattern: io('http://localhost:5000', { auth: { token: 'JWT' } })
   */
  connect(token) {
    if (token) {
      this.token = token;
    }

    if (this.socket && this.socket.connected) {
      return;
    }

    const socketUrl =
      (typeof import.meta !== 'undefined' && import.meta.env?.VITE_SOCKET_URL) ||
      'http://localhost:5000';

    try {
      this.socket = io(socketUrl, {
        auth: {
          token: this.token || '',
        },
        transports: ['websocket', 'polling'],
        reconnection: true,
        reconnectionAttempts: 10,
        reconnectionDelay: 1000,
        reconnectionDelayMax: 5000,
        timeout: 6000,
        autoConnect: true,
      });

      this.setStatus('reconnecting');

      this.socket.on(SOCKET_EVENTS.CONNECT, () => {
        this.setStatus('connected');

        // Join hospital room: hospital:{hospitalId}
        if (this.currentHospitalId) {
          this.subscribeHospital(this.currentHospitalId);
        }

        // Re-join all active emergency rooms: emergency:{requestId}
        this.activeEmergencyRooms.forEach((reqId) => {
          this.joinEmergencyRoom(reqId);
        });

        // Trigger state refresh on reconnection to prevent data loss
        this.notifyReconnect();
      });

      this.socket.on(SOCKET_EVENTS.RECONNECT, () => {
        this.setStatus('connected');
        if (this.currentHospitalId) {
          this.subscribeHospital(this.currentHospitalId);
        }
        this.activeEmergencyRooms.forEach((reqId) => {
          this.joinEmergencyRoom(reqId);
        });
        this.notifyReconnect();
      });

      this.socket.on(SOCKET_EVENTS.RECONNECT_ATTEMPT, () => {
        this.setStatus('reconnecting');
      });

      this.socket.on(SOCKET_EVENTS.DISCONNECT, (reason) => {
        this.setStatus('disconnected');
        if (reason === 'io server disconnect') {
          // Disconnection initiated by server, attempt manual reconnect
          this.socket.connect();
        }
      });

      this.socket.on(SOCKET_EVENTS.CONNECT_ERROR, () => {
        this.setStatus('disconnected');
      });

      // Forward all registered custom event handlers to socket
      this.eventHandlers.forEach((callbacks, eventName) => {
        callbacks.forEach((cb) => {
          this.socket.on(eventName, cb);
        });
      });
    } catch {
      this.setStatus('disconnected');
    }
  }

  /**
   * Disconnect socket cleanly
   */
  disconnect() {
    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
    }
    this.setStatus('disconnected');
  }

  /**
   * Subscribe to specific hospital room: hospital:{hospitalId}
   */
  subscribeHospital(hospitalId) {
    if (!hospitalId) return;
    this.currentHospitalId = hospitalId;
    // Hospital room is auto-joined server-side on socket authentication.
    // No client-side room join event is needed or recognized by the backend.
  }

  /**
   * Unsubscribe from hospital room
   */
  unsubscribeHospital(hospitalId) {
    if (this.socket && this.socket.connected) {
      const room = `hospital:${hospitalId}`;
      this.socket.emit(SOCKET_EVENTS.LEAVE_ROOM, { room, hospitalId });
      this.socket.emit(SOCKET_EVENTS.UNSUBSCRIBE_HOSPITAL, { hospitalId, room });
    }
    if (this.currentHospitalId === hospitalId) {
      this.currentHospitalId = null;
    }
  }

  /**
   * Join individual emergency room: emergency:{requestId}
   */
  joinEmergencyRoom(requestId) {
    if (!requestId) return;
    this.activeEmergencyRooms.add(requestId);
    if (this.socket && this.socket.connected) {
      // Backend listens for 'join_emergency' with plain string requestId
      this.socket.emit('join_emergency', requestId);
    }
  }

  /**
   * Leave individual emergency room: emergency:{requestId}
   */
  leaveEmergencyRoom(requestId) {
    if (!requestId) return;
    this.activeEmergencyRooms.delete(requestId);
    if (this.socket && this.socket.connected) {
      // Backend listens for 'leave_emergency' with plain string requestId
      this.socket.emit('leave_emergency', requestId);
    }
  }

  /**
   * Register event listener
   */
  on(event, callback) {
    if (!this.eventHandlers.has(event)) {
      this.eventHandlers.set(event, new Set());
    }
    this.eventHandlers.get(event).add(callback);

    if (this.socket) {
      this.socket.on(event, callback);
    }
  }

  /**
   * Remove event listener
   */
  off(event, callback) {
    if (this.eventHandlers.has(event)) {
      this.eventHandlers.get(event).delete(callback);
    }
    if (this.socket) {
      this.socket.off(event, callback);
    }
  }

  /**
   * Listen for connection status updates
   */
  onStatusChange(callback) {
    this.statusListeners.add(callback);
    callback(this.status);
    return () => this.statusListeners.delete(callback);
  }

  /**
   * Register state refresh listener invoked after reconnection
   */
  onReconnect(callback) {
    this.reconnectListeners.add(callback);
    return () => this.reconnectListeners.delete(callback);
  }

  notifyReconnect() {
    this.reconnectListeners.forEach((cb) => {
      try {
        cb();
      } catch (e) {
        if (import.meta.env?.DEV) console.error('Error in reconnect listener:', e);
      }
    });
  }

  setStatus(newStatus) {
    if (this.status !== newStatus) {
      this.status = newStatus;
      this.statusListeners.forEach((cb) => {
        try {
          cb(newStatus);
        } catch (e) {
          if (import.meta.env?.DEV) console.error('Error in status change callback:', e);
        }
      });
    }
  }
}

export const socketService = new SocketService();
export default socketService;
