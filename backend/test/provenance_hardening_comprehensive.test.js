const { test, describe, before, after } = require('node:test');
const assert = require('node:assert/strict');
const express = require('express');

const {
  DataClassification,
  DataContaminationError,
  REFERENCE_BASELINE_AMBULANCE_IDS,
  DATA_SOURCE_INVENTORY,
  assertOperationalAmbulanceBoundary,
  assertOperationalEmergencyBoundary,
  auditOperationalStatePurity,
} = require('../src/config/provenance');

const { MemoryStore } = require('../src/data/memoryStore');
const { datasetLoader } = require('../src/data/datasetLoader');
const { baselineDatasetService } = require('../src/services/evaluation');
const { getTrafficProvider } = require('../src/services/traffic');
const buildSystemRoutes = require('../src/routes/system.routes');
const buildEvaluationRoutes = require('../src/routes/evaluation.routes');

describe('Phase 20: Data Source Separation & Provenance Hardening Test Suite', () => {
  let app;
  let server;
  let baseUrl;
  let testPort;
  let store;

  before(async () => {
    datasetLoader.loadAll();
    store = new MemoryStore();
    await store.seed();

    app = express();
    app.use(express.json());
    app.use('/api/system', buildSystemRoutes({ store }));
    app.use('/api/evaluation', buildEvaluationRoutes({ store }));

    testPort = 4470;
    await new Promise((resolve) => {
      server = app.listen(testPort, () => {
        baseUrl = `http://localhost:${testPort}/api`;
        resolve();
      });
    });
  });

  after(() => {
    if (server) server.close();
  });

  test('Test A: Attempting to inject a reference baseline token into operational fleet is REJECTED', () => {
    assert.throws(
      () => {
        assertOperationalAmbulanceBoundary({
          id: 'AMB-001',
          currentLocation: { latitude: 13.08, longitude: 80.27 },
        });
      },
      (err) => {
        assert.ok(err instanceof DataContaminationError);
        assert.match(err.message, /CONTAMINATION REJECTED: Reference baseline token/);
        return true;
      }
    );
  });

  test('Test B: All 4 reference baseline tokens (AMB-001–AMB-004) are strictly blocked from operational fleet', () => {
    for (const ambId of REFERENCE_BASELINE_AMBULANCE_IDS) {
      assert.throws(
        () => {
          assertOperationalAmbulanceBoundary({
            id: ambId,
            currentLocation: { latitude: 13.08, longitude: 80.27 },
          });
        },
        DataContaminationError
      );
    }
  });

  test('Test C: Out-of-bounds geographic coordinates are rejected by operational boundary guard', () => {
    // Madurai coordinates (~9.92N, 78.12E) must not enter Chennai operational fleet
    assert.throws(
      () => {
        assertOperationalAmbulanceBoundary({
          id: 'AMB9999',
          currentLocation: { latitude: 9.92, longitude: 78.12 },
        });
      },
      (err) => {
        assert.ok(err instanceof DataContaminationError);
        assert.match(err.message, /GEOGRAPHIC INTEGRITY REJECTED/);
        return true;
      }
    );
  });

  test('Test D: Historical 108 case IDs (13-digit Madurai IDs) are rejected by emergency boundary guard', () => {
    assert.throws(
      () => {
        assertOperationalEmergencyBoundary({
          requestId: '2025110104332',
          pickupLocation: { latitude: 13.08, longitude: 80.27 },
        });
      },
      (err) => {
        assert.ok(err instanceof DataContaminationError);
        assert.match(err.message, /Historical 108 case ID/);
        return true;
      }
    );
  });

  test('Test E: Operational fleet in dataStore contains zero reference baseline tokens', async () => {
    const purity = await auditOperationalStatePurity(store);
    assert.equal(purity.pure, true, 'Operational store must be pure');
    assert.equal(purity.errors.length, 0);
    assert.equal(purity.fleetCount, 131, 'Operational fleet must contain exactly 131 Chennai units');

    const ambs = await store.getAmbulances();
    for (const amb of ambs) {
      assert.ok(
        !REFERENCE_BASELINE_AMBULANCE_IDS.includes(amb.id),
        `Ambulance ${amb.id} must not be a reference baseline token`
      );
    }
  });

  test('Test F: Evaluation endpoints do not mutate operational dispatch state', async () => {
    const initialAmbulances = await store.getAmbulances();
    const initialEmergencies = typeof store.getEmergencies === 'function' ? await store.getEmergencies() : [];

    // Query evaluation endpoints
    await fetch(`${baseUrl}/evaluation/baseline/metadata`);
    await fetch(`${baseUrl}/evaluation/baseline?limit=10`);
    await fetch(`${baseUrl}/evaluation/108-summary`);
    await fetch(`${baseUrl}/evaluation/108-comparison`);

    const finalAmbulances = await store.getAmbulances();
    const finalEmergencies = typeof store.getEmergencies === 'function' ? await store.getEmergencies() : [];

    assert.equal(finalAmbulances.length, initialAmbulances.length);
    assert.equal(finalEmergencies.length, initialEmergencies.length);
  });

  test('Test G: Simulation traffic changes do not mutate reference baseline dataset', () => {
    const baselineBefore = baselineDatasetService.getMetadata();
    const simTraffic = getTrafficProvider();

    // Apply traffic modification
    simTraffic.setTrafficState('N01', 'N02', 'BLOCKED');

    const baselineAfter = baselineDatasetService.getMetadata();
    assert.equal(baselineAfter.rowCount, baselineBefore.rowCount);
    assert.equal(
      baselineAfter.statistics.responseTime.meanMinutes,
      baselineBefore.statistics.responseTime.meanMinutes
    );
    assert.equal(baselineAfter.classification, 'REFERENCE_BASELINE');

    // Clean up traffic override
    simTraffic.clearAllOverrides();
  });

  test('Test H: Traffic provider explicitly reports simulation provenance without claiming live feed', () => {
    const traffic = getTrafficProvider();
    const status = traffic.getProviderStatus();

    assert.equal(status.name, 'SimulationTrafficProvider');
    assert.equal(status.isLive, false);
    assert.equal(status.source, 'SIMULATED_TRAFFIC');
  });

  test('Test I: DATA_SOURCE_INVENTORY covers all major project datasets with correct classification', () => {
    assert.ok(DATA_SOURCE_INVENTORY.length >= 12, 'Inventory must catalog all data assets');

    const classifications = DATA_SOURCE_INVENTORY.map((d) => d.classification);
    assert.ok(classifications.includes(DataClassification.REFERENCE_BASELINE));
    assert.ok(classifications.includes(DataClassification.SIMULATION));
    assert.ok(classifications.includes(DataClassification.STATIC_INFRASTRUCTURE));
    assert.ok(classifications.includes(DataClassification.OPERATIONAL));

    const xlsxSource = DATA_SOURCE_INVENTORY.find((d) => d.source.includes('dummy_ambulance_data.xlsx'));
    assert.ok(xlsxSource);
    assert.equal(xlsxSource.isLive, false);
    assert.equal(xlsxSource.isOperational, false);
    assert.equal(xlsxSource.classification, DataClassification.REFERENCE_BASELINE);
  });

  test('Test J: GET /api/system/provenance returns full inventory and operational purity audit', async () => {
    const res = await fetch(`${baseUrl}/system/provenance`);
    assert.equal(res.status, 200);
    const body = await res.json();

    assert.equal(body.success, true);
    assert.ok(body.classifications.includes('REFERENCE_BASELINE'));
    assert.ok(body.classifications.includes('OPERATIONAL'));
    assert.equal(body.purityAudit.pure, true);
    assert.equal(body.purityAudit.fleetCount, 131);
    assert.ok(body.inventory.length >= 12);
  });

  test('Test K: GET /api/system/data-status includes provenance verification in response', async () => {
    const res = await fetch(`${baseUrl}/system/data-status`);
    assert.equal(res.status, 200);
    const body = await res.json();

    assert.equal(body.success, true);
    assert.ok(body.provenance);
    assert.equal(body.provenance.operationalFleetPurity, true);
    assert.equal(body.provenance.fleetClassification, 'SIMULATION');
    assert.equal(body.provenance.referenceDataIsolated, true);
  });
});
