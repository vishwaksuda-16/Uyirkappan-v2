import StatCard from '../common/StatCard';
import { Siren, AlertCircle } from 'lucide-react';

export function OperationalMetrics({ emergencies = [] }) {
  const activeEmergencies = emergencies.filter(
    (e) => !['COMPLETED', 'CANCELLED', 'RESOLVED', 'NO_AMBULANCE_AVAILABLE'].includes(e.status)
  );
  const criticalCount = activeEmergencies.filter(
    (e) => e.emergencyType === 'CARDIAC' || e.emergencyType === 'TRAUMA'
  ).length;

  return (
    <div
      className="operational-metrics"
      style={{
        display: 'grid',
        marginBottom: '24px',
      }}
    >
      <StatCard
        title="Active Inbound Cases"
        value={activeEmergencies.length}
        subtitle="Cases awaiting arrival"
        icon={Siren}
        variant={activeEmergencies.length > 0 ? 'critical' : 'success'}
      />

      <StatCard
        title="Critical Cases"
        value={criticalCount}
        subtitle="Cardiac / Trauma Priority"
        icon={AlertCircle}
        variant={criticalCount > 0 ? 'critical' : 'default'}
      />
    </div>
  );
}

export default OperationalMetrics;
