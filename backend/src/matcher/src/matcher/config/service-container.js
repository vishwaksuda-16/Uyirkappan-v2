"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createServiceContainer = createServiceContainer;
/*
 * ============================================================
 * MODULE 5 — DISPATCH
 * ============================================================
 */
const candidate_filter_service_js_1 = require("../modules/dispatch/candidate-filter.service.js");
const scoring_service_js_1 = require("../modules/dispatch/scoring.service.js");
const dispatch_engine_service_js_1 = require("../modules/dispatch/dispatch-engine.service.js");
/*
 * ============================================================
 * ROUTING
 * ============================================================
 */
const traffic_service_js_1 = require("../modules/traffic/traffic.service.js");
const dijkstra_service_js_1 = require("../modules/routing/dijkstra.service.js");
const nearest_node_service_js_1 = require("../modules/routing/nearest-node.service.js");
const virtual_road_network_js_1 = require("../modules/routing/virtual-road-network.js");
/*
 * ============================================================
 * ETA
 * ============================================================
 */
const eta_service_js_1 = require("../modules/eta/eta.service.js");
/*
 * ============================================================
 * MODULE 6 — ASSIGNMENT
 * ============================================================
 */
const assignment_service_js_1 = require("../modules/assignment/assignment.service.js");
/*
 * ============================================================
 * MODULE 6 — FALLBACK
 * ============================================================
 */
const fallback_service_js_1 = require("../modules/fallback/fallback.service.js");
const fallback_orchestrator_service_js_1 = require("../modules/fallback/fallback-orchestrator.service.js");
/*
 * ============================================================
 * MODULE 6 — TRACKING
 * ============================================================
 */
const tracking_service_js_1 = require("../modules/tracking/tracking.service.js");
const emergency_tracking_service_js_1 = require("../modules/tracking/emergency-tracking.service.js");
const live_tracking_orchestrator_service_js_1 = require("../modules/tracking/live-tracking-orchestrator.service.js");
/*
 * ============================================================
 * SOCKET EVENTS
 * ============================================================
 */
const socket_events_service_js_1 = require("../websocket/socket-events.service.js");
const tracking_events_service_js_1 = require("../websocket/tracking-events.service.js");
/*
 * ============================================================
 * SIMULATION
 * ============================================================
 */
const virtual_movement_service_js_1 = require("../modules/simulation/virtual-movement.service.js");
const simulation_demo_service_js_1 = require("../modules/simulation/simulation-demo.service.js");
/*
 * ============================================================
 * SERVICE CONTAINER
 * ============================================================
 */
function createServiceContainer(io) {
    /*
     * ==========================================================
     * ROUTING
     * ==========================================================
     */
    const graphService = (0, virtual_road_network_js_1.createVirtualRoadNetwork)();
    const trafficService = new traffic_service_js_1.TrafficService();
    const dijkstraService = new dijkstra_service_js_1.DijkstraService(graphService, trafficService);
    const nearestNodeService = new nearest_node_service_js_1.NearestNodeService(graphService);
    /*
     * ==========================================================
     * ETA
     * ==========================================================
     */
    const etaService = new eta_service_js_1.ETAService(nearestNodeService, dijkstraService);
    /*
     * ==========================================================
     * MODULE 5 — DISPATCH
     * ==========================================================
     */
    const candidateFilterService = new candidate_filter_service_js_1.CandidateFilterService();
    const scoringService = new scoring_service_js_1.ScoringService();
    const dispatchEngineService = new dispatch_engine_service_js_1.DispatchEngineService(candidateFilterService, etaService, scoringService);
    /*
     * ==========================================================
     * MODULE 6 — ASSIGNMENT
     * ==========================================================
     */
    const assignmentService = new assignment_service_js_1.AssignmentService();
    /*
     * ==========================================================
     * MODULE 6 — FALLBACK
     * ==========================================================
     */
    const fallbackService = new fallback_service_js_1.FallbackService();
    /*
     * ==========================================================
     * SOCKET EVENTS
     * ==========================================================
     */
    const socketEventsService = new socket_events_service_js_1.SocketEventsService(io);
    const trackingEventsService = new tracking_events_service_js_1.TrackingEventsService(socketEventsService);
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
    const fallbackOrchestratorService = new fallback_orchestrator_service_js_1.FallbackOrchestratorService(dispatchEngineService, assignmentService, fallbackService, socketEventsService);
    /*
     * ==========================================================
     * MODULE 6 — TRACKING
     * ==========================================================
     */
    const trackingService = new tracking_service_js_1.TrackingService();
    const emergencyTrackingService = new emergency_tracking_service_js_1.EmergencyTrackingService(trackingService, etaService);
    /*
     * ==========================================================
     * LIVE TRACKING
     * ==========================================================
     */
    const liveTrackingOrchestratorService = new live_tracking_orchestrator_service_js_1.LiveTrackingOrchestratorService(emergencyTrackingService, trackingEventsService);
    /*
     * ==========================================================
     * VIRTUAL MOVEMENT
     * ==========================================================
     */
    const virtualMovementService = new virtual_movement_service_js_1.VirtualMovementService(graphService, trackingService);
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
    const simulationDemoService = new simulation_demo_service_js_1.SimulationDemoService({
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
