import { useContext, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Mail, Lock, ArrowRight } from 'lucide-react';
import { AuthContext } from '../context/AuthContext';
import AuthShell from '../components/AuthShell';
import { ErrorBanner, Field, Spinner } from '../components/ui';
import { api } from '../lib/api';

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const { login } = useContext(AuthContext);
  const navigate = useNavigate();

  const handleLogin = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      const data = await api('/api/auth/login', {
        method: 'POST',
        body: { email, password },
        auth: false,
      });
      login(data.user, data.token);
      navigate(data.user.orgId ? '/org' : '/dashboard', { replace: true });
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthShell
      title="Welcome back"
      subtitle="Sign in to chat with your organization's knowledge."
      footer={
        <>
          Don't have an account?{' '}
          <Link to="/signup" className="font-medium text-indigo-300 hover:text-indigo-200">
            Create one
          </Link>
        </>
      }
    >
      <form onSubmit={handleLogin} className="space-y-5">
        <ErrorBanner>{error}</ErrorBanner>
        <Field
          label="Email"
          icon={Mail}
          type="email"
          autoComplete="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="you@company.com"
          required
        />
        <Field
          label="Password"
          icon={Lock}
          type="password"
          autoComplete="current-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="••••••••"
          required
        />
        <button type="submit" disabled={loading} className="btn-primary w-full">
          {loading ? <Spinner /> : <>Sign in <ArrowRight size={16} /></>}
        </button>
      </form>
    </AuthShell>
  );
}
