'use strict';
const { loadUserFromToken } = require('../middleware/auth');
const { createMessage, canReadConversation } = require('../services/messageService');
const db = require('../config/db');
const { isUUID } = require('../utils/validators');

const room = (bookingId) => `booking:${bookingId}`;
const reply = (ack, payload) => { if (typeof ack === 'function') ack(payload); };

/**
 * Real-time chat with Socket.io (SFR-25..28)
 *   client connects with   io(URL, { auth: { token: "<JWT>" } })
 *   emit  join_booking   (bookingId, ack)
 *   emit  send_message   ({ bookingId, content }, ack)
 *   emit  typing         ({ bookingId })
 *   listen new_message | user_typing | booking_status
 */
module.exports = function attachChat(io) {
  io.use(async (socket, next) => {
    try {
      const token = (socket.handshake.auth && socket.handshake.auth.token) ||
        (socket.handshake.headers.authorization || '').replace('Bearer ', '');
      const { user } = await loadUserFromToken(token);
      socket.user = user;
      next();
    } catch (err) {
      next(new Error(err.message || 'Authentication failed'));
    }
  });

  io.on('connection', (socket) => {
    socket.on('join_booking', async (bookingId, ack) => {
      try {
        if (!isUUID(bookingId)) return reply(ack, { ok: false, error: 'Invalid booking id' });
        const { rows } = await db.query(
          'SELECT booking_id, customer_id, provider_id, status FROM bookings WHERE booking_id = $1', [bookingId]);
        if (!rows[0]) return reply(ack, { ok: false, error: 'Booking not found' });
        if (!(await canReadConversation(rows[0], socket.user))) {
          return reply(ack, { ok: false, error: 'You are not allowed to join this conversation' });
        }
        socket.join(room(bookingId));
        reply(ack, { ok: true });
      } catch (e) { reply(ack, { ok: false, error: 'Could not join conversation' }); }
    });

    socket.on('send_message', async (payload, ack) => {
      try {
        const { bookingId, content } = payload || {};
        const message = await createMessage({ bookingId, user: socket.user, content });  // saved first
        io.to(room(bookingId)).emit('new_message', message);                              // then delivered
        reply(ack, { ok: true, message });
      } catch (e) {
        reply(ack, { ok: false, error: e.status ? e.message : 'Message could not be sent' });
      }
    });

    socket.on('typing', ({ bookingId } = {}) => {
      if (socket.rooms.has(room(bookingId))) {
        socket.to(room(bookingId)).emit('user_typing', { bookingId, userId: socket.user.user_id, name: socket.user.full_name });
      }
    });
  });
};
