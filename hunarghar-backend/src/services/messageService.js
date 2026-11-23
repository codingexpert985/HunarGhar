'use strict';
const db = require('../config/db');
const { badRequest, conflict, forbidden, notFound } = require('../utils/AppError');

const MAX_LEN = 2000;
const CHAT_OPEN_STATUSES = ['pending', 'accepted', 'completed'];

/**
 * Validates and saves a chat message. Used by both REST and Socket.io so the rules are identical.
 * Only the customer and provider of the booking may send (SFR-25, SFR-28).
 * A message is returned only after it is saved (SFR-27).
 */
async function createMessage({ bookingId, user, content }) {
  const text = typeof content === 'string' ? content.trim() : '';
  if (!text) throw badRequest('Message cannot be empty');
  if (text.length > MAX_LEN) throw badRequest(`Message must be at most ${MAX_LEN} characters`);

  const { rows } = await db.query(
    'SELECT booking_id, customer_id, provider_id, status FROM bookings WHERE booking_id = $1', [bookingId]);
  const b = rows[0];
  if (!b) throw notFound('Booking not found');
  if (b.customer_id !== user.user_id && b.provider_id !== user.user_id) {
    throw forbidden('Only the customer and provider of this booking can chat');
  }
  if (!CHAT_OPEN_STATUSES.includes(b.status)) {
    throw conflict(`Chat is closed because the booking is ${b.status}`);
  }
  const ins = await db.query(
    `INSERT INTO messages (booking_id, sender_id, content) VALUES ($1, $2, $3)
     RETURNING message_id, booking_id, sender_id, content, sent_at`, [bookingId, user.user_id, text]);
  return { ...ins.rows[0], sender_name: user.full_name };
}

/** Participants always; an admin only when an open report targets a message of this booking (SFR-28). */
async function canReadConversation(booking, user) {
  if (booking.customer_id === user.user_id || booking.provider_id === user.user_id) return true;
  if (user.role !== 'admin') return false;
  const r = await db.query(
    `SELECT 1 FROM reports rp JOIN messages m ON m.message_id = rp.target_id
      WHERE rp.target_type = 'message' AND rp.status = 'open' AND m.booking_id = $1 LIMIT 1`, [booking.booking_id]);
  return r.rowCount > 0;
}

module.exports = { createMessage, canReadConversation, CHAT_OPEN_STATUSES };
