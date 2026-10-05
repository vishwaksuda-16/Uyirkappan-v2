import 'package:flutter/material.dart';

class AppColors {
  AppColors._();

  // Primary backgrounds — dark professional theme
  static const Color background = Color(0xFF0F172A);
  static const Color surface = Color(0xFF1E293B);
  static const Color surfaceElevated = Color(0xFF273549);
  static const Color cardBorder = Color(0xFF334155);

  // Primary brand — Teal (matching bystander app)
  static const Color primary = Color(0xFF14B8A6);        // Teal 500
  static const Color primaryDark = Color(0xFF0D9488);    // Teal 600
  static const Color primaryLight = Color(0xFFCCFBF1);   // Teal 50

  // Status indicators
  static const Color statusAvailable = Color(0xFF16A34A); // Green
  static const Color statusBusy = Color(0xFFEF4444);      // Red (only for actual danger)
  static const Color statusOffline = Color(0xFF6B7280);   // Gray

  // Navigation accents
  static const Color tacticalCyan = Color(0xFF06B6D4);
  static const Color routePolyline = Color(0xFF38BDF8);
  static const Color routeSecondary = Color(0xFF475569);
  static const Color hospitalBadge = Color(0xFF8B5CF6);

  // Text
  static const Color textPrimary = Color(0xFFF8FAFC);
  static const Color textSecondary = Color(0xFF94A3B8);
  static const Color textMuted = Color(0xFF64748B);

  // Alerts
  static const Color infoBlue = Color(0xFF3B82F6);
  static const Color warningOrange = Color(0xFFF59E0B);
  static const Color successGreen = Color(0xFF16A34A);
  static const Color error = Color(0xFFEF4444);

  // Legacy aliases
  static const Color emergencyRed = primary;
  static const Color emergencyCrimson = primaryDark;
}
