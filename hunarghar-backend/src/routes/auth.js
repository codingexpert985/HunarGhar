'use strict';
const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const db = require('../config/db');
const env = require('../config/env');
const asyncHandler = require('../utils/asyncHandler');
const { Validator, isEmail, str } = require('../utils/validators');
const { unauthorized, conflict } = require('../utils/AppError');
const { authenticate } = require('../middleware/auth');

const router = express.Router();

function signToken(user) {
  return jwt.sign({ sub: user.user_id, role: user.role, jti: crypto.randomUUID() },
    env.JWT_SECRET, { expiresIn: env.JWT_EXPIRES_IN });
}
const publicUser = (u) => ({ user_id: u.user_id, full_name: u.full_name, email: u.email, role: u.role });

// POST /api/auth/register   (SFR-01, SFR-02, SFR-03)
router.post('/register', asyncHandler(async (req, res) => {
  const fullName = str(req.body.fullName);
  const email = str(req.body.email).toLowerCase();
  const password = typeof req.body.password === 'string' ? req.body.password : '';
  const role = str(req.body.role);

  const v = new Validator()
    .required('fullName', fullName, 'Full name')
    .required('email', email, 'Email')
    .required('password', password, 'Password')
    .required('role', role, 'Account type');
  if (fullName.length > 100) v.add('fullName', 'Full name must be at most 100 characters');
  if (email && !isEmail(email)) v.add('email', 'Email address format is not valid');
  if (password && password.length < env.MIN_PASSWORD_LENGTH) {
    v.add('password', `Password must be at least ${env.MIN_PASSWORD_LENGTH} characters`);
  }
  if (role && !['customer', 'provider'].includes(role)) v.add('role', 'Account type must be customer or provider');
  v.check();

  const exists = await db.query('SELECT 1 FROM users WHERE email = $1', [email]);
  if (exists.rowCount) throw conflict('An account with this email already exists');

  const hash = await bcrypt.hash(password, env.BCRYPT_ROUNDS);   // only the hash is stored
  const user = await db.withTransaction(async (c) => {
    const { rows } = await c.query(
      `INSERT INTO users (full_name, email, password_hash, role) VALUES ($1,$2,$3,$4)
       RETURNING user_id, full_name, email, role`, [fullName, email, hash, role]);
    if (role === 'provider') await c.query('INSERT INTO provider_profiles (provider_id) VALUES ($1)', [rows[0].user_id]);
    return rows[0];
  });
  res.status(201).json({ success: true, message: 'Registration successful', token: signToken(user), user: publicUser(user) });
}));

// POST /api/auth/login   (SFR-04, SFR-07)
router.post('/login', asyncHandler(async (req, res) => {
  const email = str(req.body.email).toLowerCase();
  const password = typeof req.body.password === 'string' ? req.body.password : '';
  new Validator().required('email', email, 'Email').required('password', password, 'Password').check();

  const { rows } = await db.query(
    'SELECT user_id, full_name, email, role, password_hash, is_active FROM users WHERE email = $1', [email]);
  const user = rows[0];
  // same message whether the email or the password was wrong
  const ok = user && user.is_active && (await bcrypt.compare(password, user.password_hash));
  if (!ok) throw unauthorized('Invalid email or password');

  const redirectTo = { customer: '/customer/dashboard', provider: '/provider/dashboard', admin: '/admin/dashboard' }[user.role];
  res.json({ success: true, token: signToken(user), user: publicUser(user), redirectTo });
}));

// POST /api/auth/logout   (SFR-05)  - revokes the token so it can no longer be used
router.post('/logout', authenticate, asyncHandler(async (req, res) => {
  const { jti, exp } = req.tokenPayload;
  await db.query('INSERT INTO revoked_tokens (jti, expires_at) VALUES ($1, to_timestamp($2)) ON CONFLICT DO NOTHING', [jti, exp]);
  db.query('DELETE FROM revoked_tokens WHERE expires_at < NOW()').catch(() => {}); // housekeeping
  res.json({ success: true, message: 'Signed out' });
}));

// GET /api/auth/me
router.get('/me', authenticate, (req, res) => res.json({ success: true, user: publicUser(req.user) }));

module.exports = router;
