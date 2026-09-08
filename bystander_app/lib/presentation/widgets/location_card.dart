import 'package:flutter/material.dart';
import '../../core/theme/app_colors.dart';
import '../../core/theme/app_text_styles.dart';
import '../../core/utils/location_formatter.dart';
import '../../domain/entities/location_data.dart';
import '../controllers/location_controller.dart';

/// Modern telemetry card displaying GPS detection status, coordinates, accuracy, and quick adjust.
class LocationCard extends StatelessWidget {
  final LocationController locationController;
  final VoidCallback onAdjustLocation;

  const LocationCard({
    super.key,
    required this.locationController,
    required this.onAdjustLocation,
  });

  @override
  Widget build(BuildContext context) {
    final LocationData? loc = locationController.emergencyLocation;
    final isManual = locationController.isManualOverride;
    final status = locationController.status;
    final theme = Theme.of(context);
    final isDark = theme.brightness == Brightness.dark;

    final isGpsLocked = status == LocationFetchStatus.success || isManual;

    return Container(
      decoration: BoxDecoration(
        color: isDark ? const Color(0xFF1E293B) : Colors.white,
        borderRadius: BorderRadius.circular(20),
        border: Border.all(
          color: isGpsLocked
              ? AppColors.gpsActive.withValues(alpha: 0.3)
              : Colors.black.withValues(alpha: 0.08),
          width: 1.2,
        ),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withValues(alpha: isDark ? 0.3 : 0.06),
            blurRadius: 14,
            offset: const Offset(0, 4),
          ),
        ],
      ),
      padding: const EdgeInsets.all(16),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              // Pulsing status radar beacon
              Container(
                padding: const EdgeInsets.all(10),
                decoration: BoxDecoration(
                  color: isGpsLocked
                      ? AppColors.gpsActive.withValues(alpha: 0.12)
                      : AppColors.warning.withValues(alpha: 0.12),
                  shape: BoxShape.circle,
                ),
                child: Icon(
                  isManual ? Icons.edit_location_alt_rounded : Icons.my_location_rounded,
                  size: 20,
                  color: isGpsLocked ? AppColors.gpsActive : AppColors.warning,
                ),
              ),
              const SizedBox(width: 12),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      isManual ? 'Pickup Location (Adjusted)' : 'Current Incident Location',
                      style: const TextStyle(
                        fontSize: 14,
                        fontWeight: FontWeight.w800,
                        letterSpacing: -0.2,
                      ),
                    ),
                    const SizedBox(height: 2),
                    Row(
                      children: [
                        Container(
                          width: 7,
                          height: 7,
                          decoration: BoxDecoration(
                            color: isGpsLocked ? AppColors.gpsActive : AppColors.warning,
                            shape: BoxShape.circle,
                          ),
                        ),
                        const SizedBox(width: 6),
                        Text(
                          status == LocationFetchStatus.loading
                              ? 'Acquiring GPS fix...'
                              : (status == LocationFetchStatus.success
                                  ? 'High-Accuracy GPS Lock'
                                  : (isManual ? 'Manual Pin Selected' : 'Cell Tower Triangulation')),
                          style: TextStyle(
                            fontSize: 12,
                            color: isGpsLocked ? AppColors.gpsActive : AppColors.textSecondaryLight,
                            fontWeight: FontWeight.w700,
                          ),
                        ),
                      ],
                    ),
                  ],
                ),
              ),
              // Sleek Adjust Pin Pill Button
              InkWell(
                onTap: onAdjustLocation,
                borderRadius: BorderRadius.circular(16),
                child: Container(
                  padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
                  decoration: BoxDecoration(
                    color: AppColors.emergencyLightRed,
                    borderRadius: BorderRadius.circular(16),
                  ),
                  child: const Row(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      Icon(Icons.tune_rounded, size: 14, color: AppColors.emergencyRed),
                      SizedBox(width: 4),
                      Text(
                        'ADJUST',
                        style: TextStyle(
                          fontSize: 11,
                          fontWeight: FontWeight.w900,
                          letterSpacing: 0.5,
                          color: AppColors.emergencyRed,
                        ),
                      ),
                    ],
                  ),
                ),
              ),
            ],
          ),

          if (loc != null) ...[
            const SizedBox(height: 12),
            const Divider(height: 1),
            const SizedBox(height: 10),
            Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    const Text('LAT / LNG COORDINATES', style: AppTextStyles.caption),
                    const SizedBox(height: 2),
                    Text(
                      LocationFormatter.formatCoordinates(loc.latitude, loc.longitude),
                      style: const TextStyle(
                        fontSize: 12,
                        fontWeight: FontWeight.w800,
                        fontFamily: 'monospace',
                      ),
                    ),
                  ],
                ),
                Column(
                  crossAxisAlignment: CrossAxisAlignment.end,
                  children: [
                    const Text('EST. ACCURACY', style: AppTextStyles.caption),
                    const SizedBox(height: 2),
                    Text(
                      LocationFormatter.formatAccuracy(loc.accuracy),
                      style: const TextStyle(
                        fontSize: 12,
                        fontWeight: FontWeight.w700,
                      ),
                    ),
                  ],
                ),
              ],
            ),
          ],
        ],
      ),
    );
  }
}
