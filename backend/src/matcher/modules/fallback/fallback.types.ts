export type AssignmentResponse =
  | "ACCEPTED"
  | "REJECTED"
  | "TIMEOUT";

export interface AssignmentAttempt {
  requestId: string;
  attemptNumber: number;
  ambulanceId: string;
  assignedAt: Date;
  responseAt?: Date;
  response?: AssignmentResponse;
  failureReason?: string;
}