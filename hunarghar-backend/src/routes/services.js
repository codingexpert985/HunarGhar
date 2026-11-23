'use strict';
const express = require('express');
const db = require('../config/db');
const asyncHandler = require('../utils/asyncHandler');
const { authenticate, requireRole } = require('../middleware/auth');
const { Validator, uuidParam, str } = require('../utils/validators');
const { notFound, forbidden } = require('../utils/AppError');
const { PRICE_MIN, PRICE_MAX } = require('../config/constants');

const router = express.Router();
router.param('id', uuidParam);

/** Validates a service body. For updates (partial=true) only supplied fields are checked. */
async function validateService(body, partial = false) {
  const v = new Validator();
  const out = {};
  if (!partial || body.category !== undefined) {
    out.category = str(body.category);
    v.required('category', out.category, 'Category');
    if (out.category) {
      const c = await db.query('SELECT name FROM categories WHERE LOWER(name) = LOWER($1)', [out.category]);
      if (!c.rowCount) v.add('category', 'Category is not in the list of service categories');
      else out.category = c.rows[0].name;
    }
  }
  if (!partial || body.description !== undefined) {
    out.description = str(body.description);
    v.required('description', out.description, 'Description');
  }
  if (!partial || body.price !== undefined) {
    v.required('price', body.price, 'Price');
    out.price = Number(body.price);
    if (body.price !== undefined && body.price !== '') {
      if (!Number.isFinite(out.price)) v.add('price', 'Price must be a number');
      else if (out.price < PRICE_MIN || out.price > PRICE_MAX) {
        v.add('price', `Price must be between PKR ${PRICE_MIN} and PKR 9,000`);
      }
    }
  }
  if (body.availability !== undefined) out.availability = str(body.availability).slice(0, 255);
  v.check();
  return out;
}

// GET /api/services/mine
router.get('/mine', authenticate, requireRole('provider'), asyncHandler(async (req, res) => {
  const { rows } = await db.query(
    'SELECT * FROM services WHERE provider_id = $1 AND is_active = TRUE ORDER BY created_at DESC', [req.user.user_id]);
  res.json({ success: true, services: rows });
}));

// POST /api/services   (SFR-09)
router.post('/', authenticate, requireRole('provider'), asyncHandler(async (req, res) => {
  const s = await validateService(req.body);
  const { rows } = await db.query(
    `INSERT INTO services (provider_id, category, description, price, availability)
     VALUES ($1,$2,$3,$4,$5) RETURNING *`,
    [req.user.user_id, s.category, s.description, s.price, s.availability || null]);
  res.status(201).json({ success: true, service: rows[0] });
}));

/** Owner or admin only (SFR-12) */
async function loadOwned(req) {
  const { rows } = await db.query('SELECT * FROM services WHERE service_id = $1 AND is_active = TRUE', [req.params.id]);
  const svc = rows[0];
  if (!svc) throw notFound('Service not found');
  if (svc.provider_id !== req.user.user_id && req.user.role !== 'admin') {
    throw forbidden("You cannot change another provider's service");
  }
  return svc;
}

// PUT /api/services/:id
router.put('/:id', authenticate, requireRole('provider', 'admin'), asyncHandler(async (req, res) => {
  const svc = await loadOwned(req);
  const s = await validateService(req.body, true);
  const merged = { ...svc, ...s };
  const { rows } = await db.query(
    `UPDATE services SET category=$2, description=$3, price=$4, availability=$5 WHERE service_id=$1 RETURNING *`,
    [svc.service_id, merged.category, merged.description, merged.price, merged.availability]);
  res.json({ success: true, service: rows[0] });
}));

// DELETE /api/services/:id  (soft delete so past bookings keep their reference)
router.delete('/:id', authenticate, requireRole('provider', 'admin'), asyncHandler(async (req, res) => {
  const svc = await loadOwned(req);
  await db.query('UPDATE services SET is_active = FALSE WHERE service_id = $1', [svc.service_id]);
  res.json({ success: true, message: 'Service removed' });
}));

module.exports = router;
