const mongoose = require('mongoose');

const assignmentSchema = new mongoose.Schema(
  {
    id: { type: String, required: true, unique: true }, // e.g. ASSIGN-001
    requestId: { type: String, index: true },
    ambulanceId: { type: String, index: true },
    attemptNumber: Number,
    status: {
      type: String,
      enum: ['PENDING', 'ACCEPTED', 'REJECTED', 'TIMEOUT', 'CANCELLED', 'COMPLETED'],
      default: 'PENDING',
      index: true,
    },
    estimatedETA: Number,
    assignedAt: Date,
    responseAt: Date,
    expiresAt: Date,
    route: mongoose.Schema.Types.Mixed,
    alternativeRoutes: [mongoose.Schema.Types.Mixed],
    hospitalRoute: mongoose.Schema.Types.Mixed,
    destinationHospital: mongoose.Schema.Types.Mixed,
    baselineRoute: mongoose.Schema.Types.Mixed,
    baselineEta: Number,
    baselineDistance: Number,
    etaImprovementPct: Number,
    scoreBreakdown: mongoose.Schema.Types.Mixed,
    decisionReason: String,
    candidates: [mongoose.Schema.Types.Mixed],
    cost: Number,
    score: Number,
  },
  { collection: 'assignments', timestamps: true, strict: false }
);
// Ensure only one attempt per (request, attemptNumber)
assignmentSchema.index({ requestId: 1, attemptNumber: 1 }, { unique: true });

module.exports = mongoose.model('Assignment', assignmentSchema);