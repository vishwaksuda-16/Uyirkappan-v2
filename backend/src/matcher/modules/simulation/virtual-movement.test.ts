import { createVirtualRoadNetwork } from "../routing/virtual-road-network.js";
import { TrafficService } from "../traffic/traffic.service.js";
import { DijkstraService } from "../routing/dijkstra.service.js";
import { TrackingService } from "../tracking/tracking.service.js";
import { VirtualMovementService } from "./virtual-movement.service.js";

async function main() {
  console.log(
    "=== CONTINUOUS VIRTUAL AMBULANCE MOVEMENT TEST ==="
  );

  const graph =
    createVirtualRoadNetwork();

  const trafficService =
    new TrafficService();

  const dijkstraService =
    new DijkstraService(
      graph,
      trafficService
    );

  const trackingService =
    new TrackingService();

  const movementService =
    new VirtualMovementService(
      graph,
      trackingService,
      {
        updateIntervalMs: 1000,
        acceleratedTime: false,
        speedMultiplier: 1
      }
    );

  const route =
    dijkstraService.findShortestRoute(
      "N1",
      "N5"
    );

  console.log("\nCalculated route:");
  console.log(route);

  console.log(
    "\nStarting ambulance movement..."
  );

  const startTime = Date.now();

  const updates =
    await movementService.moveAlongRoute(
      "A1",
      "REQ-MOVE-001",
      route
    );

  const endTime = Date.now();

  console.log(
    "\nMovement completed."
  );

  console.log(
    `Elapsed time: ${endTime - startTime} ms`
  );

  console.log(
    "\nMovement updates:"
  );

  updates.forEach(
    (update, index) => {
      console.log(
        `Update ${index + 1}:`,
        update
      );
    }
  );

  console.log(
    "\nLatest location:"
  );

  console.log(
    trackingService.getLatestLocation(
      "REQ-MOVE-001"
    )
  );

  console.log(
    "\nTotal updates:"
  );

  console.log(updates.length);

  console.log(
    "\n=== Test completed ==="
  );
}

main().catch((error) => {
  console.error(
    "Test failed:",
    error
  );

  process.exit(1);
});