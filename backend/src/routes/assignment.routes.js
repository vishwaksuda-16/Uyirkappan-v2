const { Router } = require('express');
const authMiddleware = require('../middleware/auth.middleware');
const { requireRole } = require('../middleware/role.middleware');
const AssignmentController = require('../controllers/assignment.controller');

module.exports = function buildAssignmentRoutes(ctx) {
  const router = Router();
  const ctrl = new AssignmentController(ctx);

  router.use(authMiddleware(ctx.store));

  router.get('/:assignmentId', (req, res) => ctrl.get(req, res));
  router.post('/:assignmentId/accept', requireRole('DRIVER', 'ADMIN'), (req, res) => ctrl.accept(req, res));
  router.post('/:assignmentId/reject', requireRole('DRIVER', 'ADMIN'), (req, res) => ctrl.reject(req, res));
  router.patch('/:assignmentId/status', requireRole('DRIVER', 'ADMIN'), (req, res) => ctrl.updateStatus(req, res));

  return router;
};