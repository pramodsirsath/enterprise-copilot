import { useContext, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Mail, Lock, ArrowRight } from 'lucide-react';
import { AuthContext } from '../context/AuthContext';
import AuthShell from '../components/AuthShell';
import { ErrorBanner, Field, Spinner } from '../components/ui';
import { api } from '../lib/api';

export default function Signup() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const { login } = useContext(AuthContext);
  const navigate = useNavigate();

  const handleSignup = async (e) => {
    e.preventDefault();
    setError('');
    if (password !== confirm) {
      setError('Passwords do not match');
      return;
    }
    setLoading(true);
    try {
      const data = await api('/api/auth/signup', {
        method: 'POST',
        body: { email, password },
        auth: false,
      });
      // Sign the user straight in and continue to onboarding
      login(data.user, data.token);
      navigate('/dashboard', { replace: true });
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthShell
      title="Create your account"
      subtitle="Set up a workspace or join your team in under a minute."
      footer={
        <>
          Already have an account?{' '}
          <Link to="/login" className="font-medium text-indigo-300 hover:text-indigo-200">
            Sign in
          </Link>
        </>
      }
    >
      <form onSubmit={handleSignup} className="space-y-5">
        <ErrorBanner>{error}</ErrorBanner>
        <Field
          label="Work email"
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
          autoComplete="new-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="At least 6 characters"
          minLength={6}
          required
        />
        <Field
          label="Confirm password"
          icon={Lock}
          type="password"
          autoComplete="new-password"
          value={confirm}
          onChange={(e) => setConfirm(e.target.value)}
          placeholder="Repeat password"
          minLength={6}
          required
        />
        <button type="submit" disabled={loading} className="btn-primary w-full">
          {loading ? <Spinner /> : <>Create account <ArrowRight size={16} /></>}
        </button>
      </form>
    </AuthShell>
  );
}
