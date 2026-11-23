import { useState } from 'react';
import { Link, NavLink, Outlet, useNavigate } from 'react-router-dom';
import { useAuth, homeFor } from '../lib/auth.jsx';

const NAV = {
  visitor: [['/search', 'Find services'], ['/assistant', 'Ask the assistant']],
  customer: [['/search', 'Find services'], ['/customer/dashboard', 'My bookings'], ['/assistant', 'Assistant']],
  provider: [['/provider/dashboard', 'Dashboard'], ['/search', 'Browse'], ['/assistant', 'Assistant']],
  admin: [['/admin/dashboard', 'Admin dashboard'], ['/search', 'Browse']]
};

export default function Layout() {
  const { user, logout } = useAuth();
  const nav = useNavigate();
  const [open, setOpen] = useState(false);
  const links = NAV[user?.role || 'visitor'];
  const linkCls = ({ isActive }) => `hg-nav-link ${isActive ? 'active' : ''}`;

  return (
    <div className="flex min-h-screen flex-col">
      <header className="hg-site-header sticky top-0 z-[1000]">
        <div className="mx-auto flex max-w-6xl items-center gap-4 px-4 py-3">
          <Link to="/" className="flex items-center gap-2 font-display text-xl hg-brand-name">
            <span className="hg-brand-mark">ہ</span>HunarGhar
          </Link>
          <nav className="ml-4 hidden items-center gap-1 md:flex" aria-label="Main">
            {links.map(([to, label]) => <NavLink key={to} to={to} className={linkCls}>{label}</NavLink>)}
          </nav>
          <div className="ml-auto hidden items-center gap-2 md:flex">
            {user ? (
              <>
                <Link to={homeFor(user.role)} className="text-sm font-semibold text-ink/80 hover:text-ink">{user.full_name}</Link>
                <button className="btn-ghost btn-sm" onClick={async () => { await logout(); nav('/'); }}>Sign out</button>
              </>
            ) : (
              <>
                <Link to="/login" className="btn-ghost btn-sm">Sign in</Link>
                <Link to="/register" className="btn-primary btn-sm">Create account</Link>
              </>
            )}
          </div>
          <button className="ml-auto rounded-lg p-2 md:hidden" aria-label="Menu" aria-expanded={open} onClick={() => setOpen(!open)}>
            <span className="block h-0.5 w-6 bg-ink" /><span className="mt-1.5 block h-0.5 w-6 bg-ink" /><span className="mt-1.5 block h-0.5 w-6 bg-ink" />
          </button>
        </div>
        {open && (
          <div className="border-t border-indigo/10 px-4 pb-4 md:hidden" onClick={() => setOpen(false)}>
            <nav className="flex flex-col py-2">{links.map(([to, label]) => <NavLink key={to} to={to} className={linkCls}>{label}</NavLink>)}</nav>
            {user ? <button className="btn-ghost w-full" onClick={async () => { await logout(); nav('/'); }}>Sign out ({user.full_name})</button>
              : <div className="flex gap-2"><Link to="/login" className="btn-ghost flex-1">Sign in</Link><Link to="/register" className="btn-primary flex-1">Create account</Link></div>}
          </div>
        )}
      </header>
      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-8"><Outlet /></main>
      <footer className="border-t border-indigo/10 py-8 text-center text-sm text-ink/55">
        <div className="stitch mx-auto mb-5 w-24" />
        HunarGhar · Home-based women's services · NED University CS-326 project
        <p className="mt-1">Payments on this site are a demonstration only. No real money is moved.</p>
      </footer>
    </div>
  );
}
