import 'dart:async';
import 'package:uuid/uuid.dart';
import '../../models/emergency_request_model.dart';
import '../../../domain/entities/nearby_poi.dart';
import '../../../domain/entities/request_status.dart';
import '../emergency_request_datasource.dart';
import 'mock_tracking_datasource.dart';

import '../remote/socket_service.dart';

/// Available demonstration scenarios for college viva / paper / system testing.
enum SimulationScenarioType {
  normalDispatch,
  driverRejectionWithFallback,
  driverTimeoutWithFallback,
  noAmbulanceAvailable,
  trackingIntegrationDemo,
}

/// Simulated Backend Data Source for offline unit test suites and harnesses.
/// Disconnected from production runtime.
class MockEmergencyRequestDataSource implements EmergencyRequestDataSource {
  final Map<String, EmergencyRequestModel> _inMemoryStore = {};
  final Map<String, StreamController<EmergencyRequestModel>> _streamControllers = {};
  final List<Timer> _activeTimers = [];
  final MockTrackingDataSource? trackingDataSource;
  final SocketService? socketService;

  SimulationScenarioType activeScenario = SimulationScenarioType.normalDispatch;
  bool isFastSimulation = true;

  MockEmergencyRequestDataSource({
    this.trackingDataSource,
    this.socketService,
  });

  @override
  Future<EmergencyRequestModel> createEmergencyRequest(EmergencyRequestModel request) async {
    // Simulate real asynchronous network latency (400ms - 800ms)
    await Future.delayed(const Duration(milliseconds: 500));

    final String generatedId = 'UK-${const Uuid().v4().substring(0, 8).toUpperCase()}';
    final now = DateTime.now();

    final createdModel = EmergencyRequestModel(
      requestId: generatedId,
      requesterId: request.requesterId.isNotEmpty ? request.requesterId : 'BYSTANDER-${const Uuid().v4().substring(0, 4)}',
      emergencyType: request.emergencyType,
      victimCount: request.victimCount,
      emergencyLocation: request.emergencyLocation,
      requesterLocation: request.requesterLocation,
      createdAt: now,
      status: RequestStatus.searching,
      additionalNotes: request.additionalNotes,
      t0UserPressed: request.t0UserPressed ?? now,
      t1RequestReceived: now,
    );

    _inMemoryStore[generatedId] = createdModel;

    socketService?.emitSimulatedEvent('EMERGENCY_CREATED', {
      'requestId': generatedId,
      'status': 'SEARCHING',
    });

    // Start lifecycle simulation according to the selected scenario
    _startScenarioLifecycle(generatedId, activeScenario);

    return createdModel;
  }

  @override
  Future<EmergencyRequestModel> getEmergencyRequest(String requestId) async {
    await Future.delayed(const Duration(milliseconds: 150));
    final request = _inMemoryStore[requestId];
    if (request != null) {
      return request;
    }
    throw Exception('Emergency request $requestId not found in mock store');
  }

  @override
  Future<RequestStatus> getRequestStatus(String requestId) async {
    final request = await getEmergencyRequest(requestId);
    return request.status;
  }

  @override
  Future<EmergencyRequestModel> cancelEmergencyRequest(String requestId, {String? reason}) async {
    await Future.delayed(const Duration(milliseconds: 250));
    final existing = await getEmergencyRequest(requestId);
    final cancelled = existing.copyWith(
      status: RequestStatus.cancelled,
      additionalNotes: reason != null ? 'Cancelled: $reason' : existing.additionalNotes,
    );

    _updateAndEmit(cancelled);
    _cancelTimers();
    return cancelled;
  }

  @override
  Stream<EmergencyRequestModel> watchRequestUpdates(String requestId) {
    if (!_streamControllers.containsKey(requestId)) {
      _streamControllers[requestId] = StreamController<EmergencyRequestModel>.broadcast();
    }

    // Immediately push current state if available
    final current = _inMemoryStore[requestId];
    if (current != null) {
      Timer.run(() {
        final ctrl = _streamControllers[requestId];
        if (ctrl != null && !ctrl.isClosed) {
          ctrl.add(current);
        }
      });
    }

    return _streamControllers[requestId]!.stream;
  }

