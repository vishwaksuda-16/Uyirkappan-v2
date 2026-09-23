const { Router } = require('express');
const authMiddleware = require('../middleware/auth.middleware');
const { requireRole } = require('../middleware/role.middleware');
const HospitalController = require('../controllers/hospital.controller');

module.exports = function buildHospitalRoutes(ctx) {
  const router = Router();
  const ctrl = new HospitalController(ctx);

  router.get('/', (req, res) => ctrl.list(req, res));
  router.get('/:hospitalId', (req, res) => ctrl.get(req, res));

  router.use(authMiddleware(ctx.store));

  router.post('/recommend', requireRole('BYSTANDER', 'ADMIN'), (req, res) => ctrl.recommend(req, res));
  router.get('/:hospitalId/incoming', requireRole('HOSPITAL_STAFF', 'ADMIN'), (req, res) => ctrl.incoming(req, res));
  router.get('/:hospitalId/inbound', requireRole('HOSPITAL_STAFF', 'ADMIN'), (req, res) => ctrl.incoming(req, res));
  router.get('/:hospitalId/emergency-history', requireRole('HOSPITAL_STAFF', 'ADMIN'), (req, res) => ctrl.history(req, res));
  router.get('/:hospitalId/resources', requireRole('HOSPITAL_STAFF', 'ADMIN'), (req, res) => ctrl.resources(req, res));
  router.get('/:hospitalId/capacity', requireRole('HOSPITAL_STAFF', 'ADMIN'), (req, res) => ctrl.resources(req, res));
  router.patch('/:hospitalId/resources', requireRole('HOSPITAL_STAFF', 'ADMIN'), (req, res) => ctrl.updateResources(req, res));

  return router;
};