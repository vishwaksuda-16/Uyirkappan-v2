import 'package:flutter_test/flutter_test.dart';
import 'package:uyirkappan_bystander/data/models/emergency_request_model.dart';
import 'package:uyirkappan_bystander/domain/entities/emergency_request.dart';
import 'package:uyirkappan_bystander/domain/entities/emergency_type.dart';
import 'package:uyirkappan_bystander/domain/entities/location_data.dart';
import 'package:uyirkappan_bystander/domain/entities/request_status.dart';

void main() {
  group('EmergencyRequest and EmergencyRequestModel Tests', () {
    final testLocation = LocationData(
      latitude: 13.0827,
      longitude: 80.2707,
      accuracy: 6.5,
      timestamp: DateTime(2026, 9, 1, 10, 0, 0),
      isManualOverride: false,
    );

    final testRequest = EmergencyRequest(
      requestId: 'UK-TEST-001',
      requesterId: 'BYSTANDER-01',
      emergencyType: EmergencyType.cardiacEmergency,
      victimCount: 2,
      emergencyLocation: testLocation,
      createdAt: DateTime(2026, 9, 1, 10, 0, 0),
      status: RequestStatus.searching,
      additionalNotes: 'Patient having chest tightness',
    );

    test('should properly instantiate EmergencyRequest entity', () {
      expect(testRequest.requestId, 'UK-TEST-001');
      expect(testRequest.emergencyType, EmergencyType.cardiacEmergency);
      expect(testRequest.victimCount, 2);
      expect(testRequest.status, RequestStatus.searching);
      expect(testRequest.emergencyLocation.latitude, 13.0827);
    });

    test('should copyWith updated fields correctly', () {
      final updated = testRequest.copyWith(
        status: RequestStatus.assigned,
        assignedAmbulanceId: 'AMB-01',
        assignedDriverName: 'John Doe',
      );

      expect(updated.status, RequestStatus.assigned);
      expect(updated.assignedAmbulanceId, 'AMB-01');
      expect(updated.assignedDriverName, 'John Doe');
      expect(updated.requestId, testRequest.requestId);
      expect(updated.victimCount, testRequest.victimCount);
    });

    test('should serialize and deserialize JSON correctly via EmergencyRequestModel', () {
      final model = EmergencyRequestModel.fromEntity(testRequest);
      final json = model.toJson();

      expect(json['requestId'], 'UK-TEST-001');
      expect(json['emergencyType'], 'CARDIAC');
      expect(json['victimCount'], 2);
      expect(json['latitude'], 13.0827);
      expect(json['longitude'], 80.2707);
      expect(json['status'], 'SEARCHING');

      final deserialized = EmergencyRequestModel.fromJson(json);
      expect(deserialized.requestId, model.requestId);
      expect(deserialized.emergencyType, EmergencyType.cardiacEmergency);
      expect(deserialized.victimCount, 2);
      expect(deserialized.emergencyLocation.latitude, 13.0827);
      expect(deserialized.status, RequestStatus.searching);
    });

    test('preserves patient and hospital routes in request JSON', () {
      final model = EmergencyRequestModel.fromEntity(testRequest).copyWith(
        backendRoute: [
          LocationData(latitude: 13.08, longitude: 80.27, timestamp: DateTime.now()),
          LocationData(latitude: 13.081, longitude: 80.271, timestamp: DateTime.now()),
        ],
        backendHospitalRoute: [
          LocationData(latitude: 13.081, longitude: 80.271, timestamp: DateTime.now()),
          LocationData(latitude: 13.06, longitude: 80.25, timestamp: DateTime.now()),
        ],
      );

      final restored = EmergencyRequestModel.fromJson(model.toJson());
      expect(restored.backendRoute, hasLength(2));
      expect(restored.backendHospitalRoute, hasLength(2));
      expect(restored.backendHospitalRoute!.last.latitude, 13.06);
    });

    test('should produce valid toSubmissionJson payload for POST /api/emergency-requests', () {
      final model = EmergencyRequestModel.fromEntity(testRequest);
      final submissionJson = model.toSubmissionJson();

      expect(submissionJson.containsKey('requestId'), isFalse);
      expect(submissionJson['emergencyType'], 'CARDIAC');
      expect(submissionJson['victimCount'], 2);
      expect(submissionJson['latitude'], 13.0827);
      expect(submissionJson['longitude'], 80.2707);
      expect(submissionJson['additionalNotes'], 'Patient having chest tightness');
    });

    test('submits the manually pinned coordinates without replacing them with device defaults', () {
      final request = testRequest.copyWith(
        emergencyLocation: LocationData(
          latitude: 13.0418,
          longitude: 80.2341,
          timestamp: DateTime.now(),
          isManualOverride: true,
        ),
      );
      final submission = EmergencyRequestModel.fromEntity(request).toSubmissionJson();
      final pickup = submission['pickupLocation'] as Map<String, dynamic>;

      expect(pickup['latitude'], 13.0418);
      expect(pickup['longitude'], 80.2341);
      expect(submission['latitude'], 13.0418);
      expect(submission['longitude'], 80.2341);
      expect(submission['isManualOverride'], isTrue);
    });

    test('reads the backend-confirmed pickup pin instead of retaining device GPS', () {
      final response = EmergencyRequestModel.fromJson({
        ...EmergencyRequestModel.fromEntity(testRequest).toJson(),
        'pickupLocation': {
          'latitude': 13.0418,
          'longitude': 80.2341,
          'isManualOverride': true,
        },
      });

      expect(response.emergencyLocation.latitude, 13.0418);
      expect(response.emergencyLocation.longitude, 80.2341);
      expect(response.emergencyLocation.isManualOverride, isTrue);
    });

    test('should calculate response-time metrics accurately', () {
      final t0 = DateTime(2026, 9, 1, 10, 0, 0);
      final t3 = DateTime(2026, 9, 1, 10, 0, 15);
      final t4 = DateTime(2026, 9, 1, 10, 0, 25);
      final t5 = DateTime(2026, 9, 1, 10, 0, 30);
      final t6 = DateTime(2026, 9, 1, 10, 8, 30);

      final reqWithMetrics = testRequest.copyWith(
        t0UserPressed: t0,
        t3AssignmentSent: t3,
        t4DriverAccepted: t4,
        t5AmbulanceStarted: t5,
        t6AmbulanceArrived: t6,
      );

      expect(reqWithMetrics.dispatchLatency, const Duration(seconds: 15));
      expect(reqWithMetrics.driverResponseTime, const Duration(seconds: 10));
      expect(reqWithMetrics.travelTime, const Duration(minutes: 8));
      expect(reqWithMetrics.totalResponseTime, const Duration(minutes: 8, seconds: 30));
    });
  });
}