  /// Sets the active simulation scenario for demonstrations.
  void setScenario(SimulationScenarioType scenario) {
    activeScenario = scenario;
  }

  void _startScenarioLifecycle(String requestId, SimulationScenarioType scenario) {
    final baseDelay = isFastSimulation ? const Duration(seconds: 2) : const Duration(seconds: 6);

    switch (scenario) {
      case SimulationScenarioType.normalDispatch:
      case SimulationScenarioType.trackingIntegrationDemo:
        _runNormalScenario(requestId, baseDelay);
        break;
      case SimulationScenarioType.driverRejectionWithFallback:
        _runDriverRejectionScenario(requestId, baseDelay);
        break;
      case SimulationScenarioType.driverTimeoutWithFallback:
        _runDriverTimeoutScenario(requestId, baseDelay);
        break;
      case SimulationScenarioType.noAmbulanceAvailable:
        _runNoAmbulanceScenario(requestId, baseDelay);
        break;
    }
  }

  /// Complete Realistic Dispatch Journey:
  /// 1. Searching
  /// 2. Assigned (Nearest CSV Ambulance Base)
  /// 3. Driver Accepted
  /// 4. En Route to Patient (Road navigation)
  /// 5. Arrived at Scene
  /// 6. Patient Onboard (Assigned Nearest CSV Hospital)
  /// 7. En Route to Hospital (Transit along road to emergency trauma bay)
  /// 8. Arrived at Hospital
  /// 9. Completed
  void _runNormalScenario(String requestId, Duration baseDelay) {
    // 1. Searching -> Assigned (Find Nearest Ambulance Base from CSV)
    _schedule(baseDelay, () {
      final req = _inMemoryStore[requestId];
      if (req == null || !req.status.isActive) return;

      final incidentLat = req.emergencyLocation.latitude;
      final incidentLng = req.emergencyLocation.longitude;
      final nearestAmb = NearbyEmergencyService.findNearestAmbulance(incidentLat, incidentLng);
      final nearestHosp = NearbyEmergencyService.findNearestHospital(incidentLat, incidentLng);

      final now = DateTime.now();
      final updated = req.copyWith(
        status: RequestStatus.assigned,
        assignedAmbulanceId: nearestAmb.id,
        assignedDriverName: 'Paramedic Team (${nearestAmb.name})',
        driverPhone: '+91 98401 23456',
        hospitalDestination: nearestHosp.name,
        t2MatchingCompleted: now,
        t3AssignmentSent: now,
      );
      _updateAndEmit(updated);
      _bindTracking(
        updated,
        startLat: nearestAmb.latitude,
        startLng: nearestAmb.longitude,
        hospitalName: nearestHosp.name,
      );

      // 2. Assigned -> Driver Accepted
      _schedule(const Duration(seconds: 2), () {
        final req2 = _inMemoryStore[requestId];
        if (req2 == null || !req2.status.isActive) return;

        final now2 = DateTime.now();
        final updated2 = req2.copyWith(
          status: RequestStatus.accepted,
          t4DriverAccepted: now2,
        );
        _updateAndEmit(updated2);

        // 3. Accepted -> En Route to Patient (Ambulance begins driving from base to incident)
        _schedule(const Duration(seconds: 2), () {
          final req3 = _inMemoryStore[requestId];
          if (req3 == null || !req3.status.isActive) return;

          final now3 = DateTime.now();
          final updated3 = req3.copyWith(
            status: RequestStatus.enRouteToPatient,
            t5AmbulanceStarted: now3,
          );
          _updateAndEmit(updated3);
          trackingDataSource?.setUnitStatus(requestId, RequestStatus.enRouteToPatient);

          // 4. En Route -> Arrived at Patient (Vehicular drive time: ~8 seconds)
          _schedule(const Duration(seconds: 8), () {
            final req4 = _inMemoryStore[requestId];
            if (req4 == null || !req4.status.isActive) return;

            final now4 = DateTime.now();
            final updated4 = req4.copyWith(
              status: RequestStatus.arrivedAtPatient,
              t6AmbulanceArrived: now4,
            );
            _updateAndEmit(updated4);
            trackingDataSource?.setUnitStatus(requestId, RequestStatus.arrivedAtPatient);

            // 5. Arrived -> Patient Onboard (Paramedics assess, stabilize, load patient: ~3s)
            _schedule(const Duration(seconds: 3), () {
              final req5 = _inMemoryStore[requestId];
              if (req5 == null || !req5.status.isActive) return;

              final updated5 = req5.copyWith(
                status: RequestStatus.patientOnboard,
                hospitalDestination: nearestHosp.name,
              );
              _updateAndEmit(updated5);
              trackingDataSource?.setUnitStatus(requestId, RequestStatus.patientOnboard);

              // 6. Patient Onboard -> En Route to Hospital (Transfer to nearest CSV trauma hospital)
              _schedule(const Duration(seconds: 2), () {
                final req6 = _inMemoryStore[requestId];
                if (req6 == null || !req6.status.isActive) return;

                final updated6 = req6.copyWith(
                  status: RequestStatus.enRouteToHospital,
                  hospitalDestination: nearestHosp.name,
                );
                _updateAndEmit(updated6);
                trackingDataSource?.navigateToHospital(
                  requestId: requestId,
                  hospitalLatitude: nearestHosp.latitude,
                  hospitalLongitude: nearestHosp.longitude,
                  hospitalName: nearestHosp.name,
                  routeSteps: 10,
                );

                // 7. En Route -> Arrived at Hospital (Ambulance arrives at trauma bay: ~8s)
                _schedule(const Duration(seconds: 8), () {
                  final req7 = _inMemoryStore[requestId];
                  if (req7 == null || !req7.status.isActive) return;

                  final updated7 = req7.copyWith(
                    status: RequestStatus.arrivedAtHospital,
                    hospitalDestination: nearestHosp.name,
                  );
                  _updateAndEmit(updated7);
                  trackingDataSource?.setUnitStatus(requestId, RequestStatus.arrivedAtHospital);

                  // 8. Arrived at Hospital -> Completed (Triage handover complete)
                  _schedule(const Duration(seconds: 3), () {
                    final req8 = _inMemoryStore[requestId];
                    if (req8 == null || !req8.status.isActive) return;

                    final updated8 = req8.copyWith(
                      status: RequestStatus.completed,
                      additionalNotes: 'Patient admitted to emergency trauma bay at ${nearestHosp.name}',
                    );
                    _updateAndEmit(updated8);
                  });
                });
              });
            });
          });
        });
      });
    });
  }

