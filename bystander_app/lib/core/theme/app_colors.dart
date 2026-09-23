import 'package:flutter/material.dart';

/// High-contrast, emergency-optimized color tokens for UyirKappan.
class AppColors {
  AppColors._();

  // Primary Emergency Palette
  static const Color emergencyRed = Color(0xFFDC2626);
  static const Color emergencyDarkRed = Color(0xFFB91C1C);
  static const Color emergencyLightRed = Color(0xFFFEE2E2);
  static const Color emergencyGlow = Color(0xFFEF4444);

  // Status Colors
  static const Color statusSearching = Color(0xFFF59E0B); // Amber / Warning
  static const Color statusAssigned = Color(0xFF3B82F6);  // Blue / Info
  static const Color statusAccepted = Color(0xFF2563EB);  // Blue
  static const Color statusEnRoute = Color(0xFFDC2626);   // Primary Emergency Red
  static const Color statusArrived = Color(0xFF16A34A);   // Green / Success
  static const Color statusCompleted = Color(0xFF16A34A); // Green / Success
  static const Color statusCancelled = Color(0xFF6B7280); // Neutral Gray
  static const Color statusFallback = Color(0xFFF59E0B);  // Warning Amber

  // Background & Surfaces (Light)
  static const Color backgroundLight = Color(0xFFF9FAFB);
  static const Color surfaceLight = Color(0xFFFFFFFF);
  static const Color surfaceVariantLight = Color(0xFFF3F4F6);

  // Background & Surfaces (Dark - harmonized with Driver & Hospital Dashboard)
  static const Color backgroundDark = Color(0xFF0B1120);
  static const Color surfaceDark = Color(0xFF1E293B);
  static const Color surfaceVariantDark = Color(0xFF273549);

  // Text & Icons
  static const Color textPrimaryLight = Color(0xFF1F2937);
  static const Color textSecondaryLight = Color(0xFF6B7280);
  static const Color textPrimaryDark = Color(0xFFF8FAFC);
  static const Color textSecondaryDark = Color(0xFF94A3B8);

  // Accent & Utilities
  static const Color cardBorderLight = Color(0xFFE5E7EB);
  static const Color cardBorderDark = Color(0xFF334155);
  static const Color success = Color(0xFF16A34A);
  static const Color warning = Color(0xFFF59E0B);
  static const Color info = Color(0xFF3B82F6);
  static const Color gpsActive = Color(0xFF16A34A);
  static const Color gpsInactive = Color(0xFFDC2626);
}
