"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.TrafficService = void 0;
class TrafficService {
    constructor() {
        this.conditions = new Map();
        this.multipliers = {
            NORMAL: 1.0,
            MODERATE: 1.3,
            HEAVY: 2.0,
            BLOCKED: Infinity
        };
    }
    setTrafficState(fromNodeId, toNodeId, state) {
        const edgeKey = this.createEdgeKey(fromNodeId, toNodeId);
        this.conditions.set(edgeKey, {
            edgeKey,
            state,
            multiplier: this.multipliers[state]
        });
    }
    getTrafficCondition(fromNodeId, toNodeId) {
        const edgeKey = this.createEdgeKey(fromNodeId, toNodeId);
        return (this.conditions.get(edgeKey) ?? {
            edgeKey,
            state: "NORMAL",
            multiplier: this.multipliers.NORMAL
        });
    }
    getAdjustedTravelTime(baseTravelTimeMinutes, fromNodeId, toNodeId) {
        const condition = this.getTrafficCondition(fromNodeId, toNodeId);
        if (condition.state === "BLOCKED") {
            return Infinity;
        }
        return (baseTravelTimeMinutes *
            condition.multiplier);
    }
    createEdgeKey(fromNodeId, toNodeId) {
        return `${fromNodeId}->${toNodeId}`;
    }
}
exports.TrafficService = TrafficService;
