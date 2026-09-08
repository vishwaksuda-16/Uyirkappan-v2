import {
  RoadGraph,
  RouteNode,
  RoadEdge
} from "./route.types.js";

export class GraphService {
  private graph: RoadGraph;

  constructor() {
    this.graph = {
      nodes: new Map(),
      edges: new Map()
    };
  }

  addNode(node: RouteNode): void {
    this.graph.nodes.set(node.nodeId, node);

    if (!this.graph.edges.has(node.nodeId)) {
      this.graph.edges.set(node.nodeId, []);
    }
  }

  addEdge(edge: RoadEdge): void {
    if (!this.graph.nodes.has(edge.fromNodeId)) {
      throw new Error(
        `Source node ${edge.fromNodeId} does not exist`
      );
    }

    if (!this.graph.nodes.has(edge.toNodeId)) {
      throw new Error(
        `Destination node ${edge.toNodeId} does not exist`
      );
    }

    const outgoingEdges = this.graph.edges.get(edge.fromNodeId);

    if (!outgoingEdges) {
      throw new Error(
        `No edge list found for ${edge.fromNodeId}`
      );
    }

    outgoingEdges.push(edge);
  }

  getNode(nodeId: string): RouteNode | undefined {
    return this.graph.nodes.get(nodeId);
  }

  getNeighbors(nodeId: string): RoadEdge[] {
    return this.graph.edges.get(nodeId) ?? [];
  }

  getGraph(): RoadGraph {
    return this.graph;
  }
}