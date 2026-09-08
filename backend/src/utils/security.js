const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { JWT_SECRET, JWT_EXPIRES_IN } = require('../config/environment');

module.exports = {
  hashPassword: async (pw) => bcrypt.hash(pw, 10),
  comparePassword: async (pw, hash) => bcrypt.compare(pw, hash),
  signToken: (payload) => jwt.sign(payload, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN }),
  verifyToken: (token) => jwt.verify(token, JWT_SECRET),
};