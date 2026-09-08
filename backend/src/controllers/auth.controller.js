const { hashPassword, comparePassword, signToken } = require('../utils/security');
const { genUserId } = require('../utils/idGen');
const { log } = require('../utils/logger');

const VALID_ROLES = ['BYSTANDER', 'DRIVER', 'HOSPITAL_STAFF', 'ADMIN'];

class AuthController {
  constructor(ctx) { this.store = ctx.store; }

  async register(req, res) {
    const { name, phone, email, password, role, hospitalId } = req.body || {};
    if (!name || !password) {
      return res.status(400).json({ success: false, message: 'name and password are required' });
    }
    if (role && !VALID_ROLES.includes(role)) {
      return res.status(400).json({ success: false, message: `role must be one of ${VALID_ROLES.join(', ')}` });
    }
    if (!email && !phone) {
      return res.status(400).json({ success: false, message: 'email or phone is required' });
    }
    const existing = await this.store.findUserByEmailOrPhone(email, phone);
    if (existing) {
      return res.status(409).json({ success: false, message: 'A user with this email/phone already exists' });
    }

    const user = {
      id: genUserId(),
      name, phone, email,
      role: role || 'BYSTANDER',
      hospitalId,
      passwordHash: await hashPassword(password),
      createdAt: new Date(), updatedAt: new Date(),
    };
    await this.store.createUser(user);
    log('info', `User registered: ${user.id} (${user.role}) ${email || phone}`);
    const token = signToken({ sub: user.id, role: user.role });
    return res.status(201).json({ success: true, token, user: this.safeUser(user) });
  }

  async login(req, res) {
    const { email, phone, password } = req.body || {};
    const user = await this.store.findUserByEmailOrPhone(email, phone);
    if (!user) return res.status(401).json({ success: false, message: 'Invalid credentials' });
    const ok = await comparePassword(password, user.passwordHash);
    if (!ok) return res.status(401).json({ success: false, message: 'Invalid credentials' });

    const token = signToken({ sub: user.id, role: user.role });
    return res.json({ success: true, token, user: this.safeUser(user) });
  }

  me(req, res) {
    return res.json({ success: true, user: this.safeUser(req.user) });
  }

  safeUser(u) {
    return {
      id: u.id, name: u.name, phone: u.phone, email: u.email,
      role: u.role, hospitalId: u.hospitalId, createdAt: u.createdAt,
    };
  }
}

module.exports = AuthController;