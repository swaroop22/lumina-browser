import React from 'react';
import { History, Trash2, X, ExternalLink, Clock, Globe } from 'lucide-react';
import { HistoryItem } from '../services/api';

interface HistoryModalProps {
  isOpen: boolean;
  onClose: () => void;
  history: HistoryItem[];
  onClearHistory: () => void;
  onNavigate: (url: string) => void;
}

export const HistoryModal: React.FC<HistoryModalProps> = ({
  isOpen,
  onClose,
  history,
  onClearHistory,
  onNavigate,
}) => {
  if (!isOpen) return null;

  return (
    <div className="muse-modal-overlay" onClick={onClose}>
      <div className="muse-modal-dialog" onClick={(e) => e.stopPropagation()}>
        <div className="muse-modal-header">
          <div className="muse-modal-title-group">
            <History size={18} color="#7c3aed" />
            <h3>Browsing & Errand History</h3>
          </div>
          <div className="muse-modal-actions">
            {history.length > 0 && (
              <button
                className="muse-btn-text-danger"
                onClick={onClearHistory}
                title="Clear all recorded browsing history"
              >
                <Trash2 size={13} /> Clear
              </button>
            )}
            <button className="muse-modal-close-btn" onClick={onClose}>
              <X size={16} />
            </button>
          </div>
        </div>

        <div className="muse-modal-body">
          {history.length === 0 ? (
            <div className="muse-empty-state">
              <Clock size={32} color="#94a3b8" />
              <p>No browsing history yet</p>
              <span>Pages visited by you or navigated by Lumina SI will appear here.</span>
            </div>
          ) : (
            <div className="muse-history-items-list">
              {history.map((item) => (
                <div
                  key={item.id}
                  className="muse-history-item-row"
                  onClick={() => {
                    onNavigate(item.url);
                    onClose();
                  }}
                >
                  <Globe size={14} className="history-icon" />
                  <div className="history-text-col">
                    <span className="history-item-title">{item.title || 'Untitled Page'}</span>
                    <span className="history-item-url">{item.url}</span>
                  </div>
                  <span className="history-item-time">
                    {new Date(item.visit_time * 1000).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
