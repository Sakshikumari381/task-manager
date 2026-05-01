import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../api';
import { useAuth } from '../context/AuthContext';

export default function Projects() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [projects, setProjects] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState({ name: '', description: '' });
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  const load = () => {
    setLoading(true);
    api.get('/projects').then(r => setProjects(r.data)).finally(() => setLoading(false));
  };
  useEffect(load, []);

  const handleCreate = async (e) => {
    e.preventDefault();
    setSaving(true); setError('');
    try {
      await api.post('/projects', form);
      setShowModal(false); setForm({ name: '', description: '' }); load();
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to create project');
    } finally { setSaving(false); }
  };

  const handleDelete = async (id, name) => {
    if (!confirm(`Delete project "${name}"? This will delete all tasks.`)) return;
    await api.delete(`/projects/${id}`);
    load();
  };

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <h1 className="page-title">Projects</h1>
          <p className="page-subtitle">{projects.length} project{projects.length !== 1 ? 's' : ''} total</p>
        </div>
        <button className="btn btn-primary" onClick={() => setShowModal(true)}>+ New Project</button>
      </div>

      {loading ? (
        <div className="loading"><div className="spinner"/>Loading...</div>
      ) : projects.length === 0 ? (
        <div className="empty-state">
          <div className="empty-state-icon">📁</div>
          <h3>No projects yet</h3>
          <p>Create your first project to get started</p>
          <button className="btn btn-primary" style={{marginTop:16}} onClick={() => setShowModal(true)}>
            + New Project
          </button>
        </div>
      ) : (
        <div className="grid-3">
          {projects.map(p => (
            <div key={p.id} className="card" style={{cursor:'pointer'}} onClick={() => navigate(`/projects/${p.id}`)}>
              <div className="card-header">
                <div>
                  <div className="card-title">{p.name}</div>
                  <div className="card-subtitle">by {p.owner_name}</div>
                </div>
                {user?.role === 'admin' && (
                  <button className="btn btn-danger btn-sm" onClick={e => { e.stopPropagation(); handleDelete(p.id, p.name); }}>
                    Delete
                  </button>
                )}
              </div>
              {p.description && (
                <p style={{fontSize:'0.85rem', color:'var(--text-2)', marginBottom:12, lineHeight:1.5}}>
                  {p.description}
                </p>
              )}
              <div style={{display:'flex', gap:16, fontSize:'0.8rem', color:'var(--text-3)'}}>
                <span>📋 {p.task_count} task{p.task_count !== 1 ? 's' : ''}</span>
                <span>👥 {p.member_count} member{p.member_count !== 1 ? 's' : ''}</span>
              </div>
              <div style={{marginTop:10, fontSize:'0.75rem', color:'var(--text-3)', fontFamily:'var(--font-mono)'}}>
                {new Date(p.created_at).toLocaleDateString('en-IN', {day:'numeric', month:'short', year:'numeric'})}
              </div>
            </div>
          ))}
        </div>
      )}

      {showModal && (
        <div className="modal-overlay" onClick={e => e.target === e.currentTarget && setShowModal(false)}>
          <div className="modal">
            <div className="modal-header">
              <h2 className="modal-title">New Project</h2>
              <button className="btn btn-ghost btn-sm" onClick={() => setShowModal(false)}>✕</button>
            </div>
            {error && <div className="alert alert-error">{error}</div>}
            <form onSubmit={handleCreate}>
              <div className="form-group">
                <label className="form-label">Project Name *</label>
                <input className="form-input" value={form.name}
                  onChange={e => setForm(f => ({...f, name: e.target.value}))}
                  required placeholder="e.g. Website Redesign" autoFocus />
              </div>
              <div className="form-group">
                <label className="form-label">Description</label>
                <textarea className="form-textarea" value={form.description}
                  onChange={e => setForm(f => ({...f, description: e.target.value}))}
                  placeholder="What is this project about?" rows={3} />
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={() => setShowModal(false)}>Cancel</button>
                <button type="submit" className="btn btn-primary" disabled={saving}>
                  {saving ? 'Creating...' : 'Create Project'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
