import {
  Assignment,
  AssignmentStatus
} from "./assignment.types.js";

import {
  DispatchDecision,
  Ambulance
} from "../dispatch/dispatch.types.js";

export class AssignmentService {
  private assignments = new Map<string, Assignment>();

  /*
   * Keeps track of the currently active assignment
   * for each emergency request.
   *
   * This enforces the Module 6 rule:
   * only ONE ambulance can be the active responder
   * for a request at any given time.
   */
  private activeAssignments = new Map<
    string,
    string
  >();

  createAssignment(
    requestId: string,
    decision: DispatchDecision,
    ambulance: Ambulance
  ): Assignment {
    /*
     * Prevent duplicate active assignments.
     */
    const existingActiveAssignment =
      this.getActiveAssignment(requestId);

    if (existingActiveAssignment) {
      throw new Error(
        `Active assignment ${existingActiveAssignment.assignmentId} already exists for request ${requestId}`
      );
    }

    /*
     * Only an AVAILABLE ambulance can receive
     * a new assignment.
     */
    if (
      ambulance.availabilityStatus !==
      "AVAILABLE"
    ) {
      throw new Error(
        `Ambulance ${ambulance.ambulanceId} is not available`
      );
    }

    const assignment: Assignment = {
      assignmentId: `ASG-${Date.now()}-${Math.random()
        .toString(36)
        .slice(2, 8)}`,

      requestId,

      ambulanceId:
        ambulance.ambulanceId,

      driverId:
        ambulance.driverId,

      pickupLocation: {
        ...decision.pickupLocation
      },

      route:
        decision.route,

      estimatedTravelTime:
        decision.estimatedTravelTime,

      status: "ASSIGNED",

      assignedAt: new Date()
    };

    /*
     * Store assignment.
     */
    this.assignments.set(
      assignment.assignmentId,
      assignment
    );

    /*
     * Mark this as the single active assignment
     * for the emergency.
     */
    this.activeAssignments.set(
      requestId,
      assignment.assignmentId
    );

    /*
     * Reserve ambulance.
     */
    ambulance.availabilityStatus =
      "BUSY";

    ambulance.currentRequestId =
      requestId;

    return assignment;
  }

  updateStatus(
    assignmentId: string,
    status: AssignmentStatus,
    rejectionReason?: string
  ): Assignment {
    const assignment =
      this.assignments.get(
        assignmentId
      );

    if (!assignment) {
      throw new Error(
        `Assignment ${assignmentId} not found`
      );
    }

    /*
     * Prevent changing a completed response
     * into another response.
     */
    if (
      assignment.status === "REJECTED" ||
      assignment.status === "TIMEOUT" ||
      assignment.status === "CANCELLED"
    ) {
      throw new Error(
        `Assignment ${assignmentId} has already been closed with status ${assignment.status}`
      );
    }

    assignment.status = status;

    if (
      status === "ACCEPTED" ||
      status === "REJECTED" ||
      status === "TIMEOUT"
    ) {
      assignment.respondedAt =
        new Date();
    }

    if (rejectionReason) {
      assignment.rejectionReason =
        rejectionReason;
    }

    /*
     * Once an assignment is accepted,
     * it remains the active responder.
     *
     * For REJECTED/TIMEOUT/CANCELLED,
     * the active assignment is removed.
     */
    if (
      status === "REJECTED" ||
      status === "TIMEOUT" ||
      status === "CANCELLED"
    ) {
      const activeAssignmentId =
        this.activeAssignments.get(
          assignment.requestId
        );

      if (
        activeAssignmentId ===
        assignment.assignmentId
      ) {
        this.activeAssignments.delete(
          assignment.requestId
        );
      }
    }

    return assignment;
  }

  /*
   * Respond to the currently active assignment
   * for an emergency.
   *
   * This is used by the fallback orchestrator
   * before selecting another ambulance.
   */
  respondToActiveAssignment(
    requestId: string,
    ambulanceId: string,
    status:
      | "REJECTED"
      | "TIMEOUT",
    rejectionReason?: string,
    ambulances?: Ambulance[]
  ): Assignment {
    const assignment =
      this.getActiveAssignment(
        requestId
      );

    if (!assignment) {
      throw new Error(
        `No active assignment found for request ${requestId}`
      );
    }

    if (
      assignment.ambulanceId !==
      ambulanceId
    ) {
      throw new Error(
        `Ambulance ${ambulanceId} is not the active responder for request ${requestId}`
      );
    }

    /*
     * Update assignment first.
     */
    const updatedAssignment =
      this.updateStatus(
        assignment.assignmentId,
        status,
        rejectionReason
      );

    /*
     * Release the failed ambulance.
     *
     * The orchestrator passes the same ambulance
     * objects used by the dispatch engine.
     */
    if (ambulances) {
      const ambulance =
        ambulances.find(
          (item) =>
            item.ambulanceId ===
            ambulanceId
        );

      if (ambulance) {
        ambulance.availabilityStatus =
          "AVAILABLE";

        delete ambulance.currentRequestId;
      }
    }

    return updatedAssignment;
  }

  /*
   * Get the currently active assignment
   * for an emergency request.
   */
  getActiveAssignment(
    requestId: string
  ): Assignment | undefined {
    const assignmentId =
      this.activeAssignments.get(
        requestId
      );

    if (!assignmentId) {
      return undefined;
    }

    return this.assignments.get(
      assignmentId
    );
  }

  getAssignment(
    assignmentId: string
  ): Assignment | undefined {
    return this.assignments.get(
      assignmentId
    );
  }

  getAllAssignments(): Assignment[] {
    return Array.from(
      this.assignments.values()
    );
  }

  /*
   * Clear active assignment tracking
   * when an emergency is completely finished.
   */
  clearActiveAssignment(
    requestId: string
  ): void {
    this.activeAssignments.delete(
      requestId
    );
  }
}