import { createVirtualRoadNetwork } from "../routing/virtual-road-network.js";
import { TrafficService } from "../traffic/traffic.service.js";
import { DijkstraService } from "../routing/dijkstra.service.js";
import { NearestNodeService } from "../routing/nearest-node.service.js";
import { ETAService } from "./eta.service.js";
import { TrackingService } from "../tracking/tracking.service.js";
import { VirtualMovementService } from "../simulation/virtual-movement.service.js";

async function main() {
  console.log("=== DYNAMIC ETA TEST ===");

  const graph =
    createVirtualRoadNetwork();

  const trafficService =
    new TrafficService();

  const dijkstraService =
    new DijkstraService(
      graph,
      trafficService
    );

  const nearestNodeService =
    new NearestNodeService(graph);

  const etaService =
    new ETAService(
      nearestNodeService,
      dijkstraService
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

  const requestId =
    "REQ-ETA-001";

  const ambulanceId =
    "A1";

  const destination = {
    latitude: 13.08,
    longitude: 80.278
  };

  /*
   * Initial ambulance location = N1
   */
  const initialLocation = {
    latitude: 13.0827,
    longitude: 80.2707
  };

  console.log(
    "\nInitial ambulance location:"
  );

  console.log(initialLocation);

  const initialETA =
    etaService.calculateETA(
      requestId,
      ambulanceId,
      initialLocation,
      destination
    );

  console.log("\nInitial ETA:");
  console.log(initialETA);

  /*
   * Calculate the route that the
   * ambulance will follow.
   */
  const route =
    initialETA.route;

  console.log(
    "\nStarting ambulance movement..."
  );

  /*
   * Move along the route.
   */
  const updates =
    await movementService.moveAlongRoute(
      ambulanceId,
      requestId,
      route
    );

  /*
   * Recalculate ETA after every
   * location update.
   */
  console.log(
    "\nETA after each movement:"
  );

  updates.forEach(
    (update, index) => {
      const eta =
        etaService.calculateETA(
          requestId,
          ambulanceId,
          {
            latitude:
              update.latitude,
            longitude:
              update.longitude
          },
          destination
        );

      console.log(
        `\nPosition ${index + 1}`
      );

      console.log(
        "Location:",
        update.latitude,
        update.longitude
      );

      console.log(
        "Nearest route:",
        eta.route.nodeIds
      );

      console.log(
        "Remaining distance:",
        eta.route.distanceKm,
        "km"
      );

      console.log(
        "Remaining ETA:",
        eta.estimatedMinutes,
        "minutes"
      );
    }
  );

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