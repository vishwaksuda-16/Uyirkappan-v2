const { verifyToken } = require('../utils/security');
const logger = require('../utils/logger');
const { ErrorCode } = require('../utils/errors');

module.exports = function authMiddleware(store) {
  return async (req, res, next) => {
    const header = req.headers.authorization || '';
    
    if (!header.startsWith('Bearer ')) {
      logger.warn({
        event: 'SECURITY_AUTH_FAILED',
        errorCode: ErrorCode.AUTHENTICATION_ERROR,
        correlationId: req.correlationId,
        message: 'No Bearer token provided',
      });
      return res.status(401).json({ success: false, message: 'No token provided' });
    }
    
    const token = header.slice(7);
    try {
      const payload = verifyToken(token);
      const user = await store.findUserById(payload.sub);
      
      if (!user) {
        logger.warn({
          event: 'SECURITY_AUTH_FAILED',
          errorCode: ErrorCode.AUTHENTICATION_ERROR,
          correlationId: req.correlationId,
          userId: payload.sub,
          message: 'User not found in database',
        });
        return res.status(401).json({ success: false, message: 'User not found' });
      }
      
      req.user = user;
      logger.debug({
        event: 'SECURITY_AUTH_SUCCESS',
        correlationId: req.correlationId,
        userId: user.id,
        role: user.role,
        message: `Authenticated user ${user.id} (${user.role})`,
      });
      next();
    } catch (err) {
      logger.warn({
        event: 'SECURITY_AUTH_FAILED',
        errorCode: ErrorCode.AUTHENTICATION_ERROR,
        correlationId: req.correlationId,
        reason: err.name,
        message: `Token verification failed: ${err.message}`,
      });
      return res.status(401).json({
        success: false,
        code: err.name === 'TokenExpiredError' ? 'TOKEN_EXPIRED' : 'TOKEN_INVALID',
        message: err.name === 'TokenExpiredError' ? 'Token expired; please log in again' : 'Invalid token',
      });
    }
  };
};