  void _runDriverRejectionScenario(String requestId, Duration baseDelay) {
    // 1. Searching -> Assigned Ambulance 1
    _schedule(baseDelay, () {
      final req = _inMemoryStore[requestId];
      if (req == null || !req.status.isActive) return;

      final incidentLat = req.emergencyLocation.latitude;
      final incidentLng = req.emergencyLocation.longitude;
      final allAmbs = NearbyEmergencyService.getAllAmbulances(userLat: incidentLat, userLng: incidentLng);
      final nearestHosp = NearbyEmergencyService.findNearestHospital(incidentLat, incidentLng);
      final amb1 = allAmbs.isNotEmpty ? allAmbs.first : NearbyEmergencyService.fixedAmbulances.first;

      final updated = req.copyWith(
        status: RequestStatus.assigned,
        assignedAmbulanceId: amb1.id,
        assignedDriverName: 'Primary Unit (${amb1.name})',
        driverPhone: '+91 94440 11111',
        hospitalDestination: nearestHosp.name,
      );
      _updateAndEmit(updated);
      _bindTracking(updated, startLat: amb1.latitude, startLng: amb1.longitude, hospitalName: nearestHosp.name);

      // 2. Driver 1 Rejects -> Cascading Fallback Triggered (Request returns to searching with fallbackCount: 1)
      _schedule(const Duration(seconds: 3), () {
        final req2 = _inMemoryStore[requestId];
        if (req2 == null || !req2.status.isActive) return;

        final updated2 = req2.copyWith(
          status: RequestStatus.searching,
          fallbackCount: req2.fallbackCount + 1,
          assignedAmbulanceId: null,
          assignedDriverName: null,
          hospitalDestination: nearestHosp.name,
        );
        _updateAndEmit(updated2);
        trackingDataSource?.clearUnit(requestId);
        socketService?.emitSimulatedEvent('FALLBACK_STARTED', {
          'requestId': requestId,
          'attempts': req2.fallbackCount + 1,
          'message': 'Finding another available ambulance...',
        });

        // 3. Fallback Dispatch -> Assigned Secondary Ambulance from CSV (Unit 2 in focus)
        _schedule(const Duration(seconds: 3), () {
          final req3 = _inMemoryStore[requestId];
          if (req3 == null || !req3.status.isActive) return;

          final amb2 = allAmbs.length > 1 ? allAmbs[1] : NearbyEmergencyService.fixedAmbulances.last;

          final updated3 = req3.copyWith(
            status: RequestStatus.assigned,
            assignedAmbulanceId: amb2.id,
            assignedDriverName: 'Fallback Unit (${amb2.name})',
            driverPhone: '+91 97890 55555',
            hospitalDestination: nearestHosp.name,
          );
          _updateAndEmit(updated3);
          _bindTracking(updated3, startLat: amb2.latitude, startLng: amb2.longitude, hospitalName: nearestHosp.name);
          socketService?.emitSimulatedEvent('AMBULANCE_REASSIGNED', {
            'requestId': requestId,
            'ambulanceId': amb2.id,
            'eta': 4,
            'attempts': req2.fallbackCount + 1,
          });

          // 4. Driver 2 Accepts
          _schedule(const Duration(seconds: 2), () {
            final req4 = _inMemoryStore[requestId];
            if (req4 == null || !req4.status.isActive) return;

            final updated4 = req4.copyWith(
              status: RequestStatus.accepted,
              hospitalDestination: nearestHosp.name,
            );
            _updateAndEmit(updated4);

            // 5. Driver 2 En Route to Patient
            _schedule(const Duration(seconds: 2), () {
              final req5 = _inMemoryStore[requestId];
              if (req5 == null || !req5.status.isActive) return;

              final updated5 = req5.copyWith(
                status: RequestStatus.enRouteToPatient,
                hospitalDestination: nearestHosp.name,
              );
              _updateAndEmit(updated5);
              trackingDataSource?.setUnitStatus(requestId, RequestStatus.enRouteToPatient);

              // 6. Arrived at Patient
              _schedule(const Duration(seconds: 7), () {
                final req6 = _inMemoryStore[requestId];
                if (req6 == null || !req6.status.isActive) return;

                final updated6 = req6.copyWith(
                  status: RequestStatus.arrivedAtPatient,
                  hospitalDestination: nearestHosp.name,
                );
                _updateAndEmit(updated6);
                trackingDataSource?.setUnitStatus(requestId, RequestStatus.arrivedAtPatient);

                // 7. Patient Onboard -> En Route to Hospital
                _schedule(const Duration(seconds: 3), () {
                  final req7 = _inMemoryStore[requestId];
                  if (req7 == null || !req7.status.isActive) return;

                  final updated7 = req7.copyWith(
                    status: RequestStatus.patientOnboard,
                    hospitalDestination: nearestHosp.name,
                  );
                  _updateAndEmit(updated7);
                  trackingDataSource?.setUnitStatus(requestId, RequestStatus.patientOnboard);

                  _schedule(const Duration(seconds: 2), () {
                    final req8 = _inMemoryStore[requestId];
                    if (req8 == null || !req8.status.isActive) return;

                    final updated8 = req8.copyWith(
                      status: RequestStatus.enRouteToHospital,
                      hospitalDestination: nearestHosp.name,
                    );
                    _updateAndEmit(updated8);
                    trackingDataSource?.navigateToHospital(
                      requestId: requestId,
                      hospitalLatitude: nearestHosp.latitude,
                      hospitalLongitude: nearestHosp.longitude,
                      hospitalName: nearestHosp.name,
                      routeSteps: 10,
                    );

                    // 8. Arrived at Hospital
                    _schedule(const Duration(seconds: 7), () {
                      final req9 = _inMemoryStore[requestId];
                      if (req9 == null || !req9.status.isActive) return;

                      final updated9 = req9.copyWith(
                        status: RequestStatus.arrivedAtHospital,
                        hospitalDestination: nearestHosp.name,
                      );
                      _updateAndEmit(updated9);
                      trackingDataSource?.setUnitStatus(requestId, RequestStatus.arrivedAtHospital);
                    });
                  });
                });
              });
            });
          });
        });
      });
    });
  }

