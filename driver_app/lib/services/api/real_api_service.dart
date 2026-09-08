import 'dart:convert';
import 'package:http/http.dart' as http;
import '../../core/config/app_config.dart';
import '../../core/constants/app_constants.dart';
import '../../core/errors/app_exceptions.dart';
import '../../models/ambulance.dart';
import '../../models/assignment.dart';
import '../../models/driver.dart';
import '../../models/location_model.dart';
import '../../models/route_model.dart';
import '../../models/state_enums.dart';
import 'api_service.dart';

class RealApiService implements ApiService {
  final AppConfig config;
  final http.Client _client;
  String? _authToken;

  RealApiService({
    required this.config,
    http.Client? client,
  }) : _client = client ?? http.Client();

  void setAuthToken(String? token) {
    _authToken = token;
  }

  Map<String, String> get _headers => {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        if (_authToken != null) 'Authorization': 'Bearer $_authToken',
      };

  Uri _buildUri(String path) {
    final base = config.apiBaseUrl.endsWith('/')
        ? config.apiBaseUrl.substring(0, config.apiBaseUrl.length - 1)
        : config.apiBaseUrl;
    return Uri.parse('$base$path');
  }

  @override
  Future<Driver> login(String identifier, String password) async {
    try {
      final isEmail = identifier.contains('@');
      final email = isEmail
          ? identifier
          : (identifier == 'DRV-001'
              ? 'driver1@uyirkappan.demo'
              : '$identifier@uyirkappan.demo');

      // Backend reads only `email` and `password` — `driverId` is ignored but harmless
      final response = await _client
          .post(
            _buildUri('/auth/login'),
            headers: _headers,
            body: jsonEncode({
              'email': email,
              'password': password,
            }),
          )
          .timeout(AppConstants.networkTimeout);

      if (response.statusCode == 200) {
        final data = jsonDecode(response.body) as Map<String, dynamic>;
        final token = (data['token'] as String?) ??
            ((data['user'] is Map)
                ? (data['user']['token'] as String?)
                : null);

        // Set token early so _fetchAmbulanceForDriver can use it if needed
        _authToken = token;

        final driver = Driver.fromJson(data);

        final userMap = (data['user'] is Map<String, dynamic>)
            ? data['user'] as Map<String, dynamic>
            : data;
        String ambulanceId = (userMap['ambulanceId'] as String?) ?? '';

        // If ambulanceId is not in login response (real backend), look it up from the ambulances list
        if (ambulanceId.isEmpty) {
          ambulanceId = await _fetchAmbulanceForDriver(driver.driverId);
        }

        final fullDriver = driver.copyWith(
          token: _authToken,
          ambulanceId: ambulanceId,
        );
        return fullDriver;
      } else if (response.statusCode == 400) {
        throw const BadRequestException('Invalid credentials payload provided.');
      } else if (response.statusCode == 401) {
        throw const AuthException('Invalid Driver credentials.', 'UNAUTHORIZED');
      } else if (response.statusCode == 403) {
        throw const ForbiddenException('Access forbidden: user is not an authorized DRIVER.');
      } else {
        throw AuthException('Login failed with status ${response.statusCode}.');
      }
    } on AppException {
      rethrow;
    } catch (e) {
      throw NetworkException('Unable to reach backend server at ${config.apiBaseUrl}: $e');
    }
  }

  /// Fetch the ambulanceId for a given userId by calling GET /api/ambulances/
  /// and finding the ambulance whose driverId matches userId.
  /// Falls back to 'AMB-001' if not found (e.g. network error, unmapped user).
  Future<String> _fetchAmbulanceForDriver(String userId) async {
    try {
      final response = await _client
          .get(_buildUri('/ambulances/'), headers: _headers)
          .timeout(AppConstants.networkTimeout);

      if (response.statusCode == 200) {
        final body = jsonDecode(response.body);
        // Response may be a list or { success, ambulances: [...] }
        List<dynamic> list;
        if (body is List) {
          list = body;
        } else if (body is Map && body['ambulances'] is List) {
          list = body['ambulances'] as List<dynamic>;
        } else if (body is Map && body['data'] is List) {
          list = body['data'] as List<dynamic>;
        } else {
          list = [];
        }

        for (final item in list) {
          if (item is Map<String, dynamic>) {
            final driverId = item['driverId'] as String?;
            if (driverId == userId) {
              // Backend returns 'id' not 'ambulanceId'
              return (item['id'] as String?) ??
                  (item['ambulanceId'] as String?) ??
                  'AMB-001';
            }
          }
        }
      }
    } catch (_) {
      // Non-critical — fall through to default
    }
    return 'AMB-001';
  }

