import { useContext } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, AuthContext } from './context/AuthContext';
import Login from './pages/Login';
import Signup from './pages/Signup';
import Dashboard from './pages/Dashboard';
import OrgDashboard from './pages/OrgDashboard';

/** Where a signed-in user belongs right now. */
const homeFor = (user) => (user?.orgId ? '/org' : '/dashboard');

const ProtectedRoute = ({ children }) => {
  const { token } = useContext(AuthContext);
  return token ? children : <Navigate to="/login" replace />;
};

const PublicOnlyRoute = ({ children }) => {
  const { token, user } = useContext(AuthContext);
  return token ? <Navigate to={homeFor(user)} replace /> : children;
};

const RootRedirect = () => {
  const { token, user } = useContext(AuthContext);
  return <Navigate to={token ? homeFor(user) : '/login'} replace />;
};

function App() {
  return (
    <AuthProvider>
      <Router>
        <Routes>
          <Route path="/" element={<RootRedirect />} />
          <Route path="/login" element={<PublicOnlyRoute><Login /></PublicOnlyRoute>} />
          <Route path="/signup" element={<PublicOnlyRoute><Signup /></PublicOnlyRoute>} />
          <Route path="/dashboard" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
          <Route path="/org" element={<ProtectedRoute><OrgDashboard /></ProtectedRoute>} />
          <Route path="*" element={<RootRedirect />} />
        </Routes>
      </Router>
    </AuthProvider>
  );
}

export default App;
