const { Router } = require('express');
const authMiddleware = require('../middleware/auth.middleware');
const { requireRole } = require('../middleware/role.middleware');
const AmbulanceController = require('../controllers/ambulance.controller');

module.exports = function buildAmbulanceRoutes(ctx) {
  const router = Router();
  const ctrl = new AmbulanceController(ctx);

  router.use(authMiddleware(ctx.store));

  router.get('/', (req, res) => ctrl.list(req, res));
  router.get('/:ambulanceId', (req, res) => ctrl.get(req, res));
  router.patch('/:ambulanceId/status', requireRole('DRIVER', 'ADMIN'), (req, res) => ctrl.updateStatus(req, res));
  router.post('/:ambulanceId/location', requireRole('DRIVER', 'ADMIN'), (req, res) => ctrl.updateLocation(req, res));

  return router;
};