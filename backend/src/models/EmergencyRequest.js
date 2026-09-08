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
  },
  { collection: 'emergency_requests', timestamps: true }
);

module.exports = mongoose.model('EmergencyRequest', emergencyRequestSchema);