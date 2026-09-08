import 'package:flutter/material.dart';
import '../../../core/theme/app_colors.dart';

/// Directional D-pad used to nudge the incident pin by ±0.0015°.
class MapNudgePad extends StatelessWidget {
  static const double nudgeDegrees = 0.0015;

  final void Function(double latDelta, double lngDelta) onNudge;

  const MapNudgePad({super.key, required this.onNudge});

  @override
  Widget build(BuildContext context) {
    return Container(
      width: 108,
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(20),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withValues(alpha: 0.12),
            blurRadius: 8,
            offset: const Offset(0, 2),
          ),
        ],
      ),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          IconButton(
            icon: const Icon(Icons.keyboard_arrow_up_rounded),
            visualDensity: VisualDensity.compact,
            color: Colors.black87,
            tooltip: 'Nudge North',
            onPressed: () => onNudge(nudgeDegrees, 0),
          ),
          Row(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              IconButton(
                icon: const Icon(Icons.keyboard_arrow_left_rounded),
                visualDensity: VisualDensity.compact,
                color: Colors.black87,
                tooltip: 'Nudge West',
                onPressed: () => onNudge(0, -nudgeDegrees),
              ),
              const Icon(Icons.control_camera_rounded, size: 16, color: AppColors.textSecondaryLight),
              IconButton(
                icon: const Icon(Icons.keyboard_arrow_right_rounded),
                visualDensity: VisualDensity.compact,
                color: Colors.black87,
                tooltip: 'Nudge East',
                onPressed: () => onNudge(0, nudgeDegrees),
              ),
            ],
          ),
          IconButton(
            icon: const Icon(Icons.keyboard_arrow_down_rounded),
            visualDensity: VisualDensity.compact,
            color: Colors.black87,
            tooltip: 'Nudge South',
            onPressed: () => onNudge(-nudgeDegrees, 0),
          ),
        ],
      ),
    );
  }
}
