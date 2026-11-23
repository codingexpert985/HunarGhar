import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { api, fieldErrors } from '../lib/api.js';
import { useAuth } from '../lib/auth.jsx';
import { useToast } from '../lib/toast.jsx';
import { useLoad } from '../components/useLoad.js';
import { Badge, Empty, Field, Spinner } from '../components/ui.jsx';
import Chat from '../components/Chat.jsx';
import { dt, iconFor, pkr } from '../lib/format.js';

function ReviewForm({ bookingId, onDone }) {
  const toast = useToast();
  const [rating, setRating] = useState(0);
  const [comment, setComment] = useState('');
  const [err, setErr] = useState({});
  const [busy, setBusy] = useState(false);
  const submit = async (e) => {
    e.preventDefault(); setBusy(true); setErr({});
    try { await api.post('/reviews', { bookingId, rating: rating || '', comment }); toast('Thank you. Your review is published.'); onDone(); }
    catch (x) { setErr(fieldErrors(x)); if (!Object.keys(fieldErrors(x)).length) toast(x.message, 'error'); }
    finally { setBusy(false); }
  };
  return (
    <form onSubmit={submit} className="card space-y-3 p-5" noValidate>
      <h2 className="text-lg font-bold">Rate this service</h2>
      <Field label="Your rating" error={err.rating}>
        <div className="mt-1 flex gap-1" role="radiogroup" aria-label="Rating">
          {[1, 2, 3, 4, 5].map((n) => (
            <button type="button" key={n} role="radio" aria-checked={rating === n} aria-label={`${n} star${n > 1 ? 's' : ''}`} onClick={() => setRating(n)}
              className={`text-4xl leading-none ${n <= rating ? 'text-marigold' : 'text-ink/15 hover:text-marigold/60'}`}>★</button>))}
        </div></Field>
      <Field label="Comment (optional)" error={err.comment}><textarea className="input mt-1" rows={3} maxLength={2000} value={comment} onChange={(e) => setComment(e.target.value)} /></Field>
      <button className="btn-primary" disabled={busy}>{busy ? 'Publishing…' : 'Publish review'}</button>
    </form>
  );
}

export default function BookingDetail() {
  const { id } = useParams();
  const { user } = useAuth();
  const toast = useToast();
  const { data, loading, error, reload, setData } = useLoad(() => api.get(`/bookings/${id}`), [id]);
  const [busy, setBusy] = useState('');

  if (loading && !data) return <Spinner />;
  if (error) return <Empty title="Booking unavailable" action={<Link to="/" className="btn-primary btn-sm">Go home</Link>}>{error.message}</Empty>;
  const b = data.booking;
  const isProvider = user.user_id === b.provider_id;
  const isCustomer = user.user_id === b.customer_id;
  const isAdmin = user.role === 'admin';

  const act = async (action, confirmText) => {
    if (confirmText && !window.confirm(confirmText)) return;
    setBusy(action);
    try { const r = await api.post(`/bookings/${id}/${action}`); setData({ booking: r.booking }); toast(r.message); }
    catch (x) { toast(x.message, 'error'); reload(); }
    finally { setBusy(''); }
  };

  const Btn = ({ action, label, cls = 'btn-primary', confirm }) => (
    <button className={`${cls} btn-sm`} disabled={!!busy} onClick={() => act(action, confirm)}>{busy === action ? 'Working…' : label}</button>);
  const can = (...s) => s.includes(b.status);

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_1.1fr]">
      <div className="space-y-5">
        <Link to={isProvider ? '/provider/dashboard' : isAdmin ? '/admin/dashboard' : '/customer/dashboard'} className="text-sm font-semibold text-madder">← Back to dashboard</Link>
        <div className="card p-6">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <h1 className="text-2xl font-extrabold">{iconFor(b.category)} {b.category}</h1><Badge status={b.status} />
          </div>
          <dl className="stitch mt-4 grid grid-cols-[auto_1fr] gap-x-6 gap-y-2 pt-4 text-sm">
            <dt className="text-ink/55">Provider</dt><dd className="font-semibold"><Link className="hover:text-madder" to={`/providers/${b.provider_id}`}>{b.provider_name}</Link></dd>
            <dt className="text-ink/55">Customer</dt><dd className="font-semibold">{b.customer_name}</dd>
            <dt className="text-ink/55">Requested for</dt><dd>{dt(b.requested_datetime)}</dd>
            <dt className="text-ink/55">Price</dt><dd className="font-bold text-indigo">{pkr(b.price)}</dd>
            <dt className="text-ink/55">Payment</dt><dd><Badge status={b.payment_status || 'not_paid'} /></dd>
            <dt className="text-ink/55">Service</dt><dd>{b.service_description}</dd>
            {b.notes && <><dt className="text-ink/55">Notes</dt><dd className="whitespace-pre-line">{b.notes}</dd></>}
          </dl>
          <div className="mt-5 flex flex-wrap gap-2">
            {isProvider && can('pending') && <><Btn action="accept" label="Accept" /><Btn action="reject" label="Decline" cls="btn-danger" confirm="Decline this booking request?" /></>}
            {isProvider && can('accepted') && <Btn action="complete" label="Mark as completed" cls="btn-rose" />}
            {(isProvider || isCustomer) && can('pending', 'accepted') && <Btn action="cancel" label="Cancel booking" cls="btn-ghost" confirm="Cancel this booking? This cannot be undone." />}
            {isCustomer && can('accepted', 'completed') && b.payment_status !== 'mock_paid' && <Link className="btn-rose btn-sm" to={`/bookings/${id}/payment`}>Pay (demo)</Link>}
          </div>
          {isCustomer && can('pending') && <p className="mt-3 text-xs text-ink/55">Waiting for the provider to respond. You can chat once she replies or you can message her now.</p>}
        </div>
        {isCustomer && b.status === 'completed' && (b.review_id ? <p className="card p-4 text-sm text-leaf">You have reviewed this booking. Thank you.</p> : <ReviewForm bookingId={id} onDone={reload} />)}
      </div>
      <div><h2 className="mb-2 text-lg font-bold">Messages</h2>
        <Chat bookingId={id} canWrite={!isAdmin} onBookingStatus={() => reload()} /></div>
    </div>
  );
}
