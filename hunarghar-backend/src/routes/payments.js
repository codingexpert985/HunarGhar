'use strict';
const express = require('express');
const db = require('../config/db');
const asyncHandler = require('../utils/asyncHandler');
const { authenticate, requireRole } = require('../middleware/auth');
const { uuidParam } = require('../utils/validators');
const { notFound, forbidden, conflict, badRequest } = require('../utils/AppError');

const router = express.Router();
router.param('bookingId', uuidParam);
router.use(authenticate);

// Every simulated-payment response carries this notice (SFR-29, SFR-32, FR-28)
const NOTICE = 'DEMONSTRATION ONLY: this is a simulated payment. No real money has been transferred.';

async function loadPayment(bookingId) {
  const { rows } = await db.query(
    `SELECT b.booking_id, b.customer_id, b.provider_id, b.status AS booking_status,
            s.category AS service, pu.full_name AS provider_name,
            p.payment_id, p.amount, p.mock_status, p.paid_at
       FROM bookings b
       JOIN services s ON s.service_id = b.service_id
       JOIN users pu ON pu.user_id = b.provider_id
       JOIN payments p ON p.booking_id = b.booking_id
      WHERE b.booking_id = $1`, [bookingId]);
  if (!rows[0]) throw notFound('Booking not found');
  return rows[0];
}
const shape = (p) => ({
  booking_id: p.booking_id, service: p.service, provider: p.provider_name, amount: p.amount,
  currency: 'PKR', payment_status: p.mock_status, paid_at: p.paid_at, booking_status: p.booking_status,
  isSimulated: true, notice: NOTICE
});

// GET /api/payments/booking/:bookingId   - payment page data (SFR-29)
router.get('/booking/:bookingId', asyncHandler(async (req, res) => {
  const p = await loadPayment(req.params.bookingId);
  const ok = p.customer_id === req.user.user_id || p.provider_id === req.user.user_id || req.user.role === 'admin';
  if (!ok) throw forbidden('You cannot view this payment');
  res.json({ success: true, payment: shape(p) });
}));

// POST /api/payments/booking/:bookingId/confirm   body: { "confirm": true }   (SFR-30, SFR-31)
// Not calling this endpoint = the customer cancelled; nothing is recorded.
router.post('/booking/:bookingId/confirm', requireRole('customer'), asyncHandler(async (req, res) => {
  const p = await loadPayment(req.params.bookingId);
  if (p.customer_id !== req.user.user_id) throw forbidden('This is not your booking');
  if (req.body.confirm !== true) throw badRequest('Confirmation required: send { "confirm": true } to record the demo payment');
  if (!['accepted', 'completed'].includes(p.booking_status)) {
    throw conflict(`A demo payment can only be made for an accepted booking (this one is ${p.booking_status})`);
  }
  const upd = await db.query(
    `UPDATE payments SET mock_status = 'mock_paid', paid_at = NOW()
      WHERE booking_id = $1 AND mock_status = 'not_paid' RETURNING booking_id`, [p.booking_id]);
  if (!upd.rowCount) throw conflict('This booking has already been marked as paid (demo)');
  res.json({ success: true, message: 'Simulated payment recorded', payment: shape(await loadPayment(p.booking_id)) });
}));

module.exports = router;
