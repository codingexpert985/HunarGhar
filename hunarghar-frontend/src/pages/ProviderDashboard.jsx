import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api, fieldErrors } from '../lib/api.js';
import { useToast } from '../lib/toast.jsx';
import { useLoad } from '../components/useLoad.js';
import { Badge, ErrorNote, Field, PageHead, Spinner, Tabs } from '../components/ui.jsx';
import BookingList from '../components/BookingList.jsx';
import { CITIES, d, iconFor, pkr } from '../lib/format.js';

function ProfileTab({ me, reload }) {
  const toast = useToast();
  const p = me.profile;
  const [f, setF] = useState({ bio: p.bio || '', skills: p.skills || '', city: p.city || '', area: p.area || '' });
  const [err, setErr] = useState({}); const [busy, setBusy] = useState(false);
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });
  const save = async (e) => {
    e.preventDefault(); setBusy(true); setErr({});
    try { await api.put('/providers/me', f); toast('Profile saved.'); reload(); } catch (x) { setErr(fieldErrors(x)); toast(x.message, 'error'); } finally { setBusy(false); }
  };
  return (
    <form onSubmit={save} className="card max-w-2xl space-y-4 p-6">
      <Field label="About you" error={err.bio} hint="Describe your skills and experience. Customers read this first."><textarea className="input mt-1" rows={5} maxLength={2000} value={f.bio} onChange={set('bio')} /></Field>
      <Field label="Skills" hint="Separate with commas, e.g. Bridal stitching, Alterations, Embroidery"><input className="input mt-1" value={f.skills} onChange={set('skills')} /></Field>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="City" error={err.city} hint="Only the city is shown on the map, never your address.">
          <input list="pcities" className="input mt-1" value={f.city} onChange={set('city')} /><datalist id="pcities">{CITIES.map((c) => <option key={c} value={c} />)}</datalist></Field>
        <Field label="Area" error={err.area}><input className="input mt-1" value={f.area} onChange={set('area')} placeholder="e.g. Gulshan-e-Iqbal" /></Field>
      </div>
      <button className="btn-primary" disabled={busy}>{busy ? 'Saving…' : 'Save profile'}</button>
    </form>
  );
}

function ServicesTab({ services, reload }) {
  const toast = useToast();
  const cats = useLoad(() => api.get('/categories'));
  const blank = { category: '', description: '', price: '', availability: '' };
  const [f, setF] = useState(blank); const [editing, setEditing] = useState(null);
  const [err, setErr] = useState({}); const [busy, setBusy] = useState(false);
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });
  const save = async (e) => {
    e.preventDefault(); setBusy(true); setErr({});
    try {
      editing ? await api.put(`/services/${editing}`, f) : await api.post('/services', f);
      toast(editing ? 'Service updated.' : 'Service added.'); setF(blank); setEditing(null); reload();
    } catch (x) { setErr(fieldErrors(x)); if (!Object.keys(fieldErrors(x)).length) toast(x.message, 'error'); } finally { setBusy(false); }
  };
  const remove = async (s) => {
    if (!window.confirm(`Remove your ${s.category} listing?`)) return;
    try { await api.del(`/services/${s.service_id}`); toast('Service removed.'); reload(); } catch (x) { toast(x.message, 'error'); }
  };
  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_1.2fr]">
      <form onSubmit={save} className="card h-fit space-y-4 p-6" noValidate>
        <h2 className="text-lg font-bold">{editing ? 'Edit service' : 'Add a service'}</h2>
        <Field label="Category" error={err.category}><select className="input mt-1" value={f.category} onChange={set('category')}><option value="">Choose…</option>{(cats.data?.categories || []).map((c) => <option key={c.category_id}>{c.name}</option>)}</select></Field>
        <Field label="Description" error={err.description}><textarea className="input mt-1" rows={3} value={f.description} onChange={set('description')} placeholder="What exactly do you offer?" /></Field>
        <Field label="Price (PKR)" hint="Between PKR 700 and PKR 9,000" error={err.price}><input type="number" min="700" max="9000" className="input mt-1" value={f.price} onChange={set('price')} /></Field>
        <Field label="Availability" hint="e.g. Mon–Sat, 10am–6pm"><input className="input mt-1" maxLength={255} value={f.availability} onChange={set('availability')} /></Field>
        <div className="flex gap-2"><button className="btn-primary" disabled={busy}>{busy ? 'Saving…' : editing ? 'Save changes' : 'Add service'}</button>
          {editing && <button type="button" className="btn-ghost" onClick={() => { setEditing(null); setF(blank); setErr({}); }}>Cancel</button>}</div>
      </form>
      <div className="space-y-3">
        {services.length === 0 && <p className="stitch-frame rounded-2xl p-6 text-center text-sm text-ink/60">You have not listed any services. Add your first one so customers can book you.</p>}
        {services.map((s) => (
          <div key={s.service_id} className="card flex flex-wrap items-start gap-3 p-4">
            <div className="min-w-0 flex-1"><p className="font-display text-lg font-bold">{iconFor(s.category)} {s.category}</p><p className="text-sm text-ink/70">{s.description}</p>{s.availability && <p className="mt-1 text-xs text-ink/50">{s.availability}</p>}</div>
            <div className="text-right"><p className="font-bold text-indigo">{pkr(s.price)}</p>
              <div className="mt-2 flex gap-2"><button className="btn-ghost btn-sm" onClick={() => { setEditing(s.service_id); setF({ category: s.category, description: s.description, price: s.price, availability: s.availability || '' }); window.scrollTo({ top: 0, behavior: 'smooth' }); }}>Edit</button>
                <button className="btn-danger btn-sm" onClick={() => remove(s)}>Remove</button></div></div>
          </div>))}
      </div>
    </div>
  );
}

