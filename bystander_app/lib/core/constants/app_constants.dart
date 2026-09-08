/// Global application constants, constraints, and defaults.
class AppConstants {
  AppConstants._();

  static const String appName = 'UyirKappan';
  static const String appTagline = 'Real-Time Emergency Response Platform';
  static const String moduleName = 'Module 1 — Bystander Mobile Application';

  // Victim limits
  static const int minVictims = 1;
  static const int maxVictims = 50;
  static const int defaultVictims = 1;

  // Emergency Call Numbers (Defaults)
  static const String nationalEmergencyNumber = '112';
  static const String ambulanceEmergencyNumber = '108';

  // Persistence Keys
  static const String keyActiveRequestId = 'active_emergency_request_id';
  static const String keyLastKnownLatitude = 'last_known_latitude';
  static const String keyLastKnownLongitude = 'last_known_longitude';

  // Default GPS Fallback (Chennai Coordinates)
  static const double defaultLatitude = 13.0827;
  static const double defaultLongitude = 80.2707;
  static const double defaultAccuracy = 5.0; // meters
}
