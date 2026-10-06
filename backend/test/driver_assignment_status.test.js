const test = require('node:test');
const assert = require('node:assert/strict');
const { getDriverAssignmentStatus } = require('../src/routes/driver.routes');

test('active assignment polling returns current emergency lifecycle status', () => {
  const assignment = { status: 'ACCEPTED' };

  assert.equal(
    getDriverAssignmentStatus(assignment, { status: 'DRIVER_ACCEPTED' }),
    'ACCEPTED',
  );
  assert.equal(
    getDriverAssignmentStatus(assignment, { status: 'ARRIVED_AT_PATIENT' }),
    'ARRIVED_AT_PATIENT',
  );
  assert.equal(
    getDriverAssignmentStatus(assignment, { status: 'PATIENT_ONBOARD' }),
    'PATIENT_ONBOARD',
  );
  assert.equal(
    getDriverAssignmentStatus(assignment, { status: 'EN_ROUTE_TO_HOSPITAL' }),
    'EN_ROUTE_TO_HOSPITAL',
  );
});

test('pending assignment status remains pending until driver responds', () => {
  assert.equal(
    getDriverAssignmentStatus(
      { status: 'PENDING' },
      { status: 'ASSIGNED' },
    ),
    'PENDING',
  );
});
