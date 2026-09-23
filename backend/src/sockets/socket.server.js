const { verifyToken } = require('../utils/security');
const { initializeMatcher } = require('../matcher/index');

module.exports = function initSocketServer(io, ctx) {
  const store = ctx.store;

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

      next();
    } catch (err) {
      next(new Error('Authentication failed'));
    }
  });

  io.on('connection', (socket) => {
    if (socket.user?.role === 'DRIVER') {
      io.emit('DRIVER_CONNECTED', {
        driverId: socket.user.id,
        ambulanceId: socket.user.ambulanceId,
        timestamp: new Date().toISOString(),
      });
    }

    const handleJoin = (payload) => {
      const id = typeof payload === 'string' ? payload : (payload?.requestId || payload?.id);
      if (id) socket.join(`emergency:${id}`);
    };
    const handleLeave = (payload) => {
      const id = typeof payload === 'string' ? payload : (payload?.requestId || payload?.id);
      if (id) socket.leave(`emergency:${id}`);
    };

    socket.on('join_emergency', handleJoin);
    socket.on('join-emergency', handleJoin);
    socket.on('join:emergency', handleJoin);
    socket.on('leave_emergency', handleLeave);
    socket.on('leave-emergency', handleLeave);
    socket.on('leave:emergency', handleLeave);

    socket.on('join:hospital', (payload) => {
      const hId = typeof payload === 'string' ? payload : (payload?.hospitalId || payload?.id);
      if (hId) socket.join(`hospital:${hId}`);
    });

    socket.on('leave:hospital', (payload) => {
      const hId = typeof payload === 'string' ? payload : (payload?.hospitalId || payload?.id);
      if (hId) socket.leave(`hospital:${hId}`);
    });

    socket.on('location:update', async (payload) => {
      try {
        if (socket.user && payload && ctx.ambulanceService) {
          const ambulanceId = payload.ambulanceId || socket.user.ambulanceId;
          if (ambulanceId) {
            await ctx.ambulanceService.updateLocation(ambulanceId, payload, socket.user);
          }
        }
      } catch (_) {}
    });

    socket.on('disconnect', () => {
      if (socket.user?.role === 'DRIVER') {
        io.emit('DRIVER_DISCONNECTED', {
          driverId: socket.user.id,
          ambulanceId: socket.user.ambulanceId,
          timestamp: new Date().toISOString(),
        });
      }
    });
  });
};