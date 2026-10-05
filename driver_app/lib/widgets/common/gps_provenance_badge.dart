import 'package:flutter/material.dart';
import '../../core/constants/app_colors.dart';

/// A badge that displays the provenance of the GPS signal (Real vs Simulation).
/// Shows green for actual GPS hardware, and amber/warning for simulated data.
class GpsProvenanceBadge extends StatelessWidget {
  /// Whether the GPS signal is real hardware (true) or simulated/mock (false).
  final bool isRealGps;

  /// Whether the GPS telemetry is considered stale (lagging).
  final bool isStale;

  /// The number of seconds since the last GPS update, if available.
  final int? secondsSinceUpdate;

  /// Whether to display in a compact mode with tighter padding.
  final bool isCompact;

  const GpsProvenanceBadge({
    super.key,
    required this.isRealGps,
    this.isStale = false,
    this.secondsSinceUpdate,
    this.isCompact = false,
  });

  @override
  Widget build(BuildContext context) {
    // Determine colors and text based on provenance
    final badgeColor = isRealGps ? AppColors.statusAvailable : AppColors.warningOrange;
    final badgeBg = isRealGps ? AppColors.statusAvailable.withValues(alpha: 0.15) : AppColors.warningOrange.withValues(alpha: 0.15);
    final labelText = isRealGps ? '● GPS LIVE (REAL)' : '○ GPS SIMULATION';
    final iconData = isRealGps ? Icons.gps_fixed_rounded : Icons.gps_not_fixed_rounded;

    return Semantics(
      label: 'GPS Status: ${isRealGps ? "Real" : "Simulated"}${isStale ? ", Stale data" : ""}',
      child: Container(
        padding: isCompact 
            ? const EdgeInsets.symmetric(horizontal: 8.0, vertical: 4.0)
            : const EdgeInsets.symmetric(horizontal: 12.0, vertical: 6.0),
        decoration: BoxDecoration(
          color: badgeBg,
          borderRadius: BorderRadius.circular(16.0),
          border: Border.all(color: badgeColor.withValues(alpha: 0.5), width: 1),
        ),
        child: Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            Icon(
              iconData,
              color: badgeColor,
              size: isCompact ? 14.0 : 16.0,
            ),
            const SizedBox(width: 6.0),
            Text(
              labelText,
              style: TextStyle(
                color: badgeColor,
                fontWeight: FontWeight.w700,
                fontSize: isCompact ? 10.0 : 12.0,
                letterSpacing: 0.5,
              ),
            ),
            if (isStale && secondsSinceUpdate != null) ...[
              const SizedBox(width: 8.0),
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 6.0, vertical: 2.0),
                decoration: BoxDecoration(
                  color: AppColors.warningOrange.withValues(alpha: 0.2),
                  borderRadius: BorderRadius.circular(8.0),
                ),
                child: Text(
                  '${secondsSinceUpdate}s lag',
                  style: TextStyle(
                    color: AppColors.warningOrange,
                    fontWeight: FontWeight.w600,
                    fontSize: isCompact ? 9.0 : 10.0,
                  ),
                ),
              ),
            ]
          ],
        ),
      ),
    );
  }
}
