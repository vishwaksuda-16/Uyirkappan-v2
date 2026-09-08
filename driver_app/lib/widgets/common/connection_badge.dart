import 'package:flutter/material.dart';
import '../../core/constants/app_colors.dart';
import '../../models/state_enums.dart';

class ConnectionBadge extends StatelessWidget {
  final ConnectionStatus status;

  const ConnectionBadge({super.key, required this.status});

  @override
  Widget build(BuildContext context) {
    final Color color;
    final IconData icon;

    switch (status) {
      case ConnectionStatus.connected:
        color = AppColors.successGreen;
        icon = Icons.wifi;
        break;
      case ConnectionStatus.connecting:
        color = AppColors.statusBusy;
        icon = Icons.wifi_find;
        break;
      case ConnectionStatus.disconnected:
        color = AppColors.emergencyRed;
        icon = Icons.wifi_off;
        break;
      case ConnectionStatus.simulationMode:
        color = AppColors.tacticalCyan;
        icon = Icons.memory;
        break;
    }

    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
      decoration: BoxDecoration(
        color: color.withValues(alpha: 0.12),
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: color.withValues(alpha: 0.4)),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          Icon(icon, size: 13, color: color),
          const SizedBox(width: 5),
          Text(
            status.displayName,
            style: TextStyle(
              color: color,
              fontSize: 10,
              fontWeight: FontWeight.w700,
              letterSpacing: 0.5,
            ),
          ),
        ],
      ),
    );
  }
}
