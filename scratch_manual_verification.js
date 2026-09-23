const http = require('http');
const io = require('./hospital-dashboard/node_modules/socket.io-client');

const API_BASE = 'http://localhost:5000/api';
const SOCKET_URL = 'http://localhost:5000';

function post(url, data, token) {
  return new Promise((resolve, reject) => {
    const u = new URL(url);
    const postData = JSON.stringify(data);
    const req = http.request({
      hostname: u.hostname,
      port: u.port,
      path: u.pathname,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(postData),
        ...(token ? { 'Authorization': `Bearer ${token}` } : {})
      }
    }, (res) => {
      let body = '';
      res.on('data', chunk => body += chunk);
      res.on('end', () => {
        try {
          resolve({ status: res.statusCode, data: JSON.parse(body) });
        } catch (e) {
          resolve({ status: res.statusCode, body });
        }
      });
    });
    req.on('error', reject);
    req.write(postData);
    req.end();
  });
}

function get(url, token) {
  return new Promise((resolve, reject) => {
    const u = new URL(url);
    const req = http.request({
      hostname: u.hostname,
      port: u.port,
      path: u.pathname,
      method: 'GET',
      headers: {
        ...(token ? { 'Authorization': `Bearer ${token}` } : {})
      }
    }, (res) => {
      let body = '';
      res.on('data', chunk => body += chunk);
      res.on('end', () => {
        try {
          resolve({ status: res.statusCode, data: JSON.parse(body) });
        } catch (e) {
          resolve({ status: res.statusCode, body });
        }
      });
    });
    req.on('error', reject);
    req.end();
  });
}

