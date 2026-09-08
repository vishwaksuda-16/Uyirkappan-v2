import { useState, useEffect } from 'react';
import Modal from '../common/Modal';
import { validateResourceCounts } from '../../utils/validators';
import { Bed, HeartPulse, Wind, Loader2, Save } from 'lucide-react';

export function ResourceUpdateModal({
  isOpen,
  onClose,
  initialResources,
  onSave,
  isSaving = false,
}) {
  const [formState, setFormState] = useState({
    generalBeds: '',
    icuBeds: '',
    ventilators: '',
  });

  const [errors, setErrors] = useState({});

  useEffect(() => {
    if (initialResources) {
      setFormState({
        generalBeds: String(initialResources.generalBeds ?? 0),
        icuBeds: String(initialResources.icuBeds ?? 0),
        ventilators: String(initialResources.ventilators ?? 0),
      });
      setErrors({});
    }
  }, [initialResources, isOpen]);

  const handleChange = (field, value) => {
    setFormState((prev) => ({ ...prev, [field]: value }));
    if (errors[field]) {
      setErrors((prev) => ({ ...prev, [field]: null }));
    }
  };

  const handleIncrement = (field, delta) => {
    const current = Number(formState[field]) || 0;
    const nextVal = Math.max(0, current + delta);
    handleChange(field, String(nextVal));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    const validation = validateResourceCounts(formState);
    if (!validation.isValid) {
      setErrors(validation.errors);
      return;
    }

    const result = await onSave({
      generalBeds: Number(formState.generalBeds),
      icuBeds: Number(formState.icuBeds),
      ventilators: Number(formState.ventilators),
    });

    if (result?.success) {
      onClose();
    } else if (result?.errors) {
      setErrors(result.errors);
    }
  };

  const fields = [
    {
      id: 'generalBeds',
      label: 'General Emergency Beds',
      desc: 'Available acute care & triage ward beds',
      icon: Bed,
      color: 'var(--status-info)',
    },
    {
      id: 'icuBeds',
      label: 'ICU Critical Care Beds',
      desc: 'Equipped Intensive Care Unit beds with continuous vitals monitoring',
      icon: HeartPulse,
      color: 'var(--status-critical)',
    },
    {
      id: 'ventilators',
      label: 'Mechanical Ventilators',
      desc: 'Operational invasive/non-invasive mechanical ventilation units',
      icon: Wind,
      color: 'var(--status-warning)',
    },
  ];

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Update Hospital Resource Availability" maxWidth="520px">
      <form onSubmit={handleSubmit} noValidate>
        <p style={{ fontSize: '13px', color: 'var(--text-secondary)', marginBottom: '20px' }}>
          Real-time counts are automatically synchronized with the central dispatch engine to evaluate hospital receiving capability.
        </p>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', marginBottom: '24px' }}>
          {fields.map((f) => {
            const Icon = f.icon;
            const hasError = !!errors[f.id];

            return (
              <div
                key={f.id}
                style={{
                  backgroundColor: 'var(--bg-secondary)',
                  border: `1px solid ${hasError ? 'var(--status-critical)' : 'var(--border-default)'}`,
                  borderRadius: 'var(--radius-md)',
                  padding: '14px 16px',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
                  <label
                    htmlFor={f.id}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px',
                      fontSize: '14px',
                      fontWeight: 600,
                      color: 'var(--text-primary)',
                      cursor: 'pointer',
                    }}
                  >
                    <Icon size={16} style={{ color: f.color }} />
                    <span>{f.label}</span>
                  </label>

                  {/* Stepper Controls */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <button
                      type="button"
                      onClick={() => handleIncrement(f.id, -1)}
                      disabled={isSaving || Number(formState[f.id]) <= 0}
                      aria-label={`Decrease ${f.label}`}
                      style={{
                        width: '28px',
                        height: '28px',
                        borderRadius: 'var(--radius-sm)',
                        backgroundColor: 'var(--bg-card)',
                        border: '1px solid var(--border-default)',
                        color: 'var(--text-primary)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontWeight: 700,
                      }}
                    >
                      -
                    </button>

                    <input
                      id={f.id}
                      type="number"
                      min="0"
                      max="500"
                      value={formState[f.id]}
                      onChange={(e) => handleChange(f.id, e.target.value)}
                      disabled={isSaving}
                      className="tabular-nums font-mono"
                      style={{
                        width: '64px',
                        textAlign: 'center',
                        padding: '6px 8px',
                        backgroundColor: 'var(--bg-input)',
                        border: `1px solid ${hasError ? 'var(--status-critical)' : 'var(--border-default)'}`,
                        borderRadius: 'var(--radius-sm)',
                        color: 'var(--text-primary)',
                        fontSize: '15px',
                        fontWeight: 700,
                      }}
                    />

                    <button
                      type="button"
                      onClick={() => handleIncrement(f.id, 1)}
                      disabled={isSaving}
                      aria-label={`Increase ${f.label}`}
                      style={{
                        width: '28px',
                        height: '28px',
                        borderRadius: 'var(--radius-sm)',
                        backgroundColor: 'var(--bg-card)',
                        border: '1px solid var(--border-default)',
                        color: 'var(--text-primary)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontWeight: 700,
                      }}
                    >
                      +
                    </button>
                  </div>
                </div>

                <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                  {f.desc}
                </div>

                {hasError && (
                  <div
                    style={{
                      marginTop: '6px',
                      fontSize: '11px',
                      color: 'var(--status-critical)',
                      fontWeight: 600,
                    }}
                  >
                    {errors[f.id]}
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* Action Buttons */}
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px' }}>
          <button
            type="button"
            onClick={onClose}
            disabled={isSaving}
            style={{
              padding: '8px 16px',
              borderRadius: 'var(--radius-md)',
              border: '1px solid var(--border-default)',
              backgroundColor: 'transparent',
              color: 'var(--text-secondary)',
              fontSize: '13px',
              fontWeight: 600,
            }}
          >
            Cancel
          </button>

          <button
            type="submit"
            disabled={isSaving}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '8px',
              padding: '8px 20px',
              borderRadius: 'var(--radius-md)',
              backgroundColor: 'var(--status-success)',
              color: '#ffffff',
              fontSize: '13px',
              fontWeight: 700,
              boxShadow: 'var(--shadow-glow-green)',
              opacity: isSaving ? 0.7 : 1,
            }}
          >
            {isSaving ? (
              <>
                <Loader2 size={16} className="animate-spin" />
                <span>Synchronizing...</span>
              </>
            ) : (
              <>
                <Save size={16} />
                <span>Save & Broadcast</span>
              </>
            )}
          </button>
        </div>
      </form>
    </Modal>
  );
}

export default ResourceUpdateModal;
