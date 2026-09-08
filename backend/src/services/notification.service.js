/**
 * Thin wrapper around Socket.IO so REST controllers/services can emit
 * real-time events without depending on the socket module directly.
 */
class NotificationService {
  constructor(io, store) {
    this.io = io;
    this.store = store;
  }
  emitToRoom(room, event, payload) {
    if (this.io) this.io.to(room).emit(event, payload);
  }
}

module.exports = NotificationService;