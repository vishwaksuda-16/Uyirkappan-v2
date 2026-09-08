import { TrackingService } from "./tracking.service.js";

console.log("=== AMBULANCE STATUS LIFECYCLE TEST ===");

const trackingService =
  new TrackingService();

const requestId =
  "REQ-STATUS-001";

const ambulanceId =
  "A1";

/*
 * First location update creates
 * the initial tracking state.
 */
trackingService.updateLocation({
  ambulanceId,
  requestId,
  latitude: 13.0827,
  longitude: 80.2707,
  speed: 0,
  heading: 0,
  timestamp: new Date()
});

console.log("\nInitial state:");

console.log(
  trackingService.getTrackingState(
    requestId
  )
);

/*
 * Complete ambulance lifecycle.
 */
const statuses = [
  "ASSIGNED",
  "ACCEPTED",
  "EN_ROUTE_TO_PATIENT",
  "ARRIVED_AT_PATIENT",
  "PATIENT_ONBOARD",
  "EN_ROUTE_TO_HOSPITAL",
  "ARRIVED_AT_HOSPITAL",
  "COMPLETED"
] as const;

for (const status of statuses) {
  const state =
    trackingService.updateStatus(
      requestId,
      status
    );

  console.log(
    `\nStatus changed to: ${status}`
  );

  console.log(
    "Current status:",
    state.status
  );

  console.log(
    "Updated at:",
    state.updatedAt
  );
}

/*
 * Final state.
 */
console.log("\nFinal tracking state:");

console.log(
  trackingService.getTrackingState(
    requestId
  )
);

console.log(
  "\n=== Test completed ==="
);