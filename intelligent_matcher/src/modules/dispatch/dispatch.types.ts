export type EmergencyPriority =
  | "LOW"
  | "MEDIUM"
  | "HIGH"
  | "CRITICAL";

export interface Location {
  latitude: number;
  longitude: number;
}

export interface EmergencyRequest {
  requestId: string;
  emergencyType: string;
  victimCount: number;
  pickupLocation: Location;
  createdAt: Date;
  priority: EmergencyPriority;
}

export type AmbulanceAvailability =
  | "AVAILABLE"
  | "BUSY"
  | "OFFLINE";

export interface Ambulance {
  ambulanceId: string;
  currentLocation: Location;
  availabilityStatus: AmbulanceAvailability;
  currentRequestId?: string;
  driverId: string;
  capabilities: string[];
}

import { Route } from "../routing/route.types.js";

export interface DispatchDecision {
  requestId: string;
  selectedAmbulanceId: string;
  pickupLocation: Location;
  estimatedTravelTime: number;
  route: Route;
  distance: number;
  score: number;
  generatedAt: Date;
}