import 'package:flutter/material.dart';
import '../../../core/constants/map_constants.dart';
import '../../../core/theme/app_colors.dart';

/// Ultra-clean, horizontal floating pill selector for hot-swapping OpenFreeMap vector styles.
class MapStyleSelector extends StatelessWidget {
  final OpenFreeMapStyle currentStyle;
  final ValueChanged<OpenFreeMapStyle> onStyleSelected;
  final bool isEmbedded;

  const MapStyleSelector({
    super.key,
    required this.currentStyle,
    required this.onStyleSelected,
    this.isEmbedded = false,
  });

  String _getStyleLabel(OpenFreeMapStyle style) {
    switch (style) {
      case OpenFreeMapStyle.bright:
        return 'Bright';
      case OpenFreeMapStyle.liberty:
        return 'Liberty';
      case OpenFreeMapStyle.positron:
        return 'Positron';
      case OpenFreeMapStyle.dark:
        return 'Dark';
      case OpenFreeMapStyle.fiord:
        return 'Fiord';
      case OpenFreeMapStyle.threeD:
        return '3D Buildings';
    }
  }

  IconData _getStyleIcon(OpenFreeMapStyle style) {
    switch (style) {
      case OpenFreeMapStyle.bright:
        return Icons.wb_sunny_rounded;
      case OpenFreeMapStyle.liberty:
        return Icons.map_rounded;
      case OpenFreeMapStyle.dark:
        return Icons.dark_mode_rounded;
      case OpenFreeMapStyle.positron:
        return Icons.wb_twilight_rounded;
      case OpenFreeMapStyle.fiord:
        return Icons.water_rounded;
      case OpenFreeMapStyle.threeD:
        return Icons.domain_rounded;
    }
  }

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final isDark = theme.brightness == Brightness.dark;
    final isDesktop = MediaQuery.of(context).size.width >= 768;

    if (isEmbedded) {
      return Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          Container(
            padding: const EdgeInsets.all(7),
            decoration: BoxDecoration(
              color: AppColors.emergencyRed.withValues(alpha: 0.12),
              shape: BoxShape.circle,
            ),
            child: const Icon(
              Icons.layers_rounded,
              color: AppColors.emergencyRed,
              size: 18,
            ),
          ),
          const SizedBox(width: 8),
          ...OpenFreeMapStyle.values.map((style) {
            final isSelected = style == currentStyle;
            final label = _getStyleLabel(style);
            final icon = _getStyleIcon(style);

            return Padding(
              padding: const EdgeInsets.only(right: 6),
              child: InkWell(
                onTap: () => onStyleSelected(style),
                borderRadius: BorderRadius.circular(16),
                child: AnimatedContainer(
                  duration: const Duration(milliseconds: 180),
                  padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 7),
                  decoration: BoxDecoration(
                    color: isSelected
                        ? AppColors.emergencyRed
                        : (isDark ? Colors.white.withValues(alpha: 0.08) : Colors.black.withValues(alpha: 0.05)),
                    borderRadius: BorderRadius.circular(16),
                    boxShadow: isSelected
                        ? [
                            BoxShadow(
                              color: AppColors.emergencyRed.withValues(alpha: 0.35),
                              blurRadius: 6,
                              offset: const Offset(0, 2),
                            ),
                          ]
                        : null,
                  ),
                  child: Row(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      Icon(
                        icon,
                        size: 15,
                        color: isSelected ? Colors.white : (isDark ? Colors.white70 : Colors.black54),
                      ),
                      const SizedBox(width: 5),
                      Text(
                        label,
                        style: TextStyle(
                          color: isSelected ? Colors.white : (isDark ? Colors.white70 : Colors.black87),
                          fontSize: 12.5,
                          fontWeight: isSelected ? FontWeight.w900 : FontWeight.w700,
                        ),
                      ),
                    ],
                  ),
                ),
              ),
            );
          }),
        ],
      );
    }

    return Container(
      padding: EdgeInsets.symmetric(horizontal: isDesktop ? 14 : 10, vertical: isDesktop ? 10 : 7),
        decoration: BoxDecoration(
          color: isDark ? const Color(0xFF0F172A).withValues(alpha: 0.95) : Colors.white.withValues(alpha: 0.95),
          borderRadius: BorderRadius.circular(24),
          border: Border.all(
            color: isDark ? Colors.white.withValues(alpha: 0.12) : Colors.black.withValues(alpha: 0.08),
          ),
          boxShadow: [
            BoxShadow(
              color: Colors.black.withValues(alpha: isDark ? 0.35 : 0.12),
              blurRadius: 14,
              offset: const Offset(0, 3),
            ),
          ],
        ),
        child: Row(
          children: [
            Container(
              padding: EdgeInsets.all(isDesktop ? 9 : 7),
              decoration: BoxDecoration(
                color: AppColors.emergencyRed.withValues(alpha: 0.12),
                shape: BoxShape.circle,
              ),
              child: Icon(
                Icons.layers_rounded,
                color: AppColors.emergencyRed,
                size: isDesktop ? 22 : 18,
              ),
            ),
            const SizedBox(width: 8),
            Expanded(
              child: SingleChildScrollView(
                scrollDirection: Axis.horizontal,
                physics: const BouncingScrollPhysics(),
                child: Row(
                  children: OpenFreeMapStyle.values.map((style) {
                    final isSelected = style == currentStyle;
                    final label = _getStyleLabel(style);
                    final icon = _getStyleIcon(style);

                    return Padding(
                      padding: const EdgeInsets.only(right: 8),
                      child: InkWell(
                        onTap: () => onStyleSelected(style),
                        borderRadius: BorderRadius.circular(18),
                        child: AnimatedContainer(
                          duration: const Duration(milliseconds: 180),
                          padding: EdgeInsets.symmetric(
                            horizontal: isDesktop ? 18 : 14,
                            vertical: isDesktop ? 10 : 8,
                          ),
                          decoration: BoxDecoration(
                            color: isSelected
                                ? AppColors.emergencyRed
                                : (isDark ? Colors.white.withValues(alpha: 0.08) : Colors.black.withValues(alpha: 0.05)),
                            borderRadius: BorderRadius.circular(18),
                            boxShadow: isSelected
                                ? [
                                    BoxShadow(
                                      color: AppColors.emergencyRed.withValues(alpha: 0.35),
                                      blurRadius: 8,
                                      offset: const Offset(0, 2),
                                    ),
                                  ]
                                : null,
                          ),
                          child: Row(
                            mainAxisSize: MainAxisSize.min,
                            children: [
                              Icon(
                                icon,
                                size: isDesktop ? 20 : 16,
                                color: isSelected ? Colors.white : (isDark ? Colors.white70 : Colors.black54),
                              ),
                              const SizedBox(width: 6),
                              Text(
                                label,
                                style: TextStyle(
                                  color: isSelected ? Colors.white : (isDark ? Colors.white70 : Colors.black87),
                                  fontSize: isDesktop ? 14.5 : 13,
                                  fontWeight: isSelected ? FontWeight.w900 : FontWeight.w700,
                                ),
                              ),
                            ],
                          ),
                        ),
                      ),
                    );
                  }).toList(),
                ),
              ),
            ),
          ],
        ),
      );
  }
}
