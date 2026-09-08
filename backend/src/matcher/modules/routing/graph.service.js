"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.GraphService = void 0;
class GraphService {
    constructor() {
        this.graph = {
            nodes: new Map(),
            edges: new Map()
        };
    }
    addNode(node) {
        this.graph.nodes.set(node.nodeId, node);
        if (!this.graph.edges.has(node.nodeId)) {
            this.graph.edges.set(node.nodeId, []);
        }
    }
    addEdge(edge) {
        if (!this.graph.nodes.has(edge.fromNodeId)) {
            throw new Error(`Source node ${edge.fromNodeId} does not exist`);
        }
        if (!this.graph.nodes.has(edge.toNodeId)) {
            throw new Error(`Destination node ${edge.toNodeId} does not exist`);
        }
        const outgoingEdges = this.graph.edges.get(edge.fromNodeId);
        if (!outgoingEdges) {
            throw new Error(`No edge list found for ${edge.fromNodeId}`);
        }
        outgoingEdges.push(edge);
    }
    getNode(nodeId) {
        return this.graph.nodes.get(nodeId);
    }
    getNeighbors(nodeId) {
        return this.graph.edges.get(nodeId) ?? [];
    }
    getGraph() {
        return this.graph;
    }
}
exports.GraphService = GraphService;
