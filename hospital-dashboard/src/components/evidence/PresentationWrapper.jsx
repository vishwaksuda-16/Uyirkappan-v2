import { useState } from 'react';
import { Maximize2, Minimize2, X } from 'lucide-react';

/**
 * PresentationWrapper — Wraps evidence views in a fullscreen presentation mode
 * Hides sidebar, navbar, and non-essential UI for clean 16:9 screenshots.
 */
export function PresentationWrapper({ children, title, figureCaption, onClose }) {
  return (
    <div className="presentation-mode">
      <div className="presentation-content">
        {/* Minimal header */}
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          marginBottom: 'var(--space-6)', paddingBottom: 'var(--space-4)',
          borderBottom: '1px solid var(--border-subtle)',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div style={{
              width: '32px', height: '32px', borderRadius: 'var(--radius-md)',
              backgroundColor: 'rgba(239, 68, 68, 0.15)', border: '1px solid rgba(239, 68, 68, 0.3)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              color: 'var(--status-critical)', fontSize: '14px', fontWeight: 700,
            }}>
              உ
            </div>
            <div>
              <div style={{ fontSize: 'var(--text-md)', fontWeight: 700, color: 'var(--text-primary)' }}>
                {title || 'UyirKappan — Research Evidence'}
              </div>
              <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)' }}>
                Phase 1 — Intelligent Emergency Dispatch
              </div>
            </div>
          </div>
          <button
            onClick={onClose}
            className="btn btn--secondary btn--sm"
          >
            <Minimize2 size={14} />
            <span>Exit Presentation</span>
          </button>
        </div>

        {/* Content */}
        {children}

        {/* Figure Caption */}
        {figureCaption && (
          <div className="figure-caption">{figureCaption}</div>
        )}

        {/* Footer */}
        <div className="presentation-footer">
          UyirKappan — Phase 1 · Intelligent Emergency Ambulance Dispatch System
        </div>
      </div>
    </div>
  );
}

/**
 * PresentationToggle — Button to enter presentation mode
 */
export function PresentationToggle({ onClick }) {
  return (
    <button onClick={onClick} className="btn btn--secondary btn--sm" title="Enter Presentation View">
      <Maximize2 size={14} />
      <span>Presentation View</span>
    </button>
  );
}

export default PresentationWrapper;
