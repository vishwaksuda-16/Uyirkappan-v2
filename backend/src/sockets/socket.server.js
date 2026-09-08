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
        if (ambulance) socket.join(`driver:${ambulance.id}`);
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
    socket.on('join_emergency', (requestId) => {
      socket.join(`emergency:${requestId}`);
    });

    socket.on('leave_emergency', (requestId) => {
      socket.leave(`emergency:${requestId}`);
    });

    socket.on('join-emergency', (requestId) => {
      socket.join(`emergency:${requestId}`);
    });

    socket.on('leave-emergency', (requestId) => {
      socket.leave(`emergency:${requestId}`);
    });
  });
};