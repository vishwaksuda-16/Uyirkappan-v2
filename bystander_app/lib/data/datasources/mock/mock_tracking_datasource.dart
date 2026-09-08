import 'dart:async';
import 'dart:math' as math;
import '../../models/eta_model.dart';
import '../../models/tracking_model.dart';
import '../../../core/utils/map_route_geometry.dart';
import '../../../domain/entities/location_data.dart';
import '../../../domain/entities/nearby_poi.dart';
import '../../../domain/entities/request_status.dart';
import '../tracking_datasource.dart';

import '../remote/socket_service.dart';

class _AssignedUnit {
  final String ambulanceId;
  final String? driverName;
  final String? driverPhone;
  double latitude;
  double longitude;
  double destLatitude;
  double destLongitude;
  double heading;
  int etaMinutes;
  double speedKmH;
  RequestStatus status;
  List<LocationData> routePoints;
  int currentStepIndex;
  String? hospitalName;

  _AssignedUnit({
    required this.ambulanceId,
    this.driverName,
    this.driverPhone,
    required this.latitude,
    required this.longitude,
    required this.destLatitude,
    required this.destLongitude,
    required this.heading,
    this.etaMinutes = 6,
    this.speedKmH = 48.0,
    this.status = RequestStatus.enRouteToPatient,
    required this.routePoints,
    this.currentStepIndex = 0,
    this.hospitalName,
  });
}

/// Simulated Tracking DataSource for offline unit test suites and harnesses.
/// Disconnected from production runtime.
class MockTrackingDataSource implements TrackingDataSource {
  final SocketService? socketService;
  final Map<String, StreamController<TrackingModel>> _trackingControllers = {};
  final Map<String, StreamController<EtaModel>> _etaControllers = {};
  final Map<String, _AssignedUnit> _assignments = {};
  final List<Timer> _activeTimers = [];

  MockTrackingDataSource({this.socketService});

  /// Binds a dispatched unit from a fixed base station to the emergency scene.
  void assignUnit({
    required String requestId,
    required String ambulanceId,
    String? driverName,
    String? driverPhone,
    required double startLatitude,
    required double startLongitude,
    required double destLatitude,
    required double destLongitude,
    String? hospitalName,
    int routeSteps = 16,
  }) {
    final start = LocationData(
      latitude: startLatitude,
      longitude: startLongitude,
      timestamp: DateTime.now(),
    );
    final dest = LocationData(
      latitude: destLatitude,
      longitude: destLongitude,
      timestamp: DateTime.now(),
    );

    final rawRoute = MapRouteGeometry.buildSimulatedRoute(from: start, to: dest);
    final smoothPath = MapRouteGeometry.interpolatePath(rawRoute, totalSteps: routeSteps);

    final initialHeading = MapRouteGeometry.headingDegrees(start, smoothPath.length > 1 ? smoothPath[1] : dest);
    final distKm = NearbyEmergencyService.distanceKm(startLatitude, startLongitude, destLatitude, destLongitude);
    final eta = math.max(2, (distKm * 1.5).round());

    _assignments[requestId] = _AssignedUnit(
      ambulanceId: ambulanceId,
      driverName: driverName ?? 'Karthik Raja (Paramedic Lead)',
      driverPhone: driverPhone ?? '+91 98401 23456',
      latitude: startLatitude,
      longitude: startLongitude,
      destLatitude: destLatitude,
      destLongitude: destLongitude,
      heading: initialHeading,
      etaMinutes: eta,
      speedKmH: 48.0,
      status: RequestStatus.enRouteToPatient,
      routePoints: smoothPath,
      currentStepIndex: 0,
      hospitalName: hospitalName,
    );

    _emit(requestId);
  }

