const test = require('node:test');
const assert = require('node:assert/strict');
const DispatchService = require('../src/services/dispatch.service');
const { initializeMatcher } = require('../src/matcher');

test('memory-mode dispatch can consider available dataset ambulances without connected drivers', async () => {
  const store = {
    mode: 'memory',
    getActiveAssignmentForDriver: async () => null,
  };
  const onlineDriverIds = new Set(['DRV-ONLINE']);
  const dispatch = new DispatchService(store, {}, onlineDriverIds);

  const ambulance = {
    id: 'AMB-ONLINE',
    driverId: 'DRV-ONLINE',
    status: 'AVAILABLE',
    currentRequestId: null,
    activeEmergencyId: null,
    currentAssignmentId: null,
  };

  assert.equal(await dispatch.isEligibleForAssignment(ambulance), true);
  assert.equal(
    await dispatch.isEligibleForAssignment({ ...ambulance, driverId: 'DRV-OFFLINE' }),
    true,
  );
  assert.equal(
    await dispatch.isEligibleForAssignment({ ...ambulance, driverId: null }),
    true,
  );
});

test('online-driver policy excludes disconnected drivers when explicitly required', async () => {
  const store = {
    mode: 'mongodb',
    getActiveAssignmentForDriver: async () => null,
  };
  const dispatch = new DispatchService(store, {}, new Set(['DRV-ONLINE']), true);
  const ambulance = {
    id: 'AMB-ONLINE',
    driverId: 'DRV-ONLINE',
    status: 'AVAILABLE',
    currentRequestId: null,
    activeEmergencyId: null,
    currentAssignmentId: null,
  };

  assert.equal(await dispatch.isEligibleForAssignment(ambulance), true);
  assert.equal(
    await dispatch.isEligibleForAssignment({ ...ambulance, driverId: 'DRV-OFFLINE' }),
    false,
  );
  assert.equal(
    await dispatch.isEligibleForAssignment({ ...ambulance, driverId: null }),
    false,
  );
});

test('dataset dispatch can rank available ambulances without a connected-driver filter', async () => {
  initializeMatcher(null);
  const store = {
    mode: 'mongodb',
    getAmbulances: async () => [
      {
        id: 'AMB-NEAR',
        driverId: 'DRV-OFFLINE',
        status: 'AVAILABLE',
        currentRequestId: null,
        activeEmergencyId: null,
        currentAssignmentId: null,
        currentLocation: { latitude: 13.044477, longitude: 80.23476 },
        capabilities: [],
      },
      {
        id: 'AMB-FAR',
        driverId: 'DRV-ONLINE',
        status: 'AVAILABLE',
        currentRequestId: null,
        activeEmergencyId: null,
        currentAssignmentId: null,
        currentLocation: { latitude: 13.2146, longitude: 80.3203 },
        capabilities: [],
      },
    ],
    getActiveAssignmentForDriver: async () => null,
  };
  const dispatch = new DispatchService(store, {}, new Set(['DRV-ONLINE']), false);

  const selected = await dispatch.findBestAmbulance({
    requestId: 'REQ-LOCATION-BASED',
    emergencyType: 'CARDIAC',
    victimCount: 1,
    pickupLocation: { latitude: 13.0448, longitude: 80.2234 },
  });

  assert.equal(selected.ambulance.id, 'AMB-NEAR');
});

test('dispatch keeps rejecting connected drivers with an active assignment', async () => {
  const store = {
    mode: 'mongodb',
    getActiveAssignmentForDriver: async () => ({ id: 'ASSIGN-ACTIVE' }),
  };
  const dispatch = new DispatchService(store, {}, new Set(['DRV-ONLINE']));

  assert.equal(
    await dispatch.isEligibleForAssignment({
      id: 'AMB-ONLINE',
      driverId: 'DRV-ONLINE',
      status: 'AVAILABLE',
      currentRequestId: null,
      activeEmergencyId: null,
      currentAssignmentId: null,
    }),
    false,
  );
});
