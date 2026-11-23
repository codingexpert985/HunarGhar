'use strict';
// JWT authentication + role-based authorisation  (SFR-04, SFR-05, SFR-06, SFR-42)
const jwt = require('jsonwebtoken');
const env = require('../config/env');
const db = require('../config/db');
const asyncHandler = require('../utils/asyncHandler');
const { unauthorized, forbidden } = require('../utils/AppError');

/** Verify a JWT string and return { user, payload }. Throws a 401 AppError on any problem. */
async function loadUserFromToken(token) {
  if (!token) throw unauthorized('Authentication required');
  let payload;
  try { payload = jwt.verify(token, env.JWT_SECRET); }
  catch { throw unauthorized('Invalid or expired token. Please sign in again.'); }

  // a token that was signed out (SFR-05) can no longer be used
  const revoked = await db.query('SELECT 1 FROM revoked_tokens WHERE jti = $1', [payload.jti]);
  if (revoked.rowCount) throw unauthorized('You are signed out. Please sign in again.');

  const { rows } = await db.query(
    'SELECT user_id, full_name, email, role, is_active FROM users WHERE user_id = $1', [payload.sub]);
  if (!rows[0] || !rows[0].is_active) throw unauthorized('Account not found or disabled');
  return { user: rows[0], payload };
}

/** Express middleware: requires "Authorization: Bearer <token>". Sets req.user and req.tokenPayload. */
const authenticate = asyncHandler(async (req, res, next) => {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;
  const { user, payload } = await loadUserFromToken(token);
  req.user = user;
  req.tokenPayload = payload;
  next();
});

/** Role is checked on the server for every protected request (SFR-06). Use after authenticate. */
const requireRole = (...roles) => (req, res, next) =>
  roles.includes(req.user && req.user.role)
    ? next()
    : next(forbidden('Access denied: your account type cannot perform this action'));

module.exports = { authenticate, requireRole, loadUserFromToken };
