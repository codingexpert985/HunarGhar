'use strict';
const express = require('express');
const db = require('../config/db');
const asyncHandler = require('../utils/asyncHandler');
const { authenticate, requireRole } = require('../middleware/auth');
const { Validator, uuidParam, isUUID, str } = require('../utils/validators');
const { notFound, conflict, badRequest } = require('../utils/AppError');
const { recalcProviderRating } = require('../services/reviewService');

const router = express.Router();
router.param('id', uuidParam);
router.use(authenticate);

const TARGETS = {
  profile: 'SELECT provider_id AS id FROM provider_profiles WHERE provider_id = $1',
  review: 'SELECT review_id AS id FROM reviews WHERE review_id = $1',
  message: 'SELECT message_id AS id FROM messages WHERE message_id = $1'
};

// POST /api/reports   (any signed-in user)  SFR-37
router.post('/', asyncHandler(async (req, res) => {
  const targetType = str(req.body.targetType);
  const targetId = str(req.body.targetId);
  const reason = str(req.body.reason);
  const v = new Validator();
  if (!TARGETS[targetType]) v.add('targetType', 'targetType must be profile, review or message');
  if (!isUUID(targetId)) v.add('targetId', 'targetId must be a valid id');
  v.required('reason', reason, 'Reason');
  if (reason.length > 1000) v.add('reason', 'Reason must be at most 1000 characters');
  v.check();

  const t = await db.query(TARGETS[targetType], [targetId]);
  if (!t.rowCount) throw notFound(`Reported ${targetType} not found`);
  const { rows } = await db.query(
    `INSERT INTO reports (reporter_id, target_type, target_id, reason) VALUES ($1,$2,$3,$4)
     RETURNING report_id, target_type, target_id, reason, status, created_at`,
    [req.user.user_id, targetType, targetId, reason]);
  res.status(201).json({ success: true, message: 'Report submitted', report: rows[0] });
}));

// GET /api/reports?status=open   (admin)  SFR-43
router.get('/', requireRole('admin'), asyncHandler(async (req, res) => {
  const status = str(req.query.status) || 'open';
  if (!['open', 'resolved'].includes(status)) throw badRequest('Invalid status');
  const { rows } = await db.query(
    `SELECT r.report_id, r.target_type, r.target_id, r.reason, r.status, r.created_at, r.admin_note,
            u.full_name AS reporter_name,
            CASE r.target_type
              WHEN 'message' THEN (SELECT m.content FROM messages m WHERE m.message_id = r.target_id)
              WHEN 'review'  THEN (SELECT rv.comment FROM reviews rv WHERE rv.review_id = r.target_id)
              WHEN 'profile' THEN (SELECT pu.full_name FROM users pu WHERE pu.user_id = r.target_id)
            END AS target_preview
       FROM reports r JOIN users u ON u.user_id = r.reporter_id
      WHERE r.status = $1 ORDER BY r.created_at ASC`, [status]);
  res.json({ success: true, reports: rows });
}));

// PATCH /api/reports/:id   body: { action: "dismiss"|"hide_content", note? }   (admin)
router.patch('/:id', requireRole('admin'), asyncHandler(async (req, res) => {
  const action = str(req.body.action);
  if (!['dismiss', 'hide_content'].includes(action)) throw badRequest('action must be "dismiss" or "hide_content"');

  const out = await db.withTransaction(async (c) => {
    const upd = await c.query(
      `UPDATE reports SET status = 'resolved', resolved_by = $2, resolved_at = NOW(), admin_note = $3
        WHERE report_id = $1 AND status = 'open' RETURNING report_id, target_type, target_id, status`,
      [req.params.id, req.user.user_id, str(req.body.note) || null]);
    if (!upd.rowCount) {
      const ex = await c.query('SELECT status FROM reports WHERE report_id = $1', [req.params.id]);
      if (!ex.rowCount) throw notFound('Report not found');
      throw conflict('This report is already resolved');
    }
    const rep = upd.rows[0];
    if (action === 'hide_content') {
      if (rep.target_type === 'message') {
        await c.query('UPDATE messages SET is_hidden = TRUE WHERE message_id = $1', [rep.target_id]);
      } else if (rep.target_type === 'review') {
        const r = await c.query('UPDATE reviews SET is_hidden = TRUE WHERE review_id = $1 RETURNING provider_id', [rep.target_id]);
        if (r.rowCount) await recalcProviderRating(c, r.rows[0].provider_id);
      } else if (rep.target_type === 'profile') {
        await c.query('UPDATE users SET is_active = FALSE WHERE user_id = $1 AND role = $2', [rep.target_id, 'provider']);
      }
    }
    return rep;
  });
  res.json({ success: true, message: action === 'hide_content' ? 'Content hidden and report resolved' : 'Report dismissed', report: out });
}));

module.exports = router;
