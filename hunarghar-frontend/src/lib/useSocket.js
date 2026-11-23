import { useEffect, useRef, useState } from 'react';
import { io } from 'socket.io-client';
import { BASE, getToken } from './api.js';

/** Real-time chat for one booking (SFR-25..28). `status` drives the connection-status banner. */
export function useChatSocket(bookingId, { onMessage, onBookingStatus } = {}) {
  const sockRef = useRef(null);
  const [status, setStatus] = useState('connecting'); // connecting | online | offline
  const [typing, setTyping] = useState(null);
  const handlers = useRef({});
  handlers.current = { onMessage, onBookingStatus };

  useEffect(() => {
    if (!bookingId) return undefined;
    const socket = io(BASE, { auth: { token: getToken() }, reconnectionDelay: 1000, reconnectionDelayMax: 5000 });
    sockRef.current = socket;
    const join = () => socket.emit('join_booking', bookingId, (ack) => setStatus(ack?.ok ? 'online' : 'offline'));
    socket.on('connect', join);
    socket.on('disconnect', () => setStatus('offline'));
    socket.on('connect_error', () => setStatus('offline'));
    socket.on('new_message', (m) => handlers.current.onMessage?.(m));
    socket.on('booking_status', (s) => handlers.current.onBookingStatus?.(s));
    let t;
    socket.on('user_typing', (p) => { setTyping(p.name); clearTimeout(t); t = setTimeout(() => setTyping(null), 1800); });
    return () => { clearTimeout(t); socket.disconnect(); };
  }, [bookingId]);

  const send = (content) => new Promise((resolve) => {
    const s = sockRef.current;
    if (!s || !s.connected) return resolve({ ok: false, error: 'offline' });
    s.emit('send_message', { bookingId, content }, resolve);
  });
  const notifyTyping = () => sockRef.current?.connected && sockRef.current.emit('typing', { bookingId });

  return { status, typing, send, notifyTyping };
}
