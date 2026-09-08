import 'package:flutter_test/flutter_test.dart';
import 'package:uyirkappan_bystander/data/datasources/mock/mock_emergency_request_datasource.dart';
import 'package:uyirkappan_bystander/data/repositories/emergency_request_repository_impl.dart';
import 'package:uyirkappan_bystander/domain/entities/emergency_type.dart';
import 'package:uyirkappan_bystander/domain/entities/location_data.dart';
import 'package:uyirkappan_bystander/domain/entities/request_status.dart';
import 'package:uyirkappan_bystander/presentation/controllers/emergency_controller.dart';
import '../unit/mock_repository_test.dart';

void main() {
  group('EmergencyController Tests', () {
    late MockEmergencyRequestDataSource mockDataSource;
    late FakeLocalDataSource fakeLocalDataSource;
    late EmergencyRequestRepositoryImpl repository;
    late EmergencyController controller;

    setUp(() {
      mockDataSource = MockEmergencyRequestDataSource();
      fakeLocalDataSource = FakeLocalDataSource();
      repository = EmergencyRequestRepositoryImpl(
        dataSource: mockDataSource,
        localDataSource: fakeLocalDataSource,
      );
      controller = EmergencyController(repository: repository);
    });

    tearDown(() {
      controller.dispose();
      mockDataSource.dispose();
    });

    final testLocation = LocationData(
      latitude: 13.0827,
      longitude: 80.2707,
      accuracy: 5.0,
      timestamp: DateTime.now(),
    );

    test('should initialize with default state', () {
      expect(controller.victimCount, 1);
      expect(controller.selectedType, EmergencyType.accident);
      expect(controller.submissionState, SubmissionState.idle);
      expect(controller.hasActiveRequest, isFalse);
    });

    test('should increment and decrement victim count within valid bounds', () {
      controller.incrementVictimCount();
      expect(controller.victimCount, 2);

      controller.incrementVictimCount();
      expect(controller.victimCount, 3);

      controller.decrementVictimCount();
      expect(controller.victimCount, 2);

      // Decrement to minimum
      controller.decrementVictimCount();
      expect(controller.victimCount, 1);

      // Should not go below minimum
      controller.decrementVictimCount();
      expect(controller.victimCount, 1);
    });

    test('should update selected emergency type', () {
      controller.setEmergencyType(EmergencyType.cardiacEmergency);
      expect(controller.selectedType, EmergencyType.cardiacEmergency);

      controller.setEmergencyType(EmergencyType.trauma);
      expect(controller.selectedType, EmergencyType.trauma);
    });

    test('should submit emergency request successfully and update active state', () async {
      controller.setEmergencyType(EmergencyType.breathingEmergency);
      controller.setVictimCount(2);
      controller.setAdditionalNotes('Asthma attack, inhaler unavailable');

      final success = await controller.submitEmergencyRequest(
        emergencyLocation: testLocation,
      );

      expect(success, isTrue);
      expect(controller.submissionState, SubmissionState.active);
      expect(controller.activeRequest, isNotNull);
      expect(controller.activeRequest!.emergencyType, EmergencyType.breathingEmergency);
      expect(controller.activeRequest!.victimCount, 2);
      expect(controller.activeRequest!.status, RequestStatus.searching);
      expect(controller.hasActiveRequest, isTrue);
    });

    test('should cancel active emergency request', () async {
      await controller.submitEmergencyRequest(emergencyLocation: testLocation);
      expect(controller.hasActiveRequest, isTrue);

      final cancelSuccess = await controller.cancelActiveRequest(reason: 'Patient stabilized');
      expect(cancelSuccess, isTrue);
      expect(controller.submissionState, SubmissionState.cancelled);
      expect(controller.activeRequest!.status, RequestStatus.cancelled);
    });

    test('should reset form state cleanly', () async {
      await controller.submitEmergencyRequest(emergencyLocation: testLocation);
      controller.resetForm();

      expect(controller.submissionState, SubmissionState.idle);
      expect(controller.activeRequest, isNull);
      expect(controller.victimCount, 1);
      expect(controller.selectedType, EmergencyType.accident);
    });
  });
}
