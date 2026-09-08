import http from "http";
import express from "express";
import { Server } from "socket.io";
import { io as createClient } from "socket.io-client";

import { createServiceContainer } from "../../config/service-container.js";

const TEST_PORT = 5001;

async function main() {
  const app = express();

  const httpServer =
    http.createServer(app);

  const io =
    new Server(httpServer, {
      cors: {
        origin: "*"
      }
    });

  const services =
    createServiceContainer(io);

  /*
   * ============================
   * SOCKET SERVER
   * ============================
   */

  io.on("connection", (socket) => {
    console.log(
      `Socket connected: ${socket.id}`
    );

    socket.on(
      "join-emergency",
      (requestId: string) => {
        const room =
          `emergency:${requestId}`;

        socket.join(room);

        console.log(
          `Socket joined ${room}`
        );
      }
    );
  });

  await new Promise<void>((resolve) => {
    httpServer.listen(
      TEST_PORT,
      () => {
        console.log(
          `Test Socket.IO server running on port ${TEST_PORT}`
        );

        resolve();
      }
    );
  });

  /*
   * ============================
   * SOCKET CLIENT
   * ============================
   */

  const client =
    createClient(
      `http://localhost:${TEST_PORT}`
    );

  const requestId =
    "REQ-TRACK-ETA-001";

  const ambulanceId =
    "A1";

  /*
   * ============================
   * SOCKET EVENT LISTENERS
   * ============================
   */

  client.on(
    "AMBULANCE_LOCATION_UPDATED",
    (data) => {
      console.log(
        "\n📍 LOCATION UPDATE"
      );

      console.log(
        `Ambulance: ${data.ambulanceId}`
      );

      console.log(
        `Location: ${data.latitude}, ${data.longitude}`
      );
    }
  );

  client.on(
    "ETA_UPDATED",
    (data) => {
      console.log(
        "\n⏱️ ETA UPDATE"
      );

      console.log(
        `ETA: ${data.estimatedMinutes} minutes`
      );

      console.log(
        `Route: ${data.route.nodeIds.join(" → ")}`
      );
    }
  );

  client.on(
    "ROUTE_UPDATED",
    (data) => {
      console.log(
        "\n🛣️ ROUTE UPDATE"
      );

      console.log(
        data.nodeIds.join(" → ")
      );
    }
  );

  client.on(
    "STATUS_UPDATED",
    (data) => {
      console.log(
        "\n🚑 STATUS UPDATE"
      );

      console.log(
        data.status
      );
    }
  );

  /*
   * ============================
   * CONNECT CLIENT
   * ============================
   */

  await new Promise<void>((resolve) => {
    client.once(
      "connect",
      () => {
        console.log(
          `Test client connected: ${client.id}`
        );

        client.emit(
          "join-emergency",
          requestId
        );

        resolve();
      }
    );
  });

  /*
   * ============================
   * GET ROAD NODES
   * ============================
   */

  const graph =
    services.graphService;

  const n1 =
    graph.getNode("N1");

  const n5 =
    graph.getNode("N5");

  if (!n1 || !n5) {
    throw new Error(
      "N1 or N5 not found in virtual road network"
    );
  }

  /*
   * ============================
   * INITIAL LOCATION
   * ============================
   */

  const initialLocation = {
    ambulanceId,
    requestId,
    latitude: n1.latitude,
    longitude: n1.longitude,
    speed: 0,
    heading: 0,
    timestamp: new Date()
  };

  /*
   * Initialize tracking state.
   */
  services.trackingService
    .updateLocation(
      initialLocation
    );

  /*
   * Accept assignment.
   */
  services.liveTrackingOrchestratorService
    .acceptAssignment(
      requestId
    );

  /*
   * Start journey.
   */
  services.liveTrackingOrchestratorService
    .startJourney(
      requestId
    );

  /*
   * ============================
   * INITIAL N1 UPDATE
   * ============================
   *
   * Broadcast the initial position
   * through the same live-tracking
   * pipeline.
   */

  await services.liveTrackingOrchestratorService
    .processLocationUpdate(
      initialLocation,
      {
        latitude: n5.latitude,
        longitude: n5.longitude
      }
    );

  /*
   * ============================
   * CALCULATE ROUTE
   * ============================
   */

  const route =
    services.dijkstraService
      .findShortestRoute(
        "N1",
        "N5"
      );

  console.log(
    "\n================================"
  );

  console.log(
    "LIVE TRACKING SIMULATION"
  );

  console.log(
    "================================"
  );

  console.log(
    `Route: ${route.nodeIds.join(" → ")}`
  );

  console.log(
    `Total distance: ${route.distanceKm} km`
  );

  console.log(
    `Initial ETA: ${route.travelTimeMinutes} minutes`
  );

  /*
   * ============================
   * MOVE AMBULANCE
   * ============================
   */

  await services.virtualMovementService
    .moveAlongRoute(
      ambulanceId,
      requestId,
      route,
      {
        latitude: n5.latitude,
        longitude: n5.longitude
      },
      {
        onLocationUpdate:
          async (
            locationUpdate,
            destination
          ) => {
            await services
              .liveTrackingOrchestratorService
              .processLocationUpdate(
                locationUpdate,
                destination
              );
          }
      }
    );

  /*
   * ============================
   * FINAL STATE
   * ============================
   */

  const finalState =
    services.trackingService
      .getTrackingState(
        requestId
      );

  console.log(
    "\n================================"
  );

  console.log(
    "FINAL TRACKING STATE"
  );

  console.log(
    "================================"
  );

  console.log(
    finalState
  );

  console.log(
    "\n✅ Live tracking simulation completed"
  );

  /*
   * ============================
   * CLEANUP
   * ============================
   */

  client.disconnect();

  await new Promise<void>((resolve) => {
    io.close(
      () => resolve()
    );
  });

  httpServer.close();
}

main().catch(
  (error) => {
    console.error(
      "\n❌ Test failed:"
    );

    console.error(
      error
    );

    process.exit(1);
  }
);