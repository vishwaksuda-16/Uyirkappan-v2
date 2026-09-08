import 'dart:async';
import 'dart:convert';
import 'package:http/http.dart' as http;
import '../../../core/constants/api_constants.dart';
import '../../../core/errors/exceptions.dart';
import '../../models/emergency_request_model.dart';
import '../../../domain/entities/request_status.dart';
import '../emergency_request_datasource.dart';
import 'socket_service.dart';

/// Real REST API implementation adhering strictly to the backend integration contract.
/// Integrates with Socket.IO for real-time dispatch updates and handles all HTTP status codes:
/// 400 (Bad Request), 401 (Unauthorized), 403 (Forbidden), 404 (Not Found), 409 (Conflict).
class RemoteEmergencyRequestDataSource implements EmergencyRequestDataSource {
  final http.Client client;
  final String baseUrl;
  final Future<String?> Function()? tokenProvider;
  final SocketService? socketService;

  RemoteEmergencyRequestDataSource({
    required this.client,
    this.baseUrl = ApiConstants.defaultBaseUrl,
    this.tokenProvider,
    this.socketService,
  });

  Future<Map<String, String>> _getHeaders() async {
    final headers = <String, String>{
      ApiConstants.headerContentType: ApiConstants.contentTypeJson,
    };
    if (tokenProvider != null) {
      final token = await tokenProvider!();
      if (token != null && token.isNotEmpty) {
        headers[ApiConstants.headerAuthorization] = '${ApiConstants.bearerPrefix}$token';
      }
    }
    return headers;
  }

  @override
  Future<EmergencyRequestModel> createEmergencyRequest(EmergencyRequestModel request) async {
    final uri = Uri.parse('$baseUrl${ApiConstants.emergencyRequests}');
    try {
      final headers = await _getHeaders();
      final response = await client.post(
        uri,
        headers: headers,
        body: jsonEncode(request.toSubmissionJson()),
      );

      if (response.statusCode == 200 || response.statusCode == 201) {
        final Map<String, dynamic> body = jsonDecode(response.body) as Map<String, dynamic>;
        // Backend create response is a flat partial object:
        // { success, requestId, status, assignmentId, ambulanceId, eta }
        // It does NOT contain pickupLocation, requesterId, emergencyType, etc.
        // Build a complete model by merging backend response fields with submitted request data.
        final created = request.copyWith(
          requestId: body['requestId'] as String? ?? request.requestId,
          status: RequestStatus.fromCode(body['status'] as String? ?? 'SEARCHING'),
          assignedAmbulanceId: body['ambulanceId'] as String?,
          currentETA: (body['eta'] as num?)?.toInt(),
        );
        socketService?.joinEmergencyRoom(created.requestId);
        return created;
      } else {
        _handleHttpError(response.statusCode, response.body, 'Failed to submit emergency request');
      }
    } catch (e) {
      if (e is ServerException) rethrow;
      throw NetworkException('Network error during request submission: $e');
    }
    throw const ServerException('Unknown error submitting request');
  }

  @override
  Future<EmergencyRequestModel> getEmergencyRequest(String requestId) async {
    final uri = Uri.parse('$baseUrl${ApiConstants.emergencyRequestById(requestId)}');
    try {
      final headers = await _getHeaders();
      final response = await client.get(uri, headers: headers);

      if (response.statusCode == 200) {
        final Map<String, dynamic> body = jsonDecode(response.body) as Map<String, dynamic>;
        final requestData = body['request'] is Map<String, dynamic>
            ? body['request'] as Map<String, dynamic>
            : body;
        return EmergencyRequestModel.fromJson(requestData);
      } else {
        _handleHttpError(response.statusCode, response.body, 'Failed to fetch emergency request');
      }
    } catch (e) {
      if (e is ServerException) rethrow;
      throw NetworkException('Network error fetching request: $e');
    }
    throw const ServerException('Unknown error fetching request');
  }