function PortfolioTab({ portfolio, reload }) {
  const toast = useToast();
  const [busy, setBusy] = useState(false);
  const upload = async (e) => {
    const file = e.target.files[0]; e.target.value = '';
    if (!file) return;
    if (!/^image\/(jpe?g|png|webp)$/.test(file.type)) return toast('Please choose a JPG, PNG or WebP image.', 'error');
    if (file.size > 5 * 1024 * 1024) return toast('Image is larger than 5 MB.', 'error');
    const fd = new FormData(); fd.append('image', file);
    setBusy(true);
    try { await api.upload('/providers/me/portfolio', fd); toast('Image uploaded.'); reload(); } catch (x) { toast(x.message, 'error'); } finally { setBusy(false); }
  };
  const remove = async (id) => { try { await api.del(`/providers/me/portfolio/${id}`); toast('Image removed.'); reload(); } catch (x) { toast(x.message, 'error'); } };
  return (
    <div>
      <label className={`btn-primary cursor-pointer ${busy ? 'opacity-60' : ''}`}>{busy ? 'Uploading…' : 'Upload an image'}<input type="file" accept="image/jpeg,image/png,image/webp" className="sr-only" onChange={upload} disabled={busy} /></label>
      <p className="mt-2 text-xs text-ink/55">JPG, PNG or WebP, up to 5 MB each. Up to 12 images.</p>
      {portfolio.length === 0 ? <p className="stitch-frame mt-6 rounded-2xl p-8 text-center text-sm text-ink/60">Photos of your finished work help customers trust your profile.</p> : (
        <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
          {portfolio.map((i) => (<div key={i.image_id} className="group relative"><img src={i.image_url} alt="Portfolio" className="aspect-square w-full rounded-xl object-cover" />
            <button onClick={() => remove(i.image_id)} className="absolute right-2 top-2 rounded-full bg-ink/80 px-2.5 py-1 text-xs font-semibold text-white">Remove</button></div>))}
        </div>)}
    </div>
  );
}

function VerificationTab({ me, reload }) {
  const toast = useToast();
  const [busy, setBusy] = useState(false);
  const st = me.profile.verification_status; const v = me.latestVerification;
  const request = async () => {
    setBusy(true);
    try { await api.post('/verification/request'); toast('Verification request submitted.'); reload(); } catch (x) { toast(x.message, 'error'); } finally { setBusy(false); }
  };
  const msg = { unverified: 'Submit your profile for review to earn the verified badge.', pending: 'An administrator is reviewing your profile.', verified: 'Your profile is verified. The badge shows on your profile and in search results.', rejected: 'Your last request was not approved. Update your profile using the note below, then submit again.' }[st];
  return (
    <div className="card max-w-xl space-y-4 p-6">
      <div className="flex items-center gap-3"><h2 className="text-lg font-bold">Verification status</h2><Badge status={st} /></div>
      <p className="text-sm text-ink/75">{msg}</p>
      {v?.admin_note && <p className="rounded-xl bg-indigo-50 p-3 text-sm"><strong>Administrator note:</strong> {v.admin_note}</p>}
      {v && <p className="text-xs text-ink/50">Last request submitted {d(v.submitted_at)}{v.reviewed_at ? `, reviewed ${d(v.reviewed_at)}` : ''}.</p>}
      {(st === 'unverified' || st === 'rejected') && <button className="btn-rose" onClick={request} disabled={busy}>{busy ? 'Submitting…' : 'Request verification'}</button>}
      {(st === 'unverified' || st === 'rejected') && !(me.profile.bio && me.profile.city) && <p className="text-xs text-madder">Add your bio and city in the Profile tab first.</p>}
    </div>
  );
}

export default function ProviderDashboard() {
  const [tab, setTab] = useState('bookings');
  const me = useLoad(() => api.get('/providers/me'));
  const pending = useLoad(() => api.get('/bookings', { status: 'pending' }));
  if (me.loading && !me.data) return <Spinner />;
  if (me.error) return <ErrorNote error={me.error} retry={me.reload} />;
  const { profile, services, portfolio } = me.data;
  const incomplete = !profile.bio || !profile.city || services.length === 0;
  return (
    <>
      <PageHead title="Provider dashboard"><div className="flex items-center gap-2"><Badge status={profile.verification_status === 'verified' ? 'verified' : profile.verification_status} />
        <Link to={`/providers/${profile.provider_id}`} className="btn-ghost btn-sm">View public profile</Link></div></PageHead>
      {incomplete && <p className="mb-6 rounded-xl bg-marigold-100 px-4 py-3 text-sm text-marigold-700">Finish setting up: add a bio and city{services.length === 0 ? ', and list at least one service' : ''} so customers can find and book you.</p>}
      <Tabs value={tab} onChange={setTab} tabs={[
        { id: 'bookings', label: 'Bookings', count: pending.data?.bookings?.length }, { id: 'profile', label: 'Profile' }, { id: 'services', label: 'Services' },
        { id: 'portfolio', label: 'Portfolio' }, { id: 'verification', label: 'Verification' }]} />
      {tab === 'bookings' && <BookingList role="provider" />}
      {tab === 'profile' && <ProfileTab me={me.data} reload={me.reload} />}
      {tab === 'services' && <ServicesTab services={services} reload={me.reload} />}
      {tab === 'portfolio' && <PortfolioTab portfolio={portfolio} reload={me.reload} />}
      {tab === 'verification' && <VerificationTab me={me.data} reload={me.reload} />}
    </>
  );
}
