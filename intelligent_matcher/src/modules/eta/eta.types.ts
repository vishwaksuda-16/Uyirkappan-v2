import { Location } from "../dispatch/dispatch.types.js";
import { Route } from "../routing/route.types.js";

export interface ETAResult {
  requestId: string;
  ambulanceId: string;
  currentLocation: Location;
  destination: Location;
  estimatedMinutes: number;
  calculatedAt: Date;
  route: Route;
}