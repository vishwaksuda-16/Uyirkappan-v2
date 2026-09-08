import 'package:flutter/material.dart';
import '../../core/theme/app_colors.dart';
import '../../core/theme/app_text_styles.dart';

/// Accessible and responsive counter stepper for victim count selection.
class CounterStepper extends StatelessWidget {
  final int count;
  final int min;
  final int max;
  final VoidCallback onIncrement;
  final VoidCallback onDecrement;
  final bool isCompact;

  const CounterStepper({
    super.key,
    required this.count,
    required this.min,
    required this.max,
    required this.onIncrement,
    required this.onDecrement,
    this.isCompact = false,
  });

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final canDecrement = count > min;
    final canIncrement = count < max;

    return Container(
      padding: EdgeInsets.symmetric(
        horizontal: isCompact ? 6 : 16,
        vertical: isCompact ? 4 : 12,
      ),
      decoration: BoxDecoration(
        color: theme.cardColor,
        borderRadius: BorderRadius.circular(isCompact ? 12 : 16),
        border: Border.all(color: theme.dividerColor),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        mainAxisAlignment: MainAxisAlignment.center,
        children: [
          IconButton.filledTonal(
            onPressed: canDecrement ? onDecrement : null,
            icon: Icon(Icons.remove_rounded, size: isCompact ? 20 : 26),
            style: IconButton.styleFrom(
              backgroundColor: canDecrement
                  ? AppColors.emergencyLightRed
                  : theme.disabledColor.withValues(alpha: 0.1),
              foregroundColor: canDecrement
                  ? AppColors.emergencyDarkRed
                  : theme.disabledColor,
              shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(isCompact ? 10 : 12)),
              minimumSize: Size(isCompact ? 42 : 48, isCompact ? 42 : 48),
            ),
          ),
          Padding(
            padding: EdgeInsets.symmetric(horizontal: isCompact ? 8 : 0),
            child: Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                Text(
                  '$count',
                  style: (isCompact ? const TextStyle(fontSize: 19, fontWeight: FontWeight.w900) : AppTextStyles.metricValue).copyWith(
                    color: AppColors.emergencyRed,
                  ),
                ),
                Text(
                  count == 1 ? 'VICTIM' : 'VICTIMS',
                  style: (isCompact ? AppTextStyles.caption.copyWith(fontSize: 9) : AppTextStyles.caption).copyWith(
                    fontWeight: FontWeight.w700,
                    letterSpacing: 1.0,
                  ),
                ),
              ],
            ),
          ),
          IconButton.filledTonal(
            onPressed: canIncrement ? onIncrement : null,
            icon: Icon(Icons.add_rounded, size: isCompact ? 22 : 28),
            style: IconButton.styleFrom(
              backgroundColor: canIncrement
                  ? AppColors.emergencyLightRed
                  : theme.disabledColor.withValues(alpha: 0.1),
              foregroundColor: canIncrement
                  ? AppColors.emergencyDarkRed
                  : theme.disabledColor,
              shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(isCompact ? 10 : 12)),
              minimumSize: Size(isCompact ? 42 : 52, isCompact ? 42 : 52),
            ),
          ),
        ],
      ),
    );
  }
}
