const mongoose = require('mongoose');

const hospitalSchema = new mongoose.Schema(
  {
    id: { type: String, required: true, unique: true }, // e.g. HOSP-01
    name: String,
    location: { latitude: Number, longitude: Number },
    resources: {
      generalBeds: { type: Number, default: 0 },
      icuBeds: { type: Number, default: 0 },
      ventilators: { type: Number, default: 0 },
    },
  },
  { collection: 'hospitals', timestamps: true }
);

module.exports = mongoose.model('Hospital', hospitalSchema);