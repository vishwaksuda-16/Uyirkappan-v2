const mongoose = require('mongoose');

const emergencyRequestSchema = new mongoose.Schema(
  {
    requestId: { type: String, required: true, unique: true }, // e.g. UK-2026-000001
    requesterId: { type: String, index: true },
    emergencyType: String,
    victimCount: { type: Number, default: 1 },
    pickupLocation: { latitude: Number, longitude: Number },
    assignedAmbulanceId: String,
    destinationHospitalId: { type: String, index: true },
    status: { type: String, default: 'SEARCHING', index: true },
    currentETA: Number,
    completedAt: Date,
    route: mongoose.Schema.Types.Mixed,
    alternativeRoutes: [mongoose.Schema.Types.Mixed],
    candidateRoutes: [mongoose.Schema.Types.Mixed],
    hospitalRoute: mongoose.Schema.Types.Mixed,
    routeReason: String,
    decisionReason: String,
    baselineRoute: mongoose.Schema.Types.Mixed,
    baselineEta: Number,
    baselineDistance: Number,
    etaImprovementPct: Number,
    hospitalMatch: mongoose.Schema.Types.Mixed,
    debug: mongoose.Schema.Types.Mixed,
    source: String,
    sourceNodeId: String,
    mappedRoadNode: mongoose.Schema.Types.Mixed,
    incidentLatitude: Number,
    incidentLongitude: Number,
  },
  { collection: 'emergency_requests', timestamps: true, strict: false }
);

module.exports = mongoose.model('EmergencyRequest', emergencyRequestSchema);