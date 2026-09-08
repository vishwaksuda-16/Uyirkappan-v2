import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../../core/constants/app_colors.dart';
import '../../models/state_enums.dart';
import '../../state/auth_state.dart';
import '../../state/driver_state.dart';
import '../../state/navigation_state.dart';
import '../../widgets/common/connection_badge.dart';
import '../../widgets/common/pulsing_radar.dart';
import '../../widgets/common/status_badge.dart';
import '../assignment/assignment_received_screen.dart';

class DashboardScreen extends StatefulWidget {
  const DashboardScreen({super.key});

  @override
  State<DashboardScreen> createState() => _DashboardScreenState();
}

class _DashboardScreenState extends State<DashboardScreen> {
  bool _isShowingAssignmentModal = false;

  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    _checkPendingAssignment();
  }

  void _checkPendingAssignment() {
    final driverState = context.watch<DriverState>();
    if (driverState.lifecycleState == DriverLifecycleState.assignmentReceived &&
        driverState.pendingAssignment != null &&
        !_isShowingAssignmentModal) {
      _isShowingAssignmentModal = true;
      WidgetsBinding.instance.addPostFrameCallback((_) async {
        if (!mounted) return;
        await Navigator.push(
          context,
          MaterialPageRoute(
            fullscreenDialog: true,
            builder: (_) => AssignmentReceivedScreen(
              assignment: driverState.pendingAssignment!,
            ),
          ),
        );
        _isShowingAssignmentModal = false;
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    final authState = context.watch<AuthState>();
    final driverState = context.watch<DriverState>();
    final navState = context.watch<NavigationState>();
    final driver = authState.currentDriver;

    return Scaffold(
      backgroundColor: AppColors.background,
      appBar: AppBar(
        title: Row(
          children: [
            Container(
              width: 34,
              height: 34,
              decoration: const BoxDecoration(
                color: AppColors.emergencyRed,
                shape: BoxShape.circle,
              ),
              child: const Icon(Icons.emergency, color: Colors.white, size: 20),
            ),
            const SizedBox(width: 10),
            Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  driver?.ambulanceId ?? 'AMB-003',
                  style: const TextStyle(
                    fontSize: 16,
                    fontWeight: FontWeight.w900,
                    letterSpacing: 1.0,
                  ),
                ),
                Text(
                  driver?.name ?? 'Driver DRV-003',
                  style: const TextStyle(
                    fontSize: 11,
                    color: AppColors.textSecondary,
                  ),
                ),
              ],
            ),
          ],
        ),
        actions: [
          ConnectionBadge(status: driverState.connectionStatus),
          const SizedBox(width: 8),
          IconButton(
            icon: const Icon(Icons.person_outline),
            tooltip: 'Driver Profile',
            onPressed: () => Navigator.pushNamed(context, '/profile'),
          ),
          const SizedBox(width: 8),
        ],
      ),
      body: SafeArea(
        child: SingleChildScrollView(
          padding: const EdgeInsets.all(16),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              // System Feedback / Notification Banner
              if (driverState.feedbackMessage != null) ...[
                Container(
                  padding: const EdgeInsets.all(12),
                  margin: const EdgeInsets.only(bottom: 16),
                  decoration: BoxDecoration(
                    color: AppColors.tacticalCyan.withValues(alpha: 0.15),
                    borderRadius: BorderRadius.circular(12),
                    border: Border.all(color: AppColors.tacticalCyan.withValues(alpha: 0.4)),
                  ),
                  child: Row(
                    children: [
                      const Icon(Icons.notifications_active, color: AppColors.tacticalCyan, size: 20),
                      const SizedBox(width: 10),
                      Expanded(
                        child: Text(
                          driverState.feedbackMessage!,
                          style: const TextStyle(
                            color: AppColors.textPrimary,
                            fontSize: 13,
                            fontWeight: FontWeight.w600,
                          ),
                        ),
                      ),
                      IconButton(
                        constraints: const BoxConstraints(),
                        padding: EdgeInsets.zero,
                        icon: const Icon(Icons.close, size: 16, color: AppColors.textSecondary),
                        onPressed: driverState.clearFeedback,
                      ),
                    ],
                  ),
                ),
              ],

              // 1. Hero Ambulance Status & Availability Card (Section 5 & 21)
              _buildHeroStatusCard(context, driverState, navState),
              const SizedBox(height: 16),

              // 2. Active Mission Card (if in active emergency) OR Standby Radar
              if (driverState.hasActiveEmergency) ...[
                _buildActiveEmergencyCard(context, driverState, navState),
              ] else ...[
                _buildStandbyCard(context, driverState),
              ],
              const SizedBox(height: 16),

              // 3. Shift Performance Metrics Card (Section 21: Today's Requests & Completed)
              _buildMetricsCard(driverState),
            ],
          ),
        ),
      ),
    );
  }

  Widget _buildHeroStatusCard(BuildContext context, DriverState driverState, NavigationState navState) {
    final isAvail = driverState.isAvailable;
    final isBusy = driverState.isBusy;

    return Container(
      padding: const EdgeInsets.all(20),
      decoration: BoxDecoration(
        color: AppColors.surface,
        borderRadius: BorderRadius.circular(18),
        border: Border.all(
          color: isAvail
              ? AppColors.statusAvailable.withValues(alpha: 0.4)
              : isBusy
                  ? AppColors.statusBusy.withValues(alpha: 0.4)
                  : AppColors.cardBorder,
          width: 1.5,
        ),
      ),
      child: Column(
        children: [
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  const Text(
                    'OPERATIONAL STATUS',
                    style: TextStyle(
                      color: AppColors.textMuted,
                      fontSize: 11,
                      fontWeight: FontWeight.w700,
                      letterSpacing: 1.0,
                    ),
                  ),
                  const SizedBox(height: 4),
                  Row(
                    children: [
                      StatusBadge(availability: driverState.availability),
                    ],
                  ),
                ],
              ),
              // Current Location Node Display (Section 6 & 21)
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
                decoration: BoxDecoration(
                  color: AppColors.surfaceElevated,
                  borderRadius: BorderRadius.circular(10),
                  border: Border.all(color: AppColors.cardBorder),
                ),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.end,
                  children: [
                    const Text(
                      'CURRENT LOCATION',
                      style: TextStyle(
                        color: AppColors.textMuted,
                        fontSize: 9,
                        fontWeight: FontWeight.w700,
                      ),
                    ),
                    const SizedBox(height: 2),
                    Text(
                      navState.currentLocation != null
                          ? '${navState.currentLocation!.latitude.toStringAsFixed(4)}, ${navState.currentLocation!.longitude.toStringAsFixed(4)}'
                          : 'GPS Active (Standby)',
                      style: const TextStyle(
                        color: AppColors.textPrimary,
                        fontSize: 12,
                        fontWeight: FontWeight.w800,
                      ),
                    ),
                  ],
                ),
              ),
            ],
          ),
          const Divider(height: 28),

          // Availability Switch Buttons: GO AVAILABLE vs GO OFFLINE
          if (!isBusy) ...[
            Row(
              children: [
                Expanded(
                  child: ElevatedButton.icon(
                    style: ElevatedButton.styleFrom(
                      backgroundColor: isAvail
                          ? AppColors.surfaceElevated
                          : AppColors.statusAvailable,
                      foregroundColor: isAvail ? AppColors.textMuted : Colors.white,
                      side: isAvail
                          ? const BorderSide(color: AppColors.statusAvailable, width: 1.5)
                          : BorderSide.none,
                      padding: const EdgeInsets.symmetric(vertical: 14),
                    ),
                    onPressed: isAvail
                        ? null
                        : () => driverState.setAvailability(AmbulanceAvailability.available),
                    icon: const Icon(Icons.check_circle_outline, size: 18),
                    label: const Text(
                      'GO AVAILABLE',
                      style: TextStyle(fontWeight: FontWeight.w800, letterSpacing: 0.8),
                    ),
                  ),
                ),
                const SizedBox(width: 12),
                Expanded(
                  child: OutlinedButton.icon(
                    style: OutlinedButton.styleFrom(
                      foregroundColor: !isAvail ? AppColors.textMuted : AppColors.emergencyRed,
                      side: BorderSide(
                        color: !isAvail ? AppColors.cardBorder : AppColors.emergencyRed,
                        width: 1.5,
                      ),
                      padding: const EdgeInsets.symmetric(vertical: 14),
                    ),
                    onPressed: !isAvail
                        ? null
                        : () => driverState.setAvailability(AmbulanceAvailability.offline),
                    icon: const Icon(Icons.power_settings_new, size: 18),
                    label: const Text(
                      'GO OFFLINE',
                      style: TextStyle(fontWeight: FontWeight.w800, letterSpacing: 0.8),
                    ),
                  ),
                ),
              ],
            ),
          ] else ...[
            // When busy handling an emergency
            Container(
              width: double.infinity,
              padding: const EdgeInsets.all(12),
              decoration: BoxDecoration(
                color: AppColors.statusBusy.withValues(alpha: 0.12),
                borderRadius: BorderRadius.circular(10),
                border: Border.all(color: AppColors.statusBusy.withValues(alpha: 0.4)),
              ),
              child: const Row(
                mainAxisAlignment: MainAxisAlignment.center,
                children: [
                  Icon(Icons.warning_amber_rounded, color: AppColors.statusBusy, size: 20),
                  SizedBox(width: 8),
                  Text(
                    'AMBULANCE DISPATCHED • BUSY ON MISSION',
                    style: TextStyle(
                      color: AppColors.statusBusy,
                      fontSize: 12,
                      fontWeight: FontWeight.w800,
                      letterSpacing: 0.5,
                    ),
                  ),
                ],
              ),
            ),
          ],
        ],
      ),
    );
  }

  Widget _buildActiveEmergencyCard(
    BuildContext context,
    DriverState driverState,
    NavigationState navState,
  ) {
    final assignment = driverState.activeAssignment;
    if (assignment == null) return const SizedBox.shrink();

    final emergency = assignment.emergency;

    return Container(
      padding: const EdgeInsets.all(18),
      decoration: BoxDecoration(
        color: AppColors.surface,
        borderRadius: BorderRadius.circular(18),
        border: Border.all(color: AppColors.emergencyRed, width: 2),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Row(
                children: [
                  const Text('🚨 ', style: TextStyle(fontSize: 18)),
                  Text(
                    'ACTIVE EMERGENCY: ${assignment.requestId}',
                    style: const TextStyle(
                      color: AppColors.emergencyRed,
                      fontSize: 14,
                      fontWeight: FontWeight.w900,
                      letterSpacing: 0.8,
                    ),
                  ),
                ],
              ),
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                decoration: BoxDecoration(
                  color: AppColors.emergencyRed.withValues(alpha: 0.15),
                  borderRadius: BorderRadius.circular(6),
                ),
                child: Text(
                  driverState.lifecycleState.displayName.replaceAll('_', ' '),
                  style: const TextStyle(
                    color: AppColors.emergencyRed,
                    fontSize: 10,
                    fontWeight: FontWeight.w800,
                  ),
                ),
              ),
            ],
          ),
          const Divider(height: 20),
          Text(
            emergency.emergencyType,
            style: const TextStyle(
              color: AppColors.textPrimary,
              fontSize: 18,
              fontWeight: FontWeight.w800,
            ),
          ),
          const SizedBox(height: 4),
          Text(
            'Pickup: ${emergency.pickupLocationName}',
            style: const TextStyle(color: AppColors.textSecondary, fontSize: 13),
          ),
          const SizedBox(height: 14),
          Row(
            children: [
              _metricBadge(
                'ETA',
                '${navState.dynamicEtaMinutes > 0 ? navState.dynamicEtaMinutes : assignment.etaMinutes} min',
                AppColors.statusAvailable,
              ),
              const SizedBox(width: 8),
              _metricBadge('Victims', '${emergency.victimCount}', AppColors.tacticalCyan),
              const SizedBox(width: 8),
              _metricBadge('Speed', '${navState.currentSpeedKmh.round()} km/h', AppColors.textPrimary),
            ],
          ),
          const SizedBox(height: 16),
          ElevatedButton.icon(
            style: ElevatedButton.styleFrom(
              backgroundColor: AppColors.emergencyRed,
              padding: const EdgeInsets.symmetric(vertical: 14),
            ),
            onPressed: () => Navigator.pushNamed(context, '/navigation'),
            icon: const Icon(Icons.navigation, size: 20),
            label: const Text(
              'OPEN LIVE TACTICAL NAVIGATION',
              style: TextStyle(fontWeight: FontWeight.w900, letterSpacing: 0.8),
            ),
          ),
        ],
      ),
    );
  }

  Widget _metricBadge(String label, String value, Color valueColor) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
      decoration: BoxDecoration(
        color: AppColors.surfaceElevated,
        borderRadius: BorderRadius.circular(8),
        border: Border.all(color: AppColors.cardBorder),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            label,
            style: const TextStyle(color: AppColors.textMuted, fontSize: 9, fontWeight: FontWeight.w600),
          ),
          Text(
            value,
            style: TextStyle(color: valueColor, fontSize: 13, fontWeight: FontWeight.w800),
          ),
        ],
      ),
    );
  }

  Widget _buildStandbyCard(BuildContext context, DriverState driverState) {
    return Container(
      padding: const EdgeInsets.symmetric(vertical: 28, horizontal: 20),
      decoration: BoxDecoration(
        color: AppColors.surface,
        borderRadius: BorderRadius.circular(18),
        border: Border.all(color: AppColors.cardBorder),
      ),
      child: PulsingRadar(
        statusText: driverState.isAvailable
            ? 'READY FOR EMERGENCY DISPATCH'
            : 'AMBULANCE OFFLINE',
        subText: driverState.isAvailable
            ? 'Vehicle connected to Intelligent Dispatch Engine. Stand by for assignments.'
            : 'Toggle status to AVAILABLE to participate in emergency responses.',
      ),
    );
  }

  Widget _buildMetricsCard(DriverState driverState) {
    return Container(
      padding: const EdgeInsets.all(18),
      decoration: BoxDecoration(
        color: AppColors.surface,
        borderRadius: BorderRadius.circular(18),
        border: Border.all(color: AppColors.cardBorder),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const Text(
            'TODAY\'S SHIFT PERFORMANCE',
            style: TextStyle(
              color: AppColors.textMuted,
              fontSize: 11,
              fontWeight: FontWeight.w700,
              letterSpacing: 1.0,
            ),
          ),
          const SizedBox(height: 16),
          Row(
            children: [
              Expanded(
                child: _statItem(
                  'Assignments Received',
                  '${driverState.todayRequestsCount}',
                  Icons.assignment_late_outlined,
                  AppColors.tacticalCyan,
                ),
              ),
              Container(width: 1, height: 40, color: AppColors.cardBorder),
              Expanded(
                child: _statItem(
                  'Completed Missions',
                  '${driverState.todayCompletedCount}',
                  Icons.task_alt,
                  AppColors.statusAvailable,
                ),
              ),
            ],
          ),
        ],
      ),
    );
  }

  Widget _statItem(String label, String value, IconData icon, Color color) {
    return Column(
      children: [
        Icon(icon, color: color, size: 24),
        const SizedBox(height: 6),
        Text(
          value,
          style: const TextStyle(
            color: AppColors.textPrimary,
            fontSize: 22,
            fontWeight: FontWeight.w900,
          ),
        ),
        Text(
          label,
          textAlign: TextAlign.center,
          style: const TextStyle(color: AppColors.textSecondary, fontSize: 11),
        ),
      ],
    );
  }
}
