export interface RouteNode {
  nodeId: string;
  latitude: number;
  longitude: number;
}

export interface RoadEdge {
  fromNodeId: string;
  toNodeId: string;
  distanceKm: number;
  travelTimeMinutes: number;
}

export interface RoadGraph {
  nodes: Map<string, RouteNode>;
  edges: Map<string, RoadEdge[]>;
}

export interface Route {
  nodeIds: string[];
  distanceKm: number;
  travelTimeMinutes: number;
}