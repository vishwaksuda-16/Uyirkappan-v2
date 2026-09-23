/**
 * Thin wrapper around Socket.IO so REST controllers/services can emit
 * real-time events without depending on the socket module directly.
 * Implements Phase 18 duplicate event protection with eventId and sequenceNumber.
 */
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
    if (payload && typeof payload === 'object' && !Array.isArray(payload)) {
      const emergencyId = payload.requestId || payload.emergencyId;
      if (emergencyId) {
        const seq = this.nextSequence(emergencyId);
        finalPayload = {
          eventId: `evt-${emergencyId}-${String(seq).padStart(3, '0')}`,
          emergencyId,
          timestamp: payload.timestamp || new Date().toISOString(),
          sequenceNumber: seq,
          ...payload,
        };
      }
    }

    this.io.to(room).emit(event, finalPayload);
  }

  broadcast(event, payload) {
    if (!this.io) return;
    this.io.emit(event, payload);
  }
}

module.exports = NotificationService;