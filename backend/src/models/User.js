const mongoose = require('mongoose');

const userSchema = new mongoose.Schema(
  {
    id: { type: String, required: true, unique: true }, // e.g. USER-001
    name: { type: String, required: true },
    phone: String,
    email: { type: String, sparse: true, unique: true },
    passwordHash: { type: String, required: true },
    role: { type: String, enum: ['BYSTANDER', 'DRIVER', 'HOSPITAL_STAFF', 'ADMIN'], default: 'BYSTANDER' },
    hospitalId: String,
  },
  { collection: 'users', timestamps: true }
);

module.exports = mongoose.model('User', userSchema);