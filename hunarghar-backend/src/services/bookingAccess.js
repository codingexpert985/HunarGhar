'use strict';
const db = require('../config/db');
const { notFound, forbidden } = require('../utils/AppError');

/** Loads a booking's participants and checks that `user` may see it (SFR-22). */
async function getBookingForUser(bookingId, user, { allowAdmin = true } = {}) {
  const { rows } = await db.query(
    'SELECT booking_id, customer_id, provider_id, status FROM bookings WHERE booking_id = $1', [bookingId]);
  const b = rows[0];
  if (!b) throw notFound('Booking not found');
  const isParticipant = b.customer_id === user.user_id || b.provider_id === user.user_id;
  const isAdmin = allowAdmin && user.role === 'admin';
  if (!isParticipant && !isAdmin) throw forbidden('You are not a participant of this booking');
  return { booking: b, isParticipant, isAdmin };
}

module.exports = { getBookingForUser };
