import 'package:flutter/material.dart';
import '../../../core/constants/map_constants.dart';
import '../../../core/theme/app_colors.dart';
import '../../../domain/entities/location_data.dart';
import '../../../domain/entities/tracking_info.dart';
import '../../../domain/repositories/tracking_repository.dart';
import '../../controllers/emergency_controller.dart';
import '../../widgets/map/map_style_selector.dart';
import '../../widgets/map/openfreemap_view.dart';

/// Screen 6: High-Fidelity Live Tracking & Telemetry Screen powered by OpenFreeMap & MapLibre GL.
/// Displays real-time / simulated ambulance GPS movement, heading, route polyline, and dynamic ETA.
class TrackingPlaceholderScreen extends StatefulWidget {
  final EmergencyController emergencyController;
  final TrackingRepository trackingRepository;

  const TrackingPlaceholderScreen({
    super.key,
    required this.emergencyController,
    required this.trackingRepository,
  });

  @override
  State<TrackingPlaceholderScreen> createState() => _TrackingPlaceholderScreenState();
}

class _TrackingPlaceholderScreenState extends State<TrackingPlaceholderScreen> {
  TrackingInfo? _currentTelemetry;
  OpenFreeMapStyle _selectedMapStyle = OpenFreeMapStyle.bright;

