import { useState } from 'react';
import { Link, useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth, homeFor } from '../lib/auth.jsx';
import { fieldErrors } from '../lib/api.js';
import { Field } from '../components/ui.jsx';

const Shell = ({ title, sub, children, foot }) => (
  <div className="mx-auto grid max-w-4xl overflow-hidden rounded-3xl border border-indigo/10 bg-white md:grid-cols-[2fr_3fr]">
    <div className="hidden bg-indigo p-8 text-white md:block"><h1 className="text-3xl font-extrabold leading-tight">{title}</h1><p className="mt-3 text-white/75">{sub}</p><div className="stitch-draw mt-8 h-[3px] w-24" /></div>
    <div className="p-6 sm:p-10"><h1 className="mb-6 text-2xl font-extrabold md:hidden">{title}</h1>{children}<p className="mt-6 text-sm text-ink/65">{foot}</p></div>
  </div>
);

export function Login() {
  const { login } = useAuth();
  const nav = useNavigate();
  const loc = useLocation();
  const [f, setF] = useState({ email: '', password: '' });
  const [err, setErr] = useState({}); const [msg, setMsg] = useState(''); const [busy, setBusy] = useState(false);
  const submit = async (e) => {
    e.preventDefault(); setBusy(true); setErr({}); setMsg('');
    try { const u = await login(f.email, f.password); nav(loc.state?.from || homeFor(u.role), { replace: true }); }
    catch (x) { setErr(fieldErrors(x)); setMsg(x.message); }
    finally { setBusy(false); }
  };
  return (
    <Shell title="Welcome back" sub="Sign in to manage bookings, chat with providers and leave reviews." foot={<>New here? <Link className="font-semibold text-madder" to="/register">Create an account</Link></>}>
      <form onSubmit={submit} className="space-y-4" noValidate>
        {msg && !err.email && !err.password && <p className="rounded-xl bg-madder-100 px-4 py-3 text-sm text-madder" role="alert">{msg}</p>}
        <Field label="Email" error={err.email}><input type="email" autoComplete="email" className="input mt-1" value={f.email} onChange={(e) => setF({ ...f, email: e.target.value })} /></Field>
        <Field label="Password" error={err.password}><input type="password" autoComplete="current-password" className="input mt-1" value={f.password} onChange={(e) => setF({ ...f, password: e.target.value })} /></Field>
        <button className="btn-primary w-full" disabled={busy}>{busy ? 'Signing in…' : 'Sign in'}</button>
      </form>
    </Shell>
  );
}

export function Register() {
  const { register } = useAuth();
  const nav = useNavigate();
  const [sp] = useSearchParams();
  const [f, setF] = useState({ fullName: '', email: '', password: '', role: sp.get('role') === 'provider' ? 'provider' : 'customer' });
  const [err, setErr] = useState({}); const [msg, setMsg] = useState(''); const [busy, setBusy] = useState(false);
  const submit = async (e) => {
    e.preventDefault(); setBusy(true); setErr({}); setMsg('');
    try { const u = await register(f); nav(homeFor(u.role), { replace: true }); }
    catch (x) { setErr(fieldErrors(x)); setMsg(x.message); }
    finally { setBusy(false); }
  };
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });
  return (
    <Shell title="Join HunarGhar" sub="Hire a skilled woman near you, or list your own skills and start receiving bookings." foot={<>Already registered? <Link className="font-semibold text-madder" to="/login">Sign in</Link></>}>
      <form onSubmit={submit} className="space-y-4" noValidate>
        <fieldset><legend className="label">I want to</legend>
          <div className="grid grid-cols-2 gap-2">
            {[['customer', 'Book services'], ['provider', 'Offer services']].map(([v, l]) => (
              <label key={v} className={`cursor-pointer rounded-xl border-2 px-4 py-3 text-center text-sm font-semibold ${f.role === v ? 'border-indigo bg-indigo-50 text-indigo' : 'border-indigo/15'}`}>
                <input type="radio" name="role" className="sr-only" checked={f.role === v} onChange={() => setF({ ...f, role: v })} />{l}</label>))}
          </div>{err.role && <p className="mt-1 text-xs font-semibold text-madder">{err.role}</p>}
        </fieldset>
        <Field label="Full name" error={err.fullName}><input className="input mt-1" autoComplete="name" value={f.fullName} onChange={set('fullName')} /></Field>
        <Field label="Email" error={err.email}><input type="email" className="input mt-1" autoComplete="email" value={f.email} onChange={set('email')} /></Field>
        <Field label="Password" error={err.password} hint="At least 8 characters."><input type="password" className="input mt-1" autoComplete="new-password" value={f.password} onChange={set('password')} /></Field>
        {msg && !Object.keys(err).length && <p className="rounded-xl bg-madder-100 px-4 py-3 text-sm text-madder" role="alert">{msg}</p>}
        <button className="btn-primary w-full" disabled={busy}>{busy ? 'Creating account…' : 'Create account'}</button>
      </form>
    </Shell>
  );
}
