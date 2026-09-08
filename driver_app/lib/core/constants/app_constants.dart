class PredefinedDriverAccount {
  final String email;
  final String driverId;
  final String ambulanceId;
  final String providerId;
  final String name;
  final String phone;
  final String defaultPassword;

  const PredefinedDriverAccount({
    required this.email,
    required this.driverId,
    required this.ambulanceId,
    required this.providerId,
    required this.name,
    required this.phone,
    this.defaultPassword = 'password123',
  });
}

class AppConstants {
  AppConstants._();

  static const String appName = 'UyirKappan Driver';
  static const String appTagline = 'Ambulance Provider Operational Interface';

  // Timeouts
  static const int defaultAssignmentTimeoutSeconds = 15;
  static const Duration networkTimeout = Duration(seconds: 15);

  // Storage Keys
  static const String prefAuthToken = 'auth_token';
  static const String prefDriverId = 'auth_driver_id';
  static const String prefAmbulanceId = 'auth_ambulance_id';
  static const String prefDriverEmail = 'auth_driver_email';
  static const String prefAppMode = 'app_mode';
  static const String prefTodayCompletedCount = 'stats_today_completed';
  static const String prefTodayRequestCount = 'stats_today_requests';

  // Predefined simulation & checklist accounts
  static const List<PredefinedDriverAccount> predefinedAccounts = [
    PredefinedDriverAccount(
      email: 'driver1@uyirkappan.demo',
      driverId: 'DRV-001',
      ambulanceId: 'AMB-001',
      providerId: 'SIM-PROVIDER-01',
      name: 'Driver 1 (Checklist Demo)',
      phone: '+91 98401 11111',
      defaultPassword: 'password123',
    ),
    PredefinedDriverAccount(
      email: 'driver3@uyirkappan.demo',
      driverId: 'DRV-003',
      ambulanceId: 'AMB-003',
      providerId: 'SIM-PROVIDER-01',
      name: 'Karthik Subramanian',
      phone: '+91 98401 23456',
    ),
    PredefinedDriverAccount(
      email: 'driver5@uyirkappan.demo',
      driverId: 'DRV-005',
      ambulanceId: 'AMB-005',
      providerId: 'SIM-PROVIDER-01',
      name: 'Ramesh Kumar',
      phone: '+91 98401 56789',
    ),
    PredefinedDriverAccount(
      email: 'driver2@uyirkappan.demo',
      driverId: 'DRV-002',
      ambulanceId: 'AMB-002',
      providerId: 'SIM-PROVIDER-02',
      name: 'Arun Prakash',
      phone: '+91 98401 89012',
    ),
  ];
}
