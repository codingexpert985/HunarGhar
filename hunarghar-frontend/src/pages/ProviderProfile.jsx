import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { api, fieldErrors } from '../lib/api.js';
import { useAuth } from '../lib/auth.jsx';
import { useToast } from '../lib/toast.jsx';
import { useLoad } from '../components/useLoad.js';
import { Avatar, Badge, Empty, ErrorNote, Field, Modal, Spinner, Stars } from '../components/ui.jsx';
import ReportModal from '../components/ReportModal.jsx';
import { d, iconFor, pkr } from '../lib/format.js';

export default function ProviderProfile() {
  const { id } = useParams();
  const { user } = useAuth();
  const nav = useNavigate();
  const toast = useToast();
  const { data, loading, error, reload } = useLoad(() => api.get(`/providers/${id}`), [id]);
  const [book, setBook] = useState(null);
  const [report, setReport] = useState(null);
  const [form, setForm] = useState({ when: '', notes: '' });
  const [errs, setErrs] = useState({});
  const [busy, setBusy] = useState(false);

  if (loading) return <Spinner />;
  if (error) return <Empty title={error.status === 404 ? 'Provider not found' : 'Could not load profile'} action={<Link to="/search" className="btn-primary btn-sm">Back to search</Link>}>{error.message}</Empty>;
  const { provider: p, services, portfolio, reviews } = data;

  const startBooking = (s) => {
    if (!user) return nav('/login', { state: { from: `/providers/${id}` } });
    setErrs({}); setForm({ when: '', notes: '' }); setBook(s);
  };
  const submit = async (e) => {
    e.preventDefault(); setBusy(true); setErrs({});
    try {
      const r = await api.post('/bookings', { serviceId: book.service_id, requestedDatetime: form.when ? new Date(form.when).toISOString() : '', notes: form.notes });
      toast('Booking request sent. The provider will respond soon.');
      nav(`/bookings/${r.booking.booking_id}`);
    } catch (err) { setErrs(fieldErrors(err)); if (!Object.keys(fieldErrors(err)).length) toast(err.message, 'error'); }
    finally { setBusy(false); }
  };

  return (
    <div className="space-y-10">
      <header className="card flex flex-col gap-5 p-6 sm:flex-row sm:items-center">
        <Avatar name={p.full_name} size="h-20 w-20 text-2xl" />
        <div className="flex-1">
          <div className="flex flex-wrap items-center gap-3"><h1 className="text-3xl font-extrabold">{p.full_name}</h1>
            <Badge status={p.verification_status === 'verified' ? 'verified' : p.verification_status === 'pending' ? 'pending' : 'unverified'} /></div>
          <p className="mt-1 text-ink/65">{[p.area, p.city].filter(Boolean).join(', ') || 'Location not set'}</p>
          <div className="mt-2 flex items-center gap-2"><Stars value={p.avg_rating} size="text-xl" /><span className="font-bold">{Number(p.avg_rating || 0).toFixed(1)}</span><span className="text-sm text-ink/55">{p.review_count || 0} reviews</span></div>
        </div>
        {user && user.user_id !== p.provider_id && <button className="btn-ghost btn-sm self-start" onClick={() => setReport({ targetType: 'profile', targetId: p.provider_id, label: 'this profile' })}>Report profile</button>}
      </header>

      {p.verification_status !== 'verified' && (
        <p className="rounded-xl bg-marigold-100 px-4 py-3 text-sm text-marigold-700">This profile has not been verified by HunarGhar yet. Verification and reviews help you decide but do not guarantee quality or safety.</p>
      )}

      <section className="grid gap-8 md:grid-cols-[2fr_1fr]">
        <div><h2 className="mb-2 text-xl font-bold">About</h2><p className="whitespace-pre-line text-ink/80">{p.bio || 'This provider has not added a description yet.'}</p></div>
        {p.skills && <div><h2 className="mb-2 text-xl font-bold">Skills</h2><div className="flex flex-wrap gap-2">{p.skills.split(',').map((s) => <span key={s} className="rounded-full bg-indigo-100 px-3 py-1 text-sm text-indigo">{s.trim()}</span>)}</div></div>}
      </section>

      <section aria-labelledby="svc">
        <h2 id="svc" className="mb-4 text-xl font-bold">Services</h2>
        {services.length === 0 ? <p className="text-sm text-ink/60">No services listed yet.</p> : (
          <div className="grid gap-3 sm:grid-cols-2">
            {services.map((s) => (
              <div key={s.service_id} className="card flex flex-col gap-2 p-5">
                <div className="flex items-start justify-between gap-3"><h3 className="text-lg font-bold">{iconFor(s.category)} {s.category}</h3><span className="font-display text-lg font-extrabold text-indigo">{pkr(s.price)}</span></div>
                <p className="text-sm text-ink/75">{s.description}</p>
                {s.availability && <p className="text-xs text-ink/55">Available: {s.availability}</p>}
                {user?.role === 'customer' || !user ? <button className="btn-primary btn-sm mt-auto self-start" onClick={() => startBooking(s)}>{user ? 'Request booking' : 'Sign in to book'}</button> : null}
              </div>
            ))}
          </div>
        )}
      </section>

      {portfolio.length > 0 && (
        <section aria-labelledby="pf"><h2 id="pf" className="mb-4 text-xl font-bold">Portfolio</h2>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
            {portfolio.map((i) => <img key={i.image_id} src={i.image_url} alt={`Work by ${p.full_name}`} loading="lazy" className="aspect-square w-full rounded-xl object-cover" />)}
          </div></section>
      )}

      <section aria-labelledby="rv">
        <h2 id="rv" className="mb-4 text-xl font-bold">Reviews</h2>
        {reviews.length === 0 ? <p className="text-sm text-ink/60">No reviews yet.</p> : (
          <ul className="space-y-3">{reviews.map((r) => (
            <li key={r.review_id} className="card p-4">
              <div className="flex items-center gap-3"><Stars value={r.rating} /><span className="text-sm font-semibold">{r.customer_name}</span><span className="text-xs text-ink/50">{d(r.created_at)}</span>
                {user && <button className="ml-auto text-xs text-ink/50 underline" onClick={() => setReport({ targetType: 'review', targetId: r.review_id, label: 'this review' })}>Report</button>}</div>
              {r.comment && <p className="mt-2 text-sm text-ink/80">{r.comment}</p>}
            </li>))}</ul>
        )}
      </section>

      {book && (
        <Modal title={`Book ${book.category}`} onClose={() => setBook(null)}>
          <form onSubmit={submit} className="space-y-4" noValidate>
            <p className="text-sm text-ink/70">{p.full_name} · <strong>{pkr(book.price)}</strong></p>
            <Field label="Date and time" error={errs.requestedDatetime}>
              <input type="datetime-local" className="input mt-1" value={form.when} onChange={(e) => setForm({ ...form, when: e.target.value })} />
            </Field>
            <Field label="Notes (optional)" error={errs.notes}>
              <textarea className="input mt-1" rows={3} maxLength={1000} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} placeholder="Measurements, number of guests, subject…" />
            </Field>
            <button className="btn-primary w-full" disabled={busy}>{busy ? 'Sending…' : 'Send booking request'}</button>
          </form>
        </Modal>
      )}
      {report && <ReportModal {...report} onClose={() => setReport(null)} />}
    </div>
  );
}