  void _runDriverTimeoutScenario(String requestId, Duration baseDelay) {
    _schedule(baseDelay, () {
      final req = _inMemoryStore[requestId];
      if (req == null || !req.status.isActive) return;

      final incidentLat = req.emergencyLocation.latitude;
      final incidentLng = req.emergencyLocation.longitude;
      final allAmbs = NearbyEmergencyService.getAllAmbulances(userLat: incidentLat, userLng: incidentLng);
      final nearestHosp = NearbyEmergencyService.findNearestHospital(incidentLat, incidentLng);
      final amb1 = allAmbs.isNotEmpty ? allAmbs.first : NearbyEmergencyService.fixedAmbulances.first;

      final updated = req.copyWith(
        status: RequestStatus.assigned,
        assignedAmbulanceId: amb1.id,
        assignedDriverName: 'Primary Unit (${amb1.name})',
        driverPhone: '+91 94440 22222',
        hospitalDestination: nearestHosp.name,
      );
      _updateAndEmit(updated);
      _bindTracking(updated, startLat: amb1.latitude, startLng: amb1.longitude, hospitalName: nearestHosp.name);

      // Timeout expires with no response (4s) -> Trigger cascading fallback
      _schedule(const Duration(seconds: 4), () {
        final req2 = _inMemoryStore[requestId];
        if (req2 == null || !req2.status.isActive) return;

        final updated2 = req2.copyWith(
          status: RequestStatus.searching,
          fallbackCount: req2.fallbackCount + 1,
          assignedAmbulanceId: null,
          assignedDriverName: null,
          hospitalDestination: nearestHosp.name,
        );
        _updateAndEmit(updated2);
        trackingDataSource?.clearUnit(requestId);
        socketService?.emitSimulatedEvent('FALLBACK_STARTED', {
          'requestId': requestId,
          'attempts': req2.fallbackCount + 1,
          'message': 'Finding another available ambulance...',
        });

        // Reassign secondary vehicle (amb2 in focus)
        _schedule(const Duration(seconds: 3), () {
          final req3 = _inMemoryStore[requestId];
          if (req3 == null || !req3.status.isActive) return;

          final amb2 = allAmbs.length > 1 ? allAmbs[1] : NearbyEmergencyService.fixedAmbulances.last;

          final updated3 = req3.copyWith(
            status: RequestStatus.assigned,
            assignedAmbulanceId: amb2.id,
            assignedDriverName: 'Fallback Unit (${amb2.name})',
            driverPhone: '+91 91234 56789',
            hospitalDestination: nearestHosp.name,
          );
          _updateAndEmit(updated3);
          _bindTracking(updated3, startLat: amb2.latitude, startLng: amb2.longitude, hospitalName: nearestHosp.name);
          socketService?.emitSimulatedEvent('AMBULANCE_REASSIGNED', {
            'requestId': requestId,
            'ambulanceId': amb2.id,
            'eta': 4,
            'attempts': req2.fallbackCount + 1,
          });

          // Driver 2 Accepts -> En Route -> Hospital
          _schedule(const Duration(seconds: 2), () {
            final req4 = _inMemoryStore[requestId];
            if (req4 == null || !req4.status.isActive) return;

            final updated4 = req4.copyWith(
              status: RequestStatus.accepted,
              hospitalDestination: nearestHosp.name,
            );
            _updateAndEmit(updated4);

            _schedule(const Duration(seconds: 2), () {
              final req5 = _inMemoryStore[requestId];
              if (req5 == null || !req5.status.isActive) return;

              final updated5 = req5.copyWith(
                status: RequestStatus.enRouteToPatient,
                hospitalDestination: nearestHosp.name,
              );
              _updateAndEmit(updated5);
              trackingDataSource?.setUnitStatus(requestId, RequestStatus.enRouteToPatient);

              _schedule(const Duration(seconds: 7), () {
                final req6 = _inMemoryStore[requestId];
                if (req6 == null || !req6.status.isActive) return;

                final updated6 = req6.copyWith(
                  status: RequestStatus.arrivedAtPatient,
                  hospitalDestination: nearestHosp.name,
                );
                _updateAndEmit(updated6);
                trackingDataSource?.setUnitStatus(requestId, RequestStatus.arrivedAtPatient);

                _schedule(const Duration(seconds: 3), () {
                  final req7 = _inMemoryStore[requestId];
                  if (req7 == null || !req7.status.isActive) return;

                  final updated7 = req7.copyWith(
                    status: RequestStatus.patientOnboard,
                    hospitalDestination: nearestHosp.name,
                  );
                  _updateAndEmit(updated7);
                  trackingDataSource?.setUnitStatus(requestId, RequestStatus.patientOnboard);

                  _schedule(const Duration(seconds: 2), () {
                    final req8 = _inMemoryStore[requestId];
                    if (req8 == null || !req8.status.isActive) return;

                    final updated8 = req8.copyWith(
                      status: RequestStatus.enRouteToHospital,
                      hospitalDestination: nearestHosp.name,
                    );
                    _updateAndEmit(updated8);
                    trackingDataSource?.navigateToHospital(
                      requestId: requestId,
                      hospitalLatitude: nearestHosp.latitude,
                      hospitalLongitude: nearestHosp.longitude,
                      hospitalName: nearestHosp.name,
                      routeSteps: 10,
                    );

                    _schedule(const Duration(seconds: 7), () {
                      final req9 = _inMemoryStore[requestId];
                      if (req9 == null || !req9.status.isActive) return;

                      final updated9 = req9.copyWith(
                        status: RequestStatus.arrivedAtHospital,
                        hospitalDestination: nearestHosp.name,
                      );
                      _updateAndEmit(updated9);
                      trackingDataSource?.setUnitStatus(requestId, RequestStatus.arrivedAtHospital);
                    });
                  });
                });
              });
            });
          });
        });
      });
    });
  }

