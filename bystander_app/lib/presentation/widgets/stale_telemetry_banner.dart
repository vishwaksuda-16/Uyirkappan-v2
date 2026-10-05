import 'package:flutter/material.dart';
import '../../core/theme/app_colors.dart';

/// Reassuring, non-alarming alert banner displayed when vehicle telemetry updates
/// are delayed by more than 45 seconds (e.g. temporary cellular dead zones).
class StaleTelemetryBanner extends StatelessWidget {
  final int secondsDelayed;

  const StaleTelemetryBanner({
    super.key,
    required this.secondsDelayed,
  });

  @override
  Widget build(BuildContext context) {
    return Container(
      width: double.infinity,
      padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
      margin: const EdgeInsets.only(bottom: 12),
      decoration: BoxDecoration(
        color: AppColors.warning.withValues(alpha: 0.12),
        borderRadius: BorderRadius.circular(14),
        border: Border.all(color: AppColors.warning.withValues(alpha: 0.5), width: 1.2),
      ),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.center,
        children: [
          const Icon(Icons.sync_problem_rounded, color: AppColors.warning, size: 20),
          const SizedBox(width: 10),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              mainAxisSize: MainAxisSize.min,
              children: [
                const Text(
                  'Telemetry Connection Re-establishing',
                  style: TextStyle(
                    fontSize: 12,
                    fontWeight: FontWeight.w800,
                    color: AppColors.warning,
                  ),
                ),
                const SizedBox(height: 2),
                Text(
                  'Telemetry update delayed; last received $secondsDelayed seconds ago. Unit is continuing on assigned route.',
                  style: const TextStyle(
                    fontSize: 11,
                    height: 1.3,
                  ),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}