  @override
  void initState() {
    super.initState();
    final active = widget.emergencyController.activeRequest;
    if (active != null) {
      widget.trackingRepository.getTrackingInfo(active.requestId).then((info) {
        if (mounted && info != null) {
          setState(() {
            _currentTelemetry = info;
          });
        }
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    final activeRequest = widget.emergencyController.activeRequest;
    final theme = Theme.of(context);
    final isDark = theme.brightness == Brightness.dark;

    return Scaffold(
      body: StreamBuilder<TrackingInfo>(
        stream: activeRequest != null
            ? widget.trackingRepository.watchTrackingUpdates(activeRequest.requestId)
            : const Stream.empty(),
        initialData: _currentTelemetry,
        builder: (context, snapshot) {
          final telemetry = snapshot.data ?? _currentTelemetry;
          final ambulanceId = telemetry?.ambulanceId ?? activeRequest?.assignedAmbulanceId ?? 'AMB-CH-042';
          final etaFormatted = telemetry?.eta?.formattedEta ?? '6 min';
          final speed = telemetry?.speedKmH != null ? '${telemetry!.speedKmH!.toStringAsFixed(0)} km/h' : '48 km/h';

          return Stack(
            children: [
              // 1. Full-Bleed MapLibre GL JS & OpenFreeMap Canvas
              Positioned.fill(
                child: OpenFreeMapView(
                  incidentLocation: activeRequest?.emergencyLocation,
                  ambulanceLocation: telemetry != null
                      ? LocationData(
                          latitude: telemetry.latitude,
                          longitude: telemetry.longitude,
                          timestamp: telemetry.timestamp,
                        )
                      : null,
                  heading: telemetry?.headingDegrees,
                  ambulanceId: ambulanceId,
                  style: _selectedMapStyle,
                  isPickerMode: false,
                ),
              ),

              // 2. Top Floating Navigation & ETA Capsule
              Positioned(
                top: 0,
                left: 0,
                right: 0,
                child: SafeArea(
                  child: Center(
                    child: ConstrainedBox(
                      constraints: const BoxConstraints(maxWidth: 540),
                      child: Padding(
                        padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 8),
                        child: Column(
                          mainAxisSize: MainAxisSize.min,
                          children: [
                        Container(
                          padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 8),
                          decoration: BoxDecoration(
                            color: isDark ? const Color(0xFF1E293B).withValues(alpha: 0.95) : Colors.white.withValues(alpha: 0.95),
                            borderRadius: BorderRadius.circular(20),
                            boxShadow: [
                              BoxShadow(
                                color: Colors.black.withValues(alpha: 0.14),
                                blurRadius: 16,
                                offset: const Offset(0, 4),
                              ),
                            ],
                          ),
                          child: Row(
                            children: [
                              IconButton(
                                icon: const Icon(Icons.arrow_back_rounded),
                                onPressed: () => Navigator.pop(context),
                                tooltip: 'Back',
                                visualDensity: VisualDensity.compact,
                              ),
                              const SizedBox(width: 4),
                              // Live ETA Pill
                              Container(
                                padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 5),
                                decoration: BoxDecoration(
                                  color: AppColors.emergencyRed,
                                  borderRadius: BorderRadius.circular(12),
                                ),
                                child: Row(
                                  mainAxisSize: MainAxisSize.min,
                                  children: [
                                    const Icon(Icons.timer_rounded, color: Colors.white, size: 14),
                                    const SizedBox(width: 5),
                                    Text(
                                      etaFormatted.toUpperCase(),
                                      style: const TextStyle(
                                        color: Colors.white,
                                        fontSize: 12,
                                        fontWeight: FontWeight.w900,
                                        letterSpacing: 0.5,
                                      ),
                                    ),
                                  ],
                                ),
                              ),
                              const SizedBox(width: 8),
                              Expanded(
                                child: Column(
                                  crossAxisAlignment: CrossAxisAlignment.start,
                                  mainAxisSize: MainAxisSize.min,
                                  children: [
                                    Text(
                                      ambulanceId,
                                      style: const TextStyle(
                                        fontSize: 12,
                                        fontWeight: FontWeight.w800,
                                        letterSpacing: 0.4,
                                      ),
                                      maxLines: 1,
                                      overflow: TextOverflow.ellipsis,
                                    ),
                                    const Text(
                                      'En Route to Scene',
                                      style: TextStyle(
                                        fontSize: 11,
                                        color: AppColors.success,
                                        fontWeight: FontWeight.w700,
                                      ),
                                    ),
                                  ],
                                ),
                              ),
                            ],
                          ),
                        ),
                        const SizedBox(height: 8),
                        MapStyleSelector(
                          currentStyle: _selectedMapStyle,
                          onStyleSelected: (style) {
                            setState(() => _selectedMapStyle = style);
                          },
                        ),
                      ],
                    ),
                  ),
                ),
              ),
            ),
          ),

              // 3. Bottom Slide-Up Telemetry Card
              Positioned(
                left: 0,
                right: 0,
                bottom: 14,
                child: SafeArea(
                  top: false,
                  child: Center(
                    child: ConstrainedBox(
                      constraints: const BoxConstraints(maxWidth: 540),
                      child: Padding(
                        padding: const EdgeInsets.symmetric(horizontal: 14),
                        child: Container(
                          padding: const EdgeInsets.all(18),
                    decoration: BoxDecoration(
                      color: isDark ? const Color(0xFF1E293B) : Colors.white,
                      borderRadius: BorderRadius.circular(24),
                      boxShadow: [
                        BoxShadow(
                          color: Colors.black.withValues(alpha: 0.18),
                          blurRadius: 24,
                          offset: const Offset(0, 6),
                        ),
                      ],
                    ),
                    child: Column(
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        // Driver and Ambulance Info Row
                        Row(
                          children: [
                            Container(
                              width: 46,
                              height: 46,
                              decoration: BoxDecoration(
                                color: AppColors.emergencyLightRed,
                                shape: BoxShape.circle,
                                border: Border.all(color: AppColors.emergencyRed.withValues(alpha: 0.3), width: 2),
                              ),
                              child: const Center(
                                child: Text('🚑', style: TextStyle(fontSize: 22)),
                              ),
                            ),
                            const SizedBox(width: 12),
                            Expanded(
                              child: Column(
                                crossAxisAlignment: CrossAxisAlignment.start,
                                children: [
                                  Row(
                                    children: [
                                      Text(
                                        ambulanceId,
                                        style: const TextStyle(
                                          fontSize: 16,
                                          fontWeight: FontWeight.w900,
                                          letterSpacing: 0.3,
                                        ),
                                      ),
                                      const SizedBox(width: 8),
                                      Container(
                                        padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                                        decoration: BoxDecoration(
                                          color: AppColors.info.withValues(alpha: 0.12),
                                          borderRadius: BorderRadius.circular(6),
                                        ),
                                        child: const Text(
                                          'ALS UNIT',
                                          style: TextStyle(
                                            fontSize: 9,
                                            fontWeight: FontWeight.w800,
                                            color: AppColors.info,
                                          ),
                                        ),
                                      ),
                                    ],
                                  ),
                                  const SizedBox(height: 2),
                                  const Text(
                                    'Driver: Suresh Kumar • Unit 42',
                                    style: TextStyle(
                                      fontSize: 12,
                                      color: AppColors.textSecondaryLight,
                                      fontWeight: FontWeight.w500,
                                    ),
                                  ),
                                ],
                              ),
                            ),
                            // Quick Call Button
                            InkWell(
                              onTap: () {
                                ScaffoldMessenger.of(context).showSnackBar(
                                  const SnackBar(
                                    content: Text('Calling Ambulance Unit: 108...'),
                                    duration: Duration(seconds: 2),
                                  ),
                                );
                              },
                              borderRadius: BorderRadius.circular(20),
                              child: Container(
                                padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
                                decoration: BoxDecoration(
                                  color: AppColors.success,
                                  borderRadius: BorderRadius.circular(20),
                                  boxShadow: [
                                    BoxShadow(
                                      color: AppColors.success.withValues(alpha: 0.3),
                                      blurRadius: 8,
                                      offset: const Offset(0, 2),
                                    ),
                                  ],
                                ),
                                child: const Row(
                                  mainAxisSize: MainAxisSize.min,
                                  children: [
                                    Icon(Icons.phone_in_talk_rounded, color: Colors.white, size: 16),
                                    SizedBox(width: 6),
                                    Text(
                                      'CALL',
                                      style: TextStyle(
                                        color: Colors.white,
                                        fontSize: 12,
                                        fontWeight: FontWeight.w900,
                                      ),
                                    ),
                                  ],
                                ),
                              ),
                            ),
                          ],
                        ),

                        const SizedBox(height: 14),
                        const Divider(height: 1),
                        const SizedBox(height: 14),

                        // Telemetry Metrics Grid
                        Row(
                          mainAxisAlignment: MainAxisAlignment.spaceAround,
                          children: [
                            _buildTelemetryMetric(
                              icon: Icons.speed_rounded,
                              label: 'LIVE SPEED',
                              value: speed,
                              color: AppColors.info,
                            ),
                            Container(width: 1, height: 32, color: Colors.grey.withValues(alpha: 0.2)),
                            _buildTelemetryMetric(
                              icon: Icons.alt_route_rounded,
                              label: 'DISTANCE',
                              value: '2.4 km',
                              color: AppColors.emergencyRed,
                            ),
                            Container(width: 1, height: 32, color: Colors.grey.withValues(alpha: 0.2)),
                            _buildTelemetryMetric(
                              icon: Icons.traffic_rounded,
                              label: 'CORRIDOR',
                              value: 'ACTIVE',
                              color: AppColors.success,
                            ),
                          ],
                        ),
                      ],
                    ),
                  ),
                ),
              ),
            ),
          ),
        ),
      ],
    );
  },
      ),
    );
  }

  Widget _buildTelemetryMetric({
    required IconData icon,
    required String label,
    required String value,
    required Color color,
  }) {
    return Column(
      mainAxisSize: MainAxisSize.min,
      children: [
        Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            Icon(icon, size: 14, color: color),
            const SizedBox(width: 4),
            Text(
              label,
              style: const TextStyle(
                fontSize: 10,
                fontWeight: FontWeight.w800,
                letterSpacing: 0.5,
                color: AppColors.textSecondaryLight,
              ),
            ),
          ],
        ),
        const SizedBox(height: 4),
        Text(
          value,
          style: TextStyle(
            fontSize: 15,
            fontWeight: FontWeight.w900,
            color: color,
          ),
        ),
      ],
    );
  }
}