  @override
  Future<Driver> getDriverProfile(String driverId) async {
    try {
      // Backend has /api/auth/me — not /drivers/me (which does not exist)
      final response = await _client
          .get(_buildUri('/auth/me'), headers: _headers)
          .timeout(AppConstants.networkTimeout);

      if (response.statusCode == 200) {
        final data = jsonDecode(response.body) as Map<String, dynamic>;
        final userMap = (data['user'] is Map<String, dynamic>)
            ? data['user'] as Map<String, dynamic>
            : data;
        final driver = Driver.fromJson(data);

        String ambulanceId = (userMap['ambulanceId'] as String?) ?? '';
        if (ambulanceId.isEmpty) {
          ambulanceId = await _fetchAmbulanceForDriver(driver.driverId);
        }
        return driver.copyWith(ambulanceId: ambulanceId);
      } else if (response.statusCode == 401) {
        throw const UnauthorizedException('Driver session expired.');
      } else if (response.statusCode == 403) {
        throw const ForbiddenException('Access forbidden for driver profile.');
      } else if (response.statusCode == 404) {
        throw const NotFoundException('Driver profile not found.');
      } else {
        throw const AppException('Failed to fetch driver profile.');
      }
    } on AppException {
      rethrow;
    } catch (e) {
      throw NetworkException('Network error: $e');
    }
  }

  @override
  Future<Ambulance> updateAmbulanceStatus(
    String ambulanceId,
    AmbulanceAvailability availability, {
    DriverLifecycleState? lifecycleState,
  }) async {
    try {
      final response = await _client
          .patch(
            _buildUri('/ambulances/$ambulanceId/status'),
            headers: _headers,
            body: jsonEncode({
              'availability': availability.displayName,
              'status': lifecycleState?.displayName ?? availability.displayName,
            }),
          )
          .timeout(AppConstants.networkTimeout);

      if (response.statusCode == 200) {
        return Ambulance.fromJson(jsonDecode(response.body) as Map<String, dynamic>);
      } else if (response.statusCode == 400) {
        throw const BadRequestException('Invalid ambulance status update request.');
      } else if (response.statusCode == 401) {
        throw const UnauthorizedException('Driver session expired.');
      } else if (response.statusCode == 403) {
        throw const ForbiddenException('Forbidden: cannot modify another driver\'s ambulance.');
      } else if (response.statusCode == 404) {
        throw const NotFoundException('Ambulance not found in dispatch system.');
      } else {
        throw AppException('Failed to update ambulance status: ${response.statusCode}');
      }
    } on AppException {
      rethrow;
    } catch (e) {
      throw NetworkException('Network error: $e');
    }
  }

  @override
  Future<Assignment?> getActiveAssignment() async {
    try {
      final response = await _client
          .get(_buildUri('/driver/assignment'), headers: _headers)
          .timeout(AppConstants.networkTimeout);

      if (response.statusCode == 200) {
        final data = jsonDecode(response.body);
        if (data == null || (data is Map && data['success'] == false)) {
          return null;
        }
        final map = (data is Map<String, dynamic>)
            ? (data['assignment'] is Map<String, dynamic>
                ? data['assignment'] as Map<String, dynamic>
                : data)
            : <String, dynamic>{};
        if (map.isEmpty) return null;
        return Assignment.fromJson(map);
      } else if (response.statusCode == 404) {
        return null;
      } else if (response.statusCode == 401) {
        throw const UnauthorizedException('Driver session expired.');
      } else {
        return null;
      }
    } on AppException {
      rethrow;
    } catch (e) {
      throw NetworkException('Network error: $e');
    }
  }

  @override
  Future<List<Assignment>> getAssignments(String driverId) async {
    try {
      final active = await getActiveAssignment();
      if (active != null) return [active];

      final response = await _client
          .get(_buildUri('/drivers/$driverId/assignments'), headers: _headers)
          .timeout(AppConstants.networkTimeout);

      if (response.statusCode == 200) {
        final list = jsonDecode(response.body) as List<dynamic>;
        return list.map((a) => Assignment.fromJson(a as Map<String, dynamic>)).toList();
      } else {
        return [];
      }
    } on AppException {
      rethrow;
    } catch (e) {
      throw NetworkException('Network error: $e');
    }
  }

  @override
  Future<Assignment> acceptAssignment(String assignmentId) async {
    try {
      final response = await _client
          .post(_buildUri('/assignments/$assignmentId/accept'), headers: _headers)
          .timeout(AppConstants.networkTimeout);

      if (response.statusCode == 200) {
        final data = jsonDecode(response.body) as Map<String, dynamic>;
        final map = (data['assignment'] is Map<String, dynamic>)
            ? data['assignment'] as Map<String, dynamic>
            : data;
        final enriched = Map<String, dynamic>.from(map)
          ..['status'] = (map['status'] as String?) ?? 'ACCEPTED'
          ..['assignmentId'] = (map['assignmentId'] as String?) ??
              (map['id'] as String?) ??
              assignmentId;
        return Assignment.fromJson(enriched);
      } else if (response.statusCode == 401) {
        throw const UnauthorizedException('Driver session expired.');
      } else if (response.statusCode == 403) {
        throw const ForbiddenException('Forbidden: cannot accept this assignment.');
      } else if (response.statusCode == 404) {
        throw const NotFoundException('Assignment not found or expired.');
      } else if (response.statusCode == 409) {
        throw const ConflictException('Assignment has already been responded to or reallocated.');
      } else {
        throw AppException('Failed to accept assignment: ${response.statusCode}');
      }
    } on AppException {
      rethrow;
    } catch (e) {
      throw NetworkException('Network error: $e');
    }
  }

