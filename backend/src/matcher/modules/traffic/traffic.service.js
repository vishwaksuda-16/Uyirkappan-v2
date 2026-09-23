"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.TrafficService = void 0;
const { datasetLoader } = require("../../../data/datasetLoader.js");

class TrafficService {
    constructor() {
        this.conditions = new Map();
        this.multipliers = {
            NORMAL: 1.0,
            MODERATE: 1.35,
            HEAVY: 2.1,
            BLOCKED: Infinity
        };
        this.hourlyConditions = new Map();
        this.initHourlyTraffic();
    }

    initHourlyTraffic() {
        try {
            datasetLoader.loadAll();
            for (const row of datasetLoader.trafficConditions) {
                const key = `${row.dayType}_${row.hourOfDay}`;
                this.hourlyConditions.set(key, row);
            }
        } catch (e) {
            console.warn('[TrafficService] Could not load hourly traffic:', e.message);
        }
    }

    setTimeContext(dayType, hourOfDay) {
        this.timeContext = { dayType, hourOfDay };
    }

    resetTimeContext() {
        this.timeContext = null;
    }

    getTimeOfDayTraffic() {
        let dayType, hour;
        if (this.timeContext) {
            dayType = this.timeContext.dayType;
            hour = this.timeContext.hourOfDay;
        } else {
            const now = new Date();
            const day = now.getDay();
            const isWeekend = (day === 0 || day === 6);
            dayType = isWeekend ? 'Weekend' : 'Weekday';
            hour = now.getHours();
        }

        const key = `${dayType}_${hour}`;
        const record = this.hourlyConditions.get(key);
        if (record) {
            // speed_multiplier in dataset represents the congestion travel-time factor (1.0 = normal, 1.99 = peak heavy)
            const timeMultiplier = record.speedMultiplier > 0 ? record.speedMultiplier : 1.0;
            return {
                state: record.trafficState,
                multiplier: timeMultiplier,
            };
        }
        return { state: 'NORMAL', multiplier: 1.0 };
    }

    setTrafficState(fromNodeId, toNodeId, state) {
        const edgeKey = this.createEdgeKey(fromNodeId, toNodeId);
        this.conditions.set(edgeKey, {
            edgeKey,
            state,
            multiplier: this.multipliers[state] || 1.0
        });
    }

    getTrafficCondition(fromNodeId, toNodeId) {
        const edgeKey = this.createEdgeKey(fromNodeId, toNodeId);
        const specific = this.conditions.get(edgeKey);
        if (specific) {
            return specific;
        }
        const general = this.getTimeOfDayTraffic();
        return {
            edgeKey,
            state: general.state,
            multiplier: general.multiplier,
        };
    }

    getAdjustedTravelTime(baseTravelTimeMinutes, fromNodeId, toNodeId) {
        const condition = this.getTrafficCondition(fromNodeId, toNodeId);
        if (condition.state === "BLOCKED" || condition.multiplier === Infinity) {
            return Infinity;
        }
        return baseTravelTimeMinutes * condition.multiplier;
    }

    createEdgeKey(fromNodeId, toNodeId) {
        return `${fromNodeId}->${toNodeId}`;
    }
}
exports.TrafficService = TrafficService;
