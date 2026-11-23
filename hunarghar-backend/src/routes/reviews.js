'use strict';
const express = require('express');
const db = require('../config/db');
const asyncHandler = require('../utils/asyncHandler');
const { authenticate, requireRole } = require('../middleware/auth');
const { Validator, uuidParam, isUUID, str } = require('../utils/validators');
const { notFound, forbidden, conflict } = require('../utils/AppError');
const { recalcProviderRating } = require('../services/reviewService');

const router = express.Router();
router.param('providerId', uuidParam);

// POST /api/reviews   (SFR-33, SFR-34, SFR-35, SFR-36)
router.post('/', authenticate, requireRole('customer'), asyncHandler(async (req, res) => {
  const bookingId = str(req.body.bookingId);
  const rating = Number(req.body.rating);
  const comment = str(req.body.comment);
  const v = new Validator().required('bookingId', bookingId, 'Booking');
  if (bookingId && !isUUID(bookingId)) v.add('bookingId', 'Booking id is not valid');
  if (req.body.rating === undefined || req.body.rating === '') v.add('rating', 'Rating is required');
  else if (!Number.isInteger(rating) || rating < 1 || rating > 5) v.add('rating', 'Rating must be a whole number from 1 to 5');
  if (comment.length > 2000) v.add('comment', 'Comment must be at most 2000 characters');
  v.check();

  const b = await db.query('SELECT booking_id, customer_id, provider_id, status FROM bookings WHERE booking_id = $1', [bookingId]);
  const booking = b.rows[0];
  if (!booking) throw notFound('Booking not found');
  if (booking.customer_id !== req.user.user_id) throw forbidden('You can only review your own bookings');
  if (booking.status !== 'completed') throw conflict('You can only review a completed booking');

  const review = await db.withTransaction(async (c) => {
    // UNIQUE(booking_id) + this check = only one review per booking
    const dup = await c.query('SELECT 1 FROM reviews WHERE booking_id = $1', [bookingId]);
    if (dup.rowCount) throw conflict('You have already reviewed this booking');
    const { rows } = await c.query(
      `INSERT INTO reviews (booking_id, customer_id, provider_id, rating, comment)
       VALUES ($1,$2,$3,$4,$5) RETURNING review_id, booking_id, rating, comment, created_at`,
      [bookingId, req.user.user_id, booking.provider_id, rating, comment || null]);
    await recalcProviderRating(c, booking.provider_id);
    return rows[0];
  });
  const prof = await db.query('SELECT avg_rating, review_count FROM provider_profiles WHERE provider_id = $1', [booking.provider_id]);
  res.status(201).json({ success: true, message: 'Review published', review, provider: prof.rows[0] });
}));

// GET /api/reviews/provider/:providerId  (public)
router.get('/provider/:providerId', asyncHandler(async (req, res) => {
  const { rows } = await db.query(
    `SELECT r.review_id, r.rating, r.comment, r.created_at, u.full_name AS customer_name
       FROM reviews r JOIN users u ON u.user_id = r.customer_id
      WHERE r.provider_id = $1 AND r.is_hidden = FALSE ORDER BY r.created_at DESC`, [req.params.providerId]);
  const prof = await db.query('SELECT avg_rating, review_count FROM provider_profiles WHERE provider_id = $1', [req.params.providerId]);
  res.json({ success: true, summary: prof.rows[0] || { avg_rating: 0, review_count: 0 }, reviews: rows });
}));

module.exports = router;
