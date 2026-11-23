import { useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../lib/api.js';
import { useLoad } from './useLoad.js';
import { Badge, Empty, ErrorNote, Spinner } from './ui.jsx';
import { dt, iconFor, pkr } from '../lib/format.js';

const FILTERS = ['', 'pending', 'accepted', 'completed', 'rejected', 'cancelled'];

export default function BookingList({ role }) {
  const [status, setStatus] = useState('');
  const { data, loading, error, reload } = useLoad(() => api.get('/bookings', { status }), [status]);
  const list = data?.bookings || [];
  return (
    <div>
      <div className="mb-4 flex flex-wrap gap-2" role="group" aria-label="Filter by status">
        {FILTERS.map((s) => (
          <button key={s} onClick={() => setStatus(s)} aria-pressed={status === s}
            className={`rounded-full border px-3.5 py-1.5 text-sm font-semibold capitalize ${status === s ? 'border-indigo bg-indigo text-white' : 'border-indigo/20 text-ink/70'}`}>{s || 'All'}</button>))}
      </div>
      {loading ? <Spinner /> : error ? <ErrorNote error={error} retry={reload} /> : list.length === 0 ? (
        <Empty title="No bookings here yet" action={role === 'customer' ? <Link to="/search" className="btn-primary btn-sm">Find a service</Link> : null}>
          {role === 'customer' ? 'When you request a service, it will appear here with its live status.' : 'Booking requests from customers will appear here.'}
        </Empty>
      ) : (
        <ul className="space-y-3">
          {list.map((b) => (
            <li key={b.booking_id}>
              <Link to={`/bookings/${b.booking_id}`} className="card flex flex-wrap items-center gap-x-6 gap-y-2 p-4 transition hover:border-madder/40">
                <div className="min-w-[10rem] flex-1">
                  <p className="font-display text-lg font-bold">{iconFor(b.category)} {b.category}</p>
                  <p className="text-sm text-ink/65">{role === 'provider' ? `Customer: ${b.customer_name}` : `Provider: ${b.provider_name}`}</p>
                </div>
                <p className="text-sm text-ink/70">{dt(b.requested_datetime)}</p>
                <p className="font-semibold text-indigo">{pkr(b.price)}</p>
                <div className="flex items-center gap-2"><Badge status={b.status} />{b.payment_status === 'mock_paid' && <Badge status="mock_paid" />}</div>
              </Link>
            </li>))}
        </ul>
      )}
    </div>
  );
}
