const mongoose = require('mongoose');

const locationHistorySchema = new mongoose.Schema(
  {
    id: { type: String, required: true, unique: true },
    ambulanceId: { type: String, index: true },
    requestId: String,
    latitude: Number,
    longitude: Number,
    speed: Number,
    heading: Number,
    timestamp: { type: Date, default: Date.now },
  },
  { collection: 'location_history', timestamps: true }
);
locationHistorySchema.index({ ambulanceId: 1, timestamp: -1 });

module.exports = mongoose.model('LocationHistory', locationHistorySchema);