import { DispatchEngineService } from "../dispatch/dispatch-engine.service.js";

import {
  Ambulance,
  EmergencyRequest,
} from "../dispatch/dispatch.types.js";

import { AssignmentService } from "../assignment/assignment.service.js";

import {
  Assignment,
} from "../assignment/assignment.types.js";

import {
  FallbackService,
} from "./fallback.service.js";

import {
  AssignmentAttempt,
  AssignmentResponse,
} from "./fallback.types.js";

import { SocketEventsService } from "../../websocket/socket-events.service.js";


export class FallbackOrchestratorService {

  constructor(
    private readonly dispatchEngineService: DispatchEngineService,

    private readonly assignmentService: AssignmentService,

    private readonly fallbackService: FallbackService,

    private readonly socketEventsService: SocketEventsService,
  ) {}


  /**
   * ============================================================
   * INITIAL DISPATCH
   * ============================================================
   *
   * Runs Module 5 dispatch engine.
   *
   * Previously failed ambulances are excluded before dispatch.
   */
  dispatchWithFallback(
    request: EmergencyRequest,
    ambulances: Ambulance[],
    searchRadiusKm: number,
  ): Assignment {

    const excluded =
      this.fallbackService.getExcludedAmbulances(
        request.requestId,
      );


    const eligibleAmbulances =
      ambulances.filter(
        (ambulance) =>
          !excluded.has(
            ambulance.ambulanceId,
          ),
      );


    if (eligibleAmbulances.length === 0) {
      throw new Error(
        "NO_AMBULANCE_AVAILABLE",
      );
    }


    /*
     * Run the SAME Module 5 dispatch engine.
     */
    const decision =
      this.dispatchEngineService.dispatch(
        request,
        eligibleAmbulances,
        searchRadiusKm,
      );


    const selectedAmbulance =
      eligibleAmbulances.find(
        (ambulance) =>
          ambulance.ambulanceId ===
          decision.selectedAmbulanceId,
      );


    if (!selectedAmbulance) {
      throw new Error(
        `Selected ambulance ${decision.selectedAmbulanceId} not found`,
      );
    }


    /*
     * IMPORTANT:
     *
     * Existing AssignmentService contract is:
     *
     * createAssignment(
     *   requestId,
     *   decision,
     *   ambulance
     * )
     */
    const assignment =
      this.assignmentService.createAssignment(
        request.requestId,
        decision,
        selectedAmbulance,
      );


    /*
     * Record assignment attempt.
     */
    this.fallbackService.recordAttempt(
      request.requestId,
      selectedAmbulance.ambulanceId,
    );


    /*
     * Notify Socket.IO clients.
     *
     * Existing SocketEventsService contract:
     *
     * emitAssignmentCreated(
     *   requestId,
     *   assignment
     * )
     */
    this.socketEventsService.emitAssignmentCreated(
      request.requestId,
      assignment,
    );


    return assignment;
  }


  /**
   * ============================================================
   * ACCEPT ASSIGNMENT
   * ============================================================
   */
  acceptAssignment(
    requestId: string,
    ambulanceId: string,
  ): Assignment {

    const assignment =
      this.assignmentService.getActiveAssignment(
        requestId,
      );


    if (!assignment) {
      throw new Error(
        `No active assignment found for request ${requestId}`,
      );
    }


    if (
      assignment.ambulanceId !==
      ambulanceId
    ) {
      throw new Error(
        `Ambulance ${ambulanceId} does not own the active assignment`,
      );
    }


    const updatedAssignment =
      this.assignmentService.updateStatus(
        assignment.assignmentId,
        "ACCEPTED",
      );


    this.socketEventsService.emitAssignmentAccepted(
      requestId,
      updatedAssignment,
    );


    return updatedAssignment;
  }


  /**
   * ============================================================
   * FAILURE + CASCADING FALLBACK
   * ============================================================
   *
   * Handles:
   *
   * REJECTED
   * TIMEOUT
   *
   * Then:
   *
   * 1. Releases failed ambulance
   * 2. Records failed attempt
   * 3. Excludes failed ambulance
   * 4. Reruns Module 5 dispatch engine
   * 5. Creates new assignment
   * 6. Emits fallback events
   */
  handleFailureAndFallback(
    request: EmergencyRequest,
    ambulances: Ambulance[],
    searchRadiusKm: number,
    failedAmbulanceId: string,
    response: AssignmentResponse,
    failureReason?: string,
  ): Assignment {

    const activeAssignment =
      this.assignmentService.getActiveAssignment(
        request.requestId,
      );


    if (!activeAssignment) {
      throw new Error(
        `No active assignment found for request ${request.requestId}`,
      );
    }


    if (
      activeAssignment.ambulanceId !==
      failedAmbulanceId
    ) {
      throw new Error(
        `Ambulance ${failedAmbulanceId} does not own the active assignment`,
      );
    }


    if (
      response !== "REJECTED" &&
      response !== "TIMEOUT"
    ) {
      throw new Error(
        `Fallback cannot be triggered for response ${response}`,
      );
    }


    /*
     * ----------------------------------------------------------
     * STEP 1 — Notify failure
     * ----------------------------------------------------------
     */
    if (response === "REJECTED") {

      this.socketEventsService.emitAssignmentRejected(
        request.requestId,
        activeAssignment,
      );

    } else {

      this.socketEventsService.emitAssignmentTimeout(
        request.requestId,
        activeAssignment,
      );
    }


    /*
     * ----------------------------------------------------------
     * STEP 2 — Release failed ambulance
     * ----------------------------------------------------------
     *
     * AssignmentService handles:
     *
     * - status update
     * - active assignment clearing
     * - ambulance AVAILABLE
     * - currentRequestId clearing
     */
    this.assignmentService.respondToActiveAssignment(
      request.requestId,
      failedAmbulanceId,
      response,
      failureReason,
      ambulances,
    );


    /*
     * ----------------------------------------------------------
     * STEP 3 — Record failure + exclusion
     * ----------------------------------------------------------
     */
    this.fallbackService.recordResponse(
      request.requestId,
      failedAmbulanceId,
      response,
      failureReason,
    );


    const excluded =
      this.fallbackService.getExcludedAmbulances(
        request.requestId,
      );


    /*
     * ----------------------------------------------------------
     * STEP 4 — Notify fallback started
     * ----------------------------------------------------------
     */
    this.socketEventsService.emitFallbackStarted(
      request.requestId,
      {
        requestId: request.requestId,

        failedAmbulanceId,

        response,

        failureReason,

        excludedAmbulances:
          Array.from(excluded),

        timestamp: new Date(),
      },
    );


    /*
     * ----------------------------------------------------------
     * STEP 5 — Filter excluded ambulances
     * ----------------------------------------------------------
     */
    const eligibleAmbulances =
      ambulances.filter(
        (ambulance) =>
          !excluded.has(
            ambulance.ambulanceId,
          ),
      );


    if (eligibleAmbulances.length === 0) {
      throw new Error(
        "NO_AMBULANCE_AVAILABLE",
      );
    }


    /*
     * ----------------------------------------------------------
     * STEP 6 — RERUN SAME MODULE 5 ENGINE
     * ----------------------------------------------------------
     */
    const decision =
      this.dispatchEngineService.dispatch(
        request,
        eligibleAmbulances,
        searchRadiusKm,
      );


    /*
     * ----------------------------------------------------------
     * STEP 7 — Find selected fallback ambulance
     * ----------------------------------------------------------
     */
    const selectedAmbulance =
      eligibleAmbulances.find(
        (ambulance) =>
          ambulance.ambulanceId ===
          decision.selectedAmbulanceId,
      );


    if (!selectedAmbulance) {
      throw new Error(
        `Fallback selected ambulance ${decision.selectedAmbulanceId} not found`,
      );
    }


    /*
     * ----------------------------------------------------------
     * STEP 8 — Create fallback assignment
     * ----------------------------------------------------------
     *
     * Existing AssignmentService contract:
     *
     * createAssignment(
     *   requestId,
     *   decision,
     *   ambulance
     * )
     */
    const fallbackAssignment =
      this.assignmentService.createAssignment(
        request.requestId,
        decision,
        selectedAmbulance,
      );


    /*
     * ----------------------------------------------------------
     * STEP 9 — Record new attempt
     * ----------------------------------------------------------
     */
    this.fallbackService.recordAttempt(
      request.requestId,
      selectedAmbulance.ambulanceId,
    );


    /*
     * ----------------------------------------------------------
     * STEP 10 — Notify fallback assignment
     * ----------------------------------------------------------
     */
    this.socketEventsService
      .emitFallbackAssignmentCreated(
        request.requestId,
        fallbackAssignment,
      );


    return fallbackAssignment;
  }


  /**
   * ============================================================
   * GET ACTIVE ASSIGNMENT
   * ============================================================
   */
  getActiveAssignment(
    requestId: string,
  ): Assignment | undefined {

    return this.assignmentService
      .getActiveAssignment(
        requestId,
      );
  }


  /**
   * ============================================================
   * GET ATTEMPT HISTORY
   * ============================================================
   */
  getAttempts(
    requestId: string,
  ): AssignmentAttempt[] {

    return this.fallbackService
      .getAttempts(
        requestId,
      );
  }


  /**
   * ============================================================
   * GET EXCLUDED AMBULANCES
   * ============================================================
   */
  getExcludedAmbulances(
    requestId: string,
  ): Set<string> {

    return this.fallbackService
      .getExcludedAmbulances(
        requestId,
      );
  }


  /**
   * ============================================================
   * CLEAR REQUEST
   * ============================================================
   */
  clearRequest(
    requestId: string,
  ): void {

    this.assignmentService
      .clearActiveAssignment(
        requestId,
      );

    this.fallbackService
      .clearRequest(
        requestId,
      );
  }
}