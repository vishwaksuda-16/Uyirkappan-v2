import { Location } from "../dispatch/dispatch.types.js";
import { Route } from "../routing/route.types.js";

export interface SimulationConfig {
  ambulanceCount: number;
  emergencyCount: number;
  locationUpdateIntervalMs: number;
  assignmentTimeoutMs: number;
  trafficUpdateIntervalMs: number;
  acceleratedTime: boolean;
}

export interface SimulationState {
  isRunning: boolean;
  startedAt?: Date;
  activeEmergencyCount: number;
  availableAmbulanceCount: number;
  busyAmbulanceCount: number;
}

export interface VirtualAmbulance {
  ambulanceId: string;
  driverId: string;
  currentLocation: Location;
  speed: number;
  heading: number;
  route?: Route;
  routeIndex: number;
  isMoving: boolean;
}

export interface VirtualMovementConfig {
  updateIntervalMs: number;
  acceleratedTime: boolean;
  speedMultiplier: number;
}