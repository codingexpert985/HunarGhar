import { initials } from '../lib/format.js';

export const Spinner = ({ label = 'Loading…' }) => (
  <div className="flex items-center justify-center gap-3 py-16 text-sm text-ink/60" role="status">
    <span className="h-5 w-5 animate-spin rounded-full border-2 border-indigo/20 border-t-indigo" />{label}
  </div>
);

export function Stars({ value = 0, size = 'text-base' }) {
  const v = Number(value) || 0;
  return (
    <span className={`inline-flex ${size} leading-none`} aria-label={`${v.toFixed(1)} out of 5`}>
      {[1, 2, 3, 4, 5].map((i) => (
        <span key={i} className={i <= Math.round(v) ? 'text-marigold' : 'text-ink/15'}>★</span>
      ))}
    </span>
  );
}

const TONES = {
  pending: 'bg-marigold-100 text-marigold-700', accepted: 'bg-indigo-100 text-indigo', completed: 'bg-leaf-100 text-leaf',
  rejected: 'bg-madder-100 text-madder', cancelled: 'bg-ink/10 text-ink/60',
  verified: 'bg-leaf-100 text-leaf', unverified: 'bg-ink/10 text-ink/60',
  mock_paid: 'bg-leaf-100 text-leaf', not_paid: 'bg-ink/10 text-ink/60', open: 'bg-madder-100 text-madder', resolved: 'bg-leaf-100 text-leaf',
  approved: 'bg-leaf-100 text-leaf'
};
const LABELS = { mock_paid: 'Paid (demo)', not_paid: 'Not paid', verified: 'Verified', unverified: 'Not verified', pending: 'Pending' };

export const Badge = ({ status }) => (
  <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold capitalize ${TONES[status] || 'bg-ink/10'}`}>
    {status === 'verified' && <span className="mr-1">✓</span>}{LABELS[status] || status}
  </span>
);

export const Avatar = ({ name, size = 'h-12 w-12 text-base' }) => (
  <span className={`${size} grid shrink-0 place-items-center rounded-full bg-indigo font-display font-bold text-white`} aria-hidden>{initials(name)}</span>
);

export const Empty = ({ title, children, action }) => (
  <div className="stitch-frame mx-auto my-8 max-w-lg rounded-2xl p-8 text-center">
    <p className="font-display text-lg font-bold">{title}</p>
    {children && <p className="mt-1 text-sm text-ink/65">{children}</p>}
    {action && <div className="mt-4 flex flex-wrap justify-center gap-2">{action}</div>}
  </div>
);

export const ErrorNote = ({ error, retry }) => !error ? null : (
  <div className="my-4 rounded-xl border border-madder/30 bg-madder-100 px-4 py-3 text-sm text-madder" role="alert">
    {error.message || String(error)}
    {retry && <button onClick={retry} className="ml-3 font-semibold underline">Try again</button>}
  </div>
);

export const Field = ({ label, error, children, hint }) => (
  <div>
    <label className="label">{label}{children}</label>
    {hint && !error && <p className="mt-1 text-xs text-ink/55">{hint}</p>}
    {error && <p className="mt-1 text-xs font-semibold text-madder" role="alert">{error}</p>}
  </div>
);

export const PageHead = ({ title, children }) => (
  <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
    <h1 className="text-3xl font-extrabold">{title}</h1>{children}
  </div>
);

export function Tabs({ tabs, value, onChange }) {
  return (
    <div className="mb-6 flex gap-1 overflow-x-auto border-b border-indigo/10" role="tablist">
      {tabs.map((t) => (
        <button key={t.id} role="tab" aria-selected={value === t.id} onClick={() => onChange(t.id)}
          className={`whitespace-nowrap border-b-2 px-4 py-2.5 text-sm font-semibold ${value === t.id ? 'border-madder text-ink' : 'border-transparent text-ink/55 hover:text-ink'}`}>
          {t.label}{t.count ? <span className="ml-2 rounded-full bg-madder px-1.5 py-0.5 text-[11px] text-white">{t.count}</span> : null}
        </button>
      ))}
    </div>
  );
}

export function Modal({ title, onClose, children }) {
  return (
    <div className="fixed inset-0 z-[1500] grid place-items-center bg-ink/50 p-4" onClick={onClose}>
      <div role="dialog" aria-modal="true" aria-label={title} className="card w-full max-w-md p-6 shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="mb-4 flex items-start justify-between gap-4">
          <h2 className="text-xl font-bold">{title}</h2>
          <button onClick={onClose} aria-label="Close" className="text-2xl leading-none text-ink/50 hover:text-ink">×</button>
        </div>
        {children}
      </div>
    </div>
  );
}

export const useAsyncState = () => null;
