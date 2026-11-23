'use strict';
const express = require('express');
const db = require('../config/db');
const asyncHandler = require('../utils/asyncHandler');
const { authenticate, requireRole } = require('../middleware/auth');
const { uuidParam, str } = require('../utils/validators');
const { notFound, badRequest } = require('../utils/AppError');

const router = express.Router();
router.param('id', uuidParam);
router.use(authenticate, requireRole('admin'));       // SFR-42: every admin route is admin-only

// GET /api/admin/stats   - numbers for the administrator dashboard
router.get('/stats', asyncHandler(async (req, res) => {
  const q = async (sql) => (await db.query(sql)).rows[0].n;
  const [customers, providers, bookings, pendingVerifications, openReports, verifiedProviders] = await Promise.all([
    q(`SELECT COUNT(*) n FROM users WHERE role = 'customer'`),
    q(`SELECT COUNT(*) n FROM users WHERE role = 'provider'`),
    q('SELECT COUNT(*) n FROM bookings'),
    q(`SELECT COUNT(*) n FROM verification_requests WHERE status = 'pending'`),
    q(`SELECT COUNT(*) n FROM reports WHERE status = 'open'`),
    q(`SELECT COUNT(*) n FROM provider_profiles WHERE verification_status = 'verified'`)
  ]);
  res.json({ success: true, stats: { customers, providers, verifiedProviders, bookings, pendingVerifications, openReports } });
}));

// GET /api/admin/users?role=
router.get('/users', asyncHandler(async (req, res) => {
  const role = str(req.query.role);
  if (role && !['customer', 'provider', 'admin'].includes(role)) throw badRequest('Invalid role');
  const { rows } = await db.query(
    `SELECT user_id, full_name, email, role, is_active, created_at FROM users
      ${role ? 'WHERE role = $1' : ''} ORDER BY created_at DESC LIMIT 500`, role ? [role] : []);
  res.json({ success: true, users: rows });
}));

// PATCH /api/admin/users/:id/active   body: { active: true|false }
router.patch('/users/:id/active', asyncHandler(async (req, res) => {
  if (typeof req.body.active !== 'boolean') throw badRequest('active must be true or false');
  if (req.params.id === req.user.user_id) throw badRequest('You cannot change your own account status');
  const r = await db.query('UPDATE users SET is_active = $2 WHERE user_id = $1 RETURNING user_id, full_name, role, is_active',
    [req.params.id, req.body.active]);
  if (!r.rowCount) throw notFound('User not found');
  res.json({ success: true, user: r.rows[0] });
}));

module.exports = router;
