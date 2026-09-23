"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createVirtualRoadNetwork = createVirtualRoadNetwork;
const graph_service_js_1 = require("./graph.service.js");
const { datasetLoader } = require("../../../data/datasetLoader.js");

function createVirtualRoadNetwork() {
    const graph = new graph_service_js_1.GraphService();
    datasetLoader.loadAll();

    // -------------------------------------------------------------
    // Add 70 Real Chennai Road Network Nodes (H001-H030, A001-A040)
    // -------------------------------------------------------------
    for (const node of datasetLoader.roadNodes) {
        let nodeName = node.nodeId;
        if (node.nodeId.startsWith('H')) {
            const h = datasetLoader.hospitals.find(item => item.id === node.nodeId);
            if (h) nodeName = h.name;
        } else if (node.nodeId.startsWith('A')) {
            const b = datasetLoader.ambulanceBases.find(item => item.baseId === node.nodeId);
            if (b) nodeName = `${b.name} (${b.area || 'Base'})`;
        }
        graph.addNode({
            nodeId: node.nodeId,
            name: nodeName,
            latitude: node.latitude,
            longitude: node.longitude
        });
    }

    // -------------------------------------------------------------
    // Add 182 Real Chennai Road Network Segments
    // -------------------------------------------------------------
    for (const seg of datasetLoader.roadSegments) {
        const speed = seg.speedLimitKmph > 0 ? seg.speedLimitKmph : 30.0;
        const travelTimeMinutes = (seg.distanceKm / speed) * 60;

        try {
            graph.addEdge({
                fromNodeId: seg.startNodeId,
                toNodeId: seg.endNodeId,
                distanceKm: seg.distanceKm,
                travelTimeMinutes
            });

            if (!seg.oneWay) {
                graph.addEdge({
                    fromNodeId: seg.endNodeId,
                    toNodeId: seg.startNodeId,
                    distanceKm: seg.distanceKm,
                    travelTimeMinutes
                });
            }
        } catch (e) {
            console.warn(`[RoadNetwork] Skipping edge ${seg.startNodeId} -> ${seg.endNodeId}: ${e.message}`);
        }
    }

    // Connect southern cluster bridge (H020 <-> H021, ~1.1km)
    try {
        graph.addEdge({ fromNodeId: 'H020', toNodeId: 'H021', distanceKm: 1.1, travelTimeMinutes: 1.65 });
        graph.addEdge({ fromNodeId: 'H021', toNodeId: 'H020', distanceKm: 1.1, travelTimeMinutes: 1.65 });
    } catch (_) {}

    return graph;
}
