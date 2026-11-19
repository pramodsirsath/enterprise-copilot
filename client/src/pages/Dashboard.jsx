import { useContext, useState } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { Building2, KeyRound, LogOut, Plus, Users, ArrowRight } from 'lucide-react';
import { AuthContext } from '../context/AuthContext';
import { Backdrop, ErrorBanner, Field, Logo, Spinner } from '../components/ui';
import { api } from '../lib/api';

const MODES = [
  {
    id: 'create',
    icon: Plus,
    title: 'Create an organization',
    text: "You'll be the admin and can upload documents.",
  },
  {
    id: 'join',
    icon: Users,
    title: 'Join with invite code',
    text: 'Ask your admin for the 12-character code.',
  },
];

export default function Dashboard() {
  const { user, login, logout, setOrganization } = useContext(AuthContext);
  const navigate = useNavigate();

  const [mode, setMode] = useState('create');
  const [orgName, setOrgName] = useState('');
  const [inviteCode, setInviteCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  if (user?.orgId) return <Navigate to="/org" replace />;

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      const data =
        mode === 'create'
          ? await api('/api/org/create', { method: 'POST', body: { orgName } })
          : await api('/api/org/join', { method: 'POST', body: { inviteCode } });

      // Server returns a fresh token so the new role/org is reflected everywhere.
      login(data.user, data.token);
      setOrganization(data.organization);
      navigate('/org', { replace: true });
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="relative min-h-screen">
      <Backdrop />
      <header className="relative z-10 mx-auto flex max-w-6xl items-center justify-between px-4 py-5 sm:px-6">
        <Logo />
        <div className="flex items-center gap-3">
          <span className="hidden text-sm text-gray-400 sm:inline">{user?.email}</span>
          <button onClick={logout} className="btn-ghost">
            <LogOut size={16} /> Sign out
          </button>
        </div>
      </header>

      <main className="relative z-10 mx-auto flex max-w-xl flex-col px-4 pb-16 pt-10 sm:pt-16">
        <div className="mb-8 text-center">
          <h1 className="text-3xl font-semibold tracking-tight text-white">Set up your workspace</h1>
          <p className="mt-2 text-gray-400">
            Create a new organization or join your team's existing one.
          </p>
        </div>

        <div className="mb-5 grid gap-3 sm:grid-cols-2">
          {MODES.map(({ id, icon: Icon, title, text }) => {
            const active = mode === id;
            return (
              <button
                key={id}
                type="button"
                onClick={() => {
                  setMode(id);
                  setError('');
                }}
                className={`rounded-2xl border p-4 text-left transition ${
                  active
                    ? 'border-indigo-400/60 bg-indigo-500/10 ring-4 ring-indigo-500/10'
                    : 'border-white/[0.07] bg-white/[0.03] hover:border-white/20'
                }`}
              >
                <div
                  className={`mb-3 grid h-9 w-9 place-items-center rounded-lg ${
                    active ? 'bg-indigo-500 text-white' : 'bg-white/5 text-gray-400'
                  }`}
                >
                  <Icon size={18} />
                </div>
                <div className="font-medium text-white">{title}</div>
                <div className="mt-1 text-xs text-gray-400">{text}</div>
              </button>
            );
          })}
        </div>

        <form onSubmit={handleSubmit} className="card space-y-5 p-6">
          <ErrorBanner>{error}</ErrorBanner>
          {mode === 'create' ? (
            <Field
              key="create"
              label="Organization name"
              icon={Building2}
              value={orgName}
              onChange={(e) => setOrgName(e.target.value)}
              placeholder="Acme Corp"
              maxLength={80}
              autoFocus
              required
            />
          ) : (
            <Field
              key="join"
              label="Invite code"
              icon={KeyRound}
              value={inviteCode}
              onChange={(e) => setInviteCode(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, ''))}
              placeholder="A1B2C3D4E5F6"
              maxLength={12}
              minLength={12}
              className="font-mono tracking-[0.2em]"
              hint={`${inviteCode.length}/12 characters`}
              autoFocus
              required
            />
          )}
          <button type="submit" disabled={loading} className="btn-primary w-full">
            {loading ? (
              <Spinner />
            ) : (
              <>
                {mode === 'create' ? 'Create organization' : 'Join organization'}
                <ArrowRight size={16} />
              </>
            )}
          </button>
        </form>
      </main>
    </div>
  );
}
