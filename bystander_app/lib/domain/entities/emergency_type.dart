import 'package:flutter/material.dart';

/// Strongly typed emergency category model.
/// Easily extensible without hardcoding category logic across the application.
enum EmergencyType {
  accident(
    code: 'ACCIDENT',
    displayName: 'Accident / Collision',
    description: 'Road traffic crash, vehicular collision, or pedestrian impact',
    icon: Icons.car_crash_rounded,
    severity: EmergencySeverity.critical,
  ),
  cardiacEmergency(
    code: 'CARDIAC',
    displayName: 'Cardiac Emergency',
    description: 'Heart attack, chest pain, sudden cardiac arrest, or arrhythmia',
    icon: Icons.favorite_rounded,
    severity: EmergencySeverity.critical,
  ),
  breathingEmergency(
    code: 'BREATHING',
    displayName: 'Breathing Difficulty',
    description: 'Severe asthma, choking, asphyxiation, or respiratory failure',
    icon: Icons.air_rounded,
    severity: EmergencySeverity.critical,
  ),
  unconsciousPerson(
    code: 'UNCONSCIOUS',
    displayName: 'Unconscious Person',
    description: 'Unresponsive individual, fainting, coma, or syncope',
    icon: Icons.person_off_rounded,
    severity: EmergencySeverity.high,
  ),
  trauma(
    code: 'TRAUMA',
    displayName: 'Trauma / Severe Bleeding',
    description: 'Deep wounds, heavy hemorrhage, fractures, or major injury',
    icon: Icons.healing_rounded,
    severity: EmergencySeverity.high,
  ),
  generalMedical(
    code: 'GENERAL_MEDICAL',
    displayName: 'General Medical Emergency',
    description: 'High fever, seizure, allergic reaction, or acute poisoning',
    icon: Icons.medical_services_rounded,
    severity: EmergencySeverity.moderate,
  ),
  other(
    code: 'OTHER',
    displayName: 'Other Emergency',
    description: 'Any urgent medical distress not listed above',
    icon: Icons.emergency_rounded,
    severity: EmergencySeverity.moderate,
  );

  final String code;
  final String displayName;
  final String description;
  final IconData icon;
  final EmergencySeverity severity;

  const EmergencyType({
    required this.code,
    required this.displayName,
    required this.description,
    required this.icon,
    required this.severity,
  });

  static EmergencyType fromCode(String code) {
    return EmergencyType.values.firstWhere(
      (e) => e.code.toUpperCase() == code.toUpperCase(),
      orElse: () => EmergencyType.other,
    );
  }
}

enum EmergencySeverity {
  critical,
  high,
  moderate,
}
