import 'package:flutter/material.dart';
import '../../core/theme/app_colors.dart';

/// Explicit GPS Provenance Badge component adhering to Phase 3 & Phase 9 requirements.
/// Never presents simulated movement as "Live GPS". Distinguishes physical device hardware
/// fixes from simulated demonstration movement via multi-cue visual indicators (icon + text + color).
class GpsProvenanceBadge extends StatelessWidget {
  final bool isRealGps;
  final bool isStale;
  final int? secondsSinceUpdate;
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
    final theme = Theme.of(context);
    final isDark = theme.brightness == Brightness.dark;

    final badgeColor = isRealGps ? const Color(0xFF16A34A) : const Color(0xFFD97706);
    final badgeBg = isRealGps
        ? (isDark ? const Color(0xFF052E16) : const Color(0xFFDCFCE7))
        : (isDark ? const Color(0xFF451A03) : const Color(0xFFFEF3C7));
    final labelText = isRealGps ? '● GPS LIVE (REAL)' : '○ GPS SIMULATION';
    final iconData = isRealGps ? Icons.gps_fixed_rounded : Icons.gps_not_fixed_rounded;

    return Semantics(
      label: 'Telemetry Source: ${isRealGps ? "Live Physical GPS Fix" : "Simulated GPS Movement"}${isStale ? ", update delayed" : ""}',
      child: Container(
        padding: EdgeInsets.symmetric(
          horizontal: isCompact ? 8 : 10,
          vertical: isCompact ? 3 : 5,
        ),
        decoration: BoxDecoration(
          color: badgeBg,
          borderRadius: BorderRadius.circular(12),
          border: Border.all(color: badgeColor.withValues(alpha: 0.6), width: 1.2),
        ),
        child: Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            Icon(iconData, size: isCompact ? 12 : 14, color: badgeColor),
            const SizedBox(width: 5),
            Text(
              labelText,
              style: TextStyle(
                fontSize: isCompact ? 10 : 11,
                fontWeight: FontWeight.w900,
                letterSpacing: 0.4,
                color: badgeColor,
              ),
            ),
            if (isStale && secondsSinceUpdate != null) ...[
              const SizedBox(width: 6),
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 4, vertical: 1),
                decoration: BoxDecoration(
                  color: AppColors.emergencyRed.withValues(alpha: 0.15),
                  borderRadius: BorderRadius.circular(4),
                ),
                child: Text(
                  '${secondsSinceUpdate}s lag',
                  style: const TextStyle(
                    fontSize: 9,
                    fontWeight: FontWeight.w800,
                    color: AppColors.emergencyRed,
                  ),
                ),
              ),
            ],
          ],
        ),
      ),
    );
  }
}
