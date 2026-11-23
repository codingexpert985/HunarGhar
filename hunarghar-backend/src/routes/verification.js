'use strict';
const express = require('express');
const db = require('../config/db');
const asyncHandler = require('../utils/asyncHandler');
const { authenticate, requireRole } = require('../middleware/auth');
const { uuidParam, str } = require('../utils/validators');
const { notFound, conflict, badRequest } = require('../utils/AppError');

const router = express.Router();
router.param('id', uuidParam);
router.use(authenticate);

// POST /api/verification/request   (provider)  SFR-38
router.post('/request', requireRole('provider'), asyncHandler(async (req, res) => {
  const pid = req.user.user_id;
  const p = await db.query('SELECT bio, city, verification_status FROM provider_profiles WHERE provider_id = $1', [pid]);
  const prof = p.rows[0];
  if (!prof) throw notFound('Provider profile not found');
  if (prof.verification_status === 'verified') throw conflict('Your profile is already verified');
  if (prof.verification_status === 'pending') throw conflict('A verification request is already pending');
  if (!prof.bio || !prof.city) throw badRequest('Please complete your profile (bio and city) before requesting verification');

  const request = await db.withTransaction(async (c) => {
    const r = await c.query(
      `INSERT INTO verification_requests (provider_id) VALUES ($1) RETURNING request_id, status, submitted_at`, [pid]);
    await c.query(`UPDATE provider_profiles SET verification_status = 'pending' WHERE provider_id = $1`, [pid]);
    return r.rows[0];
  });
  res.status(201).json({ success: true, message: 'Verification request submitted', request });
}));

// GET /api/verification?status=pending   (admin)  SFR-39
router.get('/', requireRole('admin'), asyncHandler(async (req, res) => {
  const status = str(req.query.status) || 'pending';
  if (!['pending', 'approved', 'rejected'].includes(status)) throw badRequest('Invalid status');
  const { rows } = await db.query(
    `SELECT vr.request_id, vr.status, vr.submitted_at, vr.reviewed_at, vr.admin_note,
            u.user_id AS provider_id, u.full_name, u.email, p.bio, p.skills, p.city, p.area,
            (SELECT COUNT(*) FROM services s WHERE s.provider_id = p.provider_id AND s.is_active) AS service_count,
            (SELECT COUNT(*) FROM portfolio_images i WHERE i.provider_id = p.provider_id) AS portfolio_count
       FROM verification_requests vr
       JOIN provider_profiles p ON p.provider_id = vr.provider_id
       JOIN users u ON u.user_id = vr.provider_id
      WHERE vr.status = $1 ORDER BY vr.submitted_at ASC`, [status]);
  res.json({ success: true, requests: rows });
}));

// PATCH /api/verification/:id   body: { decision: "approve"|"reject", note? }  (admin) SFR-40, SFR-41
router.patch('/:id', requireRole('admin'), asyncHandler(async (req, res) => {
  const decision = str(req.body.decision);
  if (!['approve', 'reject'].includes(decision)) throw badRequest('decision must be "approve" or "reject"');
  const reqStatus = decision === 'approve' ? 'approved' : 'rejected';
  const profStatus = decision === 'approve' ? 'verified' : 'rejected';

  const result = await db.withTransaction(async (c) => {
    const upd = await c.query(
      `UPDATE verification_requests SET status = $2, reviewed_by = $3, reviewed_at = NOW(), admin_note = $4
        WHERE request_id = $1 AND status = 'pending'
        RETURNING request_id, provider_id, status, reviewed_by, reviewed_at, admin_note`,
      [req.params.id, reqStatus, req.user.user_id, str(req.body.note) || null]);
    if (!upd.rowCount) {
      const ex = await c.query('SELECT status FROM verification_requests WHERE request_id = $1', [req.params.id]);
      if (!ex.rowCount) throw notFound('Verification request not found');
      throw conflict(`This request has already been ${ex.rows[0].status}`);
    }
    await c.query('UPDATE provider_profiles SET verification_status = $2 WHERE provider_id = $1',
      [upd.rows[0].provider_id, profStatus]);
    return upd.rows[0];
  });
  res.json({ success: true, message: `Provider ${profStatus}`, request: result, verification_status: profStatus });
}));

module.exports = router;
