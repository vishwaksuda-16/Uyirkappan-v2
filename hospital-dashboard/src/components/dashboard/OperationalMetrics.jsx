import StatCard from '../common/StatCard';
import { Siren, AlertCircle, HeartPulse, BedDouble, Wind } from 'lucide-react';

export function OperationalMetrics({ emergencies = [], resources = {}, onManageResources }) {
  const activeEmergencies = emergencies.filter((e) => e.status !== 'COMPLETED');
  const criticalCount = activeEmergencies.filter(
    (e) => e.emergencyType === 'CARDIAC' || e.emergencyType === 'TRAUMA'
  ).length;

  const icuAvailable = resources.icuBeds ?? 0;
  const icuTotal = resources.totalIcuBeds ?? 8;
  const ventAvailable = resources.ventilators ?? 0;
  const generalAvailable = resources.generalBeds ?? 0;
  const generalTotal = resources.totalGeneralBeds ?? 25;

  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
        gap: '16px',
        marginBottom: '24px',
      }}
    >
      <StatCard
        title="Active Inbound Cases"
        value={activeEmergencies.length}
        subtitle={activeEmergencies.length === 1 ? '1 ambulance en route' : `${activeEmergencies.length} ambulances en route`}
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

      <StatCard
        title="ICU Availability"
        value={`${icuAvailable}/${icuTotal}`}
        subtitle="Critical Care Units"
        icon={HeartPulse}
        variant={icuAvailable <= 1 ? 'critical' : icuAvailable <= 3 ? 'warning' : 'success'}
        onClick={onManageResources}
      />

      <StatCard
        title="General Beds"
        value={`${generalAvailable}/${generalTotal}`}
        subtitle="Emergency Ward"
        icon={BedDouble}
        variant={generalAvailable <= 3 ? 'warning' : 'default'}
        onClick={onManageResources}
      />

      <StatCard
        title="Ventilators"
        value={ventAvailable}
        subtitle="Mechanical Units Ready"
        icon={Wind}
        variant={ventAvailable <= 1 ? 'warning' : 'info'}
        onClick={onManageResources}
      />
    </div>
  );
}

export default OperationalMetrics;
