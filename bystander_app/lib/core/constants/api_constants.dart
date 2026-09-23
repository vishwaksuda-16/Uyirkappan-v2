/// Centralized API endpoint routes and configuration.
/// Ensures the application adheres strictly to the backend integration contract.
class ApiConstants {
  ApiConstants._();

  /// Default Backend Base URL for Node.js / Express backend.
  static const String defaultBaseUrl =
      String.fromEnvironment('API_BASE_URL', defaultValue: 'http://localhost:5000');

  /// Socket.IO server URL for real-time tracking and dispatch events.
  static const String defaultSocketUrl =
      String.fromEnvironment('SOCKET_URL', defaultValue: 'http://localhost:5000');
  static const String socketUrl = defaultSocketUrl;
  static const String bearerPrefix = 'Bearer ';

  // 1. Authentication & User Management Endpoints
  static const String authRegister = '/api/auth/register';
  static const String authLogin = '/api/auth/login';
  static const String authMe = '/api/auth/me';

  // 2. Emergency Lifecycle Endpoints
  static const String emergency = '/api/emergency';
  static const String hospitals = '/api/hospitals';
  static const String recommendHospital = '/api/hospitals/recommend';
  static String emergencyById(String id) => '/api/emergency/$id';
  static String emergencyTracking(String id) => '/api/emergency/$id/tracking';
  static String cancelEmergency(String id) => '/api/emergency/$id/cancel';

  // Backwards-compatible aliases
  static const String emergencyRequests = emergency;
  static String emergencyRequestById(String id) => emergencyById(id);
  static String emergencyRequestStatus(String id) => emergencyById(id);
  static String cancelEmergencyRequest(String id) => cancelEmergency(id);
  static String trackingInfo(String id) => emergencyTracking(id);

  // Request Headers
  static const String headerContentType = 'Content-Type';
  static const String headerAuthorization = 'Authorization';
  static const String contentTypeJson = 'application/json';

  static Map<String, String> authHeaders(String? token) => {
        headerContentType: contentTypeJson,
        if (token != null && token.isNotEmpty) headerAuthorization: 'Bearer $token',
      };
}

