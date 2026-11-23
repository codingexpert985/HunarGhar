import { useEffect, useRef, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { api } from '../lib/api.js';
import { pkr } from '../lib/format.js';

const WELCOME = { from: 'bot', reply: 'Hi! Describe the service you need, for example “I need a tailor in Karachi under 3000”, or ask me how HunarGhar works.' };

export default function Assistant() {
  const [sp] = useSearchParams();
  const [msgs, setMsgs] = useState([WELCOME]);
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const end = useRef(null);
  const started = useRef(false);

  const send = async (t) => {
    const m = t.trim(); if (!m || busy) return;
    setMsgs((x) => [...x, { from: 'me', reply: m }]); setText(''); setBusy(true);
    try { const r = await api.post('/chatbot/message', { message: m }); setMsgs((x) => [...x, { from: 'bot', ...r }]); }
    catch (e) { setMsgs((x) => [...x, { from: 'bot', type: 'fallback', reply: `${e.message} You can still use manual search.`, manualSearch: '/search' }]); }
    finally { setBusy(false); }
  };
  useEffect(() => { const q = sp.get('q'); if (q && !started.current) { started.current = true; send(q); } }, []); // eslint-disable-line
  useEffect(() => { end.current?.scrollIntoView({ behavior: 'smooth', block: 'end' }); }, [msgs]);

  return (
    <div className="mx-auto max-w-2xl">
      <h1 className="text-3xl font-extrabold">Ask the assistant</h1>
      <p className="mb-5 mt-1 text-sm text-ink/65">Describe what you need in your own words. The assistant suggests a category and providers, then you decide.</p>
      <div className="card flex h-[60vh] flex-col">
        <div className="flex-1 space-y-4 overflow-y-auto p-4" aria-live="polite">
          {msgs.map((m, i) => m.from === 'me' ? (
            <div key={i} className="ml-auto w-fit max-w-[85%] rounded-2xl rounded-br-sm bg-indigo px-4 py-2.5 text-sm text-white">{m.reply}</div>
          ) : (
            <div key={i} className="max-w-[92%] space-y-2">
              <div className="w-fit rounded-2xl rounded-bl-sm bg-indigo-50 px-4 py-2.5 text-sm">{m.reply}</div>
              {m.suggestions && (
                <div className="space-y-2 pl-1">
                  {m.suggestions.category && (
                    <p className="text-sm"><Link className="btn-primary btn-sm" to={m.suggestions.searchLink || '/search'}>
                      See {m.suggestions.category}{m.suggestions.city ? ` in ${m.suggestions.city}` : ''}{m.suggestions.maxPrice ? ` under ${pkr(m.suggestions.maxPrice)}` : ''}</Link></p>)}
                  {(m.suggestions.providers || []).map((p) => (
                    <Link key={p.provider_id} to={p.profileLink || `/providers/${p.provider_id}`} className="card block px-4 py-2.5 text-sm hover:border-madder/40">
                      <span className="font-bold">{p.name}</span>{p.city && <span className="text-ink/60"> · {p.city}</span>}{p.avg_rating != null && <span className="text-ink/60"> · ★ {Number(p.avg_rating).toFixed(1)}</span>}
                    </Link>))}
                </div>)}
              {m.type === 'fallback' && <Link to={m.manualSearch || '/search'} className="btn-ghost btn-sm">Use manual search</Link>}
              {m.disclaimer && <p className="text-xs text-ink/50">{m.disclaimer}</p>}
            </div>
          ))}
          {busy && <p className="text-sm text-ink/50">Thinking…</p>}
          <div ref={end} />
        </div>
        <form onSubmit={(e) => { e.preventDefault(); send(text); }} className="stitch flex gap-2 p-3">
          <input className="input" value={text} onChange={(e) => setText(e.target.value)} placeholder="What do you need?" aria-label="Your message" maxLength={500} />
          <button className="btn-primary" disabled={busy || !text.trim()}>Send</button>
        </form>
      </div>
      <p className="mt-3 text-xs text-ink/50">Suggestions are automated and are not a guarantee of quality, availability or safety. Please do not share personal details in this chat.</p>
    </div>
  );
}
