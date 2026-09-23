import 'dart:convert';
import 'package:flutter/material.dart';
import 'package:http/http.dart' as http;
import 'package:provider/provider.dart';
import '../../core/constants/app_colors.dart';
import '../../core/constants/app_constants.dart';
import '../../models/state_enums.dart';
import '../../repositories/driver_repository.dart';
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
  }

  void _checkPendingAssignment(DriverState driverState) {
    if (driverState.lifecycleState == DriverLifecycleState.assignmentReceived &&
        driverState.pendingAssignment != null &&
        !_isShowingAssignmentModal) {
      _isShowingAssignmentModal = true;
      WidgetsBinding.instance.addPostFrameCallback((_) async {
        if (!mounted) return;
        final pending = driverState.pendingAssignment;
        if (pending == null) {
          _isShowingAssignmentModal = false;
          return;
        }
        await Navigator.push(
          context,
          MaterialPageRoute(
            fullscreenDialog: true,
            builder: (_) => AssignmentReceivedScreen(
              assignment: pending,
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

    _checkPendingAssignment(driverState);

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

              // DEMO MODE Indicator & Driver Simulator Header
              _buildDemoModeHeader(context, driver, authState, driverState),
              const SizedBox(height: 12),

              // Best Demo Behavior: ASSIGNMENT CREATED Notification Card with OPEN ASSIGNED DRIVER
              if (driverState.demoAssignment != null) ...[
                _buildDemoAssignmentCard(context, driverState, authState),
                const SizedBox(height: 12),
              ],

              // Simulation Speed Multiplier Controls [0.5x, 1x, 2x, 5x]
              _buildSpeedControlCard(driverState),
              const SizedBox(height: 16),

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

  Widget _buildDemoModeHeader(BuildContext context, dynamic driver, AuthState authState, DriverState driverState) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
      decoration: BoxDecoration(
        color: const Color(0xFF131c2e),
        borderRadius: BorderRadius.circular(14),
        border: Border.all(color: const Color(0xFF38bdf8).withValues(alpha: 0.4)),
      ),
      child: Row(
        mainAxisAlignment: MainAxisAlignment.spaceBetween,
        children: [
          Row(
            children: [
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                decoration: BoxDecoration(
                  color: Colors.amber.shade900.withValues(alpha: 0.3),
                  borderRadius: BorderRadius.circular(6),
                  border: Border.all(color: Colors.amber.shade400, width: 1),
                ),
                child: Row(
                  children: [
                    Container(
                      width: 6,
                      height: 6,
                      decoration: const BoxDecoration(
                        color: Colors.amber,
                        shape: BoxShape.circle,
                      ),
                    ),
                    const SizedBox(width: 6),
                    const Text(
                      'DEMO MODE',
                      style: TextStyle(
                        color: Colors.amber,
                        fontSize: 10,
                        fontWeight: FontWeight.w900,
                        letterSpacing: 0.8,
                      ),
                    ),
                  ],
                ),
              ),
              const SizedBox(width: 10),
              Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  const Text(
                    'DRIVER SIMULATOR',
                    style: TextStyle(
                      color: AppColors.textMuted,
                      fontSize: 9,
                      fontWeight: FontWeight.w700,
                      letterSpacing: 0.8,
                    ),
                  ),
                  Text(
                    '${driver?.ambulanceId ?? 'AMB0001'} — ${driver?.name ?? 'Driver'}',
                    style: const TextStyle(
                      color: AppColors.textPrimary,
                      fontSize: 12,
                      fontWeight: FontWeight.w700,
                    ),
                  ),
                ],
              ),
            ],
          ),
          OutlinedButton.icon(
            style: OutlinedButton.styleFrom(
              minimumSize: Size.zero,
              tapTargetSize: MaterialTapTargetSize.shrinkWrap,
              padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
              foregroundColor: const Color(0xFF38bdf8),
              side: BorderSide(color: const Color(0xFF38bdf8).withValues(alpha: 0.6)),
              shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(8)),
            ),
            icon: const Icon(Icons.swap_horiz, size: 16),
            label: const Text('Switch Driver', style: TextStyle(fontSize: 11, fontWeight: FontWeight.w700)),
            onPressed: () => _showDriverSwitcherSheet(context, authState, driverState),
          ),
        ],
      ),
    );
  }

  Widget _buildDemoAssignmentCard(BuildContext context, DriverState driverState, AuthState authState) {
    final demo = driverState.demoAssignment!;
    final ambId = demo['ambulanceId'] ?? 'AMBxxxx';
    final driverName = demo['driverName'] ?? 'Assigned Driver';
    final eta = demo['eta'] ?? 8;
    final score = demo['score'] ?? 0.23;
    final driverId = demo['driverId'] ?? ambId;

    return Container(
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: const Color(0xFF1a162b),
        borderRadius: BorderRadius.circular(14),
        border: Border.all(color: Colors.amber.shade400, width: 1.5),
        boxShadow: [
          BoxShadow(
            color: Colors.amber.withValues(alpha: 0.15),
            blurRadius: 10,
            spreadRadius: 1,
          ),
        ],
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                decoration: BoxDecoration(
                  color: Colors.amber.shade400,
                  borderRadius: BorderRadius.circular(6),
                ),
                child: const Text(
                  'ASSIGNMENT CREATED',
                  style: TextStyle(
                    color: Colors.black,
                    fontSize: 10,
                    fontWeight: FontWeight.w900,
                    letterSpacing: 0.8,
                  ),
                ),
              ),
              IconButton(
                constraints: const BoxConstraints(),
                padding: EdgeInsets.zero,
                icon: const Icon(Icons.close, size: 16, color: AppColors.textSecondary),
                onPressed: driverState.clearDemoAssignment,
              ),
            ],
          ),
          const SizedBox(height: 10),
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text('Selected Ambulance: $ambId', style: const TextStyle(color: Colors.white, fontSize: 13, fontWeight: FontWeight.w800)),
                  Text('Driver: $driverName', style: const TextStyle(color: AppColors.textSecondary, fontSize: 12)),
                ],
              ),
              Column(
                crossAxisAlignment: CrossAxisAlignment.end,
                children: [
                  Text('ETA: $eta min', style: const TextStyle(color: AppColors.statusAvailable, fontSize: 13, fontWeight: FontWeight.w800)),
                  Text('Score: $score', style: const TextStyle(color: AppColors.textMuted, fontSize: 11)),
                ],
              ),
            ],
          ),
          const Divider(height: 16, color: Colors.white12),
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Expanded(
                child: Text(
                  'ASSIGNED DRIVER: $driverName / $ambId',
                  style: const TextStyle(color: Colors.amber, fontSize: 11, fontWeight: FontWeight.w700),
                ),
              ),
              ElevatedButton.icon(
                style: ElevatedButton.styleFrom(
                  minimumSize: Size.zero,
                  tapTargetSize: MaterialTapTargetSize.shrinkWrap,
                  backgroundColor: Colors.amber.shade600,
                  foregroundColor: Colors.black,
                  padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
                  shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(8)),
                ),
                icon: const Icon(Icons.arrow_forward, size: 14),
                label: const Text('OPEN ASSIGNED DRIVER', style: TextStyle(fontSize: 11, fontWeight: FontWeight.w900)),
                onPressed: () async {
                  final targetId = driverId.toString();
                  final success = await authState.login(targetId, 'password123');
                  if (success && authState.currentDriver != null) {
                    await driverState.initializeForDriver(authState.currentDriver!);
                    await driverState.syncActiveAssignment();
                  }
                  driverState.clearDemoAssignment();
                },
              ),
            ],
          ),
        ],
      ),
    );
  }

  Widget _buildSpeedControlCard(DriverState driverState) {
    final speeds = [0.5, 1.0, 2.0, 5.0];
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
      decoration: BoxDecoration(
        color: AppColors.surface,
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: AppColors.cardBorder),
      ),
      child: Row(
        mainAxisAlignment: MainAxisAlignment.spaceBetween,
        children: [
          const Row(
            children: [
              Icon(Icons.speed, size: 16, color: AppColors.tacticalCyan),
              SizedBox(width: 8),
              Text(
                'SIMULATION SPEED',
                style: TextStyle(
                  color: AppColors.textSecondary,
                  fontSize: 11,
                  fontWeight: FontWeight.w700,
                  letterSpacing: 0.6,
                ),
              ),
            ],
          ),
          Row(
            children: speeds.map((s) {
              final isSelected = (driverState.simulationSpeed - s).abs() < 0.1;
              return Padding(
                padding: const EdgeInsets.only(left: 6),
                child: ChoiceChip(
                  label: Text('$s×', style: TextStyle(fontSize: 11, fontWeight: isSelected ? FontWeight.w900 : FontWeight.w600)),
                  selected: isSelected,
                  selectedColor: AppColors.tacticalCyan,
                  backgroundColor: AppColors.surfaceElevated,
                  labelStyle: TextStyle(color: isSelected ? Colors.black : AppColors.textPrimary),
                  padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 0),
                  onSelected: (_) => driverState.setSimulationSpeed(s),
                ),
              );
            }).toList(),
          ),
        ],
      ),
    );
  }

  void _showDriverSwitcherSheet(BuildContext context, AuthState authState, DriverState driverState) {
    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      backgroundColor: AppColors.surface,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(20)),
      ),
      builder: (ctx) {
        return _DriverSwitcherModalContent(
          currentDriverId: authState.currentDriver?.driverId ?? '',
          onSelect: (driverId) async {
            Navigator.pop(ctx);
            final success = await authState.login(driverId, 'password123');
            if (success && authState.currentDriver != null) {
              await driverState.initializeForDriver(authState.currentDriver!);
              await driverState.syncActiveAssignment();
              if (context.mounted) {
                ScaffoldMessenger.of(context).showSnackBar(
                  SnackBar(
                    content: Text('Switched to ${authState.currentDriver!.name} (${authState.currentDriver!.ambulanceId})'),
                    backgroundColor: AppColors.statusAvailable,
                  ),
                );
              }
            }
          },
        );
      },
    );
  }
}

class _DriverSwitcherModalContent extends StatefulWidget {
  final String currentDriverId;
  final Function(String driverId) onSelect;

  const _DriverSwitcherModalContent({
    required this.currentDriverId,
    required this.onSelect,
  });

  @override
  State<_DriverSwitcherModalContent> createState() => _DriverSwitcherModalContentState();
}

class _DriverSwitcherModalContentState extends State<_DriverSwitcherModalContent> {
  List<PredefinedDriverAccount> _drivers = [];
  String _search = '';
  bool _isLoading = true;

  @override
  void initState() {
    super.initState();
    _loadDrivers();
  }

  void _loadDrivers() {
    // Generate fallback baseline of 131 dataset drivers
    final fallbackList = List.generate(131, (i) {
      final numStr = (i + 1).toString().padLeft(4, '0');
      final dId = 'DRV$numStr';
      final aId = 'AMB$numStr';
      return PredefinedDriverAccount(
        email: '${dId.toLowerCase()}@uyirkappan.demo',
        driverId: dId,
        ambulanceId: aId,
        providerId: 'FLEET',
        name: 'Fleet Driver $numStr',
        phone: '+91 98401 ${numStr.padLeft(5, '0')}',
        defaultPassword: 'password123',
      );
    });

    _drivers = fallbackList;
    _isLoading = false;

    // Fetch live enriched names from backend
    WidgetsBinding.instance.addPostFrameCallback((_) async {
      try {
        final repo = context.read<DriverRepository>();
        final base = repo.config.apiBaseUrl;
        final res = await http.get(Uri.parse('$base/drivers/login-options')).timeout(const Duration(seconds: 4));
        if (res.statusCode == 200) {
          final data = jsonDecode(res.body);
          if (data['drivers'] is List) {
            final list = (data['drivers'] as List).map((d) {
              return PredefinedDriverAccount(
                email: d['email'] ?? '${d['driverId'].toString().toLowerCase()}@uyirkappan.demo',
                driverId: d['driverId'] ?? '',
                ambulanceId: d['ambulanceId'] ?? '',
                providerId: 'FLEET',
                name: d['name'] ?? 'Driver ${d['driverId']}',
                phone: d['phone'] ?? '+91 98401 00000',
                defaultPassword: d['defaultPassword'] ?? 'password123',
              );
            }).toList();
            if (mounted && list.isNotEmpty) {
              setState(() {
                _drivers = list;
              });
            }
          }
        }
      } catch (_) {}
    });
  }

  @override
  Widget build(BuildContext context) {
    final filtered = _drivers.where((d) {
      if (_search.isEmpty) return true;
      final q = _search.toLowerCase();
      return d.name.toLowerCase().contains(q) ||
          d.driverId.toLowerCase().contains(q) ||
          d.ambulanceId.toLowerCase().contains(q);
    }).toList();

    return DraggableScrollableSheet(
      initialChildSize: 0.75,
      minChildSize: 0.5,
      maxChildSize: 0.92,
      expand: false,
      builder: (context, scrollController) {
        return Container(
          padding: const EdgeInsets.fromLTRB(16, 12, 16, 16),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              Center(
                child: Container(
                  width: 40,
                  height: 4,
                  margin: const EdgeInsets.only(bottom: 14),
                  decoration: BoxDecoration(
                    color: Colors.white24,
                    borderRadius: BorderRadius.circular(2),
                  ),
                ),
              ),
              Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  const Text(
                    'AVAILABLE DRIVERS (131 FLEET UNITS)',
                    style: TextStyle(
                      color: AppColors.textPrimary,
                      fontSize: 13,
                      fontWeight: FontWeight.w900,
                      letterSpacing: 0.8,
                    ),
                  ),
                  Text(
                    '${filtered.length} found',
                    style: const TextStyle(color: AppColors.textMuted, fontSize: 11),
                  ),
                ],
              ),
              const SizedBox(height: 10),
              TextField(
                decoration: InputDecoration(
                  hintText: 'Search driver name, ID (e.g. DRV0027), or AMB...',
                  prefixIcon: const Icon(Icons.search, color: AppColors.textMuted, size: 18),
                  isDense: true,
                  filled: true,
                  fillColor: AppColors.surfaceElevated,
                  border: OutlineInputBorder(
                    borderRadius: BorderRadius.circular(10),
                    borderSide: const BorderSide(color: AppColors.cardBorder),
                  ),
                ),
                onChanged: (val) => setState(() => _search = val),
              ),
              const SizedBox(height: 10),
              Expanded(
                child: _isLoading
                    ? const Center(child: CircularProgressIndicator())
                    : ListView.separated(
                        controller: scrollController,
                        itemCount: filtered.length,
                        separatorBuilder: (_, __) => const Divider(height: 1, color: Colors.white10),
                        itemBuilder: (context, idx) {
                          final d = filtered[idx];
                          final isCurrent = d.driverId.toUpperCase() == widget.currentDriverId.toUpperCase();
                          return ListTile(
                            dense: true,
                            contentPadding: const EdgeInsets.symmetric(horizontal: 8, vertical: 2),
                            leading: CircleAvatar(
                              radius: 16,
                              backgroundColor: isCurrent ? AppColors.statusAvailable : AppColors.surfaceElevated,
                              child: Text(
                                d.ambulanceId.replaceAll('AMB', ''),
                                style: TextStyle(
                                  fontSize: 10,
                                  fontWeight: FontWeight.w900,
                                  color: isCurrent ? Colors.black : AppColors.textPrimary,
                                ),
                              ),
                            ),
                            title: Text(
                              '${d.ambulanceId}   ${d.name}',
                              style: TextStyle(
                                color: isCurrent ? AppColors.statusAvailable : AppColors.textPrimary,
                                fontWeight: isCurrent ? FontWeight.w900 : FontWeight.w600,
                                fontSize: 13,
                              ),
                            ),
                            subtitle: Text(
                              'ID: ${d.driverId} • ${d.phone}',
                              style: const TextStyle(color: AppColors.textMuted, fontSize: 10),
                            ),
                            trailing: isCurrent
                                ? const Chip(
                                    label: Text('ACTIVE', style: TextStyle(fontSize: 9, fontWeight: FontWeight.w900, color: Colors.white)),
                                    backgroundColor: AppColors.statusAvailable,
                                    padding: EdgeInsets.zero,
                                  )
                                : const Icon(Icons.chevron_right, size: 18, color: AppColors.textSecondary),
                            onTap: () => widget.onSelect(d.driverId),
                          );
                        },
                      ),
              ),
            ],
          ),
        );
      },
    );
  }
}

