import { useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../lib/api.js';
import { useToast } from '../lib/toast.jsx';
import { useLoad } from '../components/useLoad.js';
import { Badge, Empty, ErrorNote, PageHead, Spinner, Tabs } from '../components/ui.jsx';
import { d } from '../lib/format.js';

function Overview({ go }) {
  const { data, loading, error, reload } = useLoad(() => api.get('/admin/stats'));
  if (loading) return <Spinner />; if (error) return <ErrorNote error={error} retry={reload} />;
  const s = data.stats;
  const tiles = [['Customers', s.customers], ['Providers', s.providers], ['Verified providers', s.verifiedProviders], ['Bookings', s.bookings],
    ['Awaiting verification', s.pendingVerifications, 'verification'], ['Open reports', s.openReports, 'reports']];
  return (
    <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
      {tiles.map(([l, n, tab]) => (
        <button key={l} disabled={!tab} onClick={() => tab && go(tab)} className={`card p-5 text-left ${tab && Number(n) > 0 ? 'border-madder/40' : ''}`}>
          <p className="font-display text-4xl font-extrabold text-indigo">{n}</p><p className="mt-1 text-sm text-ink/60">{l}</p></button>))}
    </div>
  );
}

function Verification() {
  const toast = useToast();
  const [status, setStatus] = useState('pending');
  const [notes, setNotes] = useState({});
  const { data, loading, error, reload } = useLoad(() => api.get('/verification', { status }), [status]);
  const decide = async (id, decision) => {
    try { await api.patch(`/verification/${id}`, { decision, note: notes[id] }); toast(decision === 'approve' ? 'Provider verified.' : 'Request rejected.'); reload(); }
    catch (x) { toast(x.message, 'error'); reload(); }
  };
  const list = data?.requests || [];
  return (
    <div>
      <div className="mb-4 flex gap-2">{['pending', 'approved', 'rejected'].map((s) => <button key={s} aria-pressed={status === s} onClick={() => setStatus(s)} className={`rounded-full border px-3.5 py-1.5 text-sm font-semibold capitalize ${status === s ? 'border-indigo bg-indigo text-white' : 'border-indigo/20'}`}>{s}</button>)}</div>
      {loading ? <Spinner /> : error ? <ErrorNote error={error} retry={reload} /> : list.length === 0 ? <Empty title={`No ${status} requests`} /> : (
        <ul className="space-y-3">{list.map((r) => (
          <li key={r.request_id} className="card p-5">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div><Link to={`/providers/${r.provider_id}`} className="font-display text-lg font-bold hover:text-madder">{r.full_name}</Link><p className="text-sm text-ink/60">{r.email} · {[r.area, r.city].filter(Boolean).join(', ') || 'No location'}</p></div>
              <div className="text-right text-xs text-ink/55"><Badge status={r.status} /><p className="mt-1">Submitted {d(r.submitted_at)}</p></div>
            </div>
            <p className="mt-3 text-sm text-ink/80">{r.bio || <em>No bio written.</em>}</p>
            {r.skills && <p className="mt-1 text-sm text-ink/60">Skills: {r.skills}</p>}
            <p className="mt-1 text-xs text-ink/55">{r.service_count} service(s) · {r.portfolio_count} portfolio image(s)</p>
            {r.status === 'pending' ? (
              <div className="stitch mt-3 flex flex-wrap items-center gap-2 pt-3">
                <input className="input max-w-xs flex-1" placeholder="Note to provider (optional)" value={notes[r.request_id] || ''} onChange={(e) => setNotes({ ...notes, [r.request_id]: e.target.value })} aria-label="Note" />
                <button className="btn-primary btn-sm" onClick={() => decide(r.request_id, 'approve')}>Approve</button>
                <button className="btn-danger btn-sm" onClick={() => decide(r.request_id, 'reject')}>Reject</button>
              </div>) : r.admin_note && <p className="mt-2 text-sm"><strong>Note:</strong> {r.admin_note}</p>}
          </li>))}</ul>)}
    </div>
  );
}

function Reports() {
  const toast = useToast();
  const [status, setStatus] = useState('open');
  const [notes, setNotes] = useState({});
  const { data, loading, error, reload } = useLoad(() => api.get('/reports', { status }), [status]);
  const act = async (id, action) => {
    if (action === 'hide_content' && !window.confirm('Hide this content? For a profile report, the provider is deactivated.')) return;
    try { await api.patch(`/reports/${id}`, { action, note: notes[id] }); toast(action === 'dismiss' ? 'Report dismissed.' : 'Content hidden.'); reload(); } catch (x) { toast(x.message, 'error'); reload(); }
  };
  const list = data?.reports || [];
  return (
    <div>
      <div className="mb-4 flex gap-2">{['open', 'resolved'].map((s) => <button key={s} aria-pressed={status === s} onClick={() => setStatus(s)} className={`rounded-full border px-3.5 py-1.5 text-sm font-semibold capitalize ${status === s ? 'border-indigo bg-indigo text-white' : 'border-indigo/20'}`}>{s}</button>)}</div>
      {loading ? <Spinner /> : error ? <ErrorNote error={error} retry={reload} /> : list.length === 0 ? <Empty title={`No ${status} reports`} /> : (
        <ul className="space-y-3">{list.map((r) => (
          <li key={r.report_id} className="card p-5">
            <div className="flex flex-wrap items-center justify-between gap-2"><p className="font-bold capitalize">{r.target_type} report</p><span className="text-xs text-ink/55">by {r.reporter_name} · {d(r.created_at)}</span></div>
            <p className="mt-2 text-sm"><strong>Reason:</strong> {r.reason}</p>
            <p className="mt-1 rounded-lg bg-indigo-50 p-3 text-sm"><strong>Reported {r.target_type}:</strong> {r.target_preview || <em>not available</em>}</p>
            <div className="mt-2 flex flex-wrap gap-2 text-sm">
              {r.target_type === 'profile' && <Link to={`/providers/${r.target_id}`} className="font-semibold text-madder">Open profile</Link>}</div>
            {r.status === 'open' ? (
              <div className="stitch mt-3 flex flex-wrap items-center gap-2 pt-3">
                <input className="input max-w-xs flex-1" placeholder="Admin note (optional)" aria-label="Note" value={notes[r.report_id] || ''} onChange={(e) => setNotes({ ...notes, [r.report_id]: e.target.value })} />
                <button className="btn-ghost btn-sm" onClick={() => act(r.report_id, 'dismiss')}>Dismiss</button>
                <button className="btn-danger btn-sm" onClick={() => act(r.report_id, 'hide_content')}>Hide content</button>
              </div>) : r.admin_note && <p className="mt-2 text-sm"><strong>Note:</strong> {r.admin_note}</p>}
          </li>))}</ul>)}
    </div>
  );
}

function Users() {
  const toast = useToast();
  const [role, setRole] = useState('');
  const { data, loading, error, reload } = useLoad(() => api.get('/admin/users', { role }), [role]);
  const toggle = async (u) => {
    try { await api.patch(`/admin/users/${u.user_id}/active`, { active: !u.is_active }); toast(u.is_active ? 'Account deactivated.' : 'Account reactivated.'); reload(); } catch (x) { toast(x.message, 'error'); }
  };
  return (
    <div>
      <select className="input mb-4 max-w-[12rem]" value={role} onChange={(e) => setRole(e.target.value)} aria-label="Role"><option value="">All roles</option><option value="customer">Customers</option><option value="provider">Providers</option><option value="admin">Admins</option></select>
      {loading ? <Spinner /> : error ? <ErrorNote error={error} retry={reload} /> : (
        <div className="card overflow-x-auto"><table className="w-full text-left text-sm">
          <thead className="bg-indigo-50 text-xs text-ink/60"><tr><th className="p-3">Name</th><th className="p-3">Email</th><th className="p-3">Role</th><th className="p-3">Joined</th><th className="p-3">Status</th><th /></tr></thead>
          <tbody>{data.users.map((u) => (
            <tr key={u.user_id} className="border-t border-indigo/10"><td className="p-3 font-semibold">{u.full_name}</td><td className="p-3">{u.email}</td><td className="p-3 capitalize">{u.role}</td><td className="p-3">{d(u.created_at)}</td>
              <td className="p-3">{u.is_active ? <Badge status="verified" /> : <Badge status="cancelled" />}</td>
              <td className="p-3 text-right">{u.role !== 'admin' && <button className="btn-ghost btn-sm" onClick={() => toggle(u)}>{u.is_active ? 'Deactivate' : 'Reactivate'}</button>}</td></tr>))}</tbody>
        </table></div>)}
    </div>
  );
}

function Categories() {
  const toast = useToast();
  const { data, loading, reload } = useLoad(() => api.get('/categories'));
  const [f, setF] = useState({ name: '', description: '' });
  const add = async (e) => {
    e.preventDefault();
    try { await api.post('/categories', f); toast('Category added.'); setF({ name: '', description: '' }); reload(); } catch (x) { toast(x.message, 'error'); }
  };
  return (
    <div className="grid gap-6 md:grid-cols-2">
      <form onSubmit={add} className="card h-fit space-y-3 p-5"><h2 className="text-lg font-bold">Add a category</h2>
        <input className="input" placeholder="Name" aria-label="Name" maxLength={50} value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} />
        <input className="input" placeholder="Short description (optional)" aria-label="Description" value={f.description} onChange={(e) => setF({ ...f, description: e.target.value })} />
        <button className="btn-primary">Add category</button></form>
      {loading ? <Spinner /> : <ul className="card divide-y divide-indigo/10">{(data?.categories || []).map((c) => <li key={c.category_id} className="p-3 text-sm"><strong>{c.name}</strong>{c.description && <span className="text-ink/60"> – {c.description}</span>}</li>)}</ul>}
    </div>
  );
}

export default function AdminDashboard() {
  const [tab, setTab] = useState('overview');
  const stats = useLoad(() => api.get('/admin/stats'), [tab]);
  const s = stats.data?.stats;
  return (
    <>
      <PageHead title="Administrator dashboard" />
      <Tabs value={tab} onChange={setTab} tabs={[{ id: 'overview', label: 'Overview' }, { id: 'verification', label: 'Verification', count: Number(s?.pendingVerifications) || 0 },
        { id: 'reports', label: 'Reports', count: Number(s?.openReports) || 0 }, { id: 'users', label: 'Users' }, { id: 'categories', label: 'Categories' }]} />
      {tab === 'overview' && <Overview go={setTab} />}{tab === 'verification' && <Verification />}{tab === 'reports' && <Reports />}
      {tab === 'users' && <Users />}{tab === 'categories' && <Categories />}
    </>
  );
}
