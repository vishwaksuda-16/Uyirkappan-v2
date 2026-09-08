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
              currentLocation: navState.currentLocation,
              destinationName: navState.destinationName,
              isEnRouteToHospital: lifecycle == DriverLifecycleState.enRouteToHospital ||
                  lifecycle == DriverLifecycleState.arrivedAtHospital,
            ),

            // 2. Top Navigation HUD
            Positioned(
              top: 12,
              left: 12,
              right: 12,
              child: Column(
                children: [
                  _buildTopHud(context, driverState, navState),
                  if (navState.trafficAlert != null) ...[
                    const SizedBox(height: 8),
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
                        'Target Waypoint: ${navState.currentLocation?.nodeName ?? "En Route"}',
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
          _buildLifecycleActionButton(context, driverState, navState, lifecycle, assignment),
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
                : 'Apollo Trauma & Emergency Center (HOSP-01)');
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
                      hospitalId: 'H1',
                      name: 'Apollo Hospital (Greams Road)',
                      location: GeoPoint(13.0610, 80.2520),
                      address: '21 Greams Lane, Thousand Lights, Chennai',
                    );
                navState.startJourneyToHospital(targetHospital);
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
          onPressed: () async {
            navState.stopNavigation();
            await driverState.completeMission();
            if (context.mounted) {
              Navigator.pushReplacementNamed(context, '/dashboard');
            }
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
}