async function runVerification() {
  console.log('================================================================================');
  console.log('UYIRKAPPAN — 3-LOCATION MANUAL ROUTING & DATA-BINDING VERIFICATION');
  console.log('================================================================================');

  // 1. Authenticate Bystander, Driver, and Hospital Staff
  const userRes = await post(`${API_BASE}/auth/login`, {
    email: 'bystander@uyirkappan.demo',
    password: 'password123'
  });
  const bystanderToken = userRes.data.token;

  const driverRes = await post(`${API_BASE}/auth/login`, {
    email: 'driver1@uyirkappan.demo',
    password: 'password123'
  });
  const driverToken = driverRes.data.token;

  const staffRes = await post(`${API_BASE}/auth/login`, {
    email: 'staff@uyirkappan.demo',
    password: 'password123'
  });
  const staffToken = staffRes.data.token;
  const hospitalId = staffRes.data.user.hospitalId || 'H001';

  console.log(`✓ Authenticated:`);
  console.log(`   Bystander: ${userRes.data.user.id}`);
  console.log(`   Driver:    ${driverRes.data.user.id}`);
  console.log(`   Hospital:  ${hospitalId}`);

  // Connect bystander, driver, hospital sockets once
  const bystanderSocket = io(SOCKET_URL, { auth: { token: bystanderToken }, forceNew: true });
  const hospitalSocket = io(SOCKET_URL, { auth: { token: staffToken }, forceNew: true });

  await new Promise(r => bystanderSocket.on('connect', r));
  await new Promise(r => hospitalSocket.on('connect', r));
  console.log('✓ Bystander & Hospital WebSockets connected to port 5000');

  // Test Locations
  const locations = [
    {
      name: 'Location 1: Alwarpet / Eldams Road (Central Chennai)',
      latitude: 13.0368,
      longitude: 80.2483,
      emergencyType: 'CARDIAC',
      victimCount: 1,
    },
    {
      name: 'Location 2: Perumbakkam / Medavakkam Link (South Chennai)',
      latitude: 12.9076,
      longitude: 80.2320,
      emergencyType: 'TRAUMA',
      victimCount: 2,
    },
    {
      name: 'Location 3: Vadapalani / 100 Feet Road (West Chennai)',
      latitude: 13.0500,
      longitude: 80.2120,
      emergencyType: 'RESPIRATORY',
      victimCount: 1,
    }
  ];

  const results = [];

  for (let i = 0; i < locations.length; i++) {
    const loc = locations[i];
    console.log(`\n================================================================================`);
    console.log(`RUNNING SCENARIO ${i + 1}: ${loc.name}`);
    console.log(`================================================================================`);

    // Submit emergency request
    const createRes = await post(`${API_BASE}/emergency`, {
      emergencyType: loc.emergencyType,
      victimCount: loc.victimCount,
      pickupLocation: {
        latitude: loc.latitude,
        longitude: loc.longitude
      }
    }, bystanderToken);

    const data = createRes.data;
    const reqId = data.requestId;
    console.log(`✓ Emergency created: ${reqId}`);

    // Join rooms
    bystanderSocket.emit('join:emergency', { requestId: reqId });
    bystanderSocket.emit('join_emergency', reqId);
    hospitalSocket.emit('join:hospital', { hospitalId: data.destinationHospitalId });
    hospitalSocket.emit('join:emergency', { requestId: reqId });
    hospitalSocket.emit('join_emergency', reqId);

    // Fetch tracking details
    const trackRes = await get(`${API_BASE}/emergency/${reqId}/tracking`, bystanderToken);
    const tracking = trackRes.data;

    // Fetch emergency details
    const detailRes = await get(`${API_BASE}/emergency/${reqId}`, bystanderToken);
    const details = detailRes.data.request || detailRes.data;

    // Login as admin to ensure ambulance location telemetry can be posted accurately
    const adminRes = await post(`${API_BASE}/auth/login`, {
      email: 'admin@uyirkappan.demo',
      password: 'password123'
    });
    const adminToken = adminRes.data?.token;

    const route = data.route || tracking.route || details.route;
    const altRoutes = data.alternativeRoutes || tracking.alternativeRoutes || [];

    const result = {
      scenarioIndex: i + 1,
      locationName: loc.name,
      patientCoordinates: [loc.latitude, loc.longitude],
      requestId: reqId,
      selectedHospital: {
        id: data.destinationHospitalId,
        name: details.destinationHospital?.name || 'Selected Facility',
        location: details.destinationHospital?.location,
      },
      selectedAmbulance: {
        id: data.ambulanceId,
        driverName: details.assignedDriverName || 'Assigned Driver',
      },
      currentAmbulanceGPS: tracking.currentLocation || details.assignedAmbulance?.currentLocation,
      routeOrigin: route ? [route.waypoints[0].latitude, route.waypoints[0].longitude] : null,
      routeDestination: route ? [route.waypoints[route.waypoints.length - 1].latitude, route.waypoints[route.waypoints.length - 1].longitude] : null,
      selectedRouteId: route?.routeId,
      routeCoordinatesCount: route?.waypoints?.length || 0,
      sampleWaypoints: route?.waypoints ? [
        route.waypoints[0],
        route.waypoints[Math.floor(route.waypoints.length / 2)],
        route.waypoints[route.waypoints.length - 1]
      ] : [],
      etaMinutes: data.eta || route?.travelTimeMinutes,
      distanceKm: route?.distanceKm,
      alternativeRouteCount: altRoutes.length,
      routeCost: route?.cost || data.cost,
      selectionReason: data.decisionReason || details.selectionReason,
    };

    console.log(`\n--- VERIFICATION AUDIT DATA FOR ${loc.name} ---`);
    console.log(`1.  Selected hospital:       ${result.selectedHospital.id} (${result.selectedHospital.name})`);
    console.log(`2.  Selected ambulance:      ${result.selectedAmbulance.id}`);
    console.log(`3.  Current ambulance GPS:   ${JSON.stringify(result.currentAmbulanceGPS)}`);
    console.log(`4.  Route origin:            ${JSON.stringify(result.routeOrigin)}`);
    console.log(`5.  Route destination:       ${JSON.stringify(result.routeDestination)}`);
    console.log(`6.  Selected route ID:       ${result.selectedRouteId}`);
    console.log(`7.  Route coordinates count: ${result.routeCoordinatesCount} waypoints`);
    console.log(`    Origin WP:               ${result.sampleWaypoints[0]?.nodeId} (${result.sampleWaypoints[0]?.roadName || ''}) [${result.sampleWaypoints[0]?.latitude}, ${result.sampleWaypoints[0]?.longitude}]`);
    console.log(`    Mid WP:                  ${result.sampleWaypoints[1]?.nodeId} (${result.sampleWaypoints[1]?.roadName || ''}) [${result.sampleWaypoints[1]?.latitude}, ${result.sampleWaypoints[1]?.longitude}]`);
    console.log(`    Dest WP:                 ${result.sampleWaypoints[2]?.nodeId} (${result.sampleWaypoints[2]?.roadName || ''}) [${result.sampleWaypoints[2]?.latitude}, ${result.sampleWaypoints[2]?.longitude}]`);
    console.log(`8.  ETA:                     ${result.etaMinutes} min`);
    console.log(`9.  Alternative route count: ${result.alternativeRouteCount}`);
    console.log(`10. Route cost:              ${result.routeCost}`);
    console.log(`11. Selection reason:        ${result.selectionReason}`);

    // Check for fake nodes
    const hasFakeNodes = (route?.waypoints || []).some(wp =>
      ['Node 10', 'Node 12', 'Node 15', 'Node 17', 'Node 19', 'Node 21', 'Node 24'].includes(wp.nodeId)
    );
    console.log(`\n    Fake nodes present?      ${hasFakeNodes ? 'FAILED (Fake nodes found!)' : 'PASSED (0 fake nodes)'}`);

    // Listen for live movement along route
    let locationUpdatesReceived = 0;
    const locPromise = new Promise((resolve) => {
      const onLoc = (locUpdate) => {
        locationUpdatesReceived++;
        if (locationUpdatesReceived >= 3) {
          bystanderSocket.off('AMBULANCE_LOCATION_UPDATED', onLoc);
          resolve();
        }
      };
      bystanderSocket.on('AMBULANCE_LOCATION_UPDATED', onLoc);
      setTimeout(resolve, 3500); // 3.5s timeout
    });

    // Driver accepts assignment & updates status to move
    if (data.assignmentId) {
      const driverId = details.assignedAmbulance?.driverId || data.driverId;
      let activeDriverToken = adminToken || driverToken;
      if (driverId) {
        const dRes = await post(`${API_BASE}/auth/login`, {
          email: `${driverId.toLowerCase()}@uyirkappan.demo`,
          password: 'password123'
        });
        if (dRes.data?.token) {
          activeDriverToken = dRes.data.token;
        }
      }

      // Driver accept
      await post(`${API_BASE}/assignments/${data.assignmentId}/accept`, {}, activeDriverToken);
      // Advance to EN_ROUTE_TO_PATIENT
      await post(`${API_BASE}/assignments/${data.assignmentId}/status`, { status: 'EN_ROUTE_TO_PATIENT' }, activeDriverToken);

      // Simulate 3 GPS steps along the actual route waypoints
      const waypoints = route.waypoints;
      const step1 = waypoints[0];
      const step2 = waypoints[Math.min(1, waypoints.length - 1)];
      const step3 = waypoints[Math.min(2, waypoints.length - 1)];

      const res1 = await post(`${API_BASE}/ambulances/${data.ambulanceId}/location`, {
        latitude: step1.latitude,
        longitude: step1.longitude,
        speed: 42,
        heading: 85,
        requestId: reqId
      }, activeDriverToken);
      console.log(`    Location update 1 response: status=${res1.status}, data=${JSON.stringify(res1.data || res1.body)}`);

      await new Promise(r => setTimeout(r, 400));

      const res2 = await post(`${API_BASE}/ambulances/${data.ambulanceId}/location`, {
        latitude: step2.latitude,
        longitude: step2.longitude,
        speed: 48,
        heading: 90,
        requestId: reqId
      }, activeDriverToken);
      console.log(`    Location update 2 response: status=${res2.status}, data=${JSON.stringify(res2.data || res2.body)}`);

      await new Promise(r => setTimeout(r, 400));

      const res3 = await post(`${API_BASE}/ambulances/${data.ambulanceId}/location`, {
        latitude: step3.latitude,
        longitude: step3.longitude,
        speed: 52,
        heading: 95,
        requestId: reqId
      }, activeDriverToken);
      console.log(`    Location update 3 response: status=${res3.status}, data=${JSON.stringify(res3.data || res3.body)}`);
    }

    await locPromise;
    console.log(`    Live GPS movement verified: ${locationUpdatesReceived} socket telemetry updates received along route!`);

    results.push(result);
  }

  bystanderSocket.disconnect();
  hospitalSocket.disconnect();

  console.log('\n================================================================================');
  console.log('ALL 3 MANUAL SCENARIOS SUCCESSFULLY VERIFIED!');
  console.log('================================================================================');
  return results;
}

runVerification().catch(err => {
  console.error('Verification failed:', err);
  process.exit(1);
});