  /// Transitions the assigned unit to hospital transit mode (patient onboard -> en route to hospital).
  void navigateToHospital({
    required String requestId,
    required double hospitalLatitude,
    required double hospitalLongitude,
    required String hospitalName,
    int routeSteps = 16,
  }) {
    final unit = _assignments[requestId];
    if (unit == null) return;

    final start = LocationData(
      latitude: unit.latitude,
      longitude: unit.longitude,
      timestamp: DateTime.now(),
    );
    final dest = LocationData(
      latitude: hospitalLatitude,
      longitude: hospitalLongitude,
      timestamp: DateTime.now(),
    );

    final rawRoute = MapRouteGeometry.buildSimulatedRoute(from: start, to: dest);
    final smoothPath = MapRouteGeometry.interpolatePath(rawRoute, totalSteps: routeSteps);

    unit.destLatitude = hospitalLatitude;
    unit.destLongitude = hospitalLongitude;
    unit.hospitalName = hospitalName;
    unit.routePoints = smoothPath;
    unit.currentStepIndex = 0;
    unit.status = RequestStatus.enRouteToHospital;
    unit.speedKmH = 54.0; // Higher speed on green corridor to hospital

    final distKm = NearbyEmergencyService.distanceKm(unit.latitude, unit.longitude, hospitalLatitude, hospitalLongitude);
    unit.etaMinutes = math.max(2, (distKm * 1.3).round());

    _emit(requestId);
  }

  /// Sets the operational status of the unit (e.g. arrivedAtPatient, patientOnboard, arrivedAtHospital).
  void setUnitStatus(String requestId, RequestStatus status) {
    final unit = _assignments[requestId];
    if (unit == null) return;

    unit.status = status;
    if (status == RequestStatus.arrivedAtPatient || status == RequestStatus.arrivedAtHospital) {
      unit.speedKmH = 0.0;
    } else if (status == RequestStatus.enRouteToHospital) {
      unit.speedKmH = 54.0;
    } else if (status == RequestStatus.enRouteToPatient) {
      unit.speedKmH = 48.0;
    }
    _emit(requestId);
  }

  void clearUnit(String requestId) {
    _assignments.remove(requestId);
  }

  @override
  Future<TrackingModel?> getTrackingInfo(String requestId) async {
    await Future.delayed(const Duration(milliseconds: 200));
    return _buildSnapshot(requestId);
  }

  @override
  Future<EtaModel?> getEta(String requestId) async {
    await Future.delayed(const Duration(milliseconds: 150));
    return _buildEta(requestId);
  }

  @override
  Stream<TrackingModel> watchTrackingUpdates(String requestId) {
    if (!_trackingControllers.containsKey(requestId)) {
      _trackingControllers[requestId] = StreamController<TrackingModel>.broadcast();
      _startSimulatedTelemetryStream(requestId);
    }
    return _trackingControllers[requestId]!.stream;
  }

  @override
  Stream<EtaModel> watchEtaUpdates(String requestId) {
    if (!_etaControllers.containsKey(requestId)) {
      _etaControllers[requestId] = StreamController<EtaModel>.broadcast();
    }
    return _etaControllers[requestId]!.stream;
  }

  /// Runs continuous 1-second ticks advancing the ambulance smoothly along road waypoints.
  void _startSimulatedTelemetryStream(String requestId) {
    final timer = Timer.periodic(const Duration(milliseconds: 1000), (t) {
      if (!_trackingControllers.containsKey(requestId) ||
          _trackingControllers[requestId]!.isClosed) {
        t.cancel();
        return;
      }
      final unit = _assignments[requestId];
      if (unit == null) return;

      // Only advance position when actively traveling on the road
      final isMoving = unit.status == RequestStatus.enRouteToPatient ||
          unit.status == RequestStatus.enRouteToHospital;

      if (isMoving && unit.routePoints.isNotEmpty) {
        if (unit.currentStepIndex < unit.routePoints.length - 1) {
          unit.currentStepIndex++;
          final nextPt = unit.routePoints[unit.currentStepIndex];

          final currentLoc = LocationData(
            latitude: unit.latitude,
            longitude: unit.longitude,
            timestamp: DateTime.now(),
          );
          unit.heading = MapRouteGeometry.headingDegrees(currentLoc, nextPt);
          unit.latitude = nextPt.latitude;
          unit.longitude = nextPt.longitude;

          // Compute remaining distance in meters
          final remainingDistKm = NearbyEmergencyService.distanceKm(
            unit.latitude,
            unit.longitude,
            unit.destLatitude,
            unit.destLongitude,
          );
          unit.etaMinutes = math.max(1, (remainingDistKm * 1.4).round());

          // Fluctuate speed slightly around 48 km/h for realistic GPS telemetry
          final jitter = (math.Random().nextDouble() - 0.5) * 4;
          unit.speedKmH = math.max(38.0, math.min(62.0, (unit.status == RequestStatus.enRouteToHospital ? 54.0 : 48.0) + jitter));
        } else {
          // Reached destination for current phase
          unit.latitude = unit.destLatitude;
          unit.longitude = unit.destLongitude;
          unit.speedKmH = 0.0;
          unit.etaMinutes = 0;
        }
      }

      _emit(requestId);
    });

    _activeTimers.add(timer);
  }

  void _emit(String requestId) {
    final tracking = _buildSnapshot(requestId);
    if (tracking == null) return;
    final controller = _trackingControllers[requestId];
    if (controller != null && !controller.isClosed) {
      controller.add(tracking);
    }
    final etaController = _etaControllers[requestId];
    if (etaController != null && !etaController.isClosed && tracking.eta is EtaModel) {
      etaController.add(tracking.eta as EtaModel);
    }

    // Emit real-time Socket.IO events for live tracking and dynamic ETA
    if (socketService != null) {
      final unit = _assignments[requestId];
      if (unit != null) {
        socketService!.emitSimulatedEvent('AMBULANCE_LOCATION_UPDATED', {
          'requestId': requestId,
          'ambulanceId': unit.ambulanceId,
          'location': {'latitude': unit.latitude, 'longitude': unit.longitude},
          'status': unit.status.code,
        });

        final remainingDistKm = NearbyEmergencyService.distanceKm(
          unit.latitude,
          unit.longitude,
          unit.destLatitude,
          unit.destLongitude,
        );
        socketService!.emitSimulatedEvent('ETA_UPDATED', {
          'requestId': requestId,
          'etaMinutes': unit.etaMinutes,
          'distanceKm': remainingDistKm.toStringAsFixed(1),
        });
      }
    }
  }

  TrackingModel? _buildSnapshot(String requestId) {
    final unit = _assignments[requestId];
    if (unit == null) {
      return null;
    }

    final remainingDistKm = NearbyEmergencyService.distanceKm(
      unit.latitude,
      unit.longitude,
      unit.destLatitude,
      unit.destLongitude,
    );
    final distanceMeters = remainingDistKm * 1000.0;

    String corridorNote = 'Green Corridor Active';
    if (unit.status == RequestStatus.enRouteToHospital) {
      corridorNote = 'Hospital Trauma Corridor: ${unit.hospitalName ?? 'Emergency ICU'}';
    } else if (unit.status == RequestStatus.arrivedAtPatient) {
      corridorNote = 'Paramedic Unit On Scene';
    } else if (unit.status == RequestStatus.patientOnboard) {
      corridorNote = 'Patient Stabilized & Loaded';
    }

    return TrackingModel(
      ambulanceId: unit.ambulanceId,
      requestId: requestId,
      latitude: unit.latitude,
      longitude: unit.longitude,
      speedKmH: unit.speedKmH,
      headingDegrees: unit.heading,
      timestamp: DateTime.now(),
      status: unit.status,
      eta: EtaModel(
        estimatedMinutes: unit.etaMinutes,
        distanceMeters: distanceMeters,
        lastCalculatedAt: DateTime.now(),
        trafficCondition: corridorNote,
      ),
      vehicleNumber: 'TN-01-AMB-${unit.ambulanceId.replaceAll(RegExp(r'[^0-9]'), '').padLeft(3, '0')}',
      driverName: unit.driverName ?? 'Karthik Raja (Paramedic Lead)',
      driverPhone: unit.driverPhone ?? '+91 98401 23456',
    );
  }

  EtaModel _buildEta(String requestId) {
    final unit = _assignments[requestId];
    final remainingDistKm = unit != null
        ? NearbyEmergencyService.distanceKm(unit.latitude, unit.longitude, unit.destLatitude, unit.destLongitude)
        : 2.0;
    return EtaModel(
      estimatedMinutes: unit?.etaMinutes ?? 4,
      distanceMeters: remainingDistKm * 1000.0,
      lastCalculatedAt: DateTime.now(),
      trafficCondition: 'Green Corridor Active',
    );
  }

  void dispose() {
    for (final timer in _activeTimers) {
      timer.cancel();
    }
    _activeTimers.clear();
    for (final c in _trackingControllers.values) {
      c.close();
    }
    _trackingControllers.clear();
    for (final c in _etaControllers.values) {
      c.close();
    }
    _etaControllers.clear();
    _assignments.clear();
  }
}
