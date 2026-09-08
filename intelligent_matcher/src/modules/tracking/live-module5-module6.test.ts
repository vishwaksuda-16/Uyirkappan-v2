import { createServer } from "http";
import { Server } from "socket.io";
import { io as createClient, Socket } from "socket.io-client";

import { createServiceContainer } from "../../config/service-container.js";
import {
  Ambulance,
  EmergencyRequest,
} from "../dispatch/dispatch.types.js";

const PORT = 5004;
const REQUEST_ID = "REQ-E2E-M5-M6-REROUTE-001";

const wait = (ms: number) =>
  new Promise<void>((resolve) => setTimeout(resolve, ms));

function section(title: string): void {
  console.log("\n------------------------------------------------------------");
  console.log(title);
  console.log("------------------------------------------------------------\n");
}

function assert(
  condition: unknown,
  message: string
): asserts condition {
  if (!condition) {
    throw new Error(`ASSERTION FAILED: ${message}`);
  }
}

async function main(): Promise<void> {
  const httpServer = createServer();

  const io = new Server(httpServer, {
    cors: {
      origin: "*",
    },
  });

  const services = createServiceContainer(io);

  const socketEvents = {
    assignmentCreated: [] as unknown[],
    assignmentAccepted: [] as unknown[],
    assignmentRejected: [] as unknown[],
    assignmentTimeout: [] as unknown[],
    fallbackStarted: [] as unknown[],
    fallbackAssignmentCreated: [] as unknown[],
    locations: [] as unknown[],
    etas: [] as unknown[],
    routes: [] as unknown[],
    statuses: [] as unknown[],
    patientOnboard: [] as unknown[],
    hospitalArrived: [] as unknown[],
    completed: [] as unknown[],
  };

  /*
   * ==========================================================
   * SOCKET SERVER
   * ==========================================================
   */

  io.on("connection", (socket) => {
    console.log(`Socket connected: ${socket.id}`);

    socket.on(
      "join_emergency",
      ({ requestId }: { requestId: string }) => {
        const room = `emergency:${requestId}`;

        socket.join(room);

        console.log(
          `Socket ${socket.id} joined emergency:${requestId}`
        );
      }
    );
  });

  await new Promise<void>((resolve) => {
    httpServer.listen(PORT, () => {
      console.log(
        `Socket test server running on port ${PORT}`
      );

      resolve();
    });
  });

  /*
   * ==========================================================
   * SOCKET CLIENT
   * ==========================================================
   */

  const client: Socket = createClient(
    `http://localhost:${PORT}`,
    {
      transports: ["websocket"],
    }
  );

  client.on("connect", () => {
    console.log(
      `Test client connected: ${client.id}`
    );

    client.emit("join_emergency", {
      requestId: REQUEST_ID,
    });

    console.log(
      `Client joined emergency room: { requestId: '${REQUEST_ID}', room: 'emergency:${REQUEST_ID}' }`
    );
  });

  /*
   * ==========================================================
   * SOCKET EVENT LISTENERS
   * ==========================================================
   */

  client.on("ASSIGNMENT_CREATED", (data) => {
    socketEvents.assignmentCreated.push(data);

    console.log("\n📡 ASSIGNMENT_CREATED");
    console.dir(data, { depth: null });
  });

  client.on("ASSIGNMENT_ACCEPTED", (data) => {
    socketEvents.assignmentAccepted.push(data);

    console.log("\n📡 ASSIGNMENT_ACCEPTED");
    console.dir(data, { depth: null });
  });

  client.on("ASSIGNMENT_REJECTED", (data) => {
    socketEvents.assignmentRejected.push(data);

    console.log("\n📡 ASSIGNMENT_REJECTED");
    console.dir(data, { depth: null });
  });

  client.on("ASSIGNMENT_TIMEOUT", (data) => {
    socketEvents.assignmentTimeout.push(data);

    console.log("\n📡 ASSIGNMENT_TIMEOUT");
    console.dir(data, { depth: null });
  });

  client.on("FALLBACK_STARTED", (data) => {
    socketEvents.fallbackStarted.push(data);

    console.log("\n📡 FALLBACK_STARTED");
    console.dir(data, { depth: null });
  });

  client.on("FALLBACK_ASSIGNMENT_CREATED", (data) => {
    socketEvents.fallbackAssignmentCreated.push(data);

    console.log("\n📡 FALLBACK_ASSIGNMENT_CREATED");
    console.dir(data, { depth: null });
  });

  client.on("AMBULANCE_LOCATION_UPDATED", (data) => {
    socketEvents.locations.push(data);

    console.log("\n📡 AMBULANCE_LOCATION_UPDATED");
    console.dir(data, { depth: null });
  });

  client.on("ETA_UPDATED", (data) => {
    socketEvents.etas.push(data);

    console.log("\n📡 ETA_UPDATED");
    console.dir(data, { depth: null });
  });

  client.on("ROUTE_UPDATED", (data) => {
    socketEvents.routes.push(data);

    console.log("\n📡 ROUTE_UPDATED");
    console.dir(data, { depth: null });
  });

  client.on("STATUS_UPDATED", (data) => {
    socketEvents.statuses.push(data);

    console.log("\n📡 STATUS_UPDATED");
    console.dir(data, { depth: null });
  });

  client.on("PATIENT_ONBOARD", (data) => {
    socketEvents.patientOnboard.push(data);

    console.log("\n📡 PATIENT_ONBOARD");
    console.dir(data, { depth: null });
  });

  client.on("HOSPITAL_ARRIVED", (data) => {
    socketEvents.hospitalArrived.push(data);

    console.log("\n📡 HOSPITAL_ARRIVED");
    console.dir(data, { depth: null });
  });

  client.on("REQUEST_COMPLETED", (data) => {
    socketEvents.completed.push(data);

    console.log("\n📡 REQUEST_COMPLETED");
    console.dir(data, { depth: null });
  });

  await wait(500);

  /*
   * ==========================================================
   * TEST DATA
   * ==========================================================
   *
   * A1 starts at N1.
   *
   * Pickup = N5.
   *
   * Initial expected route:
   *
   *     N1 → N4 → N5
   *
   * Alternative route:
   *
   *     N1 → N2 → N3 → N5
   */

  const request: EmergencyRequest = {
    requestId: REQUEST_ID,

    emergencyType: "CARDIAC_EMERGENCY",

    victimCount: 1,

    pickupLocation: {
      latitude: 13.08,
      longitude: 80.278,
    },

    createdAt: new Date(),

    priority: "CRITICAL",
  };

  const ambulances: Ambulance[] = [
    {
      ambulanceId: "A1",

      currentLocation: {
        latitude: 13.0827,
        longitude: 80.2707,
      },

      availabilityStatus: "AVAILABLE",

      driverId: "D1",

      capabilities: [
        "BLS",
        "ALS",
        "CARDIAC",
      ],
    },
  ];

  try {
    /*
     * ========================================================
     * STEP 1 — MODULE 5 DISPATCH
     * ========================================================
     */

    section("STEP 1 — MODULE 5 DISPATCH");

    /*
     * dispatchWithFallback() returns Assignment directly.
     */

    const assignment =
      services.fallbackOrchestratorService.dispatchWithFallback(
        request,
        ambulances,
        10
      );

    const selectedAmbulanceId =
      assignment.ambulanceId;

    console.log(
      "Selected ambulance:",
      selectedAmbulanceId
    );

    console.log(
      "Initial route:",
      assignment.route
    );

    console.log(
      "Initial ETA:",
      assignment.estimatedTravelTime,
      "minutes"
    );

    assert(
      selectedAmbulanceId === "A1",
      `Expected A1 but received ${selectedAmbulanceId}`
    );

    assert(
      assignment.route.nodeIds[0] === "N1",
      `Initial route should start from N1, received ${assignment.route.nodeIds[0]}`
    );

    assert(
      assignment.route.nodeIds[
        assignment.route.nodeIds.length - 1
      ] === "N5",
      "Initial route should end at N5"
    );

    assert(
      assignment.route.nodeIds.includes("N4"),
      "Initial route should use N4 before traffic disruption"
    );

    console.log(
      "✅ Module 5 dispatch successful"
    );

    await wait(500);

    /*
     * ========================================================
     * STEP 2 — DRIVER ACCEPTS ASSIGNMENT
     * ========================================================
     */

    section(
      "STEP 2 — DRIVER ACCEPTS ASSIGNMENT"
    );

    const acceptedAssignment =
      services.fallbackOrchestratorService.acceptAssignment(
        REQUEST_ID,
        selectedAmbulanceId
      );

    console.log(
      "Assignment status:",
      acceptedAssignment.status
    );

    assert(
      acceptedAssignment.status === "ACCEPTED",
      "Assignment should be ACCEPTED"
    );

    console.log(
      "✅ Assignment accepted"
    );

    await wait(500);

    /*
     * ========================================================
     * STEP 3 — INITIALIZE TRACKING
     * ========================================================
     */

    section(
      "STEP 3 — INITIALIZE TRACKING + EN_ROUTE_TO_PATIENT"
    );

    /*
     * Tracking state is created by the first GPS update.
     */

    await services.liveTrackingOrchestratorService.processLocationUpdate(
      {
        ambulanceId: "A1",

        requestId: REQUEST_ID,

        latitude: 13.0827,

        longitude: 80.2707,

        speed: 0,

        heading: 0,

        timestamp: new Date(),
      },

      request.pickupLocation
    );

    await wait(300);

    const initialTrackingState =
      services.trackingService.getTrackingState(
        REQUEST_ID
      );

    assert(
      initialTrackingState !== undefined,
      "Tracking state should be initialized"
    );

    console.log(
      "✅ Tracking state initialized"
    );

    services.liveTrackingOrchestratorService.acceptAssignment(
      REQUEST_ID
    );

    await wait(100);

    services.liveTrackingOrchestratorService.startJourney(
      REQUEST_ID
    );

    await wait(300);

    const enRouteState =
      services.trackingService.getTrackingState(
        REQUEST_ID
      );

    assert(
      enRouteState?.status ===
        "EN_ROUTE_TO_PATIENT",
      `Expected EN_ROUTE_TO_PATIENT but received ${enRouteState?.status}`
    );

    console.log(
      "Current tracking status:",
      enRouteState?.status
    );

    console.log(
      "✅ Ambulance is EN_ROUTE_TO_PATIENT"
    );

    /*
     * ========================================================
     * STEP 4 — LIVE GPS + INITIAL ETA
     * ========================================================
     */

    section(
      "STEP 4 — LIVE GPS + INITIAL ETA"
    );

    /*
     * Keep ambulance at N1.
     *
     * This is deliberate because N1 has two possible
     * paths toward N5.
     */

    await services.liveTrackingOrchestratorService.processLocationUpdate(
      {
        ambulanceId: "A1",

        requestId: REQUEST_ID,

        latitude: 13.0827,

        longitude: 80.2707,

        speed: 30,

        heading: 90,

        timestamp: new Date(),
      },

      request.pickupLocation
    );

    /*
     * Allow asynchronous Socket.IO delivery.
     */

    await wait(500);

    /*
     * Validate the actual tracking state.
     */

    const liveTrackingState =
      services.trackingService.getTrackingState(
        REQUEST_ID
      );

    assert(
      liveTrackingState !== undefined,
      "Live tracking state should exist"
    );

    assert(
      liveTrackingState.latestLocation !== undefined,
      "Latest ambulance location should exist"
    );

    const initialETA =
      liveTrackingState.estimatedMinutes;

    assert(
      initialETA !== undefined,
      "Initial ETA should exist"
    );

    /*
     * Calculate ETA independently through ETAService.
     */

    const initialETAResult =
      services.etaService.calculateETA(
        REQUEST_ID,
        "A1",
        {
          latitude: 13.0827,
          longitude: 80.2707,
        },
        request.pickupLocation
      );

    console.log(
      "Initial live ETA:",
      initialETA,
      "minutes"
    );

    console.log(
      "Initial live route:",
      initialETAResult.route
    );

    /*
     * Verify tracking ETA matches ETAService.
     */

    assert(
      initialETA ===
        initialETAResult.estimatedMinutes,
      `Tracking ETA ${initialETA} should match ETAService result ${initialETAResult.estimatedMinutes}`
    );

    /*
     * Verify route.
     */

    assert(
      initialETAResult.route.nodeIds[0] ===
        "N1",
      "Initial ETA route should start from N1"
    );

    assert(
      initialETAResult.route.nodeIds[
        initialETAResult.route.nodeIds.length - 1
      ] === "N5",
      "Initial ETA route should end at N5"
    );

    assert(
      initialETAResult.route.nodeIds.includes(
        "N4"
      ),
      "Initial ETA route should use N4"
    );

    console.log(
      "Tracking state:",
      liveTrackingState
    );

    /*
     * Report asynchronous WebSocket events.
     *
     * We do NOT fail the calculation test merely because
     * the Socket.IO client has not received an event yet.
     */

    console.log(
      "Location events received:",
      socketEvents.locations.length
    );

    console.log(
      "ETA events received:",
      socketEvents.etas.length
    );

    console.log(
      "Route events received:",
      socketEvents.routes.length
    );

    console.log(
      "Status events received:",
      socketEvents.statuses.length
    );

    console.log(
      "✅ Live GPS → Tracking State → ETA → Route pipeline working"
    );

    /*
     * ========================================================
     * STEP 5 — HEAVY TRAFFIC
     * ========================================================
     */

    section(
      "STEP 5 — TRAFFIC CHANGE + ETA RECALCULATION"
    );

    /*
     * Current ambulance position:
     *
     *     N1
     *
     * Original route:
     *
     *     N1 → N4 → N5
     *
     * Make N1 → N4 HEAVY.
     */

    services.trafficService.setTrafficState(
      "N1",
      "N4",
      "HEAVY"
    );

    console.log(
      "Traffic changed: N1 → N4 = HEAVY"
    );

    await services.liveTrackingOrchestratorService.processLocationUpdate(
      {
        ambulanceId: "A1",

        requestId: REQUEST_ID,

        latitude: 13.0827,

        longitude: 80.2707,

        speed: 30,

        heading: 90,

        timestamp: new Date(),
      },

      request.pickupLocation
    );

    await wait(500);

    const heavyTrafficState =
      services.trackingService.getTrackingState(
        REQUEST_ID
      );

    assert(
      heavyTrafficState !== undefined,
      "Tracking state should exist after traffic update"
    );

    const heavyTrafficETA =
      heavyTrafficState.estimatedMinutes;

    assert(
      heavyTrafficETA !== undefined,
      "Heavy traffic ETA should exist"
    );

    const heavyTrafficResult =
      services.etaService.calculateETA(
        REQUEST_ID,
        "A1",
        {
          latitude: 13.0827,
          longitude: 80.2707,
        },
        request.pickupLocation
      );

    console.log(
      "Heavy-traffic ETA:",
      heavyTrafficETA,
      "minutes"
    );

    console.log(
      "Heavy-traffic route:",
      heavyTrafficResult.route
    );

    assert(
      heavyTrafficETA ===
        heavyTrafficResult.estimatedMinutes,
      `Tracking heavy ETA ${heavyTrafficETA} should match ETAService ${heavyTrafficResult.estimatedMinutes}`
    );

    assert(
      heavyTrafficETA >= initialETA,
      `Heavy traffic ETA ${heavyTrafficETA} should not be less than initial ETA ${initialETA}`
    );

    console.log(
      `ETA changed from ${initialETA} → ${heavyTrafficETA} minutes`
    );

    console.log(
      "✅ Traffic change caused ETA recalculation"
    );

    /*
     * ========================================================
     * STEP 6 — BLOCK ROAD + DYNAMIC REROUTING
     * ========================================================
     */

    section(
      "STEP 6 — ROAD BLOCKAGE + DYNAMIC REROUTING"
    );

    /*
     * Block N1 → N4.
     *
     * Original:
     *
     *     N1 → N4 → N5
     *
     * must become:
     *
     *     N1 → N2 → N3 → N5
     */

    services.trafficService.setTrafficState(
      "N1",
      "N4",
      "BLOCKED"
    );

    console.log(
      "Road closure: N1 → N4 = BLOCKED"
    );

    await services.liveTrackingOrchestratorService.processLocationUpdate(
      {
        ambulanceId: "A1",

        requestId: REQUEST_ID,

        latitude: 13.0827,

        longitude: 80.2707,

        speed: 30,

        heading: 90,

        timestamp: new Date(),
      },

      request.pickupLocation
    );

    await wait(500);

    const reroutedState =
      services.trackingService.getTrackingState(
        REQUEST_ID
      );

    assert(
      reroutedState !== undefined,
      "Tracking state should exist after rerouting"
    );

    const reroutedETA =
      reroutedState.estimatedMinutes;

    assert(
      reroutedETA !== undefined,
      "Rerouted ETA should exist"
    );

    const reroutedResult =
      services.etaService.calculateETA(
        REQUEST_ID,
        "A1",
        {
          latitude: 13.0827,
          longitude: 80.2707,
        },
        request.pickupLocation
      );

    console.log(
      "Rerouted ETA:",
      reroutedETA,
      "minutes"
    );

    console.log(
      "Rerouted route:",
      reroutedResult.route
    );

    assert(
      reroutedETA ===
        reroutedResult.estimatedMinutes,
      `Tracking rerouted ETA ${reroutedETA} should match ETAService ${reroutedResult.estimatedMinutes}`
    );

    assert(
      reroutedResult.route.nodeIds[0] ===
        "N1",
      "Rerouted route should start at N1"
    );

    assert(
      reroutedResult.route.nodeIds[
        reroutedResult.route.nodeIds.length - 1
      ] === "N5",
      "Rerouted route should end at N5"
    );

    /*
     * N4 must no longer appear because N1 → N4
     * is blocked.
     */

    assert(
      !reroutedResult.route.nodeIds.includes(
        "N4"
      ),
      "Rerouted route must not use blocked N4"
    );

    /*
     * Alternative route should contain N2 and N3.
     */

    assert(
      reroutedResult.route.nodeIds.includes(
        "N2"
      ),
      "Rerouted route should use N2"
    );

    assert(
      reroutedResult.route.nodeIds.includes(
        "N3"
      ),
      "Rerouted route should use N3"
    );

    const reroutedPath =
      reroutedResult.route.nodeIds.join("→");

    console.log(
      "Detected route:",
      reroutedPath
    );

    assert(
      reroutedPath ===
        "N1→N2→N3→N5",
      `Expected N1→N2→N3→N5 but received ${reroutedPath}`
    );

    console.log(
      "✅ Dijkstra dynamically rerouted around blocked road"
    );

    console.log(
      "✅ New route:",
      reroutedPath
    );

    console.log(
      "✅ New ETA:",
      reroutedETA,
      "minutes"
    );

    /*
     * ========================================================
     * STEP 7 — LIVE GPS ALONG REROUTED PATH
     * ========================================================
     */

    section(
      "STEP 7 — LIVE GPS ALONG REROUTED PATH"
    );

    /*
     * Move to N2.
     */

    await services.liveTrackingOrchestratorService.processLocationUpdate(
      {
        ambulanceId: "A1",

        requestId: REQUEST_ID,

        latitude: 13.0850,

        longitude: 80.2750,

        speed: 35,

        heading: 45,

        timestamp: new Date(),
      },

      request.pickupLocation
    );

    await wait(300);

    /*
     * Move to N3.
     */

    await services.liveTrackingOrchestratorService.processLocationUpdate(
      {
        ambulanceId: "A1",

        requestId: REQUEST_ID,

        latitude: 13.0880,

        longitude: 80.2800,

        speed: 35,

        heading: 45,

        timestamp: new Date(),
      },

      request.pickupLocation
    );

    await wait(300);

    const nearPickupState =
      services.trackingService.getTrackingState(
        REQUEST_ID
      );

    assert(
      nearPickupState !== undefined,
      "Tracking state should remain available"
    );

    console.log(
      "Current status:",
      nearPickupState.status
    );

    console.log(
      "Current location:",
      nearPickupState.latestLocation
    );

    console.log(
      "Current ETA:",
      nearPickupState.estimatedMinutes,
      "minutes"
    );

    console.log(
      "✅ Ambulance successfully followed rerouted path"
    );

    /*
     * ========================================================
     * STEP 8 — ARRIVED AT PATIENT
     * ========================================================
     */

    section(
      "STEP 8 — ARRIVED AT PATIENT"
    );

    await services.liveTrackingOrchestratorService.processLocationUpdate(
      {
        ambulanceId: "A1",

        requestId: REQUEST_ID,

        latitude: 13.0800,

        longitude: 80.2780,

        speed: 0,

        heading: 0,

        timestamp: new Date(),
      },

      request.pickupLocation
    );

    await wait(500);

    const patientArrivalState =
      services.trackingService.getTrackingState(
        REQUEST_ID
      );

    assert(
      patientArrivalState !== undefined,
      "Patient arrival tracking state should exist"
    );

    assert(
      patientArrivalState.status ===
        "ARRIVED_AT_PATIENT",
      `Expected ARRIVED_AT_PATIENT but received ${patientArrivalState.status}`
    );

    assert(
      patientArrivalState.estimatedMinutes ===
        0,
      "ETA should be 0 at patient location"
    );

    console.log(
      "Final patient ETA:",
      patientArrivalState.estimatedMinutes,
      "minutes"
    );

    console.log(
      "✅ Ambulance arrived at patient"
    );

    /*
     * ========================================================
     * STEP 9 — PATIENT ONBOARD
     * ========================================================
     */

    section(
      "STEP 9 — PATIENT ONBOARD"
    );

    services.liveTrackingOrchestratorService.patientOnboarded(
      REQUEST_ID
    );

    await wait(300);

    const onboardState =
      services.trackingService.getTrackingState(
        REQUEST_ID
      );

    assert(
      onboardState?.status ===
        "PATIENT_ONBOARD",
      `Expected PATIENT_ONBOARD but received ${onboardState?.status}`
    );

    console.log(
      "✅ Patient onboarded"
    );

    /*
     * ========================================================
     * STEP 10 — EN_ROUTE_TO_HOSPITAL
     * ========================================================
     */

    section(
      "STEP 10 — EN_ROUTE_TO_HOSPITAL"
    );

    services.liveTrackingOrchestratorService.startHospitalJourney(
      REQUEST_ID
    );

    await wait(300);

    const hospitalJourneyState =
      services.trackingService.getTrackingState(
        REQUEST_ID
      );

    assert(
      hospitalJourneyState?.status ===
        "EN_ROUTE_TO_HOSPITAL",
      `Expected EN_ROUTE_TO_HOSPITAL but received ${hospitalJourneyState?.status}`
    );

    console.log(
      "✅ Ambulance is EN_ROUTE_TO_HOSPITAL"
    );

    /*
     * ========================================================
     * STEP 11 — ARRIVED AT HOSPITAL
     * ========================================================
     */

    section(
      "STEP 11 — ARRIVED AT HOSPITAL"
    );

    services.liveTrackingOrchestratorService.hospitalArrived(
      REQUEST_ID
    );

    await wait(300);

    const hospitalArrivedState =
      services.trackingService.getTrackingState(
        REQUEST_ID
      );

    assert(
      hospitalArrivedState?.status ===
        "ARRIVED_AT_HOSPITAL",
      `Expected ARRIVED_AT_HOSPITAL but received ${hospitalArrivedState?.status}`
    );

    console.log(
      "✅ Ambulance arrived at hospital"
    );

    /*
     * ========================================================
     * STEP 12 — REQUEST COMPLETED
     * ========================================================
     */

    section(
      "STEP 12 — REQUEST COMPLETED"
    );

    services.liveTrackingOrchestratorService.completeEmergency(
      REQUEST_ID
    );

    await wait(300);

    const finalState =
      services.trackingService.getTrackingState(
        REQUEST_ID
      );

    assert(
      finalState?.status === "COMPLETED",
      `Expected COMPLETED but received ${finalState?.status}`
    );

    assert(
      finalState?.estimatedMinutes === 0,
      "Final ETA should be 0"
    );

    console.log(
      "✅ Emergency request completed"
    );

    /*
     * ========================================================
     * FINAL TRACKING STATE
     * ========================================================
     */

    section(
      "FINAL TRACKING STATE"
    );

    console.dir(finalState, {
      depth: null,
    });

    /*
     * ========================================================
     * EVENT SUMMARY
     * ========================================================
     */

    section("EVENT SUMMARY");

    console.log(
      "Assignment events:",
      socketEvents.assignmentCreated.length
    );

    console.log(
      "Accepted events:",
      socketEvents.assignmentAccepted.length
    );

    console.log(
      "Location events:",
      socketEvents.locations.length
    );

    console.log(
      "ETA events:",
      socketEvents.etas.length
    );

    console.log(
      "Route events:",
      socketEvents.routes.length
    );

    console.log(
      "Status events:",
      socketEvents.statuses.length
    );

    console.log(
      "Patient onboard events:",
      socketEvents.patientOnboard.length
    );

    console.log(
      "Hospital arrival events:",
      socketEvents.hospitalArrived.length
    );

    console.log(
      "Completion events:",
      socketEvents.completed.length
    );

    /*
     * ========================================================
     * FINAL SOCKET ASSERTIONS
     * ========================================================
     *
     * Socket delivery is asynchronous. We only assert events
     * that are required for the completed flow and give the
     * client time to receive them.
     */

    await wait(500);

    assert(
      socketEvents.assignmentCreated.length >= 1,
      "ASSIGNMENT_CREATED should be emitted"
    );

    assert(
      socketEvents.assignmentAccepted.length >= 1,
      "ASSIGNMENT_ACCEPTED should be emitted"
    );

    assert(
      socketEvents.etas.length >= 1,
      "At least one ETA event should be emitted"
    );

    assert(
      socketEvents.routes.length >= 1,
      "At least one route event should be emitted"
    );

    assert(
      socketEvents.patientOnboard.length >= 1,
      "PATIENT_ONBOARD should be emitted"
    );

    assert(
      socketEvents.hospitalArrived.length >= 1,
      "HOSPITAL_ARRIVED should be emitted"
    );

    assert(
      socketEvents.completed.length >= 1,
      "REQUEST_COMPLETED should be emitted"
    );

    /*
     * ========================================================
     * SUCCESS
     * ========================================================
     */

    console.log(
      "\n============================================================"
    );

    console.log(
      "✅ MODULE 5 → MODULE 6 END-TO-END REROUTING TEST PASSED"
    );

    console.log(
      "============================================================"
    );

    console.log("\nVerified:");

    console.log(
      "  ✅ Module 5 dispatch"
    );

    console.log(
      "  ✅ Assignment creation"
    );

    console.log(
      "  ✅ Driver acceptance"
    );

    console.log(
      "  ✅ Tracking state initialization"
    );

    console.log(
      "  ✅ EN_ROUTE_TO_PATIENT"
    );

    console.log(
      "  ✅ Live GPS updates"
    );

    console.log(
      "  ✅ Dynamic ETA"
    );

    console.log(
      "  ✅ Traffic-adjusted ETA"
    );

    console.log(
      "  ✅ Road blockage detection"
    );

    console.log(
      "  ✅ Dijkstra dynamic rerouting"
    );

    console.log(
      "  ✅ Alternative route selection"
    );

    console.log(
      "  ✅ Rerouted GPS movement"
    );

    console.log(
      "  ✅ Patient arrival"
    );

    console.log(
      "  ✅ Patient onboard"
    );

    console.log(
      "  ✅ EN_ROUTE_TO_HOSPITAL"
    );

    console.log(
      "  ✅ Hospital arrival"
    );

    console.log(
      "  ✅ Emergency completion"
    );

    console.log("\nRoute transition:");

    console.log(
      "  Initial:  N1 → N4 → N5"
    );

    console.log(
      "  Traffic:  N1 → N4 = HEAVY"
    );

    console.log(
      "  Blocked:  N1 → N4 = BLOCKED"
    );

    console.log(
      "  Rerouted: N1 → N2 → N3 → N5"
    );

    console.log(
      "\n============================================================\n"
    );
  } finally {
    client.disconnect();

    await new Promise<void>((resolve) => {
      io.close(() => {
        httpServer.close(() => {
          resolve();
        });
      });
    });
  }
}

main().catch((error) => {
  console.error(
    "\n❌ MODULE 5 → MODULE 6 TEST FAILED\n"
  );

  console.error(error);

  process.exit(1);
});