export type AmbulanceTrackingStatus =
  | "ASSIGNED"
  | "ACCEPTED"
  | "EN_ROUTE_TO_PATIENT"
  | "ARRIVED_AT_PATIENT"
  | "PATIENT_ONBOARD"
  | "EN_ROUTE_TO_HOSPITAL"
  | "ARRIVED_AT_HOSPITAL"
  | "COMPLETED";

export interface LocationUpdate {
  ambulanceId: string;
  requestId: string;
  latitude: number;
  longitude: number;
  speed: number;
  heading: number;
  timestamp: Date;
}

export interface TrackingState {
  requestId: string;
  ambulanceId: string;
  status: AmbulanceTrackingStatus;
  latestLocation?: LocationUpdate;
  estimatedMinutes?: number;
  updatedAt: Date;
}