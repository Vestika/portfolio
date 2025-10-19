import { useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { api } from '../shared/api';
import type { PrivateExtensionConfig, ExtensionConfig } from '../shared/types';
import './options.css';

function Options() {
  const [authState, setAuthState] = useState<{ isAuthenticated: boolean; user: any }>({
    isAuthenticated: false,
    user: null,
  });
  const [privateConfigs, setPrivateConfigs] = useState<PrivateExtensionConfig[]>([]);
  const [sharedConfigs, setSharedConfigs] = useState<ExtensionConfig[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    url: '',
    fullPage: true,
    selector: '',
  });

  useEffect(() => {
    checkAuth();
  }, []);

  useEffect(() => {
    if (authState.isAuthenticated) {
      loadData();
    }
  }, [authState.isAuthenticated]);

  async function checkAuth() {
    try {
      const response = await chrome.runtime.sendMessage({ type: 'GET_AUTH_TOKEN' });
      if (response.token) {
        api.setToken(response.token);
        setAuthState({ isAuthenticated: true, user: response.user });
      }
    } catch (err) {
      console.error('Auth check error:', err);
    } finally {
      setLoading(false);
    }
  }

  async function loadData() {
    try {
      const [privateResult, sharedResult] = await Promise.all([
        api.getPrivateConfigs(),
        api.getSharedConfigs(),
        // TODO: Load portfolios when needed for dropdown
        // api.getPortfolios(),
      ]);

      setPrivateConfigs(privateResult.configs || []);
      setSharedConfigs(sharedResult.configs || []);
    } catch (err: any) {
      console.error('Error loading data:', err);
    }
  }

  async function handleCreateSharedConfig(e: React.FormEvent) {
    e.preventDefault();

    try {
      await api.createSharedConfig({
        name: formData.name,
        url: formData.url,
        full_url: formData.fullPage,
        selector: formData.selector || undefined,
        is_public: true,
      });

      setShowCreateForm(false);
      setFormData({ name: '', url: '', fullPage: true, selector: '' });
      loadData();
    } catch (err: any) {
      alert('Error creating configuration: ' + err.message);
    }
  }

  async function handleDeletePrivateConfig(id: string) {
    if (!confirm('Delete this configuration?')) return;

    try {
      await api.deletePrivateConfig(id);
      loadData();
    } catch (err: any) {
      alert('Error deleting configuration: ' + err.message);
    }
  }

  if (loading) {
    return <div className="options"><div className="loading">Loading...</div></div>;
  }

  if (!authState.isAuthenticated) {
    return (
      <div className="options">
        <div className="container">
          <h1>Vestika Extension Settings</h1>
          <p>Please log in to Vestika to manage extension settings.</p>
          <button onClick={() => {
            const vestikaUrl = import.meta.env.VITE_VESTIKA_APP_URL || 'http://localhost:5173';
            chrome.tabs.create({ url: vestikaUrl });
          }}>
            Open Vestika
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="options">
      <div className="container">
        <header>
          <h1>Vestika Extension Settings</h1>
          {authState.user && <p className="user-email">{authState.user.email}</p>}
        </header>

        <section className="section">
          <h2>Your Configurations</h2>
          {privateConfigs.length === 0 ? (
            <p className="empty">No configurations yet. Create one to get started!</p>
          ) : (
            <div className="config-list">
              {privateConfigs.map((config) => (
                <div key={config.id} className="config-card">
                  <div className="config-info">
                    <strong>Portfolio ID:</strong> {config.portfolio_id}
                    <br />
                    <strong>Account ID:</strong> {config.account_id}
                    <br />
                    <strong>Auto-sync:</strong> {config.auto_sync ? 'Yes' : 'No'}
                  </div>
                  <button
                    onClick={() => handleDeletePrivateConfig(config.id!)}
                    className="btn-danger"
                  >
                    Delete
                  </button>
                </div>
              ))}
            </div>
          )}
        </section>

        <section className="section">
          <div className="section-header">
            <h2>Shared Configurations</h2>
            <button onClick={() => setShowCreateForm(!showCreateForm)} className="btn-primary">
              {showCreateForm ? 'Cancel' : 'Create New'}
            </button>
          </div>

          {showCreateForm && (
            <form onSubmit={handleCreateSharedConfig} className="create-form">
              <div className="form-group">
                <label>Name</label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="e.g., Fidelity Portfolio Page"
                  required
                />
              </div>

              <div className="form-group">
                <label>URL Pattern</label>
                <input
                  type="text"
                  value={formData.url}
                  onChange={(e) => setFormData({ ...formData, url: e.target.value })}
                  placeholder="e.g., https://fidelity.com/portfolio/*"
                  required
                />
                <small>Use * for wildcards</small>
              </div>

              <div className="form-group">
                <label>
                  <input
                    type="checkbox"
                    checked={formData.fullPage}
                    onChange={(e) => setFormData({ ...formData, fullPage: e.target.checked })}
                  />
                  Extract full page
                </label>
              </div>

              {!formData.fullPage && (
                <div className="form-group">
                  <label>CSS Selector</label>
                  <input
                    type="text"
                    value={formData.selector}
                    onChange={(e) => setFormData({ ...formData, selector: e.target.value })}
                    placeholder="e.g., table.holdings"
                    required={!formData.fullPage}
                  />
                </div>
              )}

              <button type="submit" className="btn-primary">
                Create Configuration
              </button>
            </form>
          )}

          {sharedConfigs.length === 0 ? (
            <p className="empty">No shared configurations available.</p>
          ) : (
            <div className="config-list">
              {sharedConfigs.map((config) => (
                <div key={config.id} className="config-card">
                  <div className="config-info">
                    <strong>{config.name}</strong>
                    <br />
                    <small>{config.url}</small>
                  </div>
                  <button
                    onClick={() => alert('Link to portfolio (TODO)')}
                    className="btn-secondary"
                  >
                    Use
                  </button>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}

// Mount React app
const container = document.getElementById('root');
if (container) {
  const root = createRoot(container);
  root.render(<Options />);
}
