import 'package:flutter/material.dart';

/// Clean, professional medical-grade color tokens for UyirKappan.
class AppColors {
  AppColors._();

  // Primary Brand Palette — Medical Teal
  static const Color primary = Color(0xFF0D9488);        // Teal 600
  static const Color primaryDark = Color(0xFF0F766E);    // Teal 700
  static const Color primaryLight = Color(0xFFCCFBF1);   // Teal 50
  static const Color primaryGlow = Color(0xFF14B8A6);    // Teal 500

  // Accent — Deep Indigo
  static const Color accent = Color(0xFF6366F1);         // Indigo 500
  static const Color accentLight = Color(0xFFE0E7FF);    // Indigo 50

  // Status Colors
  static const Color statusSearching = Color(0xFFF59E0B); // Amber
  static const Color statusAssigned = Color(0xFF3B82F6);  // Blue
  static const Color statusAccepted = Color(0xFF2563EB);  // Blue
  static const Color statusEnRoute = Color(0xFF0D9488);   // Teal (primary)
  static const Color statusArrived = Color(0xFF16A34A);   // Green
  static const Color statusCompleted = Color(0xFF16A34A); // Green
  static const Color statusCancelled = Color(0xFF6B7280); // Gray
  static const Color statusFallback = Color(0xFFF59E0B);  // Amber

  // Background & Surfaces (Light)
  static const Color backgroundLight = Color(0xFFF8FAFC);
  static const Color surfaceLight = Color(0xFFFFFFFF);
  static const Color surfaceVariantLight = Color(0xFFF1F5F9);

  // Background & Surfaces (Dark)
  static const Color backgroundDark = Color(0xFF0F172A);
  static const Color surfaceDark = Color(0xFF1E293B);
  static const Color surfaceVariantDark = Color(0xFF273549);

  // Text & Icons
  static const Color textPrimaryLight = Color(0xFF0F172A);
  static const Color textSecondaryLight = Color(0xFF64748B);
  static const Color textPrimaryDark = Color(0xFFF8FAFC);
  static const Color textSecondaryDark = Color(0xFF94A3B8);

  // Accent & Utilities
  static const Color cardBorderLight = Color(0xFFE2E8F0);
  static const Color cardBorderDark = Color(0xFF334155);
  static const Color success = Color(0xFF16A34A);
  static const Color warning = Color(0xFFF59E0B);
  static const Color error = Color(0xFFEF4444);
  static const Color info = Color(0xFF3B82F6);
  static const Color gpsActive = Color(0xFF16A34A);
  static const Color gpsInactive = Color(0xFFEF4444);

  // Legacy aliases for compatibility
  static const Color emergencyRed = primary;
  static const Color emergencyDarkRed = primaryDark;
  static const Color emergencyLightRed = primaryLight;
  static const Color emergencyGlow = primaryGlow;
}
