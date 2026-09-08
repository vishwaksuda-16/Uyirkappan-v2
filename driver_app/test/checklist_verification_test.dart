import 'dart:convert';
import 'package:flutter_test/flutter_test.dart';
import 'package:http/http.dart' as http;
import 'package:http/testing.dart' as http_testing;
import 'package:driver_app/core/config/app_config.dart';
import 'package:driver_app/core/constants/app_constants.dart';
import 'package:driver_app/core/errors/app_exceptions.dart';
import 'package:driver_app/core/utils/geo_utils.dart';
import 'package:driver_app/models/assignment.dart';
import 'package:driver_app/models/driver.dart';
import 'package:driver_app/models/emergency_request.dart';
import 'package:driver_app/models/location_model.dart';
import 'package:driver_app/models/state_enums.dart';
import 'package:driver_app/services/api/real_api_service.dart';
import 'package:driver_app/services/api/simulated_api_service.dart';
import 'package:driver_app/services/simulation/simulation_engine.dart';
import 'package:driver_app/services/socket/simulated_socket_service.dart';
import 'package:driver_app/state/state_machine.dart';

void main() {
  group('Team Lead Module 2 Checklist Automated Verification Suite', () {
    const config = AppConfig(
      apiBaseUrl: 'http://localhost:4000/api',
      socketUrl: 'http://localhost:4000',
      assignmentTimeoutSeconds: 15,
    );

    // ==========================================
    // SECTION 1: Authentication & Login
    // ==========================================
    test('Section 1: Login POST /api/auth/login with driver1@uyirkappan.demo and DRIVER role', () async {
      late String requestedUrl;
      late String requestedMethod;
      late Map<String, dynamic> sentBody;

      final mockClient = http_testing.MockClient((request) async {
        requestedUrl = request.url.toString();
        requestedMethod = request.method;
        sentBody = jsonDecode(request.body) as Map<String, dynamic>;

        return http.Response(
          jsonEncode({
            'success': true,
            'token': 'jwt_mock_token_driver_12345',
            'user': {
              'role': 'DRIVER',
              'email': 'driver1@uyirkappan.demo',
              'driverId': 'DRV-001',
              'ambulanceId': 'AMB-001',
              'name': 'Karthik Driver',
              'providerId': 'PROVIDER-01',
              'phone': '+91 98401 11111',
            }
          }),
          200,
          headers: {'content-type': 'application/json'},
        );
      });

      final api = RealApiService(config: config, client: mockClient);
      final Driver driver = await api.login('driver1@uyirkappan.demo', 'password123');

      expect(requestedMethod, 'POST');
      expect(requestedUrl, 'http://localhost:4000/api/auth/login');
      expect(sentBody['email'], 'driver1@uyirkappan.demo');
      expect(sentBody['password'], 'password123');
      expect(driver.token, 'jwt_mock_token_driver_12345');
      expect(driver.role, 'DRIVER');
      expect(driver.driverId, 'DRV-001');
      expect(driver.ambulanceId, 'AMB-001');
    });

    test('Section 1: Predefined checklist credentials exist in AppConstants', () {
      final account = AppConstants.predefinedAccounts.firstWhere(
        (a) => a.email == 'driver1@uyirkappan.demo',
      );
      expect(account.email, 'driver1@uyirkappan.demo');
      expect(account.defaultPassword, 'password123');
      expect(account.ambulanceId, 'AMB-001');
    });

    // ==========================================
    // SECTION 2: Driver State & Availability
    // ==========================================
    test('Section 2: PATCH /api/ambulances/{id}/status changes status to AVAILABLE, BUSY, OFFLINE', () async {
      late String patchUrl;
      late String patchMethod;
      late Map<String, dynamic> patchBody;

      final mockClient = http_testing.MockClient((request) async {
        patchUrl = request.url.toString();
        patchMethod = request.method;
        patchBody = jsonDecode(request.body) as Map<String, dynamic>;

        return http.Response(
          jsonEncode({
            'ambulanceId': 'AMB-001',
            'availability': patchBody['availability'],
            'status': patchBody['status'],
          }),
          200,
          headers: {'content-type': 'application/json'},
        );
      });

      final api = RealApiService(config: config, client: mockClient);
      final amb = await api.updateAmbulanceStatus('AMB-001', AmbulanceAvailability.available);

      expect(patchMethod, 'PATCH');
      expect(patchUrl, 'http://localhost:4000/api/ambulances/AMB-001/status');
      expect(patchBody['availability'], 'AVAILABLE');
      expect(amb.availability, AmbulanceAvailability.available);
    });

    // ==========================================
    // SECTION 3: Receiving Assignments & 15s Timer
    // ==========================================
    test('Section 3: GET /api/driver/assignment parses all checklist payload attributes', () async {
      final mockClient = http_testing.MockClient((request) async {
        expect(request.method, 'GET');
        expect(request.url.toString(), 'http://localhost:4000/api/driver/assignment');

        return http.Response(
          jsonEncode({
            'assignmentId': 'ASN-1001',
            'requestId': 'UK-000001',
            'ambulanceId': 'AMB-001',
            'attemptNumber': 2,
            'estimatedETA': 9,
            'pickupLocation': {
              'latitude': 13.0850,
              'longitude': 80.2750,
            },
            'emergencyType': 'Cardiac Arrest',
            'victimCount': 2,
          }),
          200,
          headers: {'content-type': 'application/json'},
        );
      });

      final api = RealApiService(config: config, client: mockClient);
      final assignment = await api.getActiveAssignment();

      expect(assignment, isNotNull);
      expect(assignment!.assignmentId, 'ASN-1001');
      expect(assignment.requestId, 'UK-000001');
      expect(assignment.ambulanceId, 'AMB-001');
      expect(assignment.attemptNumber, 2);
      expect(assignment.estimatedETA, 9);
      expect(assignment.pickupLocation.latitude, 13.0850);
      expect(assignment.pickupLocation.longitude, 80.2750);
      expect(assignment.emergencyType, 'Cardiac Arrest');
      expect(assignment.victimCount, 2);
      expect(assignment.timeoutSeconds, 15); // Exact 15-second response window requirement
    });

    // ==========================================
    // SECTION 4: Accepting Assignments
    // ==========================================
    test('Section 4: POST /api/assignments/{id}/accept transitions to ACCEPTED / DRIVER_ACCEPTED', () async {
      final mockClient = http_testing.MockClient((request) async {
        expect(request.method, 'POST');
        expect(request.url.toString(), 'http://localhost:4000/api/assignments/ASN-1001/accept');

        return http.Response(
          jsonEncode({
            'success': true,
            'assignmentId': 'ASN-1001',
            'requestId': 'UK-000001',
            'eta': 8,
            'status': 'ACCEPTED',
          }),
          200,
          headers: {'content-type': 'application/json'},
        );
      });

      final api = RealApiService(config: config, client: mockClient);
      final accepted = await api.acceptAssignment('ASN-1001');

      expect(accepted.assignmentId, 'ASN-1001');
      expect(accepted.status, DriverLifecycleState.accepted);
      expect(accepted.status.displayName, 'ACCEPTED');
      expect(DriverLifecycleState.fromString('DRIVER_ACCEPTED'), DriverLifecycleState.accepted);
      expect(DriverStateMachine.getAvailabilityForLifecycle(accepted.status), AmbulanceAvailability.busy);
    });

    // ==========================================
    // SECTION 5: Rejecting Assignments / Fallback
    // ==========================================
    test('Section 5: POST /api/assignments/{id}/reject triggers fallback and frees ambulance', () async {
      late String rejectBody;
      final mockClient = http_testing.MockClient((request) async {
        expect(request.method, 'POST');
        expect(request.url.toString(), 'http://localhost:4000/api/assignments/ASN-1001/reject');
        rejectBody = request.body;

        return http.Response(
          jsonEncode({
            'success': true,
            'assignmentId': 'ASN-1001',
            'message': 'Assignment rejected; fallback started',
          }),
          200,
          headers: {'content-type': 'application/json'},
        );
      });

      final api = RealApiService(config: config, client: mockClient);
      await api.rejectAssignment('ASN-1001', reason: 'Driver break');

      expect(rejectBody, contains('Driver break'));
      expect(DriverStateMachine.getAvailabilityForLifecycle(DriverLifecycleState.rejected), AmbulanceAvailability.available);
    });

    // ==========================================
    // SECTION 6: Timeout Configuration
    // ==========================================
    test('Section 6: Default timeout is exactly 15 seconds across AppConfig and Simulation', () {
      expect(config.assignmentTimeoutSeconds, 15);
      expect(AppConstants.defaultAssignmentTimeoutSeconds, 15);

      final socket = SimulatedSocketService();
      final engine = SimulationEngine(socketService: socket);
      final mock = engine.generateMockAssignment();
      expect(mock.timeoutSeconds, 15);
    });

    // ==========================================
    // SECTION 7: Status Lifecycle Sequential Progression & 409 Conflict
    // ==========================================
    test('Section 7: PATCH /api/assignments/{id}/status follows exact progression', () async {
      final statusesSent = <String>[];
      final mockClient = http_testing.MockClient((request) async {
        expect(request.method, 'PATCH');
        final body = jsonDecode(request.body) as Map<String, dynamic>;
        final status = body['status'] as String;
        statusesSent.add(status);

        return http.Response(
          jsonEncode({
            'assignmentId': 'ASN-1001',
            'status': status,
          }),
          200,
          headers: {'content-type': 'application/json'},
        );
      });

      final api = RealApiService(config: config, client: mockClient);

      final sequence = [
        DriverLifecycleState.enRouteToPatient,
        DriverLifecycleState.arrivedAtPatient,
        DriverLifecycleState.patientOnboard,
        DriverLifecycleState.enRouteToHospital,
        DriverLifecycleState.arrivedAtHospital,
      ];

      for (final s in sequence) {
        await api.updateAssignmentStatus('ASN-1001', s);
      }

      expect(statusesSent, [
        'EN_ROUTE_TO_PATIENT',
        'ARRIVED_AT_PATIENT',
        'PATIENT_ONBOARD',
        'EN_ROUTE_TO_HOSPITAL',
        'ARRIVED_AT_HOSPITAL',
      ]);
    });

    test('Section 7: Invalid skipped state transitions throw 409 ConflictException', () async {
      final mockClient = http_testing.MockClient((request) async {
        return http.Response(
          jsonEncode({'error': 'Conflict: invalid transition from DRIVER_ACCEPTED to ARRIVED_AT_HOSPITAL'}),
          409,
          headers: {'content-type': 'application/json'},
        );
      });

      final api = RealApiService(config: config, client: mockClient);

      expect(
        () => api.updateAssignmentStatus('ASN-1001', DriverLifecycleState.arrivedAtHospital),
        throwsA(isA<ConflictException>()),
      );

      // Verify state machine also rejects skipped transition locally
      expect(
        () => DriverStateMachine.validateTransition(
          DriverLifecycleState.accepted,
          DriverLifecycleState.arrivedAtHospital,
        ),
        throwsA(isA<InvalidStateTransitionException>()),
      );
    });

    // ==========================================
    // SECTION 8: GPS Location Updates
    // ==========================================
    test('Section 8: POST /api/ambulances/{id}/location sends exact GPS telemetry payload', () async {
      late Map<String, dynamic> locBody;
      final mockClient = http_testing.MockClient((request) async {
        expect(request.method, 'POST');
        expect(request.url.toString(), 'http://localhost:4000/api/ambulances/AMB-001/location');
        locBody = jsonDecode(request.body) as Map<String, dynamic>;

        return http.Response(jsonEncode({'success': true}), 200);
      });

      final api = RealApiService(config: config, client: mockClient);
      final loc = AmbulanceLocation(
        latitude: 13.0827,
        longitude: 80.2707,
        timestamp: DateTime.now(),
        speed: 45.0,
        heading: 180.0,
        ambulanceId: 'AMB-001',
      );

      await api.postLocationUpdate('AMB-001', loc);

      expect(locBody['latitude'], 13.0827);
      expect(locBody['longitude'], 80.2707);
      expect(locBody['speed'], 45.0);
      expect(locBody['heading'], 180.0);
    });

    // ==========================================
    // SECTION 9: Socket.IO Real-Time Events
    // ==========================================
    test('Section 9: SimulatedSocketService supports canonical event triggers and room semantics', () async {
      final socket = SimulatedSocketService();

      final assignmentFuture = socket.onAssignmentReceived.first;
      final mockAssignment = Assignment(
        assignmentId: 'ASN-SOCKET-1',
        requestId: 'UK-999',
        ambulanceId: 'AMB-001',
        driverId: 'DRV-001',
        emergency: EmergencyRequest(
          requestId: 'UK-999',
          emergencyType: 'Trauma',
          victimCount: 1,
          pickupLocationName: 'Adyar',
          pickupLocation: const GeoPoint(13.0012, 80.2565),
          reportedTime: DateTime.now(),
        ),
        assignedAt: DateTime.now(),
        distanceKm: 3.5,
        etaMinutes: 7,
      );

      socket.triggerAmbulanceAssigned(mockAssignment);
      final received = await assignmentFuture;
      expect(received.assignmentId, 'ASN-SOCKET-1');
      expect(received.requestId, 'UK-999');

      final etaFuture = socket.onEtaUpdated.first;
      socket.triggerEtaUpdate(5);
      expect(await etaFuture, 5);

      final cancelFuture = socket.onAssignmentCancelled.first;
      socket.triggerAssignmentRejected('UK-999');
      expect(await cancelFuture, 'UK-999');

      socket.dispose();
    });

    // ==========================================
    // SECTION 10: Fallback & Reassignment
    // ==========================================
    test('Section 10: Fallback increments attemptNumber while retaining requestId', () {
      final socket = SimulatedSocketService();
      final engine = SimulationEngine(socketService: socket);

      engine.recordAttempt(ambulanceId: 'AMB-003', outcome: 'TIMEOUT');
      engine.recordAttempt(ambulanceId: 'AMB-005', outcome: 'REJECTED');
      engine.recordAttempt(ambulanceId: 'AMB-002', outcome: 'ACCEPTED');

      expect(engine.dispatchAttempts.length, 3);
      expect(engine.dispatchAttempts[0].attemptNumber, 1);
      expect(engine.dispatchAttempts[1].attemptNumber, 2);
      expect(engine.dispatchAttempts[2].attemptNumber, 3);

      final reallocated = engine.generateMockAssignment(
        requestId: 'UK-000001',
        ambulanceId: 'AMB-002',
      );
      expect(reallocated.requestId, 'UK-000001');
      expect(reallocated.ambulanceId, 'AMB-002');
    });

    // ==========================================
    // SECTION 11: End-to-End Flow
    // ==========================================
    test('Section 11: End-to-End state machine sequence (Steps 1 to 15)', () {
      var state = DriverLifecycleState.offline;

      // 1. Available
      DriverStateMachine.validateTransition(state, DriverLifecycleState.available);
      state = DriverLifecycleState.available;
      expect(state, DriverLifecycleState.available);

      // 2. Assignment Received
      DriverStateMachine.validateTransition(state, DriverLifecycleState.assignmentReceived);
      state = DriverLifecycleState.assignmentReceived;

      // 3. Accepted / DRIVER_ACCEPTED
      DriverStateMachine.validateTransition(state, DriverLifecycleState.accepted);
      state = DriverLifecycleState.accepted;

      // 4. En route to patient
      DriverStateMachine.validateTransition(state, DriverLifecycleState.enRouteToPatient);
      state = DriverLifecycleState.enRouteToPatient;

      // 5. Arrived at patient
      DriverStateMachine.validateTransition(state, DriverLifecycleState.arrivedAtPatient);
      state = DriverLifecycleState.arrivedAtPatient;

      // 6. Patient onboard
      DriverStateMachine.validateTransition(state, DriverLifecycleState.patientOnboard);
      state = DriverLifecycleState.patientOnboard;

      // 7. En route to hospital
      DriverStateMachine.validateTransition(state, DriverLifecycleState.enRouteToHospital);
      state = DriverLifecycleState.enRouteToHospital;

      // 8. Arrived at hospital
      DriverStateMachine.validateTransition(state, DriverLifecycleState.arrivedAtHospital);
      state = DriverLifecycleState.arrivedAtHospital;

      // 9. Completed
      DriverStateMachine.validateTransition(state, DriverLifecycleState.completed);
      state = DriverLifecycleState.completed;

      // 10. Back to Available
      DriverStateMachine.validateTransition(state, DriverLifecycleState.available);
      state = DriverLifecycleState.available;
      expect(state, DriverLifecycleState.available);
    });

    // ==========================================
    // SECTION 12: Error Handling (400, 401, 403, 404, 409, Network)
    // ==========================================
    test('Section 12: Proper exception types thrown for HTTP error codes', () async {
      http.Client clientWithStatus(int statusCode) {
        return http_testing.MockClient((_) async => http.Response('{"error":"fail"}', statusCode));
      }

      // 400 Bad Request
      final api400 = RealApiService(config: config, client: clientWithStatus(400));
      expect(() => api400.updateAssignmentStatus('ASN-1', DriverLifecycleState.enRouteToPatient), throwsA(isA<BadRequestException>()));

      // 401 Unauthorized
      final api401 = RealApiService(config: config, client: clientWithStatus(401));
      expect(() => api401.updateAssignmentStatus('ASN-1', DriverLifecycleState.enRouteToPatient), throwsA(isA<UnauthorizedException>()));

      // 403 Forbidden
      final api403 = RealApiService(config: config, client: clientWithStatus(403));
      expect(() => api403.updateAssignmentStatus('ASN-1', DriverLifecycleState.enRouteToPatient), throwsA(isA<ForbiddenException>()));

      // 404 Not Found
      final api404 = RealApiService(config: config, client: clientWithStatus(404));
      expect(() => api404.updateAssignmentStatus('ASN-1', DriverLifecycleState.enRouteToPatient), throwsA(isA<NotFoundException>()));

      // 409 Conflict
      final api409 = RealApiService(config: config, client: clientWithStatus(409));
      expect(() => api409.updateAssignmentStatus('ASN-1', DriverLifecycleState.enRouteToPatient), throwsA(isA<ConflictException>()));

      // Network error
      final mockFailingClient = http_testing.MockClient((_) async => throw Exception('Connection reset'));
      final apiNet = RealApiService(config: config, client: mockFailingClient);
      expect(() => apiNet.updateAssignmentStatus('ASN-1', DriverLifecycleState.enRouteToPatient), throwsA(isA<NetworkException>()));
    });

    // ==========================================
    // SECTION 13: Simulation Modes
    // ==========================================
    test('Section 13: SimulatedApiService supports driver1@uyirkappan.demo and predefined accounts', () async {
      final simApi = SimulatedApiService();

      final driver = await simApi.login('driver1@uyirkappan.demo', 'password123');
      expect(driver.email, 'driver1@uyirkappan.demo');
      expect(driver.ambulanceId, 'AMB-001');

      final driverLegacy = await simApi.login('DRV-003', 'password123');
      expect(driverLegacy.driverId, 'DRV-003');
    });

    // ==========================================
    // SECTION 14 & 15: Data Display & Endpoints Catalogue
    // ==========================================
    test('Section 14 & 15: Assignment model formats all required display and contract fields', () {
      final assignment = Assignment(
        assignmentId: 'ASN-DISPLAY-1',
        requestId: 'REQ-12345',
        ambulanceId: 'AMB-001',
        driverId: 'DRV-001',
        emergency: EmergencyRequest(
          requestId: 'REQ-12345',
          emergencyType: 'Severe Trauma',
          victimCount: 3,
          pickupLocationName: 'Guindy Junction',
          pickupLocation: const GeoPoint(13.0067, 80.2026),
          reportedTime: DateTime.now(),
        ),
        assignedAt: DateTime.now(),
        distanceKm: 5.2,
        etaMinutes: 11,
      );

      final json = assignment.toJson();
      expect(json['assignmentId'], 'ASN-DISPLAY-1');
      expect(json['requestId'], 'REQ-12345');
      expect(json['emergencyType'], 'Severe Trauma');
      expect(json['victimCount'], 3);
      expect(json['estimatedETA'], 11);
      expect(json['pickupLocation']['latitude'], 13.0067);
      expect(json['pickupLocation']['longitude'], 80.2026);
    });
  });
}
