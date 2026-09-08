import 'package:flutter/material.dart';
import '../../core/theme/app_colors.dart';
import '../../domain/entities/emergency_type.dart';

/// Grid component allowing fast selection of emergency type.
class TypeSelectorGrid extends StatelessWidget {
  final EmergencyType selectedType;
  final ValueChanged<EmergencyType> onSelected;

  const TypeSelectorGrid({
    super.key,
    required this.selectedType,
    required this.onSelected,
  });

  @override
  Widget build(BuildContext context) {
    return Column(
      children: EmergencyType.values.map((type) {
        final isSelected = type == selectedType;
        return Padding(
          padding: const EdgeInsets.only(bottom: 10),
          child: Material(
            color: Colors.transparent,
            child: InkWell(
              onTap: () => onSelected(type),
              borderRadius: BorderRadius.circular(16),
              child: AnimatedContainer(
                duration: const Duration(milliseconds: 200),
                padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
                decoration: BoxDecoration(
                  color: isSelected
                      ? AppColors.emergencyLightRed
                      : Theme.of(context).cardColor,
                  borderRadius: BorderRadius.circular(16),
                  border: Border.all(
                    color: isSelected ? AppColors.emergencyRed : Theme.of(context).dividerColor,
                    width: isSelected ? 2.0 : 1.0,
                  ),
                  boxShadow: isSelected
                      ? [
                          BoxShadow(
                            color: AppColors.emergencyRed.withValues(alpha: 0.15),
                            blurRadius: 8,
                            offset: const Offset(0, 3),
                          ),
                        ]
                      : null,
                ),
                child: Row(
                  children: [
                    Container(
                      padding: const EdgeInsets.all(10),
                      decoration: BoxDecoration(
                        color: isSelected
                            ? AppColors.emergencyRed
                            : Theme.of(context).dividerColor.withValues(alpha: 0.2),
                        shape: BoxShape.circle,
                      ),
                      child: Icon(
                        type.icon,
                        color: isSelected ? Colors.white : AppColors.textPrimaryLight,
                        size: 22,
                      ),
                    ),
                    const SizedBox(width: 14),
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(
                            type.displayName,
                            style: TextStyle(
                              fontSize: 15,
                              fontWeight: isSelected ? FontWeight.w700 : FontWeight.w600,
                              color: isSelected ? AppColors.emergencyDarkRed : null,
                            ),
                          ),
                          const SizedBox(height: 2),
                          Text(
                            type.description,
                            style: TextStyle(
                              fontSize: 12,
                              color: isSelected
                                  ? AppColors.emergencyDarkRed.withValues(alpha: 0.8)
                                  : AppColors.textSecondaryLight,
                            ),
                          ),
                        ],
                      ),
                    ),
                    if (isSelected)
                      const Icon(
                        Icons.check_circle_rounded,
                        color: AppColors.emergencyRed,
                        size: 22,
                      ),
                  ],
                ),
              ),
            ),
          ),
        );
      }).toList(),
    );
  }
}
