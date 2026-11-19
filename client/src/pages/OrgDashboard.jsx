import { useCallback, useContext, useState } from 'react';
import { Navigate } from 'react-router-dom';
import { LogOut, MessageSquare, Library } from 'lucide-react';
import { AuthContext } from '../context/AuthContext';
import { Logo } from '../components/ui';
import ChatPanel from '../components/ChatPanel';
import DocumentsPanel from '../components/DocumentsPanel';
import TeamCard from '../components/TeamCard';

export default function OrgDashboard() {
  const { user, organization, setOrganization, logout } = useContext(AuthContext);
  const [readyCount, setReadyCount] = useState(0);
  const [mobileTab, setMobileTab] = useState('chat');

  const handleDocs = useCallback(
    (docs) => setReadyCount(docs.filter((d) => d.status === 'completed').length),
    []
  );

  if (!user?.orgId) return <Navigate to="/dashboard" replace />;

  const isAdmin = user.role === 'admin';

  return (
    <div className="flex h-[100dvh] flex-col">
      <header className="flex shrink-0 items-center justify-between gap-3 border-b border-white/[0.06] bg-black/20 px-4 py-3 backdrop-blur sm:px-6">
        <div className="flex min-w-0 items-center gap-4">
          <Logo />
          {organization?.name && (
            <>
              <span className="hidden h-5 w-px bg-white/10 sm:block" />
              <span className="hidden truncate text-sm text-gray-300 sm:block">{organization.name}</span>
            </>
          )}
        </div>
        <div className="flex items-center gap-3">
          <div className="hidden text-right md:block">
            <div className="text-sm text-gray-200">{user.email}</div>
          </div>
          <span
            className={`rounded-full px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wide ${
              isAdmin ? 'bg-fuchsia-500/15 text-fuchsia-300' : 'bg-sky-500/15 text-sky-300'
            }`}
          >
            {user.role}
          </span>
          <button onClick={logout} className="icon-btn" title="Sign out">
            <LogOut size={16} />
          </button>
        </div>
      </header>

      {/* Mobile tab switcher */}
      <div className="flex shrink-0 gap-1 border-b border-white/[0.06] p-2 lg:hidden">
        {[
          { id: 'chat', label: 'Chat', icon: MessageSquare },
          { id: 'docs', label: 'Documents', icon: Library },
        ].map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            onClick={() => setMobileTab(id)}
            className={`flex flex-1 items-center justify-center gap-2 rounded-lg py-2 text-sm transition ${
              mobileTab === id ? 'bg-white/10 text-white' : 'text-gray-400'
            }`}
          >
            <Icon size={15} /> {label}
          </button>
        ))}
      </div>

      <main className="mx-auto flex min-h-0 w-full max-w-[1400px] flex-1 gap-4 p-3 sm:p-4">
        <aside
          className={`min-h-0 w-full flex-col gap-4 lg:flex lg:w-[340px] lg:shrink-0 ${
            mobileTab === 'docs' ? 'flex' : 'hidden'
          }`}
        >
          <TeamCard
            isAdmin={isAdmin}
            organization={organization}
            onInviteCodeChange={(inviteCode) => setOrganization((o) => ({ ...o, inviteCode }))}
          />
          <DocumentsPanel isAdmin={isAdmin} onDocumentsChange={handleDocs} />
        </aside>

        <div className={`min-h-0 flex-1 flex-col lg:flex ${mobileTab === 'chat' ? 'flex' : 'hidden'}`}>
          <ChatPanel orgId={user.orgId} orgName={organization?.name} readyCount={readyCount} />
        </div>
      </main>
    </div>
  );
}
