import 'package:flutter/material.dart';
import '../../core/constants/app_colors.dart';

/// A banner that warns the driver when GPS telemetry updates are lagging.
/// Uses a non-alarming amber color scheme to avoid confusion with red emergency alerts.
class StaleTelemetryBanner extends StatelessWidget {
  /// The number of seconds since the last telemetry update.
  final int secondsSinceUpdate;
  
  /// The threshold at which telemetry is considered stale. Default is 45 seconds.
  final int staleThresholdSeconds;

  /// Callback when the dismiss button is tapped. If null, the banner cannot be dismissed.
  final VoidCallback? onDismiss;

  const StaleTelemetryBanner({
    super.key,
    required this.secondsSinceUpdate,
    this.staleThresholdSeconds = 45,
    this.onDismiss,
  });

  @override
  Widget build(BuildContext context) {
    if (secondsSinceUpdate < staleThresholdSeconds) {
      return const SizedBox.shrink();
    }

    return Semantics(
      label: 'Telemetry lagging by $secondsSinceUpdate seconds',
      child: Container(
        margin: const EdgeInsets.all(8.0),
        decoration: BoxDecoration(
          color: AppColors.warningOrange.withValues(alpha: 0.15),
          border: Border.all(color: AppColors.warningOrange.withValues(alpha: 0.5)),
          borderRadius: BorderRadius.circular(8.0),
        ),
        child: Material(
          color: Colors.transparent,
          child: Padding(
            padding: const EdgeInsets.symmetric(horizontal: 16.0, vertical: 12.0),
            child: Row(
              children: [
                const Icon(
                  Icons.wifi_tethering_error_rounded,
                  color: AppColors.warningOrange,
                  size: 24.0,
                ),
                const SizedBox(width: 12.0),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      const Text(
                        'Signal Weak / Stale Data',
                        style: TextStyle(
                          color: AppColors.warningOrange,
                          fontWeight: FontWeight.bold,
                          fontSize: 14.0,
                        ),
                      ),
                      const SizedBox(height: 2.0),
                      Text(
                        'Last location update was $secondsSinceUpdate seconds ago.',
                        style: const TextStyle(
                          color: AppColors.textPrimary,
                          fontSize: 13.0,
                        ),
                      ),
                    ],
                  ),
                ),
                if (onDismiss != null)
                  IconButton(
                    icon: const Icon(Icons.close, color: AppColors.textSecondary),
                    onPressed: onDismiss,
                    tooltip: 'Dismiss',
                    constraints: const BoxConstraints(
                      minWidth: 48.0,
                      minHeight: 48.0,
                    ),
                  ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}
