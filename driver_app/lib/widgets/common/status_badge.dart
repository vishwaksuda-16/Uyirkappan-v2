import 'package:flutter/material.dart';
import '../../core/constants/app_colors.dart';
import '../../models/state_enums.dart';

class StatusBadge extends StatelessWidget {
  final AmbulanceAvailability availability;
  final bool compact;

  const StatusBadge({
    super.key,
    required this.availability,
    this.compact = false,
  });

  @override
  Widget build(BuildContext context) {
    final Color color;
    final String label;

    switch (availability) {
      case AmbulanceAvailability.available:
        color = AppColors.statusAvailable;
        label = 'AVAILABLE';
        break;
      case AmbulanceAvailability.busy:
        color = AppColors.statusBusy;
        label = 'BUSY';
        break;
      case AmbulanceAvailability.offline:
        color = AppColors.statusOffline;
        label = 'OFFLINE';
        break;
    }

    return Container(
      padding: EdgeInsets.symmetric(
        horizontal: compact ? 8 : 12,
        vertical: compact ? 4 : 6,
      ),
      decoration: BoxDecoration(
        color: color.withValues(alpha: 0.15),
        borderRadius: BorderRadius.circular(20),
        border: Border.all(color: color.withValues(alpha: 0.5), width: 1.5),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          Container(
            width: compact ? 6 : 8,
            height: compact ? 6 : 8,
            decoration: BoxDecoration(
              color: color,
              shape: BoxShape.circle,
              boxShadow: [
                BoxShadow(
                  color: color.withValues(alpha: 0.6),
                  blurRadius: 6,
                  spreadRadius: 1,
                ),
              ],
            ),
          ),
          SizedBox(width: compact ? 6 : 8),
          Text(
            label,
            style: TextStyle(
              color: color,
              fontWeight: FontWeight.w700,
              fontSize: compact ? 11 : 13,
              letterSpacing: 0.8,
            ),
          ),
        ],
      ),
    );
  }
}
