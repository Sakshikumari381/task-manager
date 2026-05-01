import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export default function Login() {
  const [form, setForm] = useState({ email: '', password: '' });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { login } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true); setError('');
    try {
      await login(form.email, form.password);
      navigate('/dashboard');
    } catch (err) {
      setError(err.response?.data?.error || 'Login failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-page">
      <div className="auth-card">
        <div className="auth-logo">
        
          <h1>TaskFlow</h1>
        </div>
        <h2 className="auth-title">Welcome back</h2>
        <p className="auth-subtitle">Sign in to your workspace</p>
        {error && <div className="alert alert-error">{error}</div>}
        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label className="form-label">Email</label>
            <input className="form-input" type="email" value={form.email}
              onChange={e => setForm(f => ({...f, email: e.target.value}))}
              required placeholder="you@example.com" autoFocus />
          </div>
          <div className="form-group">
            <label className="form-label">Password</label>
            <input className="form-input" type="password" value={form.password}
              onChange={e => setForm(f => ({...f, password: e.target.value}))}
              required placeholder="••••••••" />
          </div>
          <button type="submit" className="btn btn-primary" style={{width:'100%', justifyContent:'center', padding:'11px'}} disabled={loading}>
            {loading ? 'Signing in...' : 'Sign in'}
          </button>
        </form>
        <div className="auth-footer">
          No account? <Link to="/signup">Create one</Link>
        </div>
        <div className="divider" style={{marginTop: 20}}/>
        <div style={{textAlign:'center'}}>
          <p style={{fontSize:'0.78rem', color:'var(--text-3)', marginBottom: 8}}>Demo credentials</p>
          <div style={{display:'flex', gap:8, justifyContent:'center', flexWrap:'wrap'}}>
            <button className="btn btn-secondary btn-sm" onClick={() => setForm({email:'admin@demo.com', password:'demo123'})}>
              Admin demo
            </button>
            <button className="btn btn-secondary btn-sm" onClick={() => setForm({email:'member@demo.com', password:'demo123'})}>
              Member demo
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
