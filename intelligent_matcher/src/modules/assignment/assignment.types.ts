import { Location } from "../dispatch/dispatch.types.js";
import { Route } from "../routing/route.types.js";

export type AssignmentStatus =
  | "ASSIGNED"
  | "ACCEPTED"
  | "REJECTED"
  | "TIMEOUT"
  | "DISPATCHED"
  | "CANCELLED";

export interface Assignment {
  assignmentId: string;
  requestId: string;
  ambulanceId: string;
  driverId: string;
  pickupLocation: Location;
  route: Route;
  estimatedTravelTime: number;
  status: AssignmentStatus;
  assignedAt: Date;
  respondedAt?: Date;
  rejectionReason?: string;
}