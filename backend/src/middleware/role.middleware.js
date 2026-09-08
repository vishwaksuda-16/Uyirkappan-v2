module.exports.requireRole = (...roles) => (req, res, next) => {
  console.log('[ROLE] Checking roles. Required:', roles);
  console.log('[ROLE] req.user exists?', !!req.user);
  console.log('[ROLE] req.user.role:', req.user ? req.user.role : 'undefined');
  
  if (!req.user) {
    return res.status(403).json({ success: false, message: 'User not authenticated' });
  }
  
  if (!roles.includes(req.user.role)) {
    console.log('[ROLE] Role check failed. User role:', req.user.role);
    return res.status(403).json({ success: false, message: 'Insufficient permissions' });
  }
  
  console.log('[ROLE] Role check passed!');
  next();
};