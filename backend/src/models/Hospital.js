const mongoose = require('mongoose');

const hospitalSchema = new mongoose.Schema(
  {
    id: { type: String, required: true, unique: true }, // e.g. HOSP-01
    name: String,
    location: { latitude: Number, longitude: Number },
    area: String,
    sector: String,
    traumaCapable: { type: Boolean, default: false },
    cardiacCapable: { type: Boolean, default: false },
    operationalStatus: { type: String, default: 'OPERATIONAL' },
    resources: {
      generalBeds: { type: Number, default: 0 },
      icuBeds: { type: Number, default: 0 },
      ventilators: { type: Number, default: 0 },
      totalGeneralBeds: { type: Number, default: 0 },
      totalIcuBeds: { type: Number, default: 0 },
      totalVentilators: { type: Number, default: 0 },
      emergencyBedsTotal: { type: Number, default: 0 },
      icuBedsTotal: { type: Number, default: 0 },
      ventilatorsTotal: { type: Number, default: 0 },
    },
  },
  { collection: 'hospitals', timestamps: true }
);

module.exports = mongoose.model('Hospital', hospitalSchema);