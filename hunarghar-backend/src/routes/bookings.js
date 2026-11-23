'use strict';
const express = require('express');
const db = require('../config/db');
const asyncHandler = require('../utils/asyncHandler');
const { authenticate, requireRole } = require('../middleware/auth');
const { Validator, uuidParam, isUUID, str } = require('../utils/validators');
const { notFound, forbidden, conflict, badRequest } = require('../utils/AppError');
const { createMessage, canReadConversation } = require('../services/messageService');

const router = express.Router();
router.param('id', uuidParam);
router.use(authenticate);

const BOOKING_SELECT = `
  SELECT b.booking_id, b.customer_id, b.provider_id, b.service_id, b.requested_datetime, b.notes,
         b.status, b.created_at, b.updated_at,
         s.category, s.description AS service_description, s.price,
         cu.full_name AS customer_name, pu.full_name AS provider_name,
         pay.mock_status AS payment_status, pay.amount, pay.paid_at,
         (SELECT r.review_id FROM reviews r WHERE r.booking_id = b.booking_id) AS review_id
    FROM bookings b
    JOIN services s  ON s.service_id = b.service_id
    JOIN users cu    ON cu.user_id = b.customer_id
    JOIN users pu    ON pu.user_id = b.provider_id
    LEFT JOIN payments pay ON pay.booking_id = b.booking_id`;

async function fetchBooking(id) {
  const { rows } = await db.query(`${BOOKING_SELECT} WHERE b.booking_id = $1`, [id]);
  if (!rows[0]) throw notFound('Booking not found');
  return rows[0];
}
const isParticipant = (b, u) => b.customer_id === u.user_id || b.provider_id === u.user_id;

// POST /api/bookings   (customer)  SFR-18
router.post('/', requireRole('customer'), asyncHandler(async (req, res) => {
  const serviceId = str(req.body.serviceId);
  const when = new Date(req.body.requestedDatetime);
  const v = new Validator().required('serviceId', serviceId, 'Service');
  if (serviceId && !isUUID(serviceId)) v.add('serviceId', 'Service id is not valid');
  if (!req.body.requestedDatetime) v.add('requestedDatetime', 'Requested date and time is required');
  else if (isNaN(when.getTime())) v.add('requestedDatetime', 'Requested date and time is not valid');
  else if (when.getTime() <= Date.now()) v.add('requestedDatetime', 'Requested date and time cannot be in the past');
  const notes = str(req.body.notes);
  if (notes.length > 1000) v.add('notes', 'Notes must be at most 1000 characters');
  v.check();

  const s = await db.query(
    `SELECT s.service_id, s.provider_id, s.price FROM services s JOIN users u ON u.user_id = s.provider_id
      WHERE s.service_id = $1 AND s.is_active = TRUE AND u.is_active = TRUE`, [serviceId]);
  if (!s.rowCount) throw notFound('Service not found or no longer available');
  const svc = s.rows[0];

  const id = await db.withTransaction(async (c) => {
    const b = await c.query(
      `INSERT INTO bookings (customer_id, provider_id, service_id, requested_datetime, notes)
       VALUES ($1,$2,$3,$4,$5) RETURNING booking_id`,
      [req.user.user_id, svc.provider_id, svc.service_id, when.toISOString(), notes || null]);
    // simulated payment record is prepared at booking time
    await c.query('INSERT INTO payments (booking_id, amount) VALUES ($1,$2)', [b.rows[0].booking_id, svc.price]);
    return b.rows[0].booking_id;
  });
  res.status(201).json({ success: true, message: 'Booking request sent (status: pending)', booking: await fetchBooking(id) });
}));

// GET /api/bookings?status=   own bookings (customer/provider); admin sees all   (SFR-19, SFR-21)
router.get('/', asyncHandler(async (req, res) => {
  const params = [];
  const where = [];
  if (req.user.role === 'customer') { params.push(req.user.user_id); where.push(`b.customer_id = $${params.length}`); }
  else if (req.user.role === 'provider') { params.push(req.user.user_id); where.push(`b.provider_id = $${params.length}`); }
  const status = str(req.query.status);
  if (status) {
    if (!['pending', 'accepted', 'rejected', 'cancelled', 'completed'].includes(status)) throw badRequest('Invalid status filter');
    params.push(status); where.push(`b.status = $${params.length}`);
  }
  const { rows } = await db.query(
    `${BOOKING_SELECT} ${where.length ? 'WHERE ' + where.join(' AND ') : ''} ORDER BY b.created_at DESC LIMIT 200`, params);
  res.json({ success: true, bookings: rows });
}));

