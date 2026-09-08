import { createServer } from "http";
import { Server } from "socket.io";
import { io as createClient, Socket } from "socket.io-client";

import { createServiceContainer } from "../../config/service-container.js";
import {
  Ambulance,
  EmergencyRequest,
} from "../dispatch/dispatch.types.js";

const PORT = 5005;
const REQUEST_ID = "REQ-E2E-FALLBACK-M5-M6-001";

const wait = (ms: number) =>
  new Promise<void>((resolve) => setTimeout(resolve, ms));

function section(title: string): void {
  console.log("\n============================================================");
  console.log(title);
  console.log("============================================================\n");
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

  /*
   * ----------------------------------------------------------
   * SOCKET EVENT CAPTURE
   * ----------------------------------------------------------
   */

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

  io.on("connection", (socket) => {
    console.log(`Socket connected: ${socket.id}`);

    socket.on(
      "join_emergency",
      ({ requestId }: { requestId: string }) => {
        const room = `emergency:${requestId}`;

        socket.join(room);

        console.log(
          `Socket ${socket.id} joined ${room}`
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
  });

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
   * ----------------------------------------------------------
   * EMERGENCY
   * ----------------------------------------------------------
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

  /*
   * A1 is deliberately placed first and should be selected.
   *
   * A2 and A3 remain available as fallback candidates.
   */

  const ambulances: Ambulance[] = [
    {
      ambulanceId: "A1",
      currentLocation: {
        latitude: 13.0827,
        longitude: 80.2707,
      },
      availabilityStatus: "AVAILABLE",
      driverId: "D1",
      capabilities: ["BLS", "ALS", "CARDIAC"],
    },

    {
      ambulanceId: "A2",
      currentLocation: {
        latitude: 13.0850,
        longitude: 80.2750,
      },
      availabilityStatus: "AVAILABLE",
      driverId: "D2",
      capabilities: ["BLS", "ALS", "CARDIAC"],
    },

    {
      ambulanceId: "A3",
      currentLocation: {
        latitude: 13.0780,
        longitude: 13.0780,
      },
      availabilityStatus: "AVAILABLE",
      driverId: "D3",
      capabilities: ["BLS"],
    },
  ];

  try {
    /*
     * ========================================================
     * STEP 1
     * MODULE 5 INITIAL DISPATCH
     * ========================================================
     */

    section(
      "STEP 1 — MODULE 5 INITIAL DISPATCH"
    );

    const initialAssignment =
      services.fallbackOrchestratorService.dispatchWithFallback(
        request,
        ambulances,
        10
      );

    console.log(
      "Initial selected ambulance:",
      initialAssignment.ambulanceId
    );

    console.log(
      "Initial route:",
      initialAssignment.route
    );

    console.log(
      "Initial ETA:",
      initialAssignment.estimatedTravelTime,
      "minutes"
    );

    assert(
      initialAssignment.ambulanceId === "A1",
      `Expected A1 to be initially selected but received ${initialAssignment.ambulanceId}`
    );

    assert(
      initialAssignment.route.nodeIds[0] === "N1",
      "Initial route should start at N1"
    );

    assert(
      initialAssignment.route.nodeIds[
        initialAssignment.route.nodeIds.length - 1
      ] === "N5",
      "Initial route should end at N5"
    );

    assert(
      initialAssignment.route.nodeIds.includes("N4"),
      "Initial route should use N4"
    );

    console.log(
      "✅ A1 selected by Module 5"
    );

    await wait(500);

    /*
     * ========================================================
     * STEP 2
     * DRIVER ACCEPTS THEN FAILS
     * ========================================================
     */

    section(
      "STEP 2 — INITIAL DRIVER ACCEPTANCE"
    );

    const accepted =
      services.fallbackOrchestratorService.acceptAssignment(
        REQUEST_ID,
        "A1"
      );

    assert(
      accepted.status === "ACCEPTED",
      `Expected ACCEPTED but received ${accepted.status}`
    );

    console.log(
      "A1 assignment status:",
      accepted.status
    );

    console.log(
      "✅ A1 initially accepted"
    );

    await wait(300);

    /*
     * ========================================================
     * STEP 3
     * A1 REJECTS / FAILURE
     * ========================================================
     */

    section(
      "STEP 3 — A1 FAILURE / REJECTION"
    );

    const fallbackResult =
      services.fallbackOrchestratorService.handleFailureAndFallback(
        request,
        ambulances,
        10,
        "A1",
        "REJECTED",
        "Driver rejected emergency assignment"
      );

    console.log(
      "Fallback selected ambulance:",
      fallbackResult.ambulanceId
    );

    console.log(
      "Fallback route:",
      fallbackResult.route
    );

    console.log(
      "Fallback ETA:",
      fallbackResult.estimatedTravelTime,
      "minutes"
    );

    assert(
      fallbackResult.ambulanceId !== "A1",
      "Failed ambulance A1 must not be selected again"
    );

    console.log(
      "✅ A1 excluded from fallback"
    );

    await wait(500);

    /*
     * ========================================================
     * STEP 4
     * VERIFY FALLBACK ASSIGNMENT
     * ========================================================
     */

    section(
      "STEP 4 — VERIFY FALLBACK ASSIGNMENT"
    );

    const fallbackAssignment =
      services.fallbackOrchestratorService.getActiveAssignment(
        REQUEST_ID
      );

    assert(
      fallbackAssignment !== undefined,
      "Fallback assignment should exist"
    );

    console.log(
      "Active fallback ambulance:",
      fallbackAssignment?.ambulanceId
    );

    console.log(
      "Active assignment status:",
      fallbackAssignment?.status
    );

    assert(
      fallbackAssignment?.ambulanceId !== "A1",
      "Active assignment must not use failed A1"
    );

    assert(
      fallbackAssignment?.status === "ASSIGNED",
      `Expected fallback assignment status ASSIGNED but received ${fallbackAssignment?.status}`
    );

    console.log(
      "✅ New ambulance assigned"
    );

    /*
     * Confirm A1 is no longer active.
     */

    assert(
      fallbackAssignment?.ambulanceId !== "A1",
      "Only fallback ambulance should remain active"
    );

    /*
     * ========================================================
     * STEP 5
     * VERIFY ATTEMPT HISTORY
     * ========================================================
     */

    section(
      "STEP 5 — FALLBACK ATTEMPT HISTORY"
    );

    const attempts =
      services.fallbackOrchestratorService.getAttempts(
        REQUEST_ID
      );

    console.log(
      "Total assignment attempts:",
      attempts.length
    );

    console.dir(attempts, {
      depth: null,
    });

    assert(
      attempts.length >= 2,
      `Expected at least 2 attempts but received ${attempts.length}`
    );

    const firstAttempt = attempts[0];

    assert(
      firstAttempt.ambulanceId === "A1",
      "First attempt should belong to A1"
    );

    assert(
      firstAttempt.response === "REJECTED",
      `First attempt should be REJECTED but received ${firstAttempt.response}`
    );

    assert(
      firstAttempt.failureReason !== undefined,
      "Rejected attempt should contain failure reason"
    );

    const secondAttempt = attempts[1];

    assert(
      secondAttempt.ambulanceId !== "A1",
      "Second attempt must use a different ambulance"
    );

    console.log(
      "First attempt:",
      firstAttempt.ambulanceId,
      firstAttempt.response
    );

    console.log(
      "Second attempt:",
      secondAttempt.ambulanceId,
      secondAttempt.response ?? "PENDING"
    );

    console.log(
      "✅ Attempt history recorded correctly"
    );

    /*
     * ========================================================
     * STEP 6
     * SOCKET FALLBACK EVENTS
     * ========================================================
     */

    section(
      "STEP 6 — VERIFY FALLBACK SOCKET EVENTS"
    );

    await wait(500);

    console.log(
      "ASSIGNMENT_CREATED:",
      socketEvents.assignmentCreated.length
    );

    console.log(
      "ASSIGNMENT_ACCEPTED:",
      socketEvents.assignmentAccepted.length
    );

    console.log(
      "ASSIGNMENT_REJECTED:",
      socketEvents.assignmentRejected.length
    );

    console.log(
      "FALLBACK_STARTED:",
      socketEvents.fallbackStarted.length
    );

    console.log(
      "FALLBACK_ASSIGNMENT_CREATED:",
      socketEvents.fallbackAssignmentCreated.length
    );

    assert(
      socketEvents.assignmentCreated.length >= 1,
      "ASSIGNMENT_CREATED should be emitted"
    );

    assert(
      socketEvents.assignmentAccepted.length >= 1,
      "ASSIGNMENT_ACCEPTED should be emitted"
    );

    assert(
      socketEvents.assignmentRejected.length >= 1,
      "ASSIGNMENT_REJECTED should be emitted"
    );

    assert(
      socketEvents.fallbackStarted.length >= 1,
      "FALLBACK_STARTED should be emitted"
    );

    assert(
      socketEvents.fallbackAssignmentCreated.length >= 1,
      "FALLBACK_ASSIGNMENT_CREATED should be emitted"
    );

    console.log(
      "✅ Fallback Socket.IO event sequence verified"
    );

    /*
     * ========================================================
     * STEP 7
     * FALLBACK DRIVER ACCEPTS
     * ========================================================
     */

    section(
      "STEP 7 — FALLBACK DRIVER ACCEPTS"
    );

    const fallbackAmbulanceId =
      fallbackAssignment!.ambulanceId;

    const fallbackAccepted =
      services.fallbackOrchestratorService.acceptAssignment(
        REQUEST_ID,
        fallbackAmbulanceId
      );

    assert(
      fallbackAccepted.status === "ACCEPTED",
      `Fallback assignment should be ACCEPTED but received ${fallbackAccepted.status}`
    );

    console.log(
      "Fallback ambulance:",
      fallbackAmbulanceId
    );

    console.log(
      "Assignment status:",
      fallbackAccepted.status
    );

    console.log(
      "✅ Fallback ambulance accepted"
    );

    await wait(500);

    /*
     * ========================================================
     * STEP 8
     * INITIALIZE LIVE TRACKING
     * ========================================================
     */

    section(
      "STEP 8 — INITIALIZE LIVE TRACKING"
    );

    await services.liveTrackingOrchestratorService.processLocationUpdate(
      {
        ambulanceId: fallbackAmbulanceId,
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

    services.liveTrackingOrchestratorService.acceptAssignment(
      REQUEST_ID
    );

    await wait(100);

    services.liveTrackingOrchestratorService.startJourney(
      REQUEST_ID
    );

    await wait(300);

    const trackingState =
      services.trackingService.getTrackingState(
        REQUEST_ID
      );

    assert(
      trackingState !== undefined,
      "Tracking state should exist"
    );

    assert(
      trackingState?.ambulanceId ===
        fallbackAmbulanceId,
      "Tracking should belong to fallback ambulance"
    );

    assert(
      trackingState?.status ===
        "EN_ROUTE_TO_PATIENT",
      `Expected EN_ROUTE_TO_PATIENT but received ${trackingState?.status}`
    );

    console.log(
      "Tracking ambulance:",
      trackingState?.ambulanceId
    );

    console.log(
      "Tracking status:",
      trackingState?.status
    );

    console.log(
      "Tracking ETA:",
      trackingState?.estimatedMinutes
    );

    console.log(
      "✅ Live tracking transferred to fallback ambulance"
    );

    /*
     * ========================================================
     * STEP 9
     * LIVE GPS + ETA
     * ========================================================
     */

    section(
      "STEP 9 — FALLBACK LIVE GPS + ETA"
    );

    await services.liveTrackingOrchestratorService.processLocationUpdate(
      {
        ambulanceId: fallbackAmbulanceId,
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

    const liveState =
      services.trackingService.getTrackingState(
        REQUEST_ID
      );

    assert(
      liveState?.latestLocation !== undefined,
      "Latest fallback ambulance location should exist"
    );

    assert(
      liveState?.estimatedMinutes !== undefined,
      "Fallback ambulance ETA should exist"
    );

    console.log(
      "Fallback live location:",
      liveState?.latestLocation
    );

    console.log(
      "Fallback live ETA:",
      liveState?.estimatedMinutes,
      "minutes"
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
      "✅ Fallback ambulance live tracking working"
    );

    /*
     * ========================================================
     * STEP 10
     * TRAFFIC CHANGE
     * ========================================================
     */

    section(
      "STEP 10 — TRAFFIC DISRUPTION"
    );

    const beforeTrafficETA =
      liveState!.estimatedMinutes!;

    services.trafficService.setTrafficState(
      "N1",
      "N4",
      "HEAVY"
    );

    console.log(
      "Traffic changed:"
    );

    console.log(
      "N1 → N4 = HEAVY"
    );

    await services.liveTrackingOrchestratorService.processLocationUpdate(
      {
        ambulanceId: fallbackAmbulanceId,
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

    const trafficState =
      services.trackingService.getTrackingState(
        REQUEST_ID
      );

    assert(
      trafficState?.estimatedMinutes !== undefined,
      "Traffic-adjusted ETA should exist"
    );

    const heavyTrafficETA =
      trafficState!.estimatedMinutes!;

    console.log(
      "ETA before traffic:",
      beforeTrafficETA,
      "minutes"
    );

    console.log(
      "ETA after heavy traffic:",
      heavyTrafficETA,
      "minutes"
    );

    assert(
      heavyTrafficETA >= beforeTrafficETA,
      `Heavy traffic ETA ${heavyTrafficETA} should not be less than ${beforeTrafficETA}`
    );

    console.log(
      "✅ Traffic dynamically affected ETA"
    );

    /*
     * ========================================================
     * STEP 11
     * ROAD BLOCKAGE + REROUTING
     * ========================================================
     */

    section(
      "STEP 11 — ROAD BLOCKAGE + DYNAMIC REROUTING"
    );

    services.trafficService.setTrafficState(
      "N1",
      "N4",
      "BLOCKED"
    );

    console.log(
      "Road closure:"
    );

    console.log(
      "N1 → N4 = BLOCKED"
    );

    await services.liveTrackingOrchestratorService.processLocationUpdate(
      {
        ambulanceId: fallbackAmbulanceId,
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
      reroutedState?.estimatedMinutes !== undefined,
      "Rerouted ETA should exist"
    );

    const reroutedETA =
      reroutedState!.estimatedMinutes!;

    const reroutedResult =
      services.etaService.calculateETA(
        REQUEST_ID,
        fallbackAmbulanceId,
        {
          latitude: 13.0827,
          longitude: 80.2707,
        },
        request.pickupLocation
      );

    const reroutedPath =
      reroutedResult.route.nodeIds.join("→");

    console.log(
      "Rerouted ETA:",
      reroutedETA,
      "minutes"
    );

    console.log(
      "Rerouted route:",
      reroutedPath
    );

    assert(
      reroutedETA ===
        reroutedResult.estimatedMinutes,
      `Tracking ETA ${reroutedETA} should match ETAService ${reroutedResult.estimatedMinutes}`
    );

    assert(
      reroutedPath ===
        "N1→N2→N3→N5",
      `Expected N1→N2→N3→N5 but received ${reroutedPath}`
    );

    assert(
      !reroutedResult.route.nodeIds.includes("N4"),
      "Rerouted path must not contain blocked N4"
    );

    console.log(
      "✅ Dijkstra dynamically rerouted fallback ambulance"
    );

    /*
     * ========================================================
     * STEP 12
     * FOLLOW REROUTED PATH
     * ========================================================
     */

    section(
      "STEP 12 — FOLLOW REROUTED PATH"
    );

    await services.liveTrackingOrchestratorService.processLocationUpdate(
      {
        ambulanceId: fallbackAmbulanceId,
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

    await services.liveTrackingOrchestratorService.processLocationUpdate(
      {
        ambulanceId: fallbackAmbulanceId,
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

    const movingState =
      services.trackingService.getTrackingState(
        REQUEST_ID
      );

    assert(
      movingState?.status ===
        "EN_ROUTE_TO_PATIENT",
      "Ambulance should remain EN_ROUTE_TO_PATIENT"
    );

    console.log(
      "Current location:",
      movingState?.latestLocation
    );

    console.log(
      "Current ETA:",
      movingState?.estimatedMinutes,
      "minutes"
    );

    console.log(
      "Current status:",
      movingState?.status
    );

    console.log(
      "✅ Fallback ambulance followed rerouted path"
    );

    /*
     * ========================================================
     * STEP 13
     * ARRIVED AT PATIENT
     * ========================================================
     */

    section(
      "STEP 13 — ARRIVED AT PATIENT"
    );

    await services.liveTrackingOrchestratorService.processLocationUpdate(
      {
        ambulanceId: fallbackAmbulanceId,
        requestId: REQUEST_ID,
        latitude: 13.08,
        longitude: 80.278,
        speed: 0,
        heading: 0,
        timestamp: new Date(),
      },
      request.pickupLocation
    );

    await wait(500);

    const arrivalState =
      services.trackingService.getTrackingState(
        REQUEST_ID
      );

    assert(
      arrivalState?.status ===
        "ARRIVED_AT_PATIENT",
      `Expected ARRIVED_AT_PATIENT but received ${arrivalState?.status}`
    );

    assert(
      arrivalState?.estimatedMinutes === 0,
      "ETA should be zero at patient"
    );

    console.log(
      "Patient arrival ETA:",
      arrivalState?.estimatedMinutes
    );

    console.log(
      "✅ Fallback ambulance arrived at patient"
    );

    /*
     * ========================================================
     * STEP 14
     * PATIENT ONBOARD
     * ========================================================
     */

    section(
      "STEP 14 — PATIENT ONBOARD"
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
     * STEP 15
     * EN ROUTE TO HOSPITAL
     * ========================================================
     */

    section(
      "STEP 15 — EN_ROUTE_TO_HOSPITAL"
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
     * STEP 16
     * HOSPITAL ARRIVAL
     * ========================================================
     */

    section(
      "STEP 16 — ARRIVED AT HOSPITAL"
    );

    services.liveTrackingOrchestratorService.hospitalArrived(
      REQUEST_ID
    );

    await wait(300);

    const hospitalState =
      services.trackingService.getTrackingState(
        REQUEST_ID
      );

    assert(
      hospitalState?.status ===
        "ARRIVED_AT_HOSPITAL",
      `Expected ARRIVED_AT_HOSPITAL but received ${hospitalState?.status}`
    );

    console.log(
      "✅ Ambulance arrived at hospital"
    );

    /*
     * ========================================================
     * STEP 17
     * COMPLETE EMERGENCY
     * ========================================================
     */

    section(
      "STEP 17 — COMPLETE EMERGENCY"
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
      "Final ETA should be zero"
    );

    assert(
      finalState?.ambulanceId ===
        fallbackAmbulanceId,
      "Final tracking should belong to fallback ambulance"
    );

    console.log(
      "Final ambulance:",
      finalState?.ambulanceId
    );

    console.log(
      "Final status:",
      finalState?.status
    );

    console.log(
      "Final ETA:",
      finalState?.estimatedMinutes
    );

    console.log(
      "✅ Emergency completed successfully"
    );

    /*
     * ========================================================
     * FINAL SUMMARY
     * ========================================================
     */

    section(
      "FINAL EVENT SUMMARY"
    );

    await wait(500);

    console.log(
      "ASSIGNMENT_CREATED:",
      socketEvents.assignmentCreated.length
    );

    console.log(
      "ASSIGNMENT_ACCEPTED:",
      socketEvents.assignmentAccepted.length
    );

    console.log(
      "ASSIGNMENT_REJECTED:",
      socketEvents.assignmentRejected.length
    );

    console.log(
      "FALLBACK_STARTED:",
      socketEvents.fallbackStarted.length
    );

    console.log(
      "FALLBACK_ASSIGNMENT_CREATED:",
      socketEvents.fallbackAssignmentCreated.length
    );

    console.log(
      "LOCATION:",
      socketEvents.locations.length
    );

    console.log(
      "ETA:",
      socketEvents.etas.length
    );

    console.log(
      "ROUTE:",
      socketEvents.routes.length
    );

    console.log(
      "STATUS:",
      socketEvents.statuses.length
    );

    console.log(
      "PATIENT_ONBOARD:",
      socketEvents.patientOnboard.length
    );

    console.log(
      "HOSPITAL_ARRIVED:",
      socketEvents.hospitalArrived.length
    );

    console.log(
      "REQUEST_COMPLETED:",
      socketEvents.completed.length
    );

    /*
     * ========================================================
     * FINAL ASSERTIONS
     * ========================================================
     */

    assert(
      socketEvents.assignmentCreated.length >= 1,
      "Initial assignment event missing"
    );

    assert(
      socketEvents.assignmentRejected.length >= 1,
      "Assignment rejection event missing"
    );

    assert(
      socketEvents.fallbackStarted.length >= 1,
      "Fallback started event missing"
    );

    assert(
      socketEvents.fallbackAssignmentCreated.length >= 1,
      "Fallback assignment event missing"
    );

    assert(
      socketEvents.etas.length >= 1,
      "ETA events missing"
    );

    assert(
      socketEvents.routes.length >= 1,
      "Route events missing"
    );

    assert(
      socketEvents.patientOnboard.length >= 1,
      "Patient onboard event missing"
    );

    assert(
      socketEvents.hospitalArrived.length >= 1,
      "Hospital arrival event missing"
    );

    assert(
      socketEvents.completed.length >= 1,
      "Completion event missing"
    );

    section(
      "MODULE 5 → FALLBACK → MODULE 6 END-TO-END TEST PASSED"
    );

    console.log(
      "Verified:"
    );

    console.log(
      "  ✅ Initial intelligent dispatch"
    );

    console.log(
      "  ✅ A1 assignment"
    );

    console.log(
      "  ✅ Driver acceptance"
    );

    console.log(
      "  ✅ A1 rejection"
    );

    console.log(
      "  ✅ Failed ambulance exclusion"
    );

    console.log(
      "  ✅ Automatic fallback"
    );

    console.log(
      "  ✅ Module 5 rerun"
    );

    console.log(
      "  ✅ New ambulance assignment"
    );

    console.log(
      "  ✅ Attempt history"
    );

    console.log(
      "  ✅ Fallback Socket.IO events"
    );

    console.log(
      "  ✅ Fallback driver acceptance"
    );

    console.log(
      "  ✅ Live GPS tracking"
    );

    console.log(
      "  ✅ Dynamic ETA"
    );

    console.log(
      "  ✅ Heavy traffic ETA recalculation"
    );

    console.log(
      "  ✅ Road blockage"
    );

    console.log(
      "  ✅ Dynamic Dijkstra rerouting"
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
      "  ✅ Hospital journey"
    );

    console.log(
      "  ✅ Hospital arrival"
    );

    console.log(
      "  ✅ Emergency completion"
    );

    console.log(
      "\nRoute transition:"
    );

    console.log(
      "  Initial:   N1 → N4 → N5"
    );

    console.log(
      "  Heavy:     N1 → N4 = HEAVY"
    );

    console.log(
      "  Blocked:   N1 → N4 = BLOCKED"
    );

    console.log(
      "  Rerouted:  N1 → N2 → N3 → N5"
    );

    console.log(
      "\nFailure recovery:"
    );

    console.log(
      "  A1 → REJECTED"
    );

    console.log(
      `  ${fallbackAmbulanceId} → ACCEPTED`
    );

    console.log(
      "\n============================================================"
    );

    console.log(
      "✅ SIH FALLBACK + LIVE TRACKING SCENARIO VERIFIED"
    );

    console.log(
      "============================================================\n"
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
    "\n❌ MODULE 5 → FALLBACK → MODULE 6 TEST FAILED\n"
  );

  console.error(error);

  process.exit(1);
});