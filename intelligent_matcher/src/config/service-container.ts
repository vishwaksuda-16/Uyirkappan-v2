import { Server } from "socket.io";

/*
 * ============================================================
 * MODULE 5 — DISPATCH
 * ============================================================
 */

import {
  CandidateFilterService
} from "../modules/dispatch/candidate-filter.service.js";

import {
  ScoringService
} from "../modules/dispatch/scoring.service.js";

import {
  DispatchEngineService
} from "../modules/dispatch/dispatch-engine.service.js";


/*
 * ============================================================
 * ROUTING
 * ============================================================
 */

import {
  TrafficService
} from "../modules/traffic/traffic.service.js";

import {
  DijkstraService
} from "../modules/routing/dijkstra.service.js";

import {
  NearestNodeService
} from "../modules/routing/nearest-node.service.js";

import {
  createVirtualRoadNetwork
} from "../modules/routing/virtual-road-network.js";


/*
 * ============================================================
 * ETA
 * ============================================================
 */

import {
  ETAService
} from "../modules/eta/eta.service.js";


/*
 * ============================================================
 * MODULE 6 — ASSIGNMENT
 * ============================================================
 */

import {
  AssignmentService
} from "../modules/assignment/assignment.service.js";


/*
 * ============================================================
 * MODULE 6 — FALLBACK
 * ============================================================
 */

import {
  FallbackService
} from "../modules/fallback/fallback.service.js";

import {
  FallbackOrchestratorService
} from "../modules/fallback/fallback-orchestrator.service.js";


/*
 * ============================================================
 * MODULE 6 — TRACKING
 * ============================================================
 */

import {
  TrackingService
} from "../modules/tracking/tracking.service.js";

import {
  EmergencyTrackingService
} from "../modules/tracking/emergency-tracking.service.js";

import {
  LiveTrackingOrchestratorService
} from "../modules/tracking/live-tracking-orchestrator.service.js";


/*
 * ============================================================
 * SOCKET EVENTS
 * ============================================================
 */

import {
  SocketEventsService
} from "../websocket/socket-events.service.js";

import {
  TrackingEventsService
} from "../websocket/tracking-events.service.js";


/*
 * ============================================================
 * SIMULATION
 * ============================================================
 */

import {
  VirtualMovementService
} from "../modules/simulation/virtual-movement.service.js";

import {
  SimulationDemoService
} from "../modules/simulation/simulation-demo.service.js";


/*
 * ============================================================
 * SERVICE CONTAINER
 * ============================================================
 */

export function createServiceContainer(
  io: Server
) {

  /*
   * ==========================================================
   * ROUTING
   * ==========================================================
   */

  const graphService =
    createVirtualRoadNetwork();


  const trafficService =
    new TrafficService();


  const dijkstraService =
    new DijkstraService(
      graphService,
      trafficService
    );


  const nearestNodeService =
    new NearestNodeService(
      graphService
    );


  /*
   * ==========================================================
   * ETA
   * ==========================================================
   */

  const etaService =
    new ETAService(
      nearestNodeService,
      dijkstraService
    );


  /*
   * ==========================================================
   * MODULE 5 — DISPATCH
   * ==========================================================
   */

  const candidateFilterService =
    new CandidateFilterService();


  const scoringService =
    new ScoringService();


  const dispatchEngineService =
    new DispatchEngineService(
      candidateFilterService,
      etaService,
      scoringService
    );


  /*
   * ==========================================================
   * MODULE 6 — ASSIGNMENT
   * ==========================================================
   */

  const assignmentService =
    new AssignmentService();


  /*
   * ==========================================================
   * MODULE 6 — FALLBACK
   * ==========================================================
   */

  const fallbackService =
    new FallbackService();


  /*
   * ==========================================================
   * SOCKET EVENTS
   * ==========================================================
   */

  const socketEventsService =
    new SocketEventsService(
      io
    );


  const trackingEventsService =
    new TrackingEventsService(
      socketEventsService
    );


  /*
   * ==========================================================
   * FALLBACK ORCHESTRATOR
   * ==========================================================
   *
   * Uses the same Module 5 dispatch engine
   * when fallback is required.
   *
   * Socket events:
   *
   * ASSIGNMENT_CREATED
   * ASSIGNMENT_ACCEPTED
   * ASSIGNMENT_REJECTED
   * ASSIGNMENT_TIMEOUT
   * FALLBACK_STARTED
   * FALLBACK_ASSIGNMENT_CREATED
   *
   */

  const fallbackOrchestratorService =
    new FallbackOrchestratorService(
      dispatchEngineService,
      assignmentService,
      fallbackService,
      socketEventsService
    );


  /*
   * ==========================================================
   * MODULE 6 — TRACKING
   * ==========================================================
   */

  const trackingService =
    new TrackingService();


  const emergencyTrackingService =
    new EmergencyTrackingService(
      trackingService,
      etaService
    );


  /*
   * ==========================================================
   * LIVE TRACKING
   * ==========================================================
   */

  const liveTrackingOrchestratorService =
    new LiveTrackingOrchestratorService(
      emergencyTrackingService,
      trackingEventsService
    );


  /*
   * ==========================================================
   * VIRTUAL MOVEMENT
   * ==========================================================
   */

  const virtualMovementService =
    new VirtualMovementService(
      graphService,
      trackingService
    );


  /*
   * ==========================================================
   * DEMO SIMULATION
   * ==========================================================
   *
   * This is only an orchestration layer.
   *
   * It does NOT duplicate:
   *
   * - Dispatch logic
   * - Dijkstra logic
   * - ETA logic
   * - Assignment logic
   * - Fallback logic
   * - Tracking logic
   *
   * It uses the existing Module 5/6 services.
   *
   */

  const simulationDemoService =
    new SimulationDemoService({

      fallbackOrchestratorService,

      liveTrackingOrchestratorService,

      virtualMovementService

    });


  /*
   * ==========================================================
   * RETURN ALL SERVICES
   * ==========================================================
   */

  return {

    /*
     * --------------------------------------------------------
     * Routing
     * --------------------------------------------------------
     */

    graphService,

    trafficService,

    dijkstraService,

    nearestNodeService,


    /*
     * --------------------------------------------------------
     * ETA
     * --------------------------------------------------------
     */

    etaService,


    /*
     * --------------------------------------------------------
     * Module 5 — Dispatch
     * --------------------------------------------------------
     */

    candidateFilterService,

    scoringService,

    dispatchEngineService,


    /*
     * --------------------------------------------------------
     * Module 6 — Assignment
     * --------------------------------------------------------
     */

    assignmentService,


    /*
     * --------------------------------------------------------
     * Module 6 — Fallback
     * --------------------------------------------------------
     */

    fallbackService,

    fallbackOrchestratorService,


    /*
     * --------------------------------------------------------
     * Module 6 — Tracking
     * --------------------------------------------------------
     */

    trackingService,

    emergencyTrackingService,


    /*
     * --------------------------------------------------------
     * Socket.IO
     * --------------------------------------------------------
     */

    socketEventsService,

    trackingEventsService,


    /*
     * --------------------------------------------------------
     * Live Tracking
     * --------------------------------------------------------
     */

    liveTrackingOrchestratorService,


    /*
     * --------------------------------------------------------
     * Simulation
     * --------------------------------------------------------
     */

    virtualMovementService,

    simulationDemoService

  };

}