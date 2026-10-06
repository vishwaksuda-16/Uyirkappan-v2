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
        final eventRequestId = event.data['requestId']?.toString();
        if (eventRequestId != null && eventRequestId != requestId) return;
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
        final eventRequestId = data['requestId']?.toString();
        if (eventRequestId != null && eventRequestId != requestId) return;
        final minutes = data['etaMinutes'] ?? data['eta'] ?? data['currentETA'];
        if (minutes is! num) return;
        final distanceKm = data['distanceKm'] ?? data['distance'];
        final eta = EtaModel(
          estimatedMinutes: minutes.toInt(),
          distanceMeters: distanceKm is num ? distanceKm.toDouble() * 1000.0 : null,
          lastCalculatedAt: DateTime.now(),
          trafficCondition: data['trafficCondition'] as String?,
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
      double? lat;
      double? lng;
      String? provider = body['provider'] as String?;
      String? gpsSource = body['gpsSource'] as String?;
      bool? isSimulated = body['isSimulated'] is bool ? body['isSimulated'] as bool : null;
      double? accuracy = (body['accuracy'] as num?)?.toDouble();

      if (body['location'] is Map) {
        final loc = body['location'] as Map;
        lat = (loc['latitude'] ?? loc['lat'] as num?)?.toDouble();
        lng = (loc['longitude'] ?? loc['lng'] as num?)?.toDouble();
        provider ??= loc['provider'] as String?;
        gpsSource ??= loc['gpsSource'] as String?;
        if (loc['isSimulated'] is bool) isSimulated ??= loc['isSimulated'] as bool;
        accuracy ??= (loc['accuracy'] as num?)?.toDouble();
      } else if (body['latitude'] != null && body['longitude'] != null) {
        lat = (body['latitude'] as num).toDouble();
        lng = (body['longitude'] as num).toDouble();
      }
      if (lat == null || lng == null || !lat.isFinite || !lng.isFinite) {
        return null;
      }
      final locationBody = body['location'] is Map ? body['location'] as Map : const {};
      final speed = body['speedKmH'] ?? body['speed'] ?? locationBody['speed'];
      final heading = body['headingDegrees'] ?? body['heading'] ?? locationBody['heading'];

      provider ??= (gpsSource == 'DEVICE' ? 'real' : 'simulation');
      gpsSource ??= (provider == 'real' ? 'DEVICE' : 'SIMULATION');
      isSimulated ??= (provider != 'real' && gpsSource != 'DEVICE');

      DateTime timestamp = DateTime.now();
      if (body['timestamp'] != null) {
        timestamp = DateTime.tryParse(body['timestamp'].toString()) ?? DateTime.now();
      }

      // Parse ETA
      EtaModel? eta;
      if (body['eta'] is Map) {
        eta = EtaModel.fromJson(body['eta'] as Map<String, dynamic>);
      } else if (body['eta'] is num) {
        final status = RequestStatus.fromCode(statusStr);
        final routeData = status == RequestStatus.patientOnboard ||
                status == RequestStatus.enRouteToHospital ||
                status == RequestStatus.arrivedAtHospital
            ? body['hospitalRoute'] ?? body['route']
            : body['route'];
        final routeDistance = routeData is Map
            ? routeData['distanceKm'] ?? routeData['totalDistanceKm']
            : null;
        final distanceKm = body['distanceKm'] ?? routeDistance;
        eta = EtaModel(
          estimatedMinutes: (body['eta'] as num).toInt(),
          distanceMeters:
              distanceKm is num ? distanceKm.toDouble() * 1000.0 : null,
          lastCalculatedAt: DateTime.now(),
          trafficCondition: body['trafficCondition'] as String?,
        );
      }

      return TrackingModel(
        ambulanceId: ambulanceId,
        requestId: requestId,
        latitude: lat,
        longitude: lng,
        timestamp: timestamp,
        status: RequestStatus.fromCode(statusStr),
        eta: eta,
        speedKmH: speed is num ? speed.toDouble() : null,
        headingDegrees: heading is num ? heading.toDouble() : null,
        driverName: body['driverName'] as String?,
        driverPhone: body['driverPhone'] as String?,
        vehicleNumber: body['vehicleNumber'] as String?,
        provider: provider,
        gpsSource: gpsSource,
        isSimulated: isSimulated,
        accuracy: accuracy,
      );
    } catch (_) {
      return null;
    }
  }
}