  @override
  Future<void> rejectAssignment(String assignmentId, {String? reason}) async {
    try {
      final response = await _client
          .post(
            _buildUri('/assignments/$assignmentId/reject'),
            headers: _headers,
            body: jsonEncode({'reason': reason ?? 'Driver declined'}),
          )
          .timeout(AppConstants.networkTimeout);

      if (response.statusCode == 200 || response.statusCode == 204) {
        return;
      } else if (response.statusCode == 401) {
        throw const UnauthorizedException('Driver session expired.');
      } else if (response.statusCode == 404) {
        throw const NotFoundException('Assignment not found.');
      } else if (response.statusCode == 409) {
        throw const ConflictException('Assignment already expired or transitioned.');
      }
    } on AppException {
      rethrow;
    } catch (e) {
      throw NetworkException('Network error: $e');
    }
  }

  @override
  Future<Assignment> updateAssignmentStatus(
    String assignmentId,
    DriverLifecycleState status,
  ) async {
    try {
      final response = await _client
          .patch(
            _buildUri('/assignments/$assignmentId/status'),
            headers: _headers,
            body: jsonEncode({'status': status.displayName}),
          )
          .timeout(AppConstants.networkTimeout);

      if (response.statusCode == 200) {
        final data = jsonDecode(response.body) as Map<String, dynamic>;
        // Backend returns { success, requestId, status } — NOT an assignment object.
        // Enrich the flat response with the known assignmentId so fromJson works.
        if (data.containsKey('assignment')) {
          return Assignment.fromJson(data['assignment'] as Map<String, dynamic>);
        }
        // Inject assignmentId so fromJson can populate the field
        final enriched = Map<String, dynamic>.from(data)
          ..['assignmentId'] = assignmentId
          ..['status'] = status.displayName;
        return Assignment.fromJson(enriched);
      } else if (response.statusCode == 400) {
        throw const BadRequestException('Invalid status transition request.');
      } else if (response.statusCode == 401) {
        throw const UnauthorizedException('Driver session expired.');
      } else if (response.statusCode == 403) {
        throw const ForbiddenException('Forbidden: cannot modify this assignment.');
      } else if (response.statusCode == 404) {
        throw const NotFoundException('Assignment not found.');
      } else if (response.statusCode == 409) {
        try {
          final err = jsonDecode(response.body);
          if (status == DriverLifecycleState.completed &&
              err['message']?.toString().contains('already completed') == true) {
            return Assignment.fromJson({
              'assignmentId': assignmentId,
              'status': 'COMPLETED',
            });
          }
        } catch (_) {}
        throw ConflictException('Invalid status transition to ${status.displayName}. Sequential progression required (409 Conflict).');
      } else {
        throw AppException('Failed to update assignment status: ${response.statusCode}');
      }
    } on AppException {
      rethrow;
    } catch (e) {
      throw NetworkException('Network error: $e');
    }
  }

  @override
  Future<void> postLocationUpdate(
    String ambulanceId,
    AmbulanceLocation location,
  ) async {
    try {
      // Backend reads exactly: latitude, longitude, speed, heading
      // timestamp and ambulanceId in body are ignored by the backend
      await _client
          .post(
            _buildUri('/ambulances/$ambulanceId/location'),
            headers: _headers,
            body: jsonEncode({
              'latitude': location.latitude,
              'longitude': location.longitude,
              'speed': location.speed,
              'heading': location.heading,
            }),
          )
          .timeout(const Duration(seconds: 5));
    } catch (e) {
      // Background location update error handled gracefully
    }
  }

  @override
  Future<RouteModel> getAssignmentRoute(String assignmentId) async {
    try {
      final response = await _client
          .get(_buildUri('/assignments/$assignmentId/route'), headers: _headers)
          .timeout(AppConstants.networkTimeout);

      if (response.statusCode == 200) {
        return RouteModel.fromJson(jsonDecode(response.body) as Map<String, dynamic>);
      } else {
        throw AppException('Failed to get route: ${response.statusCode}');
      }
    } on AppException {
      rethrow;
    } catch (e) {
      throw NetworkException('Network error: $e');
    }
  }
}