  @override
  Future<RequestStatus> getRequestStatus(String requestId) async {
    final uri = Uri.parse('$baseUrl${ApiConstants.emergencyRequestStatus(requestId)}');
    try {
      final headers = await _getHeaders();
      final response = await client.get(uri, headers: headers);

      if (response.statusCode == 200) {
        final Map<String, dynamic> body = jsonDecode(response.body) as Map<String, dynamic>;
        final requestData = body['request'] is Map<String, dynamic>
            ? body['request'] as Map<String, dynamic>
            : body;
        final statusCode = requestData['status'] as String? ?? 'SEARCHING';
        return RequestStatus.fromCode(statusCode);
      } else {
        _handleHttpError(response.statusCode, response.body, 'Failed to get status');
      }
    } catch (e) {
      if (e is ServerException) rethrow;
      throw NetworkException('Network error fetching status: $e');
    }
    throw const ServerException('Unknown error fetching status');
  }

  @override
  Future<EmergencyRequestModel> cancelEmergencyRequest(String requestId, {String? reason}) async {
    final uri = Uri.parse('$baseUrl${ApiConstants.cancelEmergencyRequest(requestId)}');
    try {
      final headers = await _getHeaders();
      final response = await client.post(
        uri,
        headers: headers,
        body: jsonEncode({'reason': reason ?? 'Cancelled by bystander'}),
      );

      if (response.statusCode == 200) {
        // Backend returns: { success: true, requestId, status: 'CANCELLED' }
        // Fetch the fresh full request details to preserve all fields
        return await getEmergencyRequest(requestId);
      } else {
        _handleHttpError(response.statusCode, response.body, 'Failed to cancel request');
      }
    } catch (e) {
      if (e is ServerException) rethrow;
      throw NetworkException('Network error during cancellation: $e');
    }
    throw const ServerException('Unknown error cancelling request');
  }

  @override
  Stream<EmergencyRequestModel> watchRequestUpdates(String requestId) {
    final controller = StreamController<EmergencyRequestModel>.broadcast();

    // 1. Join Socket.IO room
    socketService?.joinEmergencyRoom(requestId);

    // 2. Listen to real-time events
    final socketSub = socketService?.eventStream.listen((event) async {
      try {
        final req = await getEmergencyRequest(requestId);
        if (!controller.isClosed) {
          controller.add(req);
        }
      } catch (_) {}
    });

    // 3. Fallback Polling Timer (ensures data sync if WebSocket drops)
    final pollTimer = Timer.periodic(const Duration(seconds: 4), (timer) async {
      if (controller.isClosed) {
        timer.cancel();
        return;
      }
      try {
        final req = await getEmergencyRequest(requestId);
        if (!controller.isClosed) {
          controller.add(req);
          if (!req.status.isActive) {
            timer.cancel();
          }
        }
      } catch (_) {}
    });

    controller.onCancel = () {
      socketSub?.cancel();
      pollTimer.cancel();
      socketService?.leaveEmergencyRoom();
    };

    return controller.stream;
  }

  void _handleHttpError(int statusCode, String body, String context) {
    String message = body;
    try {
      final parsed = jsonDecode(body);
      if (parsed is Map && parsed.containsKey('message')) {
        message = parsed['message'].toString();
      }
    } catch (_) {}

    switch (statusCode) {
      case 400:
        throw ServerException('Invalid request ($message)', 400, 'BAD_REQUEST');
      case 401:
        throw const ServerException('Session expired or unauthorized. Please re-login.', 401, 'UNAUTHORIZED');
      case 403:
        throw const ServerException('Access forbidden: Bystander role required.', 403, 'FORBIDDEN');
      case 404:
        throw const ServerException('Emergency request not found.', 404, 'NOT_FOUND');
      case 409:
        throw const ServerException('Emergency cannot be cancelled in its current state.', 409, 'CONFLICT');
      default:
        throw ServerException('$context ($statusCode): $message', statusCode);
    }
  }
}
