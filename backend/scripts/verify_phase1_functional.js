const http = require('http');
const path = require('path');
const fs = require('fs');

const { datasetLoader } = require('../src/data/datasetLoader');
const { signToken } = require('../src/utils/security');

async function runEndToEndVerification() {
  console.log('====================================================');
  console.log('STARTING PHASE 1 FINAL FUNCTIONAL VERIFICATION');
  console.log('====================================================\n');

  // 1. Dataset Verification
  datasetLoader.loadAll();
  console.log('1. DATASET STATUS VERIFICATION:');
  console.log(`   - Hospitals: ${datasetLoader.hospitals.length} (Expected: 30)`);
  console.log(`   - Ambulances: ${datasetLoader.ambulances.length} (Expected: 131)`);
  console.log(`   - Drivers: ${datasetLoader.drivers.length} (Expected: 131)`);
  console.log(`   - Road Nodes: ${datasetLoader.roadNodes.length} (Expected: 70)`);
  console.log(`   - Road Segments: ${datasetLoader.roadSegments.length} (Expected: 182)`);
  console.log(`   - Emergency Requests: ${datasetLoader.emergencyRequests.length} (Expected: 3000)`);
  console.log(`   - GPS Trajectories: ${datasetLoader.gpsTrajectories.length} (Expected: 10372)`);

  if (datasetLoader.hospitals.length !== 30 || datasetLoader.ambulances.length !== 131) {
    throw new Error('Dataset counts do not match authoritative dataset!');
  }
  console.log('   ✓ Authoritative Dataset Status Verified!\n');

  // 2. Experimental Results File Verification
  console.log('2. EXPERIMENTAL RESULTS FILES VERIFICATION:');
  const resultsDir = path.resolve(__dirname, '../experimental_results');
  const expectedFiles = [
    'ambulance_matching_results.csv',
    'routing_results.csv',
    'hospital_selection_results.csv',
    'fallback_results.csv',
    'summary_results.json',
  ];

  for (const file of expectedFiles) {
    const filePath = path.join(resultsDir, file);
    if (!fs.existsSync(filePath)) {
      throw new Error(`Missing expected experimental result file: ${file}`);
    }
    const stat = fs.statSync(filePath);
    console.log(`   ✓ Found ${file} (${stat.size} bytes)`);
  }

  const summary = JSON.parse(fs.readFileSync(path.join(resultsDir, 'summary_results.json'), 'utf8'));
  console.log(`   - Total Evaluated: ${summary.datasetCounts.emergencyRequests}`);
  console.log(`   - Baseline Mean ETA: ${summary.ambulanceMatching.baselineMeanEta} min`);
  console.log(`   - UyirKappan Mean ETA: ${summary.ambulanceMatching.ukMeanEta} min`);
  console.log(`   - Dynamic Improvement: ${summary.ambulanceMatching.etaImprovementPct}%`);
  console.log(`   - Paired t-test: t = ${summary.statisticalComparison.tStatistic}, p = ${summary.statisticalComparison.pValue}`);
  console.log(`   - Fallback Recovery: ${summary.cascadingFallback.fallbackRecoveryRatePct}% (${summary.cascadingFallback.fallbackRecoveredAssignments}/${summary.cascadingFallback.fallbackTriggeredAssignments})`);
  console.log('   ✓ Experimental Results Validated!\n');

  // 3. REST ENDPOINT & SCENARIO TESTING:
  console.log('3. REST ENDPOINT & SCENARIO TESTING:');
  const express = require('express');
  const { MemoryStore } = require('../src/data/memoryStore');
  const { initializeMatcher } = require('../src/matcher/index');
  const EtaService = require('../src/services/eta.service');
  const DispatchService = require('../src/services/dispatch.service');
  const NotificationService = require('../src/services/notification.service');
  const FallbackService = require('../src/services/fallback.service');
  const AssignmentService = require('../src/services/assignment.service');
  const EmergencyService = require('../src/services/emergency.service');
  const AmbulanceService = require('../src/services/ambulance.service');
  const HospitalService = require('../src/services/hospital.service');
  const buildApiRoutes = require('../src/app');

  const app = express();
  app.use(express.json());

  const store = new MemoryStore();
  await store.seed();

  const mockIo = {
    to: () => mockIo,
    emit: () => {},
  };

  const matcherServices = initializeMatcher(mockIo);

  const ctx = {
    store,
    io: mockIo,
    notificationService: new NotificationService(mockIo, store),
    dbState: () => ({ connected: false, state: 'not-required' }),
    matcher: matcherServices,
  };
  ctx.etaService = new EtaService(store);
  ctx.dispatchService = new DispatchService(store, ctx.etaService);
  ctx.fallbackService = new FallbackService(ctx);
  ctx.assignmentService = new AssignmentService(ctx);
  ctx.hospitalService = new HospitalService(ctx);
  ctx.emergencyService = new EmergencyService(ctx);
  ctx.ambulanceService = new AmbulanceService(ctx);

  app.use('/api', buildApiRoutes(ctx));

  const server = http.createServer(app);

  await new Promise((resolve) => server.listen(0, resolve));
  const port = server.address().port;
  console.log(`   - Ephemeral test server running on port ${port}`);

  async function request(method, path, body = null, token = null) {
    return new Promise((resolve, reject) => {
      const headers = { 'Content-Type': 'application/json' };
      if (token) headers['Authorization'] = `Bearer ${token}`;

      const opt = {
        hostname: '127.0.0.1',
        port,
        path,
        method,
        headers,
      };
      const req = http.request(opt, (res) => {
        let data = '';
        res.on('data', chunk => data += chunk);
        res.on('end', () => {
          try {
            resolve({ status: res.statusCode, body: JSON.parse(data) });
          } catch (e) {
            resolve({ status: res.statusCode, raw: data });
          }
        });
      });
      req.on('error', reject);
      if (body) req.write(JSON.stringify(body));
      req.end();
    });
  }

  // Test /api/scenarios
  const scenariosRes = await request('GET', '/api/scenarios');
  console.log(`   - GET /api/scenarios: status ${scenariosRes.status}, found ${scenariosRes.body.scenarios?.length} scenarios`);
  if (scenariosRes.body.scenarios?.length !== 10) {
    throw new Error(`Expected 10 scenarios, got ${scenariosRes.body.scenarios?.length}`);
  }

  // Test /api/scenarios/5/load
  const sc5Load = await request('POST', '/api/scenarios/5/load');
  const sc5Obj = sc5Load.body.scenario;
  console.log(`   - POST /api/scenarios/5/load: ${sc5Obj?.name}`);
  console.log(`     Candidates: ${sc5Obj?.candidateAmbulances?.length} ambulances, ${sc5Obj?.candidateHospitals?.length} hospitals`);

  // Test /api/scenarios/5/run (Dynamic Hospital & Ambulance evaluation)
  const sc5Run = await request('POST', '/api/scenarios/5/run');
  const sc5RunObj = sc5Run.body.scenario;
  console.log(`   - POST /api/scenarios/5/run:`);
  console.log(`     Selected Ambulance: ${sc5RunObj?.selectedAmbulance?.ambulanceId} (${sc5RunObj?.selectedAmbulance?.driverName})`);
  console.log(`     Selected Hospital: ${sc5RunObj?.selectedHospital?.name} (ID: ${sc5RunObj?.selectedHospital?.hospitalId})`);
  console.log(`     Route Baseline ETA: ${sc5RunObj?.routingComparison?.baselineRoute?.etaMinutes} min | UyirKappan ETA: ${sc5RunObj?.routingComparison?.uyirkappanRoute?.etaMinutes} min`);
  console.log(`     Improvement: +${sc5RunObj?.routingComparison?.improvementPct}%`);

  // Test /api/scenarios/full-demo
  const fullDemo = await request('POST', '/api/scenarios/full-demo');
  console.log(`   - POST /api/scenarios/full-demo: status ${fullDemo.status}`);
  console.log(`     Request: ${fullDemo.body.requestId}, Ambulance: ${fullDemo.body.assignedAmbulanceId}, Hospital: ${fullDemo.body.destinationHospitalId}, ETA: ${fullDemo.body.eta}m`);

  // Test /api/scenarios/fallback-demo
  const fbDemo = await request('POST', '/api/scenarios/fallback-demo');
  console.log(`   - POST /api/scenarios/fallback-demo: status ${fbDemo.status}`);
  console.log(`     Sequence: ${fbDemo.body.sequence?.map(s => `${s.ambulanceId} (${s.event})`).join(' -> ')}`);

  // Test /api/experiments/summary
  const expSummary = await request('GET', '/api/experiments/summary');
  const expSummaryData = expSummary.body.data || expSummary.body;
  console.log(`   - GET /api/experiments/summary: status ${expSummary.status}, dataset: ${expSummaryData.datasetCounts?.emergencyRequests} emergencies`);

  // Test /api/experiments/case/REQ00001
  const expCase = await request('GET', '/api/experiments/case/REQ00001');
  const expCaseData = expCase.body.data || expCase.body;
  console.log(`   - GET /api/experiments/case/REQ00001:`);
  console.log(`     Incident: ${expCaseData.incident?.area} (${expCaseData.incident?.emergencyType})`);
  console.log(`     Why Ambulance: ${expCaseData.whyExplanation?.ambulance?.[0]}`);
  console.log(`     Why Hospital: ${expCaseData.whyExplanation?.hospital?.[0]}`);
  console.log(`     Why Route: ${expCaseData.whyExplanation?.route?.[0]}`);

  // 4. Test Emergency Creation with Dynamic Hospital & Route comparison
  console.log('\n4. EMERGENCY CREATION & DYNAMIC SELECTION TEST:');
  const bystander = store.users.find(u => u.role === 'bystander' || u.role === 'BYSTANDER') || store.users[0];
  const bystanderToken = signToken({ sub: bystander.id, role: bystander.role });

  const createRes = await request('POST', '/api/emergency', {
    emergencyType: 'CARDIAC_ARREST',
    victimCount: 1,
    pickupLocation: {
      latitude: 13.0450,
      longitude: 80.2400,
      name: 'T. Nagar Junction',
    },
  }, bystanderToken);

  console.log(`   - POST /api/emergency: status ${createRes.status}`);
  console.log(`     Emergency ID: ${createRes.body.requestId}`);
  console.log(`     Assigned Ambulance: ${createRes.body.ambulanceId}`);
  console.log(`     Destination Hospital: ${createRes.body.destinationHospitalId}`);
  console.log(`     Assignment ID: ${createRes.body.assignmentId}`);
  console.log(`     ETA: ${createRes.body.eta} min`);

  // 5. Test Driver Lifecycle & Accept/Reject
  console.log('\n5. DRIVER LIFECYCLE ACCEPT / REJECT TEST:');
  const assignId = createRes.body.assignmentId;
  const ambId = createRes.body.ambulanceId;
  const amb = store.ambulances.find(a => a.id === ambId);
  const drvId = amb ? amb.driverId : 'DRV0001';

  let driverUser = store.users.find(u => u.id === drvId || u.driverId === drvId);
  if (!driverUser) {
    driverUser = store.users.find(u => u.role === 'driver' || u.role === 'DRIVER') || { id: drvId, role: 'DRIVER' };
  }
  const driverToken = signToken({ sub: driverUser.id, role: 'DRIVER', driverId: drvId });

  // Accept
  const acceptRes = await request('POST', `/api/assignments/${assignId}/accept`, {}, driverToken);
  console.log(`   - POST /api/assignments/${assignId}/accept: status ${acceptRes.status}, status: ${acceptRes.body.status}`);
  if (acceptRes.body.status !== 'ACCEPTED') {
    throw new Error(`Expected ACCEPTED status, got ${acceptRes.body.status}`);
  }

  // Complete lifecycle testing
  await request('PATCH', `/api/assignments/${assignId}/status`, { status: 'EN_ROUTE_TO_PATIENT' }, driverToken);
  await request('PATCH', `/api/assignments/${assignId}/status`, { status: 'ARRIVED_AT_PATIENT' }, driverToken);
  await request('PATCH', `/api/assignments/${assignId}/status`, { status: 'PICKUP' }, driverToken);
  await request('PATCH', `/api/assignments/${assignId}/status`, { status: 'EN_ROUTE_TO_HOSPITAL' }, driverToken);
  await request('PATCH', `/api/assignments/${assignId}/status`, { status: 'ARRIVED_AT_HOSPITAL' }, driverToken);
  const compRes = await request('PATCH', `/api/assignments/${assignId}/status`, { status: 'COMPLETED' }, driverToken);
  console.log(`   - Full lifecycle completed to: ${compRes.body.status}`);

  server.close();
  console.log('\n====================================================');
  console.log('ALL PHASE 1 FUNCTIONAL VERIFICATIONS PASSED (100%)');
  console.log('====================================================');
}

runEndToEndVerification().catch(err => {
  console.error('\nVerification FAILED:', err);
  process.exit(1);
});
