import React, { useState, useEffect } from 'react';
import { Settings, User, Shield, Cpu, Key, Save, X, Eye, EyeOff, CheckCircle } from 'lucide-react';
import { UserProfile, fetchProfile, saveProfile, fetchSettings, saveSettings } from '../services/api';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const SettingsModal: React.FC<SettingsModalProps> = ({ isOpen, onClose }) => {
  const [activeTab, setActiveTab] = useState<'ai' | 'profile' | 'security'>('ai');
  const [showApiKey, setShowApiKey] = useState(false);

  // Settings state
  const [provider, setProvider] = useState('heuristic');
  const [apiKey, setApiKey] = useState('');
  const [modelName, setModelName] = useState('gpt-4o-mini');

  // Profile state
  const [profile, setProfile] = useState<UserProfile>({
    full_name: '',
    email: '',
    phone: '',
    address: '',
    linkedin_url: '',
    github_url: '',
    resume_text: '',
    skills: [],
  });

  const [savedSuccess, setSavedSuccess] = useState(false);

  useEffect(() => {
    if (isOpen) {
      fetchProfile().then(setProfile).catch(() => {});
      fetchSettings().then((s) => {
        if (s.provider) setProvider(s.provider);
        if (s.api_key) setApiKey(s.api_key);
        if (s.model_name) setModelName(s.model_name);
      }).catch(() => {});
    }
  }, [isOpen]);

  const handleSaveAll = async () => {
    await saveProfile(profile);
    await saveSettings({
      provider,
      api_key: apiKey,
      model_name: modelName,
    });
    setSavedSuccess(true);
    setTimeout(() => setSavedSuccess(false), 2000);
  };

  if (!isOpen) return null;

  return (
    <div className="muse-modal-overlay" onClick={onClose}>
      <div className="muse-modal-dialog" onClick={(e) => e.stopPropagation()}>
        <div className="muse-modal-header">
          <div className="muse-modal-title-group">
            <Settings size={18} color="#7c3aed" />
            <h3>Settings & User Vault</h3>
          </div>
          <button className="muse-modal-close-btn" onClick={onClose}>
            <X size={16} />
          </button>
        </div>

        {/* Tab switcher */}
        <div className="muse-modal-tabs">
          <button
            className={`muse-tab-nav-btn ${activeTab === 'ai' ? 'active' : ''}`}
            onClick={() => setActiveTab('ai')}
          >
            <Cpu size={14} /> AI Providers
          </button>
          <button
            className={`muse-tab-nav-btn ${activeTab === 'profile' ? 'active' : ''}`}
            onClick={() => setActiveTab('profile')}
          >
            <User size={14} /> User Profile & Form Fill
          </button>
          <button
            className={`muse-tab-nav-btn ${activeTab === 'security' ? 'active' : ''}`}
            onClick={() => setActiveTab('security')}
          >
            <Shield size={14} /> Safety & Boundaries
          </button>
        </div>

        <div className="muse-modal-tab-content">
          {activeTab === 'ai' && (
            <div className="muse-form-stack">
              <div className="muse-field-group">
                <label className="muse-label">AI Model Provider</label>
                <select
                  value={provider}
                  onChange={(e) => setProvider(e.target.value)}
                  className="muse-input-select"
                >
                  <option value="heuristic">Heuristic Provider (Built-in, Offline, Deterministic)</option>
                  <option value="openai">OpenAI (GPT-4o, GPT-4o-mini)</option>
                  <option value="gemini">Google Gemini (Gemini 2.5, 3.8 Flash)</option>
                  <option value="anthropic">Anthropic (Claude 3.5 Sonnet)</option>
                  <option value="ollama">Ollama / Local OpenAI Compatible</option>
                </select>
                <span className="muse-help-text">
                  Built-in Heuristic provider runs deterministic multi-step planning and DOM execution with zero latency.
                </span>
              </div>

              {provider !== 'heuristic' && (
                <>
                  <div className="muse-field-group">
                    <label className="muse-label">API Key</label>
                    <div style={{ position: 'relative' }}>
                      <input
                        type={showApiKey ? 'text' : 'password'}
                        value={apiKey}
                        onChange={(e) => setApiKey(e.target.value)}
                        placeholder="sk-..."
                        className="muse-input-text"
                      />
                      <button
                        type="button"
                        onClick={() => setShowApiKey(!showApiKey)}
                        style={{
                          position: 'absolute',
                          right: 10,
                          top: 10,
                          background: 'none',
                          border: 'none',
                          cursor: 'pointer',
                          color: '#64748b',
                        }}
                      >
                        {showApiKey ? <EyeOff size={16} /> : <Eye size={16} />}
                      </button>
                    </div>
                  </div>

                  <div className="muse-field-group">
                    <label className="muse-label">Model Name / Tag</label>
                    <input
                      type="text"
                      value={modelName}
                      onChange={(e) => setModelName(e.target.value)}
                      placeholder="e.g. gpt-4o-mini"
                      className="muse-input-text"
                    />
                  </div>
                </>
              )}
            </div>
          )}

          {activeTab === 'profile' && (
            <div className="muse-form-stack">
              <span className="muse-help-text">
                Stored locally in the Lumina SI Vault. Used strictly with your consent to assist in applications, bookings, and forms.
              </span>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div className="muse-field-group">
                  <label className="muse-label">Full Name</label>
                  <input
                    type="text"
                    value={profile.full_name}
                    onChange={(e) => setProfile({ ...profile, full_name: e.target.value })}
                    className="muse-input-text"
                  />
                </div>
                <div className="muse-field-group">
                  <label className="muse-label">Email Address</label>
                  <input
                    type="email"
                    value={profile.email}
                    onChange={(e) => setProfile({ ...profile, email: e.target.value })}
                    className="muse-input-text"
                  />
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div className="muse-field-group">
                  <label className="muse-label">Phone Number</label>
                  <input
                    type="text"
                    value={profile.phone}
                    onChange={(e) => setProfile({ ...profile, phone: e.target.value })}
                    className="muse-input-text"
                  />
                </div>
                <div className="muse-field-group">
                  <label className="muse-label">LinkedIn URL</label>
                  <input
                    type="url"
                    value={profile.linkedin_url}
                    onChange={(e) => setProfile({ ...profile, linkedin_url: e.target.value })}
                    className="muse-input-text"
                  />
                </div>
              </div>

              <div className="muse-field-group">
                <label className="muse-label">Resume / Qualifications Summary</label>
                <textarea
                  value={profile.resume_text}
                  onChange={(e) => setProfile({ ...profile, resume_text: e.target.value })}
                  placeholder="Paste resume summary or key skills..."
                  className="muse-textarea"
                  rows={3}
                />
              </div>
            </div>
          )}

          {activeTab === 'security' && (
            <div className="muse-form-stack">
              <div className="muse-security-card">
                <div className="sec-title">✓ Category C Mandatory Approval Gateway</div>
                <div className="sec-sub">
                  Irreversible actions (submitting job applications, placing orders, sending messages) strictly require explicit confirmation.
                </div>
              </div>

              <div className="muse-security-card">
                <div className="sec-title">✓ SSRF & Cloud Metadata Protection</div>
                <div className="sec-sub">
                  Blocks link-local IP addresses (169.254.169.254) and dangerous schemes (file://, javascript:).
                </div>
              </div>

              <div className="muse-security-card">
                <div className="sec-title">✓ Untrusted Web Content Sanitization</div>
                <div className="sec-sub">
                  Web page contents are strictly isolated inside untrusted data boundaries and prompt injection canaries are stripped.
                </div>
              </div>
            </div>
          )}
        </div>

        <div className="muse-modal-footer">
          <button type="button" className="muse-btn secondary" onClick={onClose}>
            Cancel
          </button>
          <button type="button" className="muse-btn primary" onClick={handleSaveAll}>
            <Save size={14} /> {savedSuccess ? 'Saved!' : 'Save Changes'}
          </button>
        </div>
      </div>
    </div>
  );
};
