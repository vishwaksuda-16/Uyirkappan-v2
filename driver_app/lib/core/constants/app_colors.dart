import 'package:flutter/material.dart';

class AppColors {
  AppColors._();

  // Primary backgrounds - dark tactical theme for optimal day/night emergency operations
  static const Color background = Color(0xFF0B1120);
  static const Color surface = Color(0xFF1E293B);
  static const Color surfaceElevated = Color(0xFF273549);
  static const Color cardBorder = Color(0xFF334155);

  // Status indicators (standardized emergency design palette)
  static const Color statusAvailable = Color(0xFF16A34A); // Green 🟢
  static const Color statusBusy = Color(0xFFDC2626);      // Emergency Red 🔴
  static const Color statusOffline = Color(0xFF6B7280);   // Neutral Gray ⚪
  static const Color emergencyRed = Color(0xFFDC2626);    // Signal Red 🚨
  static const Color emergencyCrimson = Color(0xFFB91C1C);

  // Tactical navigation & route accents
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
}
