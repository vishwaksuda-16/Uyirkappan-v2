const mongoose = require('mongoose');

const requestAttemptSchema = new mongoose.Schema(
  {
    id: { type: String, required: true, unique: true }, // e.g. ATTEMPT-001
    requestId: { type: String, index: true },
    assignmentId: String,
    attemptNumber: Number,
    ambulanceId: String,
    assignedAt: Date,
    responseAt: Date,
    response: { type: String, default: 'PENDING' }, // PENDING | ACCEPTED | REJECTED | TIMEOUT
    failureReason: String,
  },
  { collection: 'request_attempts', timestamps: true }
);
requestAttemptSchema.index({ requestId: 1, attemptNumber: 1 }, { unique: true });

module.exports = mongoose.model('RequestAttempt', requestAttemptSchema);