import http from "http";
import { Server } from "socket.io";
import { io as Client, Socket } from "socket.io-client";

import { createServiceContainer } from "../../config/service-container.js";

import {
  Ambulance,
  EmergencyRequest,
} from "../dispatch/dispatch.types.js";

import {
  Assignment,
} from "../assignment/assignment.types.js";

const PORT = 5003;

const REQUEST_ID = "REQ-LIVE-FB-001";

const SEARCH_RADIUS_KM = 5;

const emergency: EmergencyRequest = {
  requestId: REQUEST_ID,

  emergencyType: "CARDIAC_EMERGENCY",

  victimCount: 1,

  pickupLocation: {
    latitude: 13.0800,
    longitude: 80.2780,
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

    capabilities: ["BASIC"],
  },

  {
    ambulanceId: "A2",

    currentLocation: {
      latitude: 13.0850,
      longitude: 80.2750,
    },

    availabilityStatus: "AVAILABLE",

    driverId: "D2",

    capabilities: ["ICU"],
  },

  {
    ambulanceId: "A3",

    currentLocation: {
      latitude: 13.0780,
      longitude: 80.2680,
    },

    availabilityStatus: "AVAILABLE",

    driverId: "D3",

    capabilities: ["BASIC"],
  },
];

async function runTest(): Promise<void> {
  console.log("");

  console.log(
    "================================================",
  );

  console.log(
    " LIVE CASCADING FALLBACK SOCKET TEST",
  );

  console.log(
    "================================================",
  );

  console.log("");

  const httpServer = http.createServer();

  const io = new Server(httpServer, {
    cors: {
      origin: "*",
      methods: ["GET", "POST"],
    },
  });

  const services =
    createServiceContainer(io);

  io.on("connection", (socket) => {
    console.log(
      `Socket connected: ${socket.id}`,
    );

    socket.on(
      "join-emergency",
      (requestId: string) => {
        const room =
          `emergency:${requestId}`;

        socket.join(room);

        console.log(
          `Socket ${socket.id} joined ${room}`,
        );

        socket.emit(
          "joined-emergency",
          {
            requestId,
            room,
          },
        );
      },
    );

    socket.on("disconnect", () => {
      console.log(
        `Socket disconnected: ${socket.id}`,
      );
    });
  });

  await new Promise<void>(
    (resolve) => {
      httpServer.listen(
        PORT,
        () => {
          console.log(
            `Socket test server running on port ${PORT}`,
          );

          resolve();
        },
      );
    },
  );

  const client: Socket = Client(
    `http://localhost:${PORT}`,
    {
      transports: ["websocket"],
      forceNew: true,
      reconnection: false,
    },
  );

  const receivedEvents: string[] = [];

  const assignmentCreated: Assignment[] =
    [];

  const assignmentRejected: Assignment[] =
    [];

  const fallbackStarted: unknown[] =
    [];

  const fallbackAssignments: Assignment[] =
    [];

  const assignmentAccepted: Assignment[] =
    [];

  let joinedEmergencyResolve:
    (() => void) | undefined;

  const joinedEmergency =
    new Promise<void>((resolve) => {
      joinedEmergencyResolve = resolve;
    });

  client.on("connect", () => {
    console.log(
      `Test client connected: ${client.id}`,
    );

    client.emit(
      "join-emergency",
      REQUEST_ID,
    );
  });

  client.on(
    "joined-emergency",
    (data) => {
      console.log(
        "Client joined emergency room:",
        data,
      );

      joinedEmergencyResolve?.();
    },
  );

  client.on(
    "ASSIGNMENT_CREATED",
    (assignment: Assignment) => {
      console.log(
        "\n📡 EVENT: ASSIGNMENT_CREATED",
      );

      console.log(assignment);

      receivedEvents.push(
        "ASSIGNMENT_CREATED",
      );

      assignmentCreated.push(
        assignment,
      );
    },
  );

  client.on(
    "ASSIGNMENT_REJECTED",
    (assignment: Assignment) => {
      console.log(
        "\n📡 EVENT: ASSIGNMENT_REJECTED",
      );

      console.log(assignment);

      receivedEvents.push(
        "ASSIGNMENT_REJECTED",
      );

      assignmentRejected.push(
        assignment,
      );
    },
  );

  client.on(
    "FALLBACK_STARTED",
    (data) => {
      console.log(
        "\n📡 EVENT: FALLBACK_STARTED",
      );

      console.log(data);

      receivedEvents.push(
        "FALLBACK_STARTED",
      );

      fallbackStarted.push(data);
    },
  );

  client.on(
    "FALLBACK_ASSIGNMENT_CREATED",
    (assignment: Assignment) => {
      console.log(
        "\n📡 EVENT: FALLBACK_ASSIGNMENT_CREATED",
      );

      console.log(assignment);

      receivedEvents.push(
        "FALLBACK_ASSIGNMENT_CREATED",
      );

      fallbackAssignments.push(
        assignment,
      );
    },
  );

  client.on(
    "ASSIGNMENT_ACCEPTED",
    (assignment: Assignment) => {
      console.log(
        "\n📡 EVENT: ASSIGNMENT_ACCEPTED",
      );

      console.log(assignment);

      receivedEvents.push(
        "ASSIGNMENT_ACCEPTED",
      );

      assignmentAccepted.push(
        assignment,
      );
    },
  );

  await new Promise<void>(
    (resolve, reject) => {
      if (client.connected) {
        resolve();

        return;
      }

      const timeout =
        setTimeout(() => {
          reject(
            new Error(
              "Socket connection timeout",
            ),
          );
        }, 5000);

      client.once(
        "connect",
        () => {
          clearTimeout(timeout);

          resolve();
        },
      );
    },
  );

  await joinedEmergency;

  await delay(100);

  console.log("");

  console.log(
    "----------------------------------------------",
  );

  console.log(
    "STEP 1 — INITIAL DISPATCH",
  );

  console.log(
    "----------------------------------------------",
  );

  const firstAssignment =
    services
      .fallbackOrchestratorService
      .dispatchWithFallback(
        emergency,
        ambulances,
        SEARCH_RADIUS_KM,
      );

  console.log(
    "\nFirst selected ambulance:",
    firstAssignment.ambulanceId,
  );

  console.log(
    "Assignment status:",
    firstAssignment.status,
  );

  if (
    firstAssignment.status !==
    "ASSIGNED"
  ) {
    throw new Error(
      `Expected first assignment status ASSIGNED, got ${firstAssignment.status}`,
    );
  }

  const firstAmbulance =
    ambulances.find(
      (ambulance) =>
        ambulance.ambulanceId ===
        firstAssignment.ambulanceId,
    );

  if (!firstAmbulance) {
    throw new Error(
      "First ambulance not found",
    );
  }

  if (
    firstAmbulance.availabilityStatus !==
    "BUSY"
  ) {
    throw new Error(
      `Expected ${firstAmbulance.ambulanceId} to be BUSY`,
    );
  }

  if (
    firstAmbulance.currentRequestId !==
    REQUEST_ID
  ) {
    throw new Error(
      `Expected ${firstAmbulance.ambulanceId} currentRequestId to be ${REQUEST_ID}`,
    );
  }

  console.log(
    "✅ First ambulance marked BUSY",
  );

  await waitForCondition(
    () =>
      assignmentCreated.length === 1,

    "ASSIGNMENT_CREATED event",
  );

  console.log("");

  console.log(
    "----------------------------------------------",
  );

  console.log(
    "STEP 2 — DRIVER REJECTS",
  );

  console.log(
    "----------------------------------------------",
  );

  const fallbackAssignment =
    services
      .fallbackOrchestratorService
      .handleFailureAndFallback(
        emergency,
        ambulances,
        SEARCH_RADIUS_KM,
        firstAssignment.ambulanceId,
        "REJECTED",
        "Driver rejected assignment",
      );

  console.log(
    "\nFallback ambulance:",
    fallbackAssignment.ambulanceId,
  );

  console.log(
    "Fallback assignment status:",
    fallbackAssignment.status,
  );

  /*
   * IMPORTANT:
   *
   * Use a fresh lookup here.
   *
   * TypeScript previously narrowed firstAmbulance
   * to BUSY earlier in the test and therefore
   * complained about comparing it with AVAILABLE.
   */
  const failedAmbulanceAfterFallback =
    ambulances.find(
      (ambulance) =>
        ambulance.ambulanceId ===
        firstAssignment.ambulanceId,
    );

  if (!failedAmbulanceAfterFallback) {
    throw new Error(
      "Failed ambulance not found after fallback",
    );
  }

  if (
    failedAmbulanceAfterFallback
      .availabilityStatus !==
    "AVAILABLE"
  ) {
    throw new Error(
      `Expected failed ambulance ${failedAmbulanceAfterFallback.ambulanceId} to become AVAILABLE`,
    );
  }

  if (
    failedAmbulanceAfterFallback
      .currentRequestId !== undefined
  ) {
    throw new Error(
      `Expected ${failedAmbulanceAfterFallback.ambulanceId} currentRequestId to be cleared`,
    );
  }

  console.log(
    "✅ Failed ambulance released",
  );

  const excluded =
    services
      .fallbackOrchestratorService
      .getExcludedAmbulances(
        REQUEST_ID,
      );

  console.log(
    "\nExcluded ambulances:",
    Array.from(excluded),
  );

  if (
    !excluded.has(
      firstAssignment.ambulanceId,
    )
  ) {
    throw new Error(
      `Expected ${firstAssignment.ambulanceId} to be excluded`,
    );
  }

  console.log(
    "✅ Failed ambulance correctly excluded",
  );

  if (
    fallbackAssignment.ambulanceId ===
    firstAssignment.ambulanceId
  ) {
    throw new Error(
      "Fallback selected the previously failed ambulance",
    );
  }

  console.log(
    "✅ Fallback selected a different ambulance",
  );

  const secondAmbulance =
    ambulances.find(
      (ambulance) =>
        ambulance.ambulanceId ===
        fallbackAssignment.ambulanceId,
    );

  if (!secondAmbulance) {
    throw new Error(
      "Fallback ambulance not found",
    );
  }

  if (
    secondAmbulance.availabilityStatus !==
    "BUSY"
  ) {
    throw new Error(
      `Expected fallback ambulance ${secondAmbulance.ambulanceId} to be BUSY`,
    );
  }

  if (
    secondAmbulance.currentRequestId !==
    REQUEST_ID
  ) {
    throw new Error(
      `Expected fallback ambulance ${secondAmbulance.ambulanceId} currentRequestId to be ${REQUEST_ID}`,
    );
  }

  console.log(
    "✅ Fallback ambulance marked BUSY",
  );

  const activeAssignment =
    services
      .fallbackOrchestratorService
      .getActiveAssignment(
        REQUEST_ID,
      );

  if (!activeAssignment) {
    throw new Error(
      "Expected an active fallback assignment",
    );
  }

  if (
    activeAssignment.ambulanceId !==
    fallbackAssignment.ambulanceId
  ) {
    throw new Error(
      "Active assignment does not belong to fallback ambulance",
    );
  }

  console.log(
    "✅ Only fallback ambulance is active",
  );

  await waitForCondition(
    () =>
      assignmentRejected.length === 1,

    "ASSIGNMENT_REJECTED event",
  );

  await waitForCondition(
    () =>
      fallbackStarted.length === 1,

    "FALLBACK_STARTED event",
  );

  await waitForCondition(
    () =>
      fallbackAssignments.length === 1,

    "FALLBACK_ASSIGNMENT_CREATED event",
  );

  console.log("");

  console.log(
    "----------------------------------------------",
  );

  console.log(
    "STEP 3 — FALLBACK DRIVER ACCEPTS",
  );

  console.log(
    "----------------------------------------------",
  );

  const acceptedAssignment =
    services
      .fallbackOrchestratorService
      .acceptAssignment(
        REQUEST_ID,
        fallbackAssignment.ambulanceId,
      );

  console.log(
    "\nAccepted ambulance:",
    acceptedAssignment.ambulanceId,
  );

  console.log(
    "Assignment status:",
    acceptedAssignment.status,
  );

  if (
    acceptedAssignment.status !==
    "ACCEPTED"
  ) {
    throw new Error(
      `Expected ACCEPTED status, got ${acceptedAssignment.status}`,
    );
  }

  await waitForCondition(
    () =>
      assignmentAccepted.length === 1,

    "ASSIGNMENT_ACCEPTED event",
  );

  console.log(
    "✅ Fallback assignment accepted",
  );

  console.log("");

  console.log(
    "----------------------------------------------",
  );

  console.log(
    "EVENT SEQUENCE",
  );

  console.log(
    "----------------------------------------------",
  );

  console.log(receivedEvents);

  const expectedEvents = [
    "ASSIGNMENT_CREATED",
    "ASSIGNMENT_REJECTED",
    "FALLBACK_STARTED",
    "FALLBACK_ASSIGNMENT_CREATED",
    "ASSIGNMENT_ACCEPTED",
  ];

  if (
    receivedEvents.length <
    expectedEvents.length
  ) {
    throw new Error(
      `Expected ${expectedEvents.length} events, received ${receivedEvents.length}`,
    );
  }

  for (
    let index = 0;
    index < expectedEvents.length;
    index++
  ) {
    if (
      receivedEvents[index] !==
      expectedEvents[index]
    ) {
      throw new Error(
        `Invalid event order at position ${index + 1}. Expected ${expectedEvents[index]}, got ${receivedEvents[index]}`,
      );
    }
  }

  console.log(
    "✅ Socket event order is correct",
  );

  console.log("");

  console.log(
    "----------------------------------------------",
  );

  console.log(
    "ATTEMPT HISTORY",
  );

  console.log(
    "----------------------------------------------",
  );

  const attempts =
    services
      .fallbackOrchestratorService
      .getAttempts(
        REQUEST_ID,
      );

  console.log(attempts);

  if (attempts.length !== 2) {
    throw new Error(
      `Expected 2 assignment attempts, got ${attempts.length}`,
    );
  }

  if (
    attempts[0].ambulanceId !==
    firstAssignment.ambulanceId
  ) {
    throw new Error(
      "Attempt 1 ambulance mismatch",
    );
  }

  if (
    attempts[0].response !==
    "REJECTED"
  ) {
    throw new Error(
      `Expected attempt 1 to be REJECTED, got ${attempts[0].response}`,
    );
  }

  if (
    attempts[1].ambulanceId !==
    fallbackAssignment.ambulanceId
  ) {
    throw new Error(
      "Attempt 2 ambulance mismatch",
    );
  }

  console.log(
    "✅ Attempt history is correct",
  );

  console.log("");

  console.log(
    "----------------------------------------------",
  );

  console.log(
    "FINAL STATE",
  );

  console.log(
    "----------------------------------------------",
  );

  for (const ambulance of ambulances) {
    console.log(
      `${ambulance.ambulanceId}:`,
      ambulance.availabilityStatus,
      "request:",
      ambulance.currentRequestId,
    );
  }

  console.log(
    "\nActive assignment:",
    services
      .fallbackOrchestratorService
      .getActiveAssignment(
        REQUEST_ID,
      ),
  );

  /*
   * Use fresh references for final runtime
   * state validation as well.
   */
  const finalFailedAmbulance =
    ambulances.find(
      (ambulance) =>
        ambulance.ambulanceId ===
        firstAssignment.ambulanceId,
    );

  const finalFallbackAmbulance =
    ambulances.find(
      (ambulance) =>
        ambulance.ambulanceId ===
        fallbackAssignment.ambulanceId,
    );

  if (!finalFailedAmbulance) {
    throw new Error(
      "Failed ambulance not found in final state",
    );
  }

  if (!finalFallbackAmbulance) {
    throw new Error(
      "Fallback ambulance not found in final state",
    );
  }

  if (
    finalFailedAmbulance.availabilityStatus !==
    "AVAILABLE"
  ) {
    throw new Error(
      "Failed ambulance is not AVAILABLE",
    );
  }

  if (
    finalFallbackAmbulance.availabilityStatus !==
    "BUSY"
  ) {
    throw new Error(
      "Accepted fallback ambulance should remain BUSY",
    );
  }

  console.log("");

  console.log(
    "================================================",
  );

  console.log(
    "✅ LIVE CASCADING FALLBACK SOCKET TEST PASSED",
  );

  console.log(
    "================================================",
  );

  console.log("");

  client.disconnect();

  await new Promise<void>(
    (resolve) => {
      io.close(() => {
        httpServer.close(() => {
          resolve();
        });
      });
    },
  );
}

function delay(
  milliseconds: number,
): Promise<void> {
  return new Promise(
    (resolve) => {
      setTimeout(
        resolve,
        milliseconds,
      );
    },
  );
}

async function waitForCondition(
  condition: () => boolean,
  description: string,
  timeoutMs = 5000,
): Promise<void> {
  const start = Date.now();

  while (!condition()) {
    if (
      Date.now() - start >
      timeoutMs
    ) {
      throw new Error(
        `Timeout waiting for ${description}`,
      );
    }

    await delay(50);
  }
}

runTest().catch((error) => {
  console.error("");

  console.error(
    "❌ LIVE FALLBACK SOCKET TEST FAILED",
  );

  console.error(error);

  process.exitCode = 1;
});