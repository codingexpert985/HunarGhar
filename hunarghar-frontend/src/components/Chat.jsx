import { useEffect, useRef, useState } from 'react';
import { api } from '../lib/api.js';
import { useAuth } from '../lib/auth.jsx';
import { useToast } from '../lib/toast.jsx';
import { useChatSocket } from '../lib/useSocket.js';
import { Spinner } from './ui.jsx';
import ReportModal from './ReportModal.jsx';

const time = (v) => new Date(v).toLocaleTimeString('en-PK', { hour: '2-digit', minute: '2-digit' });

/** One conversation per booking. Socket.io for live delivery, REST as the saved-first fallback (SFR-26, SFR-27). */
export default function Chat({ bookingId, onBookingStatus, canWrite = true }) {
  const { user } = useAuth();
  const toast = useToast();
  const [msgs, setMsgs] = useState(null);
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);
  const [report, setReport] = useState(null);
  const [loadErr, setLoadErr] = useState('');
  const end = useRef(null);

  const add = (m) => setMsgs((x) => (x && x.some((y) => y.message_id === m.message_id) ? x : [...(x || []), m]));
  const { status, typing, send, notifyTyping } = useChatSocket(bookingId, { onMessage: add, onBookingStatus });

  useEffect(() => {
    api.get(`/bookings/${bookingId}/messages`).then((r) => setMsgs(r.messages)).catch((e) => { setLoadErr(e.message); setMsgs([]); });
  }, [bookingId]);
  useEffect(() => { end.current?.scrollIntoView({ block: 'end' }); }, [msgs]);

  const submit = async (e) => {
    e.preventDefault();
    const content = text.trim(); if (!content) return;
    setSending(true);
    let ack = await send(content);
    if (!ack?.ok && ack?.error === 'offline') {           // fall back to REST; only shown once the server has saved it
      try { const r = await api.post(`/bookings/${bookingId}/messages`, { content }); ack = { ok: true, message: r.message }; }
      catch (x) { ack = { ok: false, error: x.message }; }
    }
    setSending(false);
    if (ack.ok) { add(ack.message); setText(''); } else toast(`Message not sent: ${ack.error}`, 'error');
  };

  const banner = { connecting: 'Connecting to live chat…', offline: 'Live chat is offline. Reconnecting… messages you send are still saved.', online: null }[status];

  return (
    <section className="card flex h-[28rem] flex-col" aria-label="Conversation">
      {banner && <p className={`px-4 py-2 text-xs font-semibold ${status === 'offline' ? 'bg-marigold-100 text-marigold-700' : 'bg-indigo-50 text-indigo'}`} role="status">{banner}</p>}
      <div className="flex-1 space-y-2 overflow-y-auto p-4">
        {msgs === null ? <Spinner /> : loadErr ? <p className="text-sm text-madder">{loadErr}</p> : msgs.length === 0 ? <p className="py-10 text-center text-sm text-ink/55">No messages yet. Say hello and agree on the details.</p> : msgs.map((m) => {
          const mine = m.sender_id === user.user_id;
          return (
            <div key={m.message_id} className={`flex flex-col ${mine ? 'items-end' : 'items-start'}`}>
              <div className={`max-w-[80%] rounded-2xl px-3.5 py-2 text-sm ${mine ? 'rounded-br-sm bg-indigo text-white' : 'rounded-bl-sm bg-indigo-50'} ${m.is_hidden ? 'italic opacity-60' : ''}`}>
                {!mine && <p className="mb-0.5 text-xs font-bold text-madder">{m.sender_name}</p>}
                {m.is_hidden ? 'Hidden by a moderator: ' : ''}{m.content}
              </div>
              <p className="mt-0.5 text-[11px] text-ink/45">{mine ? 'You' : m.sender_name} · {time(m.sent_at)}
                {!mine && user.role !== 'admin' && <button className="ml-2 underline" onClick={() => setReport(m.message_id)}>Report</button>}</p>
            </div>);
        })}
        {typing && <p className="text-xs text-ink/50">{typing} is typing…</p>}
        <div ref={end} />
      </div>
      {canWrite ? (
        <form onSubmit={submit} className="stitch flex gap-2 p-3">
          <input className="input" value={text} onChange={(e) => { setText(e.target.value); notifyTyping(); }} placeholder="Write a message" aria-label="Message" maxLength={2000} />
          <button className="btn-primary" disabled={sending || !text.trim()}>Send</button>
        </form>) : <p className="stitch p-3 text-center text-xs text-ink/55">Moderation view: you can read this conversation but not post in it.</p>}
      {report && <ReportModal targetType="message" targetId={report} label="this message" onClose={() => setReport(null)} />}
    </section>
  );
}
