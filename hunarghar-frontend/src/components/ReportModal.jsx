import { useState } from 'react';
import { api, fieldErrors } from '../lib/api.js';
import { useToast } from '../lib/toast.jsx';
import { Field, Modal } from './ui.jsx';

export default function ReportModal({ targetType, targetId, label, onClose }) {
  const [reason, setReason] = useState('');
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  const toast = useToast();
  const submit = async (e) => {
    e.preventDefault(); setBusy(true); setErr('');
    try { await api.post('/reports', { targetType, targetId, reason }); toast('Report sent to the administrators.'); onClose(); }
    catch (x) { setErr(fieldErrors(x).reason || x.message); }
    finally { setBusy(false); }
  };
  return (
    <Modal title={`Report ${label}`} onClose={onClose}>
      <form onSubmit={submit} className="space-y-4">
        <Field label="What is wrong?" error={err}><textarea className="input mt-1" rows={4} maxLength={1000} value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Describe the problem so an administrator can review it." /></Field>
        <button className="btn-rose w-full" disabled={busy}>{busy ? 'Sending…' : 'Send report'}</button>
      </form>
    </Modal>
  );
}
