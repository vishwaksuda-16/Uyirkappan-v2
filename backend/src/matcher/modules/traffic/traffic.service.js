"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.TrafficService = void 0;
const { SimulationTrafficProvider } = require("../../../services/traffic/SimulationTrafficProvider.js");

/**
 * TrafficService — Concrete implementation extending SimulationTrafficProvider
 * Preserves 100% backward compatibility with internal matcher tests while
 * integrating cleanly with the pluggable TrafficProvider architecture.
 */
class TrafficService extends SimulationTrafficProvider {
  constructor(options = {}) {
    super(options);
  }
}

exports.TrafficService = TrafficService;