  void _runNoAmbulanceScenario(String requestId, Duration baseDelay) {
    _schedule(baseDelay * 1.5, () {
      final req = _inMemoryStore[requestId];
      if (req == null || !req.status.isActive) return;

      final incidentLat = req.emergencyLocation.latitude;
      final incidentLng = req.emergencyLocation.longitude;
      final nearestHosp = NearbyEmergencyService.findNearestHospital(incidentLat, incidentLng);

      final updated = req.copyWith(
        status: RequestStatus.noAmbulanceAvailable,
        hospitalDestination: nearestHosp.name,
        additionalNotes: 'All 40 network ambulances in Chennai currently engaged. Automated cascading fallback exhausted.',
      );
      _updateAndEmit(updated);
      trackingDataSource?.clearUnit(requestId);
    });
  }

  void _schedule(Duration delay, void Function() action) {
    final timer = Timer(delay, action);
    _activeTimers.add(timer);
  }

  void _updateAndEmit(EmergencyRequestModel updated) {
    _inMemoryStore[updated.requestId] = updated;
    if (_streamControllers.containsKey(updated.requestId)) {
      final controller = _streamControllers[updated.requestId]!;
      if (!controller.isClosed) {
        controller.add(updated);
      }
    }

    if (socketService != null) {
      switch (updated.status) {
        case RequestStatus.assigned:
          socketService!.emitSimulatedEvent('AMBULANCE_ASSIGNED', {
            'requestId': updated.requestId,
            'ambulanceId': updated.assignedAmbulanceId,
            'eta': updated.currentETA ?? 5,
          });
          break;
        case RequestStatus.accepted:
          socketService!.emitSimulatedEvent('ASSIGNMENT_ACCEPTED', {
            'requestId': updated.requestId,
            'ambulanceId': updated.assignedAmbulanceId,
          });
          break;
        case RequestStatus.enRouteToPatient:
          socketService!.emitSimulatedEvent('STATUS_UPDATED', {
            'requestId': updated.requestId,
            'status': 'EN_ROUTE_TO_PATIENT',
          });
          break;
        case RequestStatus.arrivedAtPatient:
          socketService!.emitSimulatedEvent('AMBULANCE_ARRIVED', {
            'requestId': updated.requestId,
            'ambulanceId': updated.assignedAmbulanceId,
          });
          break;
        case RequestStatus.patientOnboard:
          socketService!.emitSimulatedEvent('STATUS_UPDATED', {
            'requestId': updated.requestId,
            'status': 'PATIENT_ONBOARD',
          });
          break;
        case RequestStatus.enRouteToHospital:
          socketService!.emitSimulatedEvent('STATUS_UPDATED', {
            'requestId': updated.requestId,
            'status': 'EN_ROUTE_TO_HOSPITAL',
          });
          break;
        case RequestStatus.arrivedAtHospital:
          socketService!.emitSimulatedEvent('STATUS_UPDATED', {
            'requestId': updated.requestId,
            'status': 'ARRIVED_AT_HOSPITAL',
          });
          break;
        case RequestStatus.completed:
          socketService!.emitSimulatedEvent('EMERGENCY_COMPLETED', {
            'requestId': updated.requestId,
          });
          break;
        case RequestStatus.cancelled:
          socketService!.emitSimulatedEvent('STATUS_UPDATED', {
            'requestId': updated.requestId,
            'status': 'CANCELLED',
          });
          break;
        case RequestStatus.noAmbulanceAvailable:
          socketService!.emitSimulatedEvent('STATUS_UPDATED', {
            'requestId': updated.requestId,
            'status': 'NO_AMBULANCE_AVAILABLE',
          });
          break;
        default:
          break;
      }
    }
  }

  void _bindTracking(
    EmergencyRequestModel request, {
    required double startLat,
    required double startLng,
    String? hospitalName,
  }) {
    if (trackingDataSource == null) return;
    trackingDataSource!.assignUnit(
      requestId: request.requestId,
      ambulanceId: request.assignedAmbulanceId ?? 'AMB-01',
      driverName: request.assignedDriverName,
      driverPhone: request.driverPhone,
      startLatitude: startLat,
      startLongitude: startLng,
      destLatitude: request.emergencyLocation.latitude,
      destLongitude: request.emergencyLocation.longitude,
      hospitalName: hospitalName,
      routeSteps: 12,
    );
  }

  void _cancelTimers() {
    for (final timer in _activeTimers) {
      timer.cancel();
    }
    _activeTimers.clear();
  }

  void dispose() {
    _cancelTimers();
    for (final controller in _streamControllers.values) {
      controller.close();
    }
    _streamControllers.clear();
  }
}
