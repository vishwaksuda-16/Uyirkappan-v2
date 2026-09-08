import http from "http";
import express from "express";
import { Server } from "socket.io";

import {
  Ambulance,
  EmergencyRequest
} from "../dispatch/dispatch.types.js";

import {
  CandidateFilterService
} from "../dispatch/candidate-filter.service.js";

import {
  ScoringService
} from "../dispatch/scoring.service.js";

import {
  DispatchEngineService
} from "../dispatch/dispatch-engine.service.js";

import {
  AssignmentService
} from "../assignment/assignment.service.js";

import {
  FallbackService
} from "./fallback.service.js";

import {
  FallbackOrchestratorService
} from "./fallback-orchestrator.service.js";

import {
  createVirtualRoadNetwork
} from "../routing/virtual-road-network.js";

import {
  DijkstraService
} from "../routing/dijkstra.service.js";

import {
  NearestNodeService
} from "../routing/nearest-node.service.js";

import {
  TrafficService
} from "../traffic/traffic.service.js";

import {
  ETAService
} from "../eta/eta.service.js";

import {
  SocketEventsService
} from "../../websocket/socket-events.service.js";


/*
 * ==================================================
 * ROUTING
 * ==================================================
 */

const graph =
  createVirtualRoadNetwork();

const traffic =
  new TrafficService();

const nearestNodeService =
  new NearestNodeService(
    graph
  );

const dijkstraService =
  new DijkstraService(
    graph,
    traffic
  );

const etaService =
  new ETAService(
    nearestNodeService,
    dijkstraService
  );


/*
 * ==================================================
 * DISPATCH
 * ==================================================
 */

const candidateFilterService =
  new CandidateFilterService();

const scoringService =
  new ScoringService();

const dispatchEngineService =
  new DispatchEngineService(
    candidateFilterService,
    etaService,
    scoringService
  );


/*
 * ==================================================
 * SOCKET.IO
 * ==================================================
 *
 * The fallback orchestrator now requires
 * SocketEventsService.
 *
 * This test does not need a real client yet,
 * but it needs a Socket.IO Server instance
 * so SocketEventsService can be created.
 */

const app =
  express();

const httpServer =
  http.createServer(app);

const io =
  new Server(
    httpServer,
    {
      cors: {
        origin: "*"
      }
    }
  );

const socketEventsService =
  new SocketEventsService(
    io
  );


/*
 * ==================================================
 * ASSIGNMENT + FALLBACK
 * ==================================================
 */

const assignmentService =
  new AssignmentService();

const fallbackService =
  new FallbackService();

const fallbackOrchestrator =
  new FallbackOrchestratorService(
    dispatchEngineService,
    assignmentService,
    fallbackService,
    socketEventsService
  );


/*
 * ==================================================
 * EMERGENCY
 * ==================================================
 */

const emergency: EmergencyRequest = {
  requestId:
    "REQ-FB-001",

  emergencyType:
    "CARDIAC_EMERGENCY",

  victimCount:
    1,

  pickupLocation: {
    latitude:
      13.0800,

    longitude:
      80.2780
  },

  createdAt:
    new Date(),

  priority:
    "CRITICAL"
};


/*
 * ==================================================
 * AMBULANCE FLEET
 * ==================================================
 */

const ambulances: Ambulance[] = [
  {
    ambulanceId:
      "A1",

    currentLocation: {
      latitude:
        13.0827,

      longitude:
        80.2707
    },

    availabilityStatus:
      "AVAILABLE",

    driverId:
      "D1",

    capabilities: [
      "BASIC"
    ]
  },

  {
    ambulanceId:
      "A2",

    currentLocation: {
      latitude:
        13.0850,

      longitude:
        80.2750
    },

    availabilityStatus:
      "AVAILABLE",

    driverId:
      "D2",

    capabilities: [
      "ICU"
    ]
  },

  {
    ambulanceId:
      "A3",

    currentLocation: {
      latitude:
        13.0780,

      longitude:
        80.2680
    },

    availabilityStatus:
      "AVAILABLE",

    driverId:
      "D3",

    capabilities: [
      "BASIC"
    ]
  }
];


console.log(
  "======================================"
);

console.log(
  "CASCADE FALLBACK TEST"
);

console.log(
  "======================================"
);


/*
 * ==================================================
 * INITIAL STATE
 * ==================================================
 */

console.log(
  "\nInitial ambulance states:"
);