// GET /api/bookings/:id   (SFR-22)
router.get('/:id', asyncHandler(async (req, res) => {
  const b = await fetchBooking(req.params.id);
  if (!isParticipant(b, req.user) && req.user.role !== 'admin') throw forbidden('You cannot view this booking');
  res.json({ success: true, booking: b });
}));

/**
 * Status transitions. The UPDATE is conditional on the current status, so two users acting at the
 * same time can never produce an invalid state (SFR-20, SFR-23, SFR-24, correctness 4.3.3).
 */
const ACTIONS = {
  accept:   { to: 'accepted',  from: ['pending'],             by: 'provider', verb: 'accepted' },
  reject:   { to: 'rejected',  from: ['pending'],             by: 'provider', verb: 'rejected' },
  complete: { to: 'completed', from: ['accepted'],            by: 'provider', verb: 'marked as completed' },
  cancel:   { to: 'cancelled', from: ['pending', 'accepted'], by: 'either',   verb: 'cancelled' }
};

for (const [action, rule] of Object.entries(ACTIONS)) {
  router.post(`/:id/${action}`, asyncHandler(async (req, res) => {
    const b = await fetchBooking(req.params.id);
    const isProvider = b.provider_id === req.user.user_id;
    const isCustomer = b.customer_id === req.user.user_id;
    const allowed = rule.by === 'provider' ? isProvider : (isProvider || isCustomer);
    if (!allowed) throw forbidden(`Only the ${rule.by === 'provider' ? 'provider of this booking' : 'customer or provider of this booking'} can ${action} it`);

    const upd = await db.query(
      `UPDATE bookings SET status = $2, updated_at = NOW()
        WHERE booking_id = $1 AND status = ANY($3::booking_status[]) RETURNING booking_id`,
      [b.booking_id, rule.to, rule.from]);
    if (!upd.rowCount) {
      throw conflict(`Booking cannot be ${rule.verb}: it is currently ${b.status}`);
    }
    const io = req.app.get('io');
    if (io) io.to(`booking:${b.booking_id}`).emit('booking_status', { booking_id: b.booking_id, status: rule.to });
    res.json({ success: true, message: `Booking ${rule.verb}`, booking: await fetchBooking(b.booking_id) });
  }));
}

// ---------- chat history + send (REST fallback for Socket.io) ----------
// GET /api/bookings/:id/messages
router.get('/:id/messages', asyncHandler(async (req, res) => {
  const { rows } = await db.query(
    'SELECT booking_id, customer_id, provider_id, status FROM bookings WHERE booking_id = $1', [req.params.id]);
  if (!rows[0]) throw notFound('Booking not found');
  if (!(await canReadConversation(rows[0], req.user))) throw forbidden('You cannot read this conversation');
  const isAdmin = req.user.role === 'admin';
  const msgs = await db.query(
    `SELECT m.message_id, m.booking_id, m.sender_id, u.full_name AS sender_name, m.content, m.sent_at, m.is_hidden
       FROM messages m JOIN users u ON u.user_id = m.sender_id
      WHERE m.booking_id = $1 ${isAdmin ? '' : 'AND m.is_hidden = FALSE'}
      ORDER BY m.sent_at ASC`, [req.params.id]);
  res.json({ success: true, messages: msgs.rows });
}));

// POST /api/bookings/:id/messages
router.post('/:id/messages', asyncHandler(async (req, res) => {
  const message = await createMessage({ bookingId: req.params.id, user: req.user, content: req.body.content });
  const io = req.app.get('io');
  if (io) io.to(`booking:${req.params.id}`).emit('new_message', message);
  res.status(201).json({ success: true, message });
}));

module.exports = router;
