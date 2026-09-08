import {
  AssignmentAttempt,
  AssignmentResponse
} from "./fallback.types.js";

export class FallbackService {
  private attempts = new Map<
    string,
    AssignmentAttempt[]
  >();

  private excludedAmbulances = new Map<
    string,
    Set<string>
  >();

  recordAttempt(
    requestId: string,
    ambulanceId: string
  ): AssignmentAttempt {
    const requestAttempts =
      this.attempts.get(requestId) ?? [];

    /*
     * Do not create another pending attempt
     * for the same ambulance.
     */
    const pendingAttempt =
      requestAttempts.find(
        (attempt) =>
          attempt.ambulanceId ===
            ambulanceId &&
          !attempt.response
      );

    if (pendingAttempt) {
      throw new Error(
        `Ambulance ${ambulanceId} already has a pending assignment attempt for request ${requestId}`
      );
    }

    const attempt: AssignmentAttempt = {
      requestId,

      attemptNumber:
        requestAttempts.length + 1,

      ambulanceId,

      assignedAt: new Date()
    };

    requestAttempts.push(
      attempt
    );

    this.attempts.set(
      requestId,
      requestAttempts
    );

    return attempt;
  }

  recordResponse(
    requestId: string,
    ambulanceId: string,
    response: AssignmentResponse,
    failureReason?: string
  ): AssignmentAttempt {
    const requestAttempts =
      this.attempts.get(requestId);

    if (!requestAttempts) {
      throw new Error(
        `No assignment attempts found for request ${requestId}`
      );
    }

    const attempt =
      [...requestAttempts]
        .reverse()
        .find(
          (item) =>
            item.ambulanceId ===
              ambulanceId &&
            !item.response
        );

    if (!attempt) {
      throw new Error(
        `No pending assignment found for ambulance ${ambulanceId}`
      );
    }

    attempt.response =
      response;

    attempt.responseAt =
      new Date();

    if (
      response === "REJECTED" ||
      response === "TIMEOUT"
    ) {
      attempt.failureReason =
        failureReason ??
        response;

      this.excludeAmbulance(
        requestId,
        ambulanceId
      );
    }

    return attempt;
  }

  excludeAmbulance(
    requestId: string,
    ambulanceId: string
  ): void {
    const excluded =
      this.excludedAmbulances.get(
        requestId
      ) ?? new Set<string>();

    excluded.add(
      ambulanceId
    );

    this.excludedAmbulances.set(
      requestId,
      excluded
    );
  }

  getExcludedAmbulances(
    requestId: string
  ): Set<string> {
    return (
      this.excludedAmbulances.get(
        requestId
      ) ?? new Set<string>()
    );
  }

  getAttempts(
    requestId: string
  ): AssignmentAttempt[] {
    return [
      ...(this.attempts.get(
        requestId
      ) ?? [])
    ];
  }

  clearRequest(
    requestId: string
  ): void {
    this.attempts.delete(
      requestId
    );

    this.excludedAmbulances.delete(
      requestId
    );
  }
}