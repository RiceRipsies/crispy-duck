import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './contexts/AuthContext.jsx';
import Login from './pages/Login.jsx';
import Cashier from './pages/Cashier.jsx';
import Kitchen from './pages/Kitchen.jsx';
import Admin from './pages/Admin.jsx';

function RoleRoute({ roles, children }) {
  const { user } = useAuth();
  if (user === undefined) return <div className="flex items-center justify-center min-h-screen text-gray-400">Loading…</div>;
  if (!user) return <Navigate to="/login" replace />;
  if (!roles.includes(user.role)) return <Navigate to="/" replace />;
  return children;
}

function DefaultRedirect() {
  const { user } = useAuth();
  if (user === undefined) return null;
  if (!user) return <Navigate to="/login" replace />;
  if (user.role === 'kitchen') return <Navigate to="/kitchen" replace />;
  if (user.role === 'admin') return <Navigate to="/admin" replace />;
  return <Navigate to="/cashier" replace />;
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/cashier" element={<RoleRoute roles={['cashier', 'admin']}><Cashier /></RoleRoute>} />
          <Route path="/kitchen" element={<RoleRoute roles={['kitchen', 'admin']}><Kitchen /></RoleRoute>} />
          <Route path="/admin" element={<RoleRoute roles={['admin']}><Admin /></RoleRoute>} />
          <Route path="*" element={<DefaultRedirect />} />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  );
}
