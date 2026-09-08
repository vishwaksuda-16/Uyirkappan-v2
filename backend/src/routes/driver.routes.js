const { Router } = require('express');
const authMiddleware = require('../middleware/auth.middleware');
const { requireRole } = require('../middleware/role.middleware');

module.exports = function buildDriverRoutes(ctx) {
  const router = Router();
  const store = ctx.store;

  router.use(authMiddleware(store));

  router.get('/assignment', requireRole('DRIVER'), async (req, res) => {
    const assignment = await store.getActiveAssignmentForDriver(req.user.id);
    if (!assignment) {
      return res.json({ success: true, assignment: null, message: 'No active assignment' });
    }
    const request = await store.getEmergencyByRequestId(assignment.requestId);
    return res.json({
      success: true,
      assignment: {
        id: assignment.id,
        requestId: assignment.requestId,
        ambulanceId: assignment.ambulanceId,
        attemptNumber: assignment.attemptNumber,
        status: assignment.status,
        estimatedETA: assignment.estimatedETA,
        assignedAt: assignment.assignedAt,
        expiresAt: assignment.expiresAt,
        request: request ? {
          emergencyType: request.emergencyType,
          victimCount: request.victimCount,
          pickupLocation: request.pickupLocation,
          destinationHospitalId: request.destinationHospitalId,
        } : null,
      },
    });
  });

  return router;
};