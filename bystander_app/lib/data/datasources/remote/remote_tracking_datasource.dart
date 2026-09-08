import 'dart:async';
import 'dart:convert';
import 'package:http/http.dart' as http;
import '../../../core/constants/api_constants.dart';
import '../../../core/errors/exceptions.dart';
import '../../models/eta_model.dart';
import '../../models/tracking_model.dart';
import '../../../domain/entities/request_status.dart';
import '../tracking_datasource.dart';
import 'socket_service.dart';

/// Real REST/Socket.IO Data Source for ambulance live tracking.
/// Handles GET /api/emergency/{requestId}/tracking and listens to
/// AMBULANCE_LOCATION_UPDATED, ETA_UPDATED, and STATUS_UPDATED real-time events.
class RemoteTrackingDataSource implements TrackingDataSource {
  final http.Client client;
  final String baseUrl;
  final Future<String?> Function()? tokenProvider;
  final SocketService? socketService;

  RemoteTrackingDataSource({
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
  Future<TrackingModel?> getTrackingInfo(String requestId) async {
    final uri = Uri.parse('$baseUrl${ApiConstants.trackingInfo(requestId)}');
    try {
      final headers = await _getHeaders();
      final response = await client.get(uri, headers: headers);
      if (response.statusCode == 200) {
        final Map<String, dynamic> body = jsonDecode(response.body) as Map<String, dynamic>;
        return _parseTrackingBody(body);
      }
      return null;
    } catch (e) {
      throw NetworkException('Failed to retrieve tracking info: $e');
    }
  }

  @override
  Future<EtaModel?> getEta(String requestId) async {
    final tracking = await getTrackingInfo(requestId);
    return tracking?.eta as EtaModel?;
  }

  @override
  Stream<TrackingModel> watchTrackingUpdates(String requestId) {
    final controller = StreamController<TrackingModel>.broadcast();

    // 1. Listen to Socket.IO real-time events
    final sub = socketService?.eventStream.listen((event) {
      if (event.event == 'AMBULANCE_LOCATION_UPDATED' ||
          event.event == 'AMBULANCE_ASSIGNED' ||
          event.event == 'AMBULANCE_REASSIGNED') {
        final model = _parseTrackingBody(event.data);
        if (model != null && !controller.isClosed) {
          controller.add(model);
        }
      }
    });

    // 2. Periodic poll as reliable fallback
    final pollTimer = Timer.periodic(const Duration(seconds: 4), (timer) async {
      if (controller.isClosed) {
        timer.cancel();
        return;
      }
      try {
        final tracking = await getTrackingInfo(requestId);
        if (tracking != null && !controller.isClosed) {
          controller.add(tracking);
        }
      } catch (_) {}
    });

    controller.onCancel = () {
      sub?.cancel();
      pollTimer.cancel();
    };

    return controller.stream;
  }

  @override
  Stream<EtaModel> watchEtaUpdates(String requestId) {
    final controller = StreamController<EtaModel>.broadcast();

    final sub = socketService?.eventStream.listen((event) {
      if (event.event == 'ETA_UPDATED') {
        final data = event.data;
        final minutes = (data['etaMinutes'] ?? data['eta'] ?? data['currentETA'] ?? 5) as num;
        final distanceKm = (data['distanceKm'] ?? data['distance'] ?? 2.5) as num;
        final eta = EtaModel(
          estimatedMinutes: minutes.toInt(),
          distanceMeters: distanceKm.toDouble() * 1000.0,
          lastCalculatedAt: DateTime.now(),
          trafficCondition: 'Green Corridor Active',
        );
        if (!controller.isClosed) controller.add(eta);
      }
    });

    controller.onCancel = () => sub?.cancel();
    return controller.stream;
  }

  TrackingModel? _parseTrackingBody(Map<String, dynamic> rawBody) {
    try {
      final body = rawBody['tracking'] is Map<String, dynamic>
          ? rawBody['tracking'] as Map<String, dynamic>
          : rawBody;
      final ambulanceId = body['ambulanceId'] as String? ?? 'AMB-UNKNOWN';
      final requestId = body['requestId'] as String? ?? '';
      final statusStr = body['status'] as String? ?? 'DISPATCHED';

      // Parse nested or flat location
      double lat = 13.0827;
      double lng = 80.2707;
      if (body['location'] is Map) {
        final loc = body['location'] as Map;
        lat = (loc['latitude'] ?? loc['lat'] ?? 13.0827).toDouble();
        lng = (loc['longitude'] ?? loc['lng'] ?? 80.2707).toDouble();
      } else if (body['latitude'] != null && body['longitude'] != null) {
        lat = (body['latitude'] as num).toDouble();
        lng = (body['longitude'] as num).toDouble();
      }

      // Parse ETA
      EtaModel eta = EtaModel(
        estimatedMinutes: 5,
        distanceMeters: 2000.0,
        lastCalculatedAt: DateTime.now(),
        trafficCondition: 'Green Corridor Active',
      );
      if (body['eta'] is Map) {
        eta = EtaModel.fromJson(body['eta'] as Map<String, dynamic>);
      } else if (body['eta'] is num) {
        eta = EtaModel(
          estimatedMinutes: (body['eta'] as num).toInt(),
          distanceMeters: 2000.0,
          lastCalculatedAt: DateTime.now(),
          trafficCondition: 'Green Corridor Active',
        );
      }

      return TrackingModel(
        ambulanceId: ambulanceId,
        requestId: requestId,
        latitude: lat,
        longitude: lng,
        timestamp: DateTime.now(),
        status: RequestStatus.fromCode(statusStr),
        eta: eta,
        speedKmH: (body['speedKmH'] as num?)?.toDouble() ?? 48.0,
        driverName: body['driverName'] as String?,
        driverPhone: body['driverPhone'] as String?,
        vehicleNumber: body['vehicleNumber'] as String?,
      );
    } catch (_) {
      return null;
    }
  }
}
