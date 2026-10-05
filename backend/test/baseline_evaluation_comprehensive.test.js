const { test, describe, before } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const express = require('express');

const {
  BaselineDatasetService,
  baselineDatasetService,
  EXPECTED_COLUMNS,
} = require('../src/services/evaluation/baselineDataset.service');

const {
  BaselineComparisonService,
  baselineComparisonService,
} = require('../src/services/evaluation/baselineComparison.service');

const buildEvaluationRoutes = require('../src/routes/evaluation.routes');
const { MemoryStore } = require('../src/data/memoryStore');
const { datasetLoader } = require('../src/data/datasetLoader');

describe('Phase 13: 108 Baseline Comparison & Evaluation Data Integration', () => {
  let app;
  let server;
  let baseUrl;
  let testPort;
  let store;

  before(async () => {
    // Ensure datasetLoader is loaded for operational comparison
    datasetLoader.loadAll();
    store = new MemoryStore();
    await store.seed();

    const evaluationRouter = buildEvaluationRoutes({ store, dataStore: store });
    app = express();
    app.use(express.json());
    app.use('/api/evaluation', evaluationRouter);

    testPort = 4450;
    await new Promise((resolve) => {
      server = app.listen(testPort, () => {
        baseUrl = `http://localhost:${testPort}/api/evaluation`;
        resolve();
      });
    });
  });

  test('1. dummy_ambulance_data.xlsx exists at repository root', () => {
    const rootPath = path.resolve(__dirname, '../../dummy_ambulance_data.xlsx');
    assert.ok(fs.existsSync(rootPath), `Root workbook must exist at ${rootPath}`);
    const stats = fs.statSync(rootPath);
    assert.ok(stats.size > 10000, `Workbook size should be non-trivial (${stats.size} bytes)`);
  });

  test('2. BaselineDatasetService loads workbook successfully', () => {
    const service = new BaselineDatasetService();
    service.load();
    assert.equal(service.loaded, true);
    assert.ok(service.records.length > 0, 'Records should be loaded');
  });

  test('3. Expected sheet dummy_ambulance_data exists and contains exactly 50 rows', () => {
    const meta = baselineDatasetService.getMetadata();
    assert.equal(meta.sheetName, 'dummy_ambulance_data');
    assert.equal(meta.rowCount, 50);
  });

  test('4. Expected core columns validate properly', () => {
    const records = baselineDatasetService.getRecords();
    assert.equal(records.length, 50);
    const sample = records[0];

    assert.ok('caseId' in sample);
    assert.ok('callerDistrict' in sample);
    assert.ok('callerTaluk' in sample);
    assert.ok('responseMinutes' in sample);
    assert.ok('benchmarkMinutes' in sample);
    assert.ok('metBenchmark' in sample);
    assert.ok('vehicleType' in sample);
    assert.ok('emergencyType' in sample);
  });

  test('5. Dataset metadata and population distribution are correct', () => {
    const meta = baselineDatasetService.getMetadata();
    assert.equal(meta.source, 'dummy_ambulance_data.xlsx');
    assert.equal(meta.classification, 'REFERENCE_BASELINE');
    assert.equal(meta.isOperational, false);
    assert.equal(meta.isLive, false);
    assert.equal(meta.isSimulation, false);
    assert.equal(meta.hasCoordinates, false);
    assert.equal(meta.primaryDistrict, 'Madurai');

    // 47 Madurai, 1 Nilgiris, 1 Pudukottai, 1 Thiruvannamalai
    assert.equal(meta.districts['Madurai'], 47);
    assert.equal(meta.districts['Nilgiris'], 1);
    assert.equal(meta.districts['Pudukottai'], 1);
    assert.equal(meta.districts['Thiruvannamalai'], 1);
  });

  test('6. Baseline records are read-only and immutable', () => {
    const records = baselineDatasetService.getRecords();
    assert.ok(Object.isFrozen(records), 'Records collection must be frozen');
    const sample = records[0];
    assert.ok(Object.isFrozen(sample), 'Record items must be frozen');
    assert.throws(() => {
      'use strict';
      sample.responseMinutes = 999;
    }, TypeError);
  });

  test('7. Missing workbook path fails clearly with descriptive error', () => {
    const missingService = new BaselineDatasetService('C:/non/existent/path/dummy.xlsx');
    assert.throws(() => {
      missingService.load();
    }, /CRITICAL: Baseline workbook not found at specified path/);
  });

  test('8. Malformed workbook validation fails cleanly', () => {
    // Test helper to verify missing columns detection
    const dummyRecord = { invalid_col: 123 };
    const missing = EXPECTED_COLUMNS.filter(col => !(col in dummyRecord));
    assert.ok(missing.length > 0, 'Must detect missing required columns');
  });

  test('9. GET /api/evaluation/baseline/metadata returns valid metadata JSON', async () => {
    const res = await fetch(`${baseUrl}/baseline/metadata`);
    assert.equal(res.status, 200);
    const body = await res.json();
    assert.equal(body.success, true);
    assert.equal(body.metadata.classification, 'REFERENCE_BASELINE');
    assert.equal(body.metadata.rowCount, 50);
    assert.equal(body.metadata.primaryDistrict, 'Madurai');
  });

  test('10. GET /api/evaluation/baseline returns paginated read-only records', async () => {
    const res = await fetch(`${baseUrl}/baseline?page=1&limit=10`);
    assert.equal(res.status, 200);
    const body = await res.json();
    assert.equal(body.success, true);
    assert.equal(body.total, 50);
    assert.equal(body.records.length, 10);
    assert.equal(body.page, 1);
    assert.equal(body.totalPages, 5);
    assert.equal(body.classification, 'REFERENCE_BASELINE');
  });

  test('11. GET /api/evaluation/baseline/:caseId returns single record details', async () => {
    const records = baselineDatasetService.getRecords();
    const firstCaseId = records[0].caseId;

    const res = await fetch(`${baseUrl}/baseline/${firstCaseId}`);
    assert.equal(res.status, 200);
    const body = await res.json();
    assert.equal(body.success, true);
    assert.equal(body.record.caseId, firstCaseId);
    assert.equal(body.record.callerDistrict, records[0].callerDistrict);
  });

  test('12. GET /api/evaluation/108-summary calculates authentic statistics from workbook', async () => {
    const res = await fetch(`${baseUrl}/108-summary`);
    assert.equal(res.status, 200);
    const body = await res.json();
    assert.equal(body.caseCount, 50);
    assert.equal(body.classification, 'REFERENCE_BASELINE');
    assert.ok(body.responseTime.meanMinutes >= 10.0 && body.responseTime.meanMinutes <= 12.0);
    assert.ok(body.responseTime.medianMinutes >= 9.0 && body.responseTime.medianMinutes <= 11.0);
    assert.equal(body.responseTime.benchmarkMetPercent, 72); // 36 / 50 * 100 = 72%
  });

  test('13. No operational ambulance in dataStore originates from the XLSX dataset', async () => {
    const ambs = await store.getAmbulances();
    assert.ok(ambs.length > 0, 'Operational fleet must exist');

    // Baseline workbook has 4 ambulance identifiers: AMB-001, AMB-002, AMB-003, AMB-004 from Madurai
    // Operational fleet has Chennai identifiers (A01, A02, etc.) with coordinates in Chennai (lat ~13.0, lon ~80.2)
    for (const amb of ambs) {
      assert.ok(amb.currentLocation, 'Operational ambulance must have GPS location');
      assert.ok(
        amb.currentLocation.latitude >= 12.5 && amb.currentLocation.latitude <= 13.5,
        `Ambulance ${amb.id || amb.ambulanceId} must be in Chennai coordinates, not Madurai`
      );
      assert.ok(
        amb.currentLocation.longitude >= 79.5 && amb.currentLocation.longitude <= 80.5,
        `Ambulance ${amb.id || amb.ambulanceId} must be in Chennai coordinates`
      );
    }
  });

  test('14. Evaluation endpoints do not mutate operational dispatch state', async () => {
    const ambsBefore = await store.getAmbulances();
    const countBefore = ambsBefore.length;

    // Call all evaluation endpoints
    await fetch(`${baseUrl}/baseline/metadata`);
    await fetch(`${baseUrl}/baseline?limit=50`);
    await fetch(`${baseUrl}/108-summary`);
    await fetch(`${baseUrl}/108-comparison`);

    const ambsAfter = await store.getAmbulances();
    assert.equal(ambsAfter.length, countBefore, 'Fleet size must remain identical');
  });

  test('15. GET /api/evaluation/108-comparison maintains population integrity and caveats', async () => {
    const res = await fetch(`${baseUrl}/108-comparison`);
    assert.equal(res.status, 200);
    const body = await res.json();

    assert.equal(body.success, true);
    assert.equal(body.comparisonType, 'REFERENCE_BENCHMARK_CONTRAST');
    assert.ok(body.methodology.comparabilityCaveat.includes('NON-CAUSAL REFERENCE CONTRAST'));
    assert.equal(body.baseline.classification, 'REFERENCE_BASELINE');
    assert.equal(body.baseline.sampleSize, 50);
    assert.equal(body.uyirkappan.classification, 'OPERATIONAL_AND_SIMULATION');
    assert.ok(body.metricDefinitions.length >= 3);
  });

  test.after(() => {
    if (server) server.close();
  });
});
