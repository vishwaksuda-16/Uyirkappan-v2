import { TrackingService } from "./tracking.service.js";

const trackingService = new TrackingService();

console.log("=== LIVE TRACKING TEST ===");

const update1 = trackingService.updateLocation({
  ambulanceId: "A1",
  requestId: "REQ-TRACK-001",
  latitude: 13.0827,
  longitude: 80.2707,
  speed: 35,
  heading: 90,
  timestamp: new Date()
});

console.log("\nFirst location update:");
console.log(update1);

const update2 = trackingService.updateLocation({
  ambulanceId: "A1",
  requestId: "REQ-TRACK-001",
  latitude: 13.0835,
  longitude: 80.2720,
  speed: 42,
  heading: 90,
  timestamp: new Date()
});

console.log("\nSecond location update:");
console.log(update2);

const latest =
  trackingService.getLatestLocation(
    "REQ-TRACK-001"
  );

console.log("\nLatest location:");
console.log(latest);

const history =
  trackingService.getLocationHistory(
    "REQ-TRACK-001"
  );

console.log("\nLocation history:");
console.log(history);

console.log("\nTotal location updates:");
console.log(history.length);

console.log("\n=== Test completed ===");