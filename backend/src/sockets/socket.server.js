const { verifyToken } = require('../utils/security');
const { initializeMatcher } = require('../matcher/index');
const logger = require('../utils/logger');
const { ErrorCode } = require('../utils/errors');

module.exports = function initSocketServer(io, ctx) {
  const store = ctx.store;
  ctx.onlineDriverIds ??= new Set();
  ctx.driverSocketCounts ??= new Map();

  // ✅ Initialize the Intelligent Matcher with Socket.IO
  const matcherServices = initializeMatcher(io);
  ctx.matcher = matcherServices;

  io.use(async (socket, next) => {
    const token = socket.handshake.auth && socket.handshake.auth.token;
    try {
      const payload = verifyToken(token);
      const user = await store.findUserById(payload.sub);
      if (!user) throw new Error('User not found');
      socket.user = user;

      socket.join(`user:${user.id}`);

      if (user.role === 'DRIVER') {
        const ambulance = await store.getAmbulanceByDriverId(user.id);
        if (ambulance) {
          socket.join(`driver:${ambulance.id}`);
          socket.join(`ambulance:${ambulance.id}`);
        }
        socket.join(`driver:${user.id}`);
      }

      if (user.role === 'HOSPITAL_STAFF' && user.hospitalId) {
        socket.join(`hospital:${user.hospitalId}`);
      }

      logger.info({
        event: 'SOCKET_AUTH_SUCCESS',
        socketId: socket.id,
        userId: user.id,
        role: user.role,
        message: `Socket authenticated for user ${user.id} (${user.role})`,
      });
      next();
    } catch (err) {
      logger.warn({
        event: 'SOCKET_AUTH_REJECTED',
        errorCode: ErrorCode.AUTHENTICATION_ERROR,
        socketId: socket.id,
        message: `Socket handshake authentication rejected: ${err.message}`,
      });
      next(new Error('Authentication failed'));
    }
  });

  io.on('connection', (socket) => {
    logger.info({
      event: 'SOCKET_CONNECTED',
      socketId: socket.id,
      userId: socket.user?.id,
      role: socket.user?.role,
      message: `Socket connected: ${socket.id}`,
    });

    if (socket.user?.role === 'DRIVER') {
      const driverId = socket.user.id;
      const socketCount = (ctx.driverSocketCounts.get(driverId) || 0) + 1;
      ctx.driverSocketCounts.set(driverId, socketCount);
      ctx.onlineDriverIds.add(driverId);
      io.emit('DRIVER_CONNECTED', {
        driverId,
        ambulanceId: socket.user.ambulanceId,
        timestamp: new Date().toISOString(),
      });
      logger.info({
        event: 'DRIVER_PRESENCE_ONLINE',
        driverId,
        ambulanceId: socket.user.ambulanceId,
        activeSockets: socketCount,
        message: `Driver ${driverId} is available for dispatch`,
      });
    }

    const handleJoin = async (payload) => {
      const id = typeof payload === 'string' ? payload : (payload?.requestId || payload?.id);
      if (!id) return;
      if (socket.user?.role === 'ADMIN') {
        socket.join(`emergency:${id}`);
        return;
      }
      if (typeof store.getEmergencyByRequestId === 'function') {
        try {
          const req = await store.getEmergencyByRequestId(id);
          if (req) {
            const isRequester = req.requesterId === socket.user?.id;
            let isAssignedDriver = false;
            if (socket.user?.role === 'DRIVER') {
              const amb = await store.getAmbulanceByDriverId(socket.user.id);
              if (amb && (amb.id === req.assignedAmbulanceId || amb.currentRequestId === req.requestId)) {
                isAssignedDriver = true;
              }
            }
            const isAssignedHospital = socket.user?.role === 'HOSPITAL_STAFF' &&
              socket.user.hospitalId && (
                req.destinationHospitalId === socket.user.hospitalId ||
                (socket.user.hospitalId === 'H001' && req.destinationHospitalId === 'HOSP-01') ||
                (socket.user.hospitalId === 'HOSP-01' && req.destinationHospitalId === 'H001')
              );

            if (!isRequester && !isAssignedDriver && !isAssignedHospital) {
              logger.warn({
                event: 'SOCKET_ROOM_DENIED',
                errorCode: ErrorCode.AUTHORIZATION_ERROR,
                socketId: socket.id,
                room: `emergency:${id}`,
                requestId: id,
                userId: socket.user?.id,
                role: socket.user?.role,
                message: `Forbidden: Unauthorized emergency room join attempt for ${id}`,
              });
              socket.emit('error', { message: 'Forbidden: Not authorized to join emergency room' });
              return; // Reject unauthorized emergency room join
            }
          }
        } catch (_) {}
      }
      socket.join(`emergency:${id}`);
      logger.info({
        event: 'SOCKET_ROOM_JOINED',
        socketId: socket.id,
        room: `emergency:${id}`,
        requestId: id,
        userId: socket.user?.id,
        role: socket.user?.role,
        message: `Socket joined emergency room emergency:${id}`,
      });
    };
    const handleLeave = (payload) => {
      const id = typeof payload === 'string' ? payload : (payload?.requestId || payload?.id);
      if (id) {
        socket.leave(`emergency:${id}`);
        logger.info({
          event: 'SOCKET_ROOM_LEFT',
          socketId: socket.id,
          room: `emergency:${id}`,
          requestId: id,
          userId: socket.user?.id,
          message: `Socket left emergency room emergency:${id}`,
        });
      }
    };

    socket.on('join_emergency', handleJoin);
    socket.on('join-emergency', handleJoin);
    socket.on('join:emergency', handleJoin);
    socket.on('leave_emergency', handleLeave);
    socket.on('leave-emergency', handleLeave);
    socket.on('leave:emergency', handleLeave);

    socket.on('join:hospital', (payload) => {
      const hId = typeof payload === 'string' ? payload : (payload?.hospitalId || payload?.id);
      if (!hId) return;
      if (socket.user?.role === 'ADMIN') {
        socket.join(`hospital:${hId}`);
        logger.info({
          event: 'SOCKET_ROOM_JOINED',
          socketId: socket.id,
          room: `hospital:${hId}`,
          hospitalId: hId,
          userId: socket.user?.id,
          role: socket.user?.role,
          message: `Admin joined hospital room hospital:${hId}`,
        });
        return;
      }
      if (socket.user?.role === 'HOSPITAL_STAFF' && socket.user.hospitalId) {
        const isMatch = socket.user.hospitalId === hId ||
          (socket.user.hospitalId === 'H001' && hId === 'HOSP-01') ||
          (socket.user.hospitalId === 'HOSP-01' && hId === 'H001');
        if (isMatch) {
          socket.join(`hospital:${hId}`);
          logger.info({
            event: 'SOCKET_ROOM_JOINED',
            socketId: socket.id,
            room: `hospital:${hId}`,
            hospitalId: hId,
            userId: socket.user?.id,
            role: socket.user?.role,
            message: `Staff joined hospital room hospital:${hId}`,
          });
          return;
        }
      }
      logger.warn({
        event: 'SOCKET_ROOM_DENIED',
        errorCode: ErrorCode.AUTHORIZATION_ERROR,
        socketId: socket.id,
        room: `hospital:${hId}`,
        hospitalId: hId,
        userId: socket.user?.id,
        role: socket.user?.role,
        message: `Forbidden: Staff cannot join another hospital room ${hId}`,
      });
      socket.emit('error', { message: 'Forbidden: Cannot join room for another hospital' });
    });

    socket.on('leave:hospital', (payload) => {
      const hId = typeof payload === 'string' ? payload : (payload?.hospitalId || payload?.id);
      if (hId) {
        socket.leave(`hospital:${hId}`);
        logger.info({
          event: 'SOCKET_ROOM_LEFT',
          socketId: socket.id,
          room: `hospital:${hId}`,
          hospitalId: hId,
          userId: socket.user?.id,
          message: `Socket left hospital room hospital:${hId}`,
        });
      }
    });

    socket.on('location:update', async (payload) => {
      try {
        if (socket.user && payload && ctx.ambulanceService) {
          if (socket.user.role !== 'DRIVER' && socket.user.role !== 'ADMIN') {
            logger.warn({
              event: 'SECURITY_TELEMETRY_DENIED',
              errorCode: ErrorCode.AUTHORIZATION_ERROR,
              socketId: socket.id,
              userId: socket.user.id,
              role: socket.user.role,
              message: 'Forbidden: Only drivers may emit location updates',
            });
            socket.emit('error', { message: 'Forbidden: Only drivers may emit location updates' });
            return;
          }
          const ambulanceId = payload.ambulanceId || socket.user.ambulanceId;
          if (ambulanceId) {
            await ctx.ambulanceService.updateLocation(ambulanceId, payload, socket.user);
          }
        }
      } catch (_) {}
    });

    socket.on('disconnect', () => {
      logger.info({
        event: 'SOCKET_DISCONNECTED',
        socketId: socket.id,
        userId: socket.user?.id,
        role: socket.user?.role,
        message: `Socket disconnected: ${socket.id}`,
      });
      if (socket.user?.role === 'DRIVER') {
        const driverId = socket.user.id;
        const socketCount = Math.max(0, (ctx.driverSocketCounts.get(driverId) || 1) - 1);
        if (socketCount === 0) {
          ctx.driverSocketCounts.delete(driverId);
          ctx.onlineDriverIds.delete(driverId);
        } else {
          ctx.driverSocketCounts.set(driverId, socketCount);
        }
        io.emit('DRIVER_DISCONNECTED', {
          driverId,
          ambulanceId: socket.user.ambulanceId,
          timestamp: new Date().toISOString(),
        });
        logger.info({
          event: 'DRIVER_PRESENCE_OFFLINE',
          driverId,
          ambulanceId: socket.user.ambulanceId,
          activeSockets: socketCount,
          message: `Driver ${driverId} disconnected from dispatch`,
        });
      }
    });
  });
};