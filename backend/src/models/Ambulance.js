const mongoose = require('mongoose');

const ambulanceSchema = new mongoose.Schema(
  {
    id: { type: String, required: true, unique: true }, // e.g. AMB-01
    ambulanceNumber: String,
    driverId: { type: String, index: true },
    vehicleType: { type: String, default: 'BLS' },
    baseId: String,
    currentLocation: {
      latitude: Number,
      longitude: Number,
    },
    currentSpeed: Number,
    currentHeading: Number,
    status: {
      type: String,
      enum: ['AVAILABLE', 'ASSIGNED', 'BUSY', 'OFFLINE'],
      default: 'AVAILABLE',
      index: true,
    },
    capabilities: [String],
    currentRequestId: { type: String, default: null },
    activeEmergencyId: { type: String, default: null },
    currentAssignmentId: { type: String, default: null },
  },
  { collection: 'ambulances', timestamps: true }
);

module.exports = mongoose.model('Ambulance', ambulanceSchema);