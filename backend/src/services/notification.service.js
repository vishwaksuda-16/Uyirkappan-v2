/**
 * Thin wrapper around Socket.IO so REST controllers/services can emit
 * real-time events without depending on the socket module directly.
 * Implements Phase 18 duplicate event protection with eventId and sequenceNumber.
 */
const logger = require('../utils/logger');

class NotificationService {
  constructor(io, store) {
    this.io = io;
    this.store = store;
    this.sequences = new Map(); // emergencyId -> currentSequence
  }

  nextSequence(emergencyId) {
    const current = this.sequences.get(emergencyId) || 0;
    const next = current + 1;
    this.sequences.set(emergencyId, next);
    return next;
  }

  emitToRoom(room, event, payload) {
    if (!this.io) return;

    let finalPayload = payload;
    let emergencyId = null;
    let seq = undefined;
    let eventId = undefined;

    if (payload && typeof payload === 'object' && !Array.isArray(payload)) {
      emergencyId = payload.requestId || payload.emergencyId;
      if (emergencyId) {
        seq = this.nextSequence(emergencyId);
        eventId = `evt-${emergencyId}-${String(seq).padStart(3, '0')}`;
        finalPayload = {
          eventId,
          emergencyId,
          timestamp: payload.timestamp || new Date().toISOString(),
          sequenceNumber: seq,
          ...payload,
        };
      }
    }

    this.io.to(room).emit(event, finalPayload);

    // High frequency telemetry events logged at DEBUG to prevent log flooding (Step 24)
    const isHighFrequency = event === 'AMBULANCE_LOCATION_UPDATED' || event === 'ETA_UPDATED';
    logger.log(isHighFrequency ? 'debug' : 'info', {
      event: 'SOCKET_EVENT_EMITTED',
      socketEvent: event,
      room,
      requestId: emergencyId,
      emergencyId,
      eventId,
      seqNum: seq,
      ambulanceId: payload?.ambulanceId,
      status: payload?.status,
      message: `Socket.IO emitted ${event} to room ${room}${eventId ? ` (${eventId})` : ''}`,
    });
  }

  broadcast(event, payload) {
    if (!this.io) return;
    this.io.emit(event, payload);

    logger.info({
      event: 'SOCKET_BROADCAST_EMITTED',
      socketEvent: event,
      message: `Socket.IO broadcast ${event}`,
    });
  }
}

module.exports = NotificationService;