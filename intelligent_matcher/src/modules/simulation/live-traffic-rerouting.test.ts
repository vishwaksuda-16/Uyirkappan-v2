import http from "http";
import express from "express";
import { Server } from "socket.io";
import { io as createClient } from "socket.io-client";

import { createServiceContainer } from "../../config/service-container.js";

const TEST_PORT = 5002;

function delay(
  milliseconds: number
): Promise<void> {
  return new Promise(
    (resolve) =>
      setTimeout(resolve, milliseconds)
  );
}

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

        socket.emit(
          "joined-emergency",
          {
            requestId,
            room
          }
        );
      }
    );
  });

  await new Promise<void>((resolve) => {
    httpServer.listen(
      TEST_PORT,
      () => {
        console.log(
          `Traffic test Socket.IO server running on port ${TEST_PORT}`
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
    "REQ-TRAFFIC-001";

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
    }
  );

  client.on(
    "ROUTE_UPDATED",
    (data) => {
      console.log(
        "\n🛣️ ROUTE UPDATED"
      );

      console.log(
        `Route: ${data.nodeIds.join(" → ")}`
      );

      console.log(
        `Travel time: ${data.travelTimeMinutes} minutes`
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
        `Status: ${data.status}`
      );
    }
  );

  /*
   * ============================
   * CONNECT + JOIN ROOM
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
      }
    );

    client.once(
      "joined-emergency",
      (data) => {
        console.log(
          `Joined emergency room: ${data.room}`
        );

        resolve();
      }
    );
  });

  /*
   * Give Socket.IO a moment to finish
   * room synchronization.
   */
  await delay(100);

  /*
   * ============================
   * ROAD NODES
   * ============================
   */

  const graph =
    services.graphService;

  const n4 =
    graph.getNode("N4");

  const n5 =
    graph.getNode("N5");

  if (!n4 || !n5) {
    throw new Error(
      "N4 or N5 not found in virtual road network"
    );
  }

  /*
   * ============================
   * INITIAL TRACKING STATE
   * ============================
   */

  const initialLocation = {
    ambulanceId,
    requestId,
    latitude: n4.latitude,
    longitude: n4.longitude,
    speed: 0,
    heading: 0,
    timestamp: new Date()
  };

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
   * TEST 1 — NORMAL TRAFFIC
   * ============================
   */

  console.log(
    "\n================================"
  );

  console.log(
    "TEST 1 — NORMAL TRAFFIC"
  );

  console.log(
    "================================"
  );

  services.trafficService
    .setTrafficState(
      "N4",
      "N5",
      "NORMAL"
    );

  let route =
    services.dijkstraService
      .findShortestRoute(
        "N4",
        "N5"
      );

  console.log(
    `Route: ${route.nodeIds.join(" → ")}`
  );

  console.log(
    `ETA: ${route.travelTimeMinutes} minutes`
  );

  /*
   * Send normal traffic update.
   */

  await services
    .liveTrackingOrchestratorService
    .processLocationUpdate(
      initialLocation,
      {
        latitude:
          n5.latitude,

        longitude:
          n5.longitude
      }
    );

  /*
   * Allow Socket.IO client to receive events.
   */
  await delay(300);

  /*
   * ============================
   * TEST 2 — HEAVY TRAFFIC
   * ============================
   */

  console.log(
    "\n================================"
  );

  console.log(
    "TEST 2 — HEAVY TRAFFIC"
  );

  console.log(
    "================================"
  );

  services.trafficService
    .setTrafficState(
      "N4",
      "N5",
      "HEAVY"
    );

  route =
    services.dijkstraService
      .findShortestRoute(
        "N4",
        "N5"
      );

  console.log(
    `Route: ${route.nodeIds.join(" → ")}`
  );

  console.log(
    `ETA: ${route.travelTimeMinutes} minutes`
  );

  /*
   * Send heavy traffic update.
   */

  await services
    .liveTrackingOrchestratorService
    .processLocationUpdate(
      initialLocation,
      {
        latitude:
          n5.latitude,

        longitude:
          n5.longitude
      }
    );

  await delay(300);

  /*
   * ============================
   * TEST 3 — ROAD BLOCKED
   * ============================
   */

  console.log(
    "\n================================"
  );

  console.log(
    "TEST 3 — ROAD BLOCKED"
  );

  console.log(
    "================================"
  );

  services.trafficService
    .setTrafficState(
      "N4",
      "N5",
      "BLOCKED"
    );

  route =
    services.dijkstraService
      .findShortestRoute(
        "N4",
        "N5"
      );

  console.log(
    `Alternative route: ${route.nodeIds.join(" → ")}`
  );

  console.log(
    `New ETA: ${route.travelTimeMinutes} minutes`
  );

  /*
   * Send blocked-road rerouting update.
   */

  await services
    .liveTrackingOrchestratorService
    .processLocationUpdate(
      initialLocation,
      {
        latitude:
          n5.latitude,

        longitude:
          n5.longitude
      }
    );

  await delay(500);

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
    "\n✅ Traffic-aware rerouting test completed"
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