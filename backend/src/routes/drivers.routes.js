const { Router } = require('express');
const { datasetLoader } = require('../data/datasetLoader');

module.exports = function buildDriversRoutes(ctx) {
  const router = Router();
  const store = ctx.store;

  // GET /api/drivers — list all 131 fleet drivers
  router.get('/', async (req, res) => {
    try {
      if (!datasetLoader.loaded) datasetLoader.loadAll();
      const drivers = datasetLoader.drivers || [];
      const ambulances = await store.getAmbulances();
      const ambMap = new Map(ambulances.map(a => [a.id, a]));

      const enriched = drivers.map(d => {
        const amb = ambMap.get(d.assignedAmbulanceId);
        return {
          id: d.id,
          driverId: d.id,
          name: d.name,
          phone: d.phone,
          ambulanceId: d.assignedAmbulanceId,
          assignedAmbulanceId: d.assignedAmbulanceId,
          status: amb ? amb.status : 'AVAILABLE',
          baseId: amb ? amb.baseId : undefined,
          baseName: amb ? amb.baseName : undefined,
          shift: d.shift,
          experienceYears: d.experienceYears,
          rating: d.rating,
        };
      });

      return res.json({
        success: true,
        count: enriched.length,
        drivers: enriched,
      });
    } catch (err) {
      return res.status(500).json({ success: false, message: err.message });
    }
  });

  // GET /api/drivers/login-options — lightweight list for driver app login dropdown
  router.get('/login-options', async (req, res) => {
    try {
      if (!datasetLoader.loaded) datasetLoader.loadAll();
      const drivers = datasetLoader.drivers || [];
      const ambulances = await store.getAmbulances();
      const ambMap = new Map(ambulances.map(a => [a.id, a]));

      const options = drivers.map(d => {
        const amb = ambMap.get(d.assignedAmbulanceId);
        return {
          driverId: d.id,
          name: d.name,
          email: `${d.id.toLowerCase()}@uyirkappan.demo`,
          ambulanceId: d.assignedAmbulanceId,
          status: amb ? amb.status : 'AVAILABLE',
          phone: d.phone || '+91 98401 00000',
          baseId: amb ? amb.baseId : undefined,
          baseName: amb ? amb.baseName : undefined,
          defaultPassword: 'password123',
        };
      });

      return res.json({
        success: true,
        count: options.length,
        drivers: options,
      });
    } catch (err) {
      return res.status(500).json({ success: false, message: err.message });
    }
  });

  // GET /api/drivers/:id
  router.get('/:id', async (req, res) => {
    const driver = datasetLoader.drivers?.find(d => d.id.toUpperCase() === req.params.id.toUpperCase());
    if (!driver) {
      return res.status(404).json({ success: false, message: 'Driver not found' });
    }
    const amb = await store.getAmbulanceById(driver.assignedAmbulanceId);
    return res.json({
      success: true,
      driver: {
        ...driver,
        status: amb ? amb.status : 'AVAILABLE',
        ambulance: amb || null,
      },
    });
  });

  return router;
};
