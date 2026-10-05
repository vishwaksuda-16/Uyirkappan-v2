const logger = require('../utils/logger');
const { ErrorCode } = require('../utils/errors');

module.exports.requireRole = (...roles) => (req, res, next) => {
  if (!req.user) {
    logger.warn({
      event: 'SECURITY_ROLE_DENIED',
      errorCode: ErrorCode.AUTHORIZATION_ERROR,
      correlationId: req.correlationId,
      path: req.originalUrl || req.url,
      message: 'Role check denied: user not authenticated',
    });
    return res.status(403).json({ success: false, message: 'User not authenticated' });
  }
  
  if (!roles.includes(req.user.role)) {
    logger.warn({
      event: 'SECURITY_ROLE_DENIED',
      errorCode: ErrorCode.AUTHORIZATION_ERROR,
      correlationId: req.correlationId,
      userId: req.user.id,
      userRole: req.user.role,
      requiredRoles: roles,
      path: req.originalUrl || req.url,
      message: `Role check failed: User role ${req.user.role} does not meet [${roles.join(', ')}]`,
    });
    return res.status(403).json({ success: false, message: 'Insufficient permissions' });
  }
  
  logger.debug({
    event: 'SECURITY_ROLE_PASSED',
    correlationId: req.correlationId,
    userId: req.user.id,
    userRole: req.user.role,
    requiredRoles: roles,
    message: 'Role authorization passed',
  });
  next();
};