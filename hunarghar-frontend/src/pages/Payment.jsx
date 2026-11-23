import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { api } from '../lib/api.js';
import { useToast } from '../lib/toast.jsx';
import { useLoad } from '../components/useLoad.js';
import { Badge, Empty, Spinner } from '../components/ui.jsx';
import { d, pkr } from '../lib/format.js';

export default function Payment() {
  const { id } = useParams();
  const nav = useNavigate();
  const toast = useToast();
  const { data, loading, error, setData } = useLoad(() => api.get(`/payments/booking/${id}`), [id]);
  const [busy, setBusy] = useState(false);
  if (loading) return <Spinner />;
  if (error) return <Empty title="Payment page unavailable" action={<Link to={`/bookings/${id}`} className="btn-primary btn-sm">Back to booking</Link>}>{error.message}</Empty>;
  const p = data.payment;
  const paid = p.payment_status === 'mock_paid';

  const confirm = async () => {
    setBusy(true);
    try { const r = await api.post(`/payments/booking/${id}/confirm`, { confirm: true }); setData({ payment: r.payment }); toast('Demo payment recorded.'); }
    catch (x) { toast(x.message, 'error'); } finally { setBusy(false); }
  };

  return (
    <div className="mx-auto max-w-md">
      <div className="mb-4 rounded-xl border-2 border-dashed border-marigold bg-marigold-100 px-4 py-3 text-sm font-semibold text-marigold-700" role="note">
        DEMONSTRATION ONLY. {p.notice || 'No real money is transferred.'}
      </div>
      <div className="card p-6">
        <h1 className="text-2xl font-extrabold">Demo payment</h1>
        <dl className="stitch mt-4 grid grid-cols-[auto_1fr] gap-x-6 gap-y-2 pt-4 text-sm">
          <dt className="text-ink/55">Service</dt><dd className="font-semibold">{p.service}</dd>
          <dt className="text-ink/55">Provider</dt><dd className="font-semibold">{p.provider}</dd>
          <dt className="text-ink/55">Status</dt><dd><Badge status={p.payment_status} /></dd>
          {paid && <><dt className="text-ink/55">Recorded</dt><dd>{d(p.paid_at)}</dd></>}
        </dl>
        <p className="stitch mt-4 flex items-baseline justify-between pt-4"><span className="text-sm text-ink/60">Booking amount</span><span className="font-display text-3xl font-extrabold text-indigo">{pkr(p.amount)}</span></p>
        {paid ? (
          <div className="mt-6 rounded-xl bg-leaf-100 p-4 text-sm text-leaf"><strong>Simulated payment recorded.</strong> This was a demo receipt; no funds were moved.</div>
        ) : (
          <div className="mt-6 flex gap-2">
            <button className="btn-rose flex-1" onClick={confirm} disabled={busy}>{busy ? 'Recording…' : 'Confirm demo payment'}</button>
            <button className="btn-ghost" onClick={() => nav(`/bookings/${id}`)} disabled={busy}>Cancel</button>
          </div>)}
        {paid && <Link to={`/bookings/${id}`} className="btn-primary mt-4 w-full">Back to booking</Link>}
      </div>
    </div>
  );
}
