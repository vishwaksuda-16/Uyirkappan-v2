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
  },
  { collection: 'assignments', timestamps: true }
);
// Ensure only one attempt per (request, attemptNumber)
assignmentSchema.index({ requestId: 1, attemptNumber: 1 }, { unique: true });

module.exports = mongoose.model('Assignment', assignmentSchema);