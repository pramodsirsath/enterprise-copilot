import { useEffect, useState } from 'react';
import { Check, Copy, RefreshCw, Users } from 'lucide-react';
import { api } from '../lib/api';
import { Spinner } from './ui';

export default function TeamCard({ isAdmin, organization, onInviteCodeChange }) {
  const [members, setMembers] = useState([]);
  const [copied, setCopied] = useState(false);
  const [rotating, setRotating] = useState(false);

  useEffect(() => {
    api('/api/org/members')
      .then((d) => setMembers(d.members))
      .catch(() => {});
  }, []);

  const code = organization?.inviteCode;

  const copy = () => {
    navigator.clipboard?.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  const rotate = async () => {
    if (!window.confirm('Generate a new invite code? The old one will stop working.')) return;
    setRotating(true);
    try {
      const d = await api('/api/org/invite-code', { method: 'POST' });
      onInviteCodeChange(d.inviteCode);
    } catch (err) {
      alert(err.message);
    } finally {
      setRotating(false);
    }
  };

  return (
    <section className="card p-4">
      <div className="flex items-center justify-between">
        <h2 className="flex items-center gap-2 text-sm font-semibold text-white">
          <Users size={15} className="text-gray-400" /> Team
        </h2>
        <span className="text-xs text-gray-500">
          {members.length} member{members.length === 1 ? '' : 's'}
        </span>
      </div>

      {isAdmin && code && (
        <div className="mt-3">
          <div className="mb-1.5 text-xs text-gray-500">Invite code</div>
          <div className="flex items-center gap-1 rounded-xl border border-white/10 bg-black/30 py-1 pl-3 pr-1">
            <code className="flex-1 font-mono text-sm tracking-[0.18em] text-white">{code}</code>
            <button className="icon-btn" onClick={copy} title="Copy invite code">
              {copied ? <Check size={14} className="text-emerald-300" /> : <Copy size={14} />}
            </button>
            <button className="icon-btn" onClick={rotate} disabled={rotating} title="Generate new code">
              {rotating ? <Spinner size={14} /> : <RefreshCw size={14} />}
            </button>
          </div>
          <p className="mt-1.5 text-[11px] text-gray-500">Share this with teammates so they can join.</p>
        </div>
      )}

      {members.length > 0 && (
        <ul className="scroll-thin mt-3 max-h-32 space-y-1.5 overflow-y-auto">
          {members.map((m) => (
            <li key={m._id} className="flex items-center gap-2 text-xs">
              <div className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-white/10 text-[10px] font-semibold uppercase text-gray-300">
                {m.email[0]}
              </div>
              <span className="min-w-0 flex-1 truncate text-gray-300">{m.email}</span>
              {m.role === 'admin' && (
                <span className="rounded bg-fuchsia-500/10 px-1.5 py-0.5 text-[10px] font-medium text-fuchsia-300">
                  Admin
                </span>
              )}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
