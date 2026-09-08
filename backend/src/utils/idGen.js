let userCounter = 0;
let emergencyCounter = 0;
let assignmentCounter = 0;
let ambulanceCounter = 0;
let hospitalCounter = 0;
let attemptCounter = 0;
let locationCounter = 0;

const pad = (n, width) => String(n).padStart(width, '0');

module.exports = {
  genUserId: () => `USER-${pad(++userCounter, 3)}`,
  genEmergencyRequestId: () => `UK-${new Date().getFullYear()}-${pad(++emergencyCounter, 6)}`,
  genAssignmentId: () => `ASSIGN-${pad(++assignmentCounter, 3)}`,
  genAmbulanceId: () => `AMB-${pad(++ambulanceCounter, 2)}`,
  genHospitalId: () => `HOSP-${pad(++hospitalCounter, 2)}`,
  genAttemptId: () => `ATTEMPT-${pad(++attemptCounter, 3)}`,
  genLocationId: () => `LOC-${pad(++locationCounter, 5)}`,
  // Setters — used by MongoStore.synchronizeCounters() so IDs stay unique across restarts.
  setUserIdCounter: (n) => { userCounter = n; },
  setEmergencyCounter: (n) => { emergencyCounter = n; },
  setAssignmentCounter: (n) => { assignmentCounter = n; },
  setAmbulanceCounter: (n) => { ambulanceCounter = n; },
  setHospitalCounter: (n) => { hospitalCounter = n; },
  setAttemptCounter: (n) => { attemptCounter = n; },
  setLocationCounter: (n) => { locationCounter = n; },
};