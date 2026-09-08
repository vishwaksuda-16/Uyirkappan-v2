const { verifyToken } = require('../utils/security');

module.exports = function authMiddleware(store) {
  return async (req, res, next) => {  // ✅ ADD 'async' here
    const header = req.headers.authorization || '';
    console.log('[AUTH] Authorization header:', header ? 'Present' : 'Missing');
    
    if (!header.startsWith('Bearer ')) {
      console.log('[AUTH] No Bearer token found');
      return res.status(401).json({ success: false, message: 'No token provided' });
    }
    
    const token = header.slice(7);
    try {
      const payload = verifyToken(token);
      console.log('[AUTH] Token payload:', payload);
      
      const user = await store.findUserById(payload.sub);  // ✅ ADD 'await' here
      console.log('[AUTH] User found:', user ? user.id : 'Not found');
      
      if (!user) {
        console.log('[AUTH] User not found in database');
        return res.status(401).json({ success: false, message: 'User not found' });
      }
      
      req.user = user;
      console.log('[AUTH] User attached to req.user:', req.user.id, 'Role:', req.user.role);
      next();
    } catch (err) {
      console.log('[AUTH] Token verification failed:', err.message);
      return res.status(401).json({ success: false, message: 'Invalid or expired token' });
    }
  };
};