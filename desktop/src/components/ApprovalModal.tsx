import React from 'react';
import { ShieldAlert, Check, X, AlertTriangle, Lock } from 'lucide-react';
import { ApprovalItem } from '../services/api';
import { Mascot } from './Mascot';

interface ApprovalModalProps {
  approval: ApprovalItem | null;
  onDecide: (id: string, approved: boolean, reason?: string) => void;
}

export const ApprovalModal: React.FC<ApprovalModalProps> = ({ approval, onDecide }) => {
  if (!approval) return null;

  return (
    <div className="muse-modal-overlay">
      <div className="muse-approval-modal-card">
        {/* Glow accent */}
        <div className="muse-approval-top-bar" />

        <div className="muse-approval-header">
          <div className="muse-approval-avatar-wrap">
            <Mascot mood="waiting_for_approval" size={36} showHalo={true} />
          </div>

          <div className="muse-approval-titles">
            <h3>Consequential Action Gate</h3>
            <span className="muse-approval-sub">
              Human-in-the-loop verification required before Lumina SI executes this step
            </span>
          </div>
        </div>

        {/* Warning / Risk Notice */}
        <div className="muse-approval-risk-box">
          <div className="risk-title-row">
            <ShieldAlert size={16} color="#d97706" />
            <span className="risk-title">Action: {approval.action_name}</span>
          </div>
          <p className="risk-desc">{approval.description}</p>
          <div className="risk-meta">
            <Lock size={12} color="#b45309" />
            <span>Risk Assessment: {approval.risk_summary}</span>
          </div>
        </div>

        {/* Parameters Preview */}
        {approval.parameters && Object.keys(approval.parameters).length > 0 && (
          <div className="muse-approval-params-wrap">
            <span className="params-label">PROPOSED DATA PAYLOAD:</span>
            <div className="params-code-box">
              <pre>{JSON.stringify(approval.parameters, null, 2)}</pre>
            </div>
          </div>
        )}

        {/* Decision Actions */}
        <div className="muse-approval-btn-row">
          <button
            type="button"
            className="muse-approval-btn reject"
            onClick={() => onDecide(approval.id, false, 'User rejected consequential action in Lumina SI review dialog')}
          >
            <X size={15} /> Reject & Halt Errand
          </button>

          <button
            type="button"
            className="muse-approval-btn approve"
            onClick={() => onDecide(approval.id, true, 'User explicitly authorized consequential action')}
          >
            <Check size={15} /> Authorize & Proceed
          </button>
        </div>
      </div>
    </div>
  );
};
