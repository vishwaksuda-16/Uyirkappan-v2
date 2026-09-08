import { AssignmentService } from "./assignment.service.js";

import {
  Ambulance,
  DispatchDecision
} from "../dispatch/dispatch.types.js";

const assignmentService =
  new AssignmentService();

const ambulance: Ambulance = {
  ambulanceId: "A3",

  currentLocation: {
    latitude: 13.0780,
    longitude: 80.2680
  },

  availabilityStatus: "AVAILABLE",

  driverId: "D3",

  capabilities: [
    "BASIC"
  ]
};

const decision: DispatchDecision = {
  requestId: "REQ001",

  selectedAmbulanceId: "A3",

  pickupLocation: {
    latitude: 13.0800,
    longitude: 80.2780
  },

  estimatedTravelTime: 2,

  route: {
    nodeIds: [
      "N4",
      "N5"
    ],
    distanceKm: 0.3,
    travelTimeMinutes: 2
  },

  distance: 0.3,

  score: 0.31,

  generatedAt: new Date()
};

console.log("=== ASSIGNMENT TEST ===");

const assignment =
  assignmentService.createAssignment(
    decision.requestId,
    decision,
    ambulance
  );

console.log("\nCreated assignment:");
console.log(assignment);

console.log(
  "\nInitial status:",
  assignment.status
);

assignmentService.updateStatus(
  assignment.assignmentId,
  "ACCEPTED"
);

console.log(
  "\nAfter driver acceptance:"
);

console.log(
  assignmentService.getAssignment(
    assignment.assignmentId
  )
);

console.log(
  "\n=== Test completed ==="
);