for (
  const ambulance of ambulances
) {
  console.log(
    `${ambulance.ambulanceId}: ${ambulance.availabilityStatus}`
  );
}


/*
 * ==================================================
 * FIRST ASSIGNMENT
 * ==================================================
 */

console.log(
  "\n--------------------------------------"
);

console.log(
  "STEP 1 — INITIAL DISPATCH"
);

console.log(
  "--------------------------------------"
);

const firstAssignment =
  fallbackOrchestrator.dispatchWithFallback(
    emergency,
    ambulances,
    5
  );

console.log(
  "Selected ambulance:",
  firstAssignment.ambulanceId
);

console.log(
  "Assignment status:",
  firstAssignment.status
);


const firstAmbulance =
  ambulances.find(
    (ambulance) =>
      ambulance.ambulanceId ===
      firstAssignment.ambulanceId
  );


if (!firstAmbulance) {
  throw new Error(
    "First ambulance not found"
  );
}


console.log(
  "Ambulance availability:",
  firstAmbulance.availabilityStatus
);

console.log(
  "Current request:",
  firstAmbulance.currentRequestId
);


/*
 * Verify first ambulance is BUSY
 */

if (
  firstAmbulance.availabilityStatus !==
  "BUSY"
) {
  throw new Error(
    `Expected ${firstAmbulance.ambulanceId} to be BUSY after assignment`
  );
}

console.log(
  "✅ First ambulance correctly marked BUSY"
);


/*
 * ==================================================
 * ACTIVE ASSIGNMENT CHECK
 * ==================================================
 */

const activeBeforeFailure =
  assignmentService.getActiveAssignment(
    emergency.requestId
  );


if (!activeBeforeFailure) {
  throw new Error(
    "Expected an active assignment before failure"
  );
}


console.log(
  "Active assignment:",
  activeBeforeFailure.assignmentId
);

console.log(
  "Active ambulance:",
  activeBeforeFailure.ambulanceId
);


/*
 * ==================================================
 * DRIVER REJECTION
 * ==================================================
 */

console.log(
  "\n--------------------------------------"
);

console.log(
  "STEP 2 — DRIVER REJECTS"
);

console.log(
  "--------------------------------------"
);

console.log(
  `${firstAssignment.ambulanceId} rejecting assignment...`
);


const secondAssignment =
  fallbackOrchestrator.handleFailureAndFallback(
    emergency,
    ambulances,
    5,
    firstAssignment.ambulanceId,
    "REJECTED",
    "Driver rejected assignment"
  );


/*
 * ==================================================
 * FAILED AMBULANCE STATE
 * ==================================================
 */

const failedAmbulance =
  ambulances.find(
    (ambulance) =>
      ambulance.ambulanceId ===
      firstAssignment.ambulanceId
  );


if (!failedAmbulance) {
  throw new Error(
    "Failed ambulance not found"
  );
}


console.log(
  "\nFailed ambulance state:"
);

console.log(
  "Ambulance:",
  failedAmbulance.ambulanceId
);

console.log(
  "Availability:",
  failedAmbulance.availabilityStatus
);

console.log(
  "Current request:",
  failedAmbulance.currentRequestId
);


/*
 * Verify failed ambulance is AVAILABLE
 */

if (
  failedAmbulance.availabilityStatus !==
  "AVAILABLE"
) {
  throw new Error(
    `Expected ${failedAmbulance.ambulanceId} to become AVAILABLE after rejection`
  );
}


if (
  failedAmbulance.currentRequestId !==
  undefined
) {
  throw new Error(
    `Expected ${failedAmbulance.ambulanceId} currentRequestId to be cleared`
  );
}


console.log(
  "✅ Failed ambulance released correctly"
);


/*
 * ==================================================
 * EXCLUSION CHECK
 * ==================================================
 */

const excluded =
  fallbackService.getExcludedAmbulances(
    emergency.requestId
  );


console.log(
  "\nExcluded ambulances:"
);

console.log(
  Array.from(excluded)
);


if (
  !excluded.has(
    firstAssignment.ambulanceId
  )
) {
  throw new Error(
    `Expected ${firstAssignment.ambulanceId} to be excluded`
  );
}


console.log(
  "✅ Failed ambulance excluded from future dispatch"
);


/*
 * ==================================================
 * FALLBACK ASSIGNMENT
 * ==================================================
 */

console.log(
  "\n--------------------------------------"
);

console.log(
  "STEP 3 — FALLBACK ASSIGNMENT"
);

console.log(
  "--------------------------------------"
);


console.log(
  "New ambulance:",
  secondAssignment.ambulanceId
);

console.log(
  "Assignment status:",
  secondAssignment.status
);


/*
 * Fallback ambulance must be different
 */

if (
  secondAssignment.ambulanceId ===
  firstAssignment.ambulanceId
) {
  throw new Error(
    "Fallback selected the previously failed ambulance"
  );
}


console.log(
  "✅ Fallback selected a different ambulance"
);


/*
 * ==================================================
 * NEW AMBULANCE STATE
 * ==================================================
 */

const secondAmbulance =
  ambulances.find(
    (ambulance) =>
      ambulance.ambulanceId ===
      secondAssignment.ambulanceId
  );


if (!secondAmbulance) {
  throw new Error(
    "Fallback ambulance not found"
  );
}


console.log(
  "\nFallback ambulance state:"
);

console.log(
  "Ambulance:",
  secondAmbulance.ambulanceId
);

console.log(
  "Availability:",
  secondAmbulance.availabilityStatus
);

console.log(
  "Current request:",
  secondAmbulance.currentRequestId
);


/*
 * Verify fallback ambulance is BUSY
 */

if (
  secondAmbulance.availabilityStatus !==
  "BUSY"
) {
  throw new Error(
    `Expected ${secondAmbulance.ambulanceId} to be BUSY after fallback assignment`
  );
}


if (
  secondAmbulance.currentRequestId !==
  emergency.requestId
) {
  throw new Error(
    `Expected ${secondAmbulance.ambulanceId} to belong to request ${emergency.requestId}`
  );
}


console.log(
  "✅ Fallback ambulance correctly marked BUSY"
);


/*
 * ==================================================
 * SINGLE ACTIVE ASSIGNMENT CHECK
 * ==================================================
 */

const activeAfterFallback =
  assignmentService.getActiveAssignment(
    emergency.requestId
  );


if (!activeAfterFallback) {
  throw new Error(
    "Expected an active fallback assignment"
  );
}


console.log(
  "\nActive assignment after fallback:"
);

console.log(
  activeAfterFallback
);


/*
 * Active assignment must belong
 * to fallback ambulance
 */

if (
  activeAfterFallback.ambulanceId !==
  secondAssignment.ambulanceId
) {
  throw new Error(
    "Active assignment does not belong to fallback ambulance"
  );
}


console.log(
  "✅ Only fallback ambulance is active"
);


/*
 * ==================================================
 * ATTEMPT HISTORY
 * ==================================================
 */

const attempts =
  fallbackService.getAttempts(
    emergency.requestId
  );


console.log(
  "\nAttempt history:"
);

console.log(
  attempts
);


/*
 * Expected:
 *
 * Attempt 1 → REJECTED
 * Attempt 2 → pending
 */

if (
  attempts.length !==
  2
) {
  throw new Error(
    `Expected 2 attempts, got ${attempts.length}`
  );
}


if (
  attempts[0].ambulanceId !==
  firstAssignment.ambulanceId
) {
  throw new Error(
    "First attempt ambulance mismatch"
  );
}


if (
  attempts[0].response !==
  "REJECTED"
) {
  throw new Error(
    "First attempt should be REJECTED"
  );
}


if (
  attempts[1].ambulanceId !==
  secondAssignment.ambulanceId
) {
  throw new Error(
    "Second attempt ambulance mismatch"
  );
}


if (
  attempts[1].response !==
  undefined
) {
  throw new Error(
    "Second attempt should still be pending"
  );
}


console.log(
  "✅ Attempt history is correct"
);


/*
 * ==================================================
 * FINAL STATE
 * ==================================================
 */

console.log(
  "\n======================================"
);

console.log(
  "FINAL STATE"
);

console.log(
  "======================================"
);


for (
  const ambulance of ambulances
) {
  console.log(
    `${ambulance.ambulanceId} → ${ambulance.availabilityStatus}`
  );
}


console.log(
  "\nActive assignment:"
);

console.log(
  activeAfterFallback
);


console.log(
  "\nExcluded:"
);

console.log(
  Array.from(excluded)
);


console.log(
  "\n======================================"
);

console.log(
  "✅ CASCADING FALLBACK TEST PASSED"
);

console.log(
  "======================================"
);


/*
 * ==================================================
 * CLEANUP
 * ==================================================
 */

io.close();
httpServer.close();