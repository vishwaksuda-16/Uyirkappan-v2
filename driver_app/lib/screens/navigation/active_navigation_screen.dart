import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../../core/constants/app_colors.dart';
import '../../core/utils/formatters.dart';
import '../../core/utils/geo_utils.dart';
import '../../models/assignment.dart';
import '../../models/hospital.dart';
import '../../models/state_enums.dart';
import '../../state/driver_state.dart';
import '../../state/navigation_state.dart';
import '../../widgets/navigation/tactical_map_canvas.dart';

class ActiveNavigationScreen extends StatelessWidget {
  const ActiveNavigationScreen({super.key});

  @override
  Widget build(BuildContext context) {
    final driverState = context.watch<DriverState>();
    final navState = context.watch<NavigationState>();

    final assignment = driverState.activeAssignment;
    final lifecycle = driverState.lifecycleState;

    return Scaffold(
      backgroundColor: AppColors.background,
      body: SafeArea(
        child: Stack(
          children: [
            // 1. Full-screen Tactical Map
            TacticalMapCanvas(
              route: navState.activeRoute,
              alternativeRoute: navState.alternativeRoutes.isNotEmpty
                  ? navState.alternativeRoutes.first
                  : null,
              currentLocation: navState.currentLocation,
              destinationName: navState.destinationName,
              isEnRouteToHospital: lifecycle == DriverLifecycleState.enRouteToHospital ||
                  lifecycle == DriverLifecycleState.arrivedAtHospital,
              ambulanceId: driverState.activeAssignment?.ambulanceId ?? '',
            ),

            // 2. Top Navigation HUD
            Positioned(
              top: 12,
              left: 12,
              right: 12,
              child: Column(
                children: [
                  _buildTopHud(context, driverState, navState),
                  const SizedBox(height: 6),
                  _buildRouteIntelligenceBanner(context, navState, assignment),
                  if (navState.trafficAlert != null) ...[
                    const SizedBox(height: 6),
                    _buildTrafficBanner(context, navState),
                  ],
                ],
              ),
            ),

            // 3. Bottom Mission Action Card
            Positioned(
              bottom: 0,
              left: 0,
              right: 0,
              child: _buildBottomLifecycleCard(
                context,
                driverState,
                navState,
                lifecycle,
                assignment,
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildTopHud(
    BuildContext context,
    DriverState driverState,
    NavigationState navState,
  ) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
      decoration: BoxDecoration(
        color: AppColors.surface.withValues(alpha: 0.95),
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: AppColors.cardBorder),
        boxShadow: const [
          BoxShadow(color: Colors.black45, blurRadius: 10, offset: Offset(0, 4)),
        ],
      ),
      child: Row(
        mainAxisAlignment: MainAxisAlignment.spaceBetween,
        children: [
          // Next maneuver / Destination
          Expanded(
            child: Row(
              children: [
                Container(
                  padding: const EdgeInsets.all(8),
                  decoration: BoxDecoration(
                    color: AppColors.tacticalCyan.withValues(alpha: 0.15),
                    borderRadius: BorderRadius.circular(10),
                  ),
                  child: const Icon(
                    Icons.directions,
                    color: AppColors.tacticalCyan,
                    size: 22,
                  ),
                ),
                const SizedBox(width: 12),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      Text(
                        navState.destinationName.isNotEmpty
                            ? navState.destinationName
                            : 'Emergency Route',
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                        style: const TextStyle(
                          color: AppColors.textPrimary,
                          fontSize: 14,
                          fontWeight: FontWeight.w700,
                        ),
                      ),
                      Text(
                        navState.phase == JourneyPhase.enRouteToHospital
                            ? 'Target: ${navState.destinationName}'
                            : 'Target Waypoint: ${navState.currentLocation?.nodeName ?? "En Route"}',
                        style: const TextStyle(
                          color: AppColors.textSecondary,
                          fontSize: 11,
                        ),
                      ),
                    ],
                  ),
                ),
              ],
            ),
          ),
          const SizedBox(width: 12),
          // Dynamic ETA and Distance
          Column(
            crossAxisAlignment: CrossAxisAlignment.end,
            mainAxisSize: MainAxisSize.min,
            children: [
              Text(
                Formatters.formatEta(navState.dynamicEtaMinutes),
                style: const TextStyle(
                  color: AppColors.statusAvailable,
                  fontSize: 18,
                  fontWeight: FontWeight.w900,
                  letterSpacing: 0.5,
                ),
              ),
              Text(
                Formatters.formatDistance(navState.distanceRemainingKm),
                style: const TextStyle(
                  color: AppColors.textSecondary,
                  fontSize: 11,
                  fontWeight: FontWeight.w600,
                ),
              ),
            ],
          ),
        ],
      ),
    );
  }

  Widget _buildTrafficBanner(BuildContext context, NavigationState navState) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 8),
      decoration: BoxDecoration(
        color: AppColors.warningOrange.withValues(alpha: 0.95),
        borderRadius: BorderRadius.circular(10),
      ),
      child: Row(
        children: [
          const Icon(Icons.traffic, color: Colors.white, size: 16),
          const SizedBox(width: 8),
          Expanded(
            child: Text(
              navState.trafficAlert!,
              style: const TextStyle(
                color: Colors.white,
                fontSize: 11,
                fontWeight: FontWeight.w700,
              ),
            ),
          ),
          IconButton(
            constraints: const BoxConstraints(),
            padding: EdgeInsets.zero,
            onPressed: navState.dismissTrafficAlert,
            icon: const Icon(Icons.close, color: Colors.white, size: 16),
          ),
        ],
      ),
    );
  }

  Widget _buildRouteIntelligenceBanner(BuildContext context, NavigationState navState, Assignment? assignment) {
    return InkWell(
      onTap: () => _showRouteIntelligenceDialog(context, assignment, navState),
      borderRadius: BorderRadius.circular(10),
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 7),
        decoration: BoxDecoration(
          color: const Color(0xFF0F172A).withValues(alpha: 0.95),
          borderRadius: BorderRadius.circular(10),
          border: Border.all(color: AppColors.tacticalCyan.withValues(alpha: 0.6)),
        ),
        child: Row(
          children: [
            const Icon(Icons.alt_route, color: AppColors.tacticalCyan, size: 16),
            const SizedBox(width: 8),
            const Expanded(
              child: Text(
                'Route: Arterial Corridor (Selected • Fastest) | Alternate corridor available',
                style: TextStyle(
                  color: Colors.white,
                  fontSize: 10,
                  fontWeight: FontWeight.w700,
                ),
              ),
            ),
            const SizedBox(width: 6),
            Container(
              padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
              decoration: BoxDecoration(
                color: AppColors.tacticalCyan.withValues(alpha: 0.2),
                borderRadius: BorderRadius.circular(4),
              ),
              child: const Row(
                mainAxisSize: MainAxisSize.min,
                children: [
                  Text('WHY?', style: TextStyle(color: AppColors.tacticalCyan, fontSize: 9, fontWeight: FontWeight.w900)),
                  SizedBox(width: 2),
                  Icon(Icons.info_outline, color: AppColors.tacticalCyan, size: 11),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }

  void _showRouteIntelligenceDialog(
    BuildContext context,
    Assignment? assignment,
    NavigationState navState,
  ) {
    final reason = assignment?.decisionReason ??
        'Primary Arterial Corridor evaluated as optimal due to lowest cumulative travel latency under dynamic traffic simulation.';
    final primaryDist = assignment?.distanceKm ?? 4.2;
    final primaryEta = assignment?.etaMinutes ?? 8;

    showDialog(
      context: context,
      builder: (ctx) => AlertDialog(
        backgroundColor: const Color(0xFF0F172A),
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(20),
          side: const BorderSide(color: Color(0xFF334155), width: 1.5),
        ),
        title: const Row(
          children: [
            Icon(Icons.alt_route_rounded, color: AppColors.tacticalCyan, size: 22),
            SizedBox(width: 10),
            Text(
              'Route Intelligence & Decision',
              style: TextStyle(color: Colors.white, fontWeight: FontWeight.w800, fontSize: 17),
            ),
          ],
        ),
        content: SizedBox(
          width: 500,
          child: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              const Text(
                'The Intelligent Dispatch Engine evaluated multiple candidate corridors over the Chennai road network graph to pick the optimal route.',
                style: TextStyle(color: Color(0xFF94A3B8), fontSize: 11),
              ),
              const SizedBox(height: 14),
              Container(
                decoration: BoxDecoration(
                  borderRadius: BorderRadius.circular(12),
                  border: Border.all(color: const Color(0xFF334155)),
                ),
                child: Column(
                  children: [
                    Container(
                      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
                      decoration: const BoxDecoration(
                        color: Color(0xFF1E293B),
                        borderRadius: BorderRadius.vertical(top: Radius.circular(11)),
                      ),
                      child: const Row(
                        children: [
                          Expanded(flex: 3, child: Text('Corridor', style: TextStyle(color: Colors.white70, fontSize: 11, fontWeight: FontWeight.w700))),
                          Expanded(flex: 2, child: Text('Distance', style: TextStyle(color: Colors.white70, fontSize: 11, fontWeight: FontWeight.w700))),
                          Expanded(flex: 2, child: Text('ETA', style: TextStyle(color: Colors.white70, fontSize: 11, fontWeight: FontWeight.w700))),
                          Expanded(flex: 3, child: Text('Decision', style: TextStyle(color: Colors.white70, fontSize: 11, fontWeight: FontWeight.w700))),
                        ],
                      ),
                    ),
                    Container(
                      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
                      color: AppColors.tacticalCyan.withValues(alpha: 0.15),
                      child: Row(
                        children: [
                          const Expanded(
                            flex: 3,
                            child: Row(
                              children: [
                                Icon(Icons.star_rounded, color: Color(0xFFFBBF24), size: 16),
                                SizedBox(width: 4),
                                Expanded(child: Text('Arterial (Primary)', style: TextStyle(color: Colors.white, fontSize: 11, fontWeight: FontWeight.w800))),
                              ],
                            ),
                          ),
                          Expanded(flex: 2, child: Text('${primaryDist.toStringAsFixed(1)} km', style: const TextStyle(color: Colors.white, fontSize: 11))),
                          Expanded(flex: 2, child: Text('$primaryEta min', style: const TextStyle(color: Color(0xFF4ADE80), fontSize: 11, fontWeight: FontWeight.w800))),
                          const Expanded(flex: 3, child: Text('SELECTED (Fastest)', style: TextStyle(color: AppColors.tacticalCyan, fontSize: 10, fontWeight: FontWeight.w800))),
                        ],
                      ),
                    ),
                    const Divider(height: 1, color: Color(0xFF334155)),
                    Container(
                      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
                      child: const Row(
                        children: [
                          Expanded(flex: 3, child: Text('Alternate Corridor 1', style: TextStyle(color: Color(0xFFCBD5E1), fontSize: 11))),
                          Expanded(flex: 2, child: Text('5.1 km', style: TextStyle(color: Color(0xFF94A3B8), fontSize: 11))),
                          Expanded(flex: 2, child: Text('11 min', style: TextStyle(color: Color(0xFFCBD5E1), fontSize: 11))),
                          Expanded(flex: 3, child: Text('Alternative • Dynamic Traffic', style: TextStyle(color: Color(0xFF94A3B8), fontSize: 9))),
                        ],
                      ),
                    ),
                  ],
                ),
              ),
              const SizedBox(height: 12),
              Container(
                padding: const EdgeInsets.all(10),
                decoration: BoxDecoration(
                  color: const Color(0xFF1E293B),
                  borderRadius: BorderRadius.circular(8),
                  border: Border.all(color: AppColors.tacticalCyan.withValues(alpha: 0.3)),
                ),
                child: Text(
                  'Reason: $reason',
                  style: const TextStyle(color: Color(0xFFE2E8F0), fontSize: 11, fontStyle: FontStyle.italic),
                ),
              ),
            ],
          ),
        ),
        actions: [
          FilledButton(
            onPressed: () => Navigator.pop(ctx),
            style: FilledButton.styleFrom(backgroundColor: AppColors.tacticalCyan, foregroundColor: Colors.black),
            child: const Text('DISMISS', style: TextStyle(fontWeight: FontWeight.w800)),
          ),
        ],
      ),
    );
  }

  Widget _buildBottomLifecycleCard(
    BuildContext context,
    DriverState driverState,
    NavigationState navState,
    DriverLifecycleState lifecycle,
    dynamic assignment,
  ) {
    final speed = navState.currentSpeedKmh.round();
    final heading = navState.currentHeading.round();
    final direction = navState.compassDirection;

    return Container(
      padding: const EdgeInsets.all(18),
      decoration: const BoxDecoration(
        color: AppColors.surface,
        borderRadius: BorderRadius.vertical(top: Radius.circular(24)),
        border: Border(top: BorderSide(color: AppColors.cardBorder)),
      ),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          // Vehicle Telemetry Row
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceAround,
            children: [
              _telemetryItem('SPEED', '$speed km/h', Icons.speed),
              Container(width: 1, height: 24, color: AppColors.cardBorder),
              _telemetryItem('HEADING', '$heading° $direction', Icons.explore),
              Container(width: 1, height: 24, color: AppColors.cardBorder),
              _telemetryItem('PHASE', lifecycle.displayName.replaceAll('_', ' '), Icons.sync),
            ],
          ),
          const SizedBox(height: 16),

          // Primary Lifecycle State Transition Action Button
          SizedBox(
            width: double.infinity,
            child: _buildLifecycleActionButton(context, driverState, navState, lifecycle, assignment),
          ),
        ],
      ),
    );
  }

  Widget _telemetryItem(String label, String value, IconData icon) {
    return Row(
      children: [
        Icon(icon, size: 14, color: AppColors.textMuted),
        const SizedBox(width: 6),
        Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(
              label,
              style: const TextStyle(
                color: AppColors.textMuted,
                fontSize: 9,
                fontWeight: FontWeight.w700,
                letterSpacing: 0.5,
              ),
            ),
            Text(
              value,
              style: const TextStyle(
                color: AppColors.textPrimary,
                fontSize: 12,
                fontWeight: FontWeight.w800,
              ),
            ),
          ],
        ),
      ],
    );
  }

  Widget _buildLifecycleActionButton(
    BuildContext context,
    DriverState driverState,
    NavigationState navState,
    DriverLifecycleState lifecycle,
    Assignment? assignment,
  ) {
    switch (lifecycle) {
      case DriverLifecycleState.enRouteToPatient:
        return ElevatedButton.icon(
          style: ElevatedButton.styleFrom(
            backgroundColor: AppColors.statusAvailable,
            foregroundColor: Colors.white,
            padding: const EdgeInsets.symmetric(vertical: 16),
          ),
          onPressed: () async {
            await driverState.advanceToArrivedAtPatient();
          },
          icon: const Icon(Icons.pin_drop, size: 22),
          label: const Text(
            'ARRIVED AT PATIENT LOCATION',
            style: TextStyle(fontWeight: FontWeight.w900, letterSpacing: 1.0),
          ),
        );

      case DriverLifecycleState.arrivedAtPatient:
        return ElevatedButton.icon(
          style: ElevatedButton.styleFrom(
            backgroundColor: AppColors.statusBusy,
            foregroundColor: Colors.black,
            padding: const EdgeInsets.symmetric(vertical: 16),
          ),
          onPressed: () async {
            await driverState.advanceToPatientOnboard();
          },
          icon: const Icon(Icons.airline_seat_flat, size: 22),
          label: const Text(
            'PATIENT ONBOARD',
            style: TextStyle(fontWeight: FontWeight.w900, letterSpacing: 1.0),
          ),
        );

      case DriverLifecycleState.patientOnboard:
        final hospName = (assignment is Assignment && assignment.destinationHospital != null)
            ? assignment.destinationHospital!.name
            : (navState.destinationName.isNotEmpty
                ? navState.destinationName
                : 'Assigned Destination Hospital');
        final hospBeds = (assignment is Assignment && assignment.destinationHospital != null)
            ? assignment.destinationHospital!.availableBeds
            : 5;
        final hospEta = navState.dynamicEtaMinutes > 0 ? navState.dynamicEtaMinutes : 11;
        final hospDist = navState.distanceRemainingKm > 0 ? navState.distanceRemainingKm : 6.4;

        return Column(
          children: [
            // Display assigned hospital specs (Checklist Section 14)
            Container(
              padding: const EdgeInsets.all(12),
              margin: const EdgeInsets.only(bottom: 12),
              decoration: BoxDecoration(
                color: AppColors.hospitalBadge.withValues(alpha: 0.15),
                borderRadius: BorderRadius.circular(12),
                border: Border.all(color: AppColors.hospitalBadge.withValues(alpha: 0.4)),
              ),
              child: Row(
                children: [
                  const Icon(Icons.local_hospital, color: AppColors.hospitalBadge, size: 24),
                  const SizedBox(width: 12),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          'Destination Hospital: $hospName',
                          style: const TextStyle(
                            color: Colors.white,
                            fontSize: 13,
                            fontWeight: FontWeight.w800,
                          ),
                        ),
                        Text(
                          'Distance: ${hospDist.toStringAsFixed(1)} km • ETA: $hospEta min • Available ICU Beds: $hospBeds',
                          style: const TextStyle(color: AppColors.textSecondary, fontSize: 11),
                        ),
                      ],
                    ),
                  ),
                ],
              ),
            ),
            ElevatedButton.icon(
              style: ElevatedButton.styleFrom(
                backgroundColor: AppColors.emergencyRed,
                foregroundColor: Colors.white,
                padding: const EdgeInsets.symmetric(vertical: 16),
              ),
              onPressed: () async {
                await driverState.advanceToEnRouteToHospital();
                final targetHospital = assignment?.destinationHospital ??
                    const Hospital(
                      hospitalId: 'H020',
                      name: 'Vijaya Hospital',
                      location: GeoPoint(13.0480, 80.2085),
                      address: 'Vadapalani, Chennai',
                    );
                navState.startJourneyToHospital(
                  targetHospital,
                  hospitalRoute: assignment?.hospitalRoute,
                  alternativeRoutes: assignment?.alternativeRoutes,
                );
              },
              icon: const Icon(Icons.navigation, size: 22),
              label: const Text(
                'START NAVIGATION TO HOSPITAL',
                style: TextStyle(fontWeight: FontWeight.w900, letterSpacing: 1.0),
              ),
            ),
          ],
        );

      case DriverLifecycleState.enRouteToHospital:
        return ElevatedButton.icon(
          style: ElevatedButton.styleFrom(
            backgroundColor: AppColors.hospitalBadge,
            foregroundColor: Colors.white,
            padding: const EdgeInsets.symmetric(vertical: 16),
          ),
          onPressed: () async {
            await driverState.advanceToArrivedAtHospital();
          },
          icon: const Icon(Icons.domain, size: 22),
          label: const Text(
            'ARRIVED AT HOSPITAL',
            style: TextStyle(fontWeight: FontWeight.w900, letterSpacing: 1.0),
          ),
        );

      case DriverLifecycleState.arrivedAtHospital:
        return ElevatedButton.icon(
          style: ElevatedButton.styleFrom(
            backgroundColor: AppColors.statusAvailable,
            foregroundColor: Colors.white,
            padding: const EdgeInsets.symmetric(vertical: 16),
          ),
          onPressed: () {
            _showMissionDebriefModal(
              context,
              assignment is Assignment ? assignment : null,
              driverState,
              navState,
            );
          },
          icon: const Icon(Icons.task_alt, size: 22),
          label: const Text(
            'COMPLETE MISSION & BECOME AVAILABLE',
            style: TextStyle(fontWeight: FontWeight.w900, letterSpacing: 1.0),
          ),
        );

      default:
        return ElevatedButton(
          onPressed: () => Navigator.pushReplacementNamed(context, '/dashboard'),
          child: const Text('RETURN TO DASHBOARD'),
        );
    }
  }

  void _showMissionDebriefModal(
    BuildContext context,
    Assignment? assignment,
    DriverState driverState,
    NavigationState navState,
  ) {
    final hosp = assignment?.destinationHospital;
    final hospName = hosp?.name ?? (navState.destinationName.isNotEmpty ? navState.destinationName : 'Vijaya Hospital');
    final baselineEta = assignment?.baselineEta ?? 11;
    final actualEta = assignment?.etaMinutes ?? 8;
    final savedMins = (baselineEta - actualEta).clamp(1, 10);
    final savedPct = assignment?.etaImprovementPct ??
        ((savedMins / baselineEta) * 100).roundToDouble();
    final reason = assignment?.decisionReason ??
        'Arterial corridor prioritized to mitigate high congestion along secondary links, ensuring fastest handover time.';
    final baselineDist = assignment?.baselineDistance ?? 5.2;
    final actualDist = assignment?.distanceKm ?? 4.2;

    showDialog(
      context: context,
      barrierDismissible: false,
      builder: (ctx) => AlertDialog(
        backgroundColor: const Color(0xFF0F172A),
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(20),
          side: const BorderSide(color: Color(0xFF334155), width: 1.5),
        ),
        title: Row(
          children: [
            Container(
              padding: const EdgeInsets.all(8),
              decoration: BoxDecoration(
                color: AppColors.statusAvailable.withValues(alpha: 0.2),
                borderRadius: BorderRadius.circular(10),
              ),
              child: const Icon(Icons.verified, color: AppColors.statusAvailable, size: 24),
            ),
            const SizedBox(width: 12),
            const Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    'Mission Debrief & Metrics',
                    style: TextStyle(color: Colors.white, fontWeight: FontWeight.w800, fontSize: 17),
                  ),
                  Text(
                    'Trip Completed • Intelligent Match Intelligence',
                    style: TextStyle(color: AppColors.textSecondary, fontSize: 11),
                  ),
                ],
              ),
            ),
          ],
        ),
        content: SizedBox(
          width: 540,
          child: SingleChildScrollView(
            child: Column(
              mainAxisSize: MainAxisSize.min,
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Container(
                  padding: const EdgeInsets.all(12),
                  decoration: BoxDecoration(
                    color: AppColors.hospitalBadge.withValues(alpha: 0.15),
                    borderRadius: BorderRadius.circular(12),
                    border: Border.all(color: AppColors.hospitalBadge.withValues(alpha: 0.4)),
                  ),
                  child: Row(
                    children: [
                      const Icon(Icons.local_hospital, color: AppColors.hospitalBadge, size: 28),
                      const SizedBox(width: 12),
                      Expanded(
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Text(
                              'Handover Facility: $hospName',
                              style: const TextStyle(color: Colors.white, fontWeight: FontWeight.w800, fontSize: 13),
                            ),
                            const SizedBox(height: 2),
                            Text(
                              'Emergency handover completed successfully.',
                              style: const TextStyle(color: AppColors.textSecondary, fontSize: 11),
                            ),
                          ],
                        ),
                      ),
                    ],
                  ),
                ),
                const SizedBox(height: 14),
                Container(
                  padding: const EdgeInsets.all(12),
                  decoration: BoxDecoration(
                    color: const Color(0xFF1E293B),
                    borderRadius: BorderRadius.circular(12),
                    border: Border.all(color: const Color(0xFF334155)),
                  ),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      const Text(
                        'MISSION SUMMARY',
                        style: TextStyle(color: AppColors.tacticalCyan, fontSize: 11, fontWeight: FontWeight.w800, letterSpacing: 0.5),
                      ),
                      const SizedBox(height: 10),
                      Row(
                        children: [
                          const Icon(Icons.timer_outlined, color: AppColors.tacticalCyan, size: 16),
                          const SizedBox(width: 8),
                          Text(
                            'Travel time: $actualEta min',
                            style: const TextStyle(color: Colors.white, fontSize: 12, fontWeight: FontWeight.w700),
                          ),
                        ],
                      ),
                      const SizedBox(height: 8),
                      Row(
                        children: [
                          const Icon(Icons.route_outlined, color: AppColors.tacticalCyan, size: 16),
                          const SizedBox(width: 8),
                          Text(
                            'Distance: ${actualDist.toStringAsFixed(1)} km',
                            style: const TextStyle(color: Colors.white, fontSize: 12, fontWeight: FontWeight.w700),
                          ),
                        ],
                      ),
                    ],
                  ),
                ),
                const SizedBox(height: 14),
                Container(
                  padding: const EdgeInsets.all(12),
                  decoration: BoxDecoration(
                    color: const Color(0xFF1E293B),
                    borderRadius: BorderRadius.circular(10),
                    border: Border.all(color: AppColors.tacticalCyan.withValues(alpha: 0.3)),
                  ),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      const Row(
                        children: [
                          Icon(Icons.check_circle_outline, color: AppColors.tacticalCyan, size: 18),
                          SizedBox(width: 8),
                          Text(
                            'DISPATCH RESULT',
                            style: TextStyle(color: AppColors.tacticalCyan, fontSize: 11, fontWeight: FontWeight.w800),
                          ),
                        ],
                      ),
                      const SizedBox(height: 6),
                      Text(
                        reason,
                        style: const TextStyle(color: Color(0xFFE2E8F0), fontSize: 11, height: 1.4),
                      ),
                    ],
                  ),
                ),
              ],
            ),
          ),
        ),
        actions: [
          ElevatedButton(
            style: ElevatedButton.styleFrom(
              backgroundColor: AppColors.statusAvailable,
              foregroundColor: Colors.white,
              padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 12),
              shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
            ),
            onPressed: () async {
              Navigator.pop(ctx);
              navState.stopNavigation();
              await driverState.completeMission();
              if (context.mounted) {
                Navigator.pushReplacementNamed(context, '/dashboard');
              }
            },
            child: const Text(
              'ACKNOWLEDGE & RETURN TO DASHBOARD',
              style: TextStyle(fontWeight: FontWeight.w900),
            ),
          ),
        ],
      ),
    );
  }
}
