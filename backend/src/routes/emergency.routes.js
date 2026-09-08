const { Router } = require('express');
const authMiddleware = require('../middleware/auth.middleware');
const { requireRole } = require('../middleware/role.middleware');
const EmergencyController = require('../controllers/emergency.controller');

module.exports = function buildEmergencyRoutes(ctx) {
  const router = Router();
  const ctrl = new EmergencyController(ctx);

  router.use(authMiddleware(ctx.store));

  router.post('/', requireRole('BYSTANDER', 'ADMIN'), (req, res) => ctrl.create(req, res));
  router.get('/:requestId', (req, res) => ctrl.get(req, res));
  router.post('/:requestId/cancel', (req, res) => ctrl.cancel(req, res));
  router.get('/:requestId/tracking', (req, res) => ctrl.tracking(req, res));

  return router;
};