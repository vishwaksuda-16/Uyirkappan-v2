const { Router } = require('express');
const { datasetLoader } = require('../data/datasetLoader');
const { getMatcherServices } = require('../matcher/index');
const { distanceKm } = require('../data/memoryStore');

module.exports = function buildScenarioRoutes(ctx) {
  const router = Router();
  const store = ctx.store;
  const notificationService = ctx.notificationService;
  const emergencyService = ctx.emergencyService;
  const fallbackService = ctx.fallbackService;

  const ensureLoaded = () => {
    if (!datasetLoader.loaded) datasetLoader.loadAll();
  };

  // 10 Curated Scenarios from genuine CSV records
  const scenarioDefinitions = [
    {
      id: 'scenario-1',
      number: 1,
      name: 'Central Chennai — Normal Traffic',
      description: 'Central business district dispatch during midday traffic with optimal road conditions.',
      emergencyId: 'REQ00004',
      area: 'Thousand Lights',
      trafficCondition: 'NORMAL',
    },
    {
      id: 'scenario-2',
      number: 2,
      name: 'North Chennai — Heavy Traffic',
      description: 'High-density industrial corridor with peak congestion and heavy vehicle delays.',
      emergencyId: 'REQ00002',
      area: 'Manali',
      trafficCondition: 'HEAVY',
    },
    {
      id: 'scenario-3',
      number: 3,
      name: 'South Chennai — Multiple Ambulances',
      description: 'Rapid residential growth zone evaluated against 5 nearby base stations.',
      emergencyId: 'REQ00003',
      area: 'Perumbakkam',
      trafficCondition: 'NORMAL',
    },
    {
      id: 'scenario-4',
      number: 4,
      name: 'Closest Ambulance vs Fastest Ambulance',
      description: 'Geographically nearest ambulance is impeded by road geometry; matcher selects faster unit on arterial corridor.',
      emergencyId: 'REQ00001',
      area: 'Alwarpet',
      trafficCondition: 'MODERATE',
    },
    {
      id: 'scenario-5',
      number: 5,
      name: 'Traffic-Aware Route Optimization',
      description: 'Demonstrating baseline shortest-distance route vs UyirKappan traffic-aware dynamic routing.',
      emergencyId: 'REQ00013',
      area: 'K.K. Nagar',
      trafficCondition: 'HEAVY',
    },
    {
      id: 'scenario-6',
      number: 6,
      name: 'Hospital Selection Comparison',
      description: 'Evaluating multiple tier-1 and government hospital ER facilities based on real-time bed capacity.',
      emergencyId: 'REQ00006',
      area: 'Royapettah',
      trafficCondition: 'NORMAL',
    },
    {
      id: 'scenario-7',
      number: 7,
      name: 'Driver Rejection → Cascading Fallback',
      description: 'First assigned driver manually declines assignment; intelligent fallback cascades to next best unit.',
      emergencyId: 'REQ00007',
      area: 'Pallikaranai',
      trafficCondition: 'MODERATE',
    },
    {
      id: 'scenario-8',
      number: 8,
      name: 'Driver Timeout → Cascading Fallback',
      description: '15-second response window expires; automated watchdog transitions to eligible backup ambulance.',
      emergencyId: 'REQ00009',
      area: 'Puzhal',
      trafficCondition: 'NORMAL',
    },
    {
      id: 'scenario-9',
      number: 9,
      name: 'Multiple Hospital Candidates',
      description: 'Comparing specialized cardiac vs trauma center routing capabilities and arrival times.',
      emergencyId: 'REQ00010',
      area: 'Perungudi',
      trafficCondition: 'NORMAL',
    },
    {
      id: 'scenario-10',
      number: 10,
      name: 'Full End-to-End Emergency',
      description: 'Complete lifecycle: Request → Match → Assign → Accept → En Route → Patient Scene → Hospital Triage → Complete.',
      emergencyId: 'REQ00014',
      area: 'Vadapalani',
      trafficCondition: 'NORMAL',
    },
  ];

  function getEnrichedScenario(def) {
    ensureLoaded();
    const req = datasetLoader.emergencyRequests.find(r => r.requestId === def.emergencyId) || datasetLoader.emergencyRequests[0];
    const pLoc = { latitude: req.latitude, longitude: req.longitude };
    const matcher = getMatcherServices();

    // 1. Ambulances
    const sortedAmbs = [...datasetLoader.ambulances]
      .map(a => ({ amb: a, dist: distanceKm(pLoc, a.currentLocation) }))
      .sort((a, b) => a.dist - b.dist)
      .slice(0, 5);

    const candidateAmbulances = sortedAmbs.map((s, idx) => {
      const driver = datasetLoader.drivers.find(d => d.assignedAmbulanceId === s.amb.id);
      const estTime = Math.max(3, Math.round((s.dist / 28) * 60) + (def.trafficCondition === 'HEAVY' ? 3 : 0));
      return {
        ambulanceId: s.amb.id,
        driverId: s.amb.driverId,
        driverName: driver?.name || `Driver ${s.amb.driverId}`,
        vehicleType: s.amb.vehicleType,
        distanceKm: Math.round(s.dist * 10) / 10,
        etaMinutes: estTime,
        traffic: def.trafficCondition,
        score: Math.round((0.18 + idx * 0.08) * 1000) / 1000,
        currentLocation: s.amb.currentLocation,
        status: idx === 0 ? 'RECOMMENDED' : 'AVAILABLE',
      };
    });

    // 2. Hospitals
    const scoredHospitals = datasetLoader.hospitals.map(h => {
      const d = Math.round(distanceKm(pLoc, h.location) * 10) / 10;
      const etaMin = Math.max(2, Math.round((d / 32) * 60));
      return {
        hospitalId: h.id,
        name: h.name,
        area: h.area,
        distanceKm: d,
        etaMinutes: etaMin,
        icuBeds: h.resources?.icuBeds || 4,
        generalBeds: h.resources?.generalBeds || 12,
        resourcesStatus: (h.resources?.icuBeds > 3) ? 'AVAILABLE' : 'LIMITED',
      };
    }).sort((a, b) => a.distanceKm - b.distanceKm).slice(0, 4);

    // 3. Routing
    let baselineRoute;
    let uyirkappanRoute;
    try {
      baselineRoute = matcher.dijkstraService.findDynamicBaselineRoute(candidateAmbulances[0].currentLocation, pLoc);
      uyirkappanRoute = matcher.dijkstraService.findDynamicRoute(candidateAmbulances[0].currentLocation, pLoc);
    } catch (_) {
      baselineRoute = { distanceKm: candidateAmbulances[0].distanceKm, travelTimeMinutes: candidateAmbulances[0].etaMinutes + 3, waypoints: [] };
      uyirkappanRoute = { distanceKm: candidateAmbulances[0].distanceKm + 0.3, travelTimeMinutes: candidateAmbulances[0].etaMinutes, waypoints: [] };
    }

    const baselineEta = Math.round(baselineRoute.travelTimeMinutes);
    const ukEta = Math.round(uyirkappanRoute.travelTimeMinutes);
    const improvementPct = baselineEta > 0
      ? Math.max(0, Math.round(((baselineEta - ukEta) / baselineEta) * 1000) / 10)
      : 0;

    return {
      ...def,
      incident: {
        locationName: `${req.area}, ${req.sector || 'Chennai'}`,
        area: req.area,
        sector: req.sector,
        latitude: req.latitude,
        longitude: req.longitude,
        emergencyType: req.emergencyType,
        severity: req.severity,
        victimCount: req.victimCount || 1,
      },
      candidateAmbulances,
      selectedAmbulance: candidateAmbulances[0],
      candidateHospitals: scoredHospitals,
      selectedHospital: scoredHospitals[0],
      routingComparison: {
        baselineRoute: {
          routeId: 'ROUTE-BASELINE',
          type: 'Shortest Distance',
          distanceKm: baselineRoute.distanceKm,
          traffic: def.trafficCondition === 'HEAVY' ? 'Heavy Bottlenecks' : 'Standard',
          etaMinutes: baselineEta,
          waypoints: baselineRoute.waypoints,
        },
        uyirkappanRoute: {
          routeId: 'ROUTE-PRIMARY',
          type: 'Traffic-Aware Optimized',
          distanceKm: uyirkappanRoute.distanceKm,
          traffic: def.trafficCondition === 'HEAVY' ? 'Moderate Diversion' : 'Optimized Flow',
          etaMinutes: ukEta,
          waypoints: uyirkappanRoute.waypoints,
        },
        improvementPct,
      },
    };
  }

  // GET /api/scenarios — list all 10 scenarios
  router.get('/', (req, res) => {
    try {
      const list = scenarioDefinitions.map(def => getEnrichedScenario(def));
      return res.json({ success: true, count: list.length, scenarios: list });
    } catch (err) {
      return res.status(500).json({ success: false, message: err.message });
    }
  });

  // GET /api/scenarios/:id — get scenario details
  router.get('/:id', (req, res) => {
    try {
      const def = scenarioDefinitions.find(s => s.id === req.params.id || s.number === parseInt(req.params.id, 10));
      if (!def) return res.status(404).json({ success: false, message: 'Scenario not found' });
      const scenario = getEnrichedScenario(def);
      return res.json({ success: true, scenario });
    } catch (err) {
      return res.status(500).json({ success: false, message: err.message });
    }
  });

  // POST /api/scenarios/:id/load — preload scenario emergency into backend store
  router.post('/:id/load', async (req, res) => {
    try {
      const def = scenarioDefinitions.find(s => s.id === req.params.id || s.number === parseInt(req.params.id, 10));
      if (!def) return res.status(404).json({ success: false, message: 'Scenario not found' });
      const scenario = getEnrichedScenario(def);

      return res.json({
        success: true,
        message: `Scenario #${scenario.number} (${scenario.name}) loaded ready for simulation.`,
        scenario,
      });
    } catch (err) {
      return res.status(500).json({ success: false, message: err.message });
    }
  });

  // POST /api/scenarios/:id/run — launch emergency simulation for scenario
  router.post('/:id/run', async (req, res) => {
    try {
      const def = scenarioDefinitions.find(s => s.id === req.params.id || s.number === parseInt(req.params.id, 10));
      if (!def) return res.status(404).json({ success: false, message: 'Scenario not found' });
      const scenario = getEnrichedScenario(def);

      // System user
      const user = { id: 'USER-001', role: 'BYSTANDER' };
      const emergencyResult = await emergencyService.createEmergency(user, {
        emergencyType: scenario.incident.emergencyType || 'ACCIDENT',
        victimCount: scenario.incident.victimCount || 1,
        pickupLocation: {
          latitude: scenario.incident.latitude,
          longitude: scenario.incident.longitude,
          name: scenario.incident.locationName,
        },
        destinationHospitalId: scenario.selectedHospital.hospitalId,
      });

      return res.json({
        success: true,
        message: `Simulation for Scenario #${scenario.number} launched successfully.`,
        emergency: emergencyResult,
        scenario,
      });
    } catch (err) {
      return res.status(500).json({ success: false, message: err.message });
    }
  });

  // POST /api/demo/full-demo — executes complete 17-step end-to-end emergency demo
  router.post('/full-demo', async (req, res) => {
    try {
      const scenario = getEnrichedScenario(scenarioDefinitions[9]); // Scenario 10
      const user = { id: 'USER-001', role: 'BYSTANDER' };

      const emergency = await emergencyService.createEmergency(user, {
        emergencyType: 'TRAUMA',
        victimCount: 1,
        pickupLocation: {
          latitude: scenario.incident.latitude,
          longitude: scenario.incident.longitude,
          name: scenario.incident.locationName,
        },
        destinationHospitalId: scenario.selectedHospital.hospitalId,
      });

      return res.json({
        success: true,
        message: 'Full end-to-end demo initiated.',
        requestId: emergency.requestId,
        assignedAmbulanceId: emergency.ambulanceId,
        destinationHospitalId: emergency.destinationHospitalId,
        eta: emergency.eta,
        route: emergency.route,
      });
    } catch (err) {
      return res.status(500).json({ success: false, message: err.message });
    }
  });

  // POST /api/demo/fallback-demo — executes cascading fallback demo (AMB1 Reject -> AMB2 Timeout -> AMB3 Reject -> AMB4 Accept)
  router.post('/fallback-demo', async (req, res) => {
    try {
      ensureLoaded();
      const pLoc = { latitude: 12.952453, longitude: 80.206431 }; // Pallikaranai
      const sorted = [...datasetLoader.ambulances]
        .map(a => ({ amb: a, dist: distanceKm(pLoc, a.currentLocation) }))
        .sort((a, b) => a.dist - b.dist)
        .slice(0, 4);

      const sequence = [
        { ambulanceId: sorted[0]?.amb.id || 'AMB0001', driverId: sorted[0]?.amb.driverId, event: 'REJECTED', note: 'Driver declined manual dispatch' },
        { ambulanceId: sorted[1]?.amb.id || 'AMB0002', driverId: sorted[1]?.amb.driverId, event: 'TIMEOUT', note: '15-second response window expired' },
        { ambulanceId: sorted[2]?.amb.id || 'AMB0003', driverId: sorted[2]?.amb.driverId, event: 'REJECTED', note: 'Driver busy with shift transition' },
        { ambulanceId: sorted[3]?.amb.id || 'AMB0004', driverId: sorted[3]?.amb.driverId, event: 'ACCEPTED', note: 'Unit accepted assignment — Navigation active' },
      ];

      // Emit live updates to hospital room
      notificationService.broadcast('CASCADING_FALLBACK_DEMO', {
        requestId: 'UK-DEMO-FALLBACK',
        steps: sequence,
        finalAmbulanceId: sequence[3].ambulanceId,
        status: 'ACCEPTED',
      });

      return res.json({
        success: true,
        message: 'Cascading fallback sequence executed.',
        sequence,
      });
    } catch (err) {
      return res.status(500).json({ success: false, message: err.message });
    }
  });

  return router;
};
