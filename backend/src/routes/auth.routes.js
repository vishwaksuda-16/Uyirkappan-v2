const { Router } = require('express');
const authMiddleware = require('../middleware/auth.middleware');
const AuthController = require('../controllers/auth.controller');

module.exports = function buildAuthRoutes(ctx) {
  const router = Router();
  const ctrl = new AuthController(ctx);

  router.post('/register', (req, res) => ctrl.register(req, res));
  router.post('/login', (req, res) => ctrl.login(req, res));
  router.get('/me', authMiddleware(ctx.store), (req, res) => ctrl.me(req, res));

  return router;
};