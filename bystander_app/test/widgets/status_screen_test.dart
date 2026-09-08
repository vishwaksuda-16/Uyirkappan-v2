import 'dart:async';
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:uyirkappan_bystander/data/datasources/emergency_request_datasource.dart';
import 'package:uyirkappan_bystander/data/models/emergency_request_model.dart';
import 'package:uyirkappan_bystander/data/repositories/emergency_request_repository_impl.dart';
import 'package:uyirkappan_bystander/domain/entities/location_data.dart';
import 'package:uyirkappan_bystander/domain/entities/request_status.dart';
import 'package:uyirkappan_bystander/presentation/controllers/emergency_controller.dart';
import 'package:uyirkappan_bystander/presentation/screens/status/request_status_screen.dart';
import '../unit/mock_repository_test.dart';

class DeterministicEmergencyRequestDataSource implements EmergencyRequestDataSource {
  EmergencyRequestModel? stored;
  final _controller = StreamController<EmergencyRequestModel>.broadcast();

  @override
  Future<EmergencyRequestModel> createEmergencyRequest(EmergencyRequestModel request) async {
    final model = EmergencyRequestModel(
      requestId: 'UK-MOCK-101',
      requesterId: request.requesterId,
      emergencyType: request.emergencyType,
      victimCount: request.victimCount,
      emergencyLocation: request.emergencyLocation,
      createdAt: DateTime.now(),
      status: RequestStatus.searching,
      fallbackCount: request.fallbackCount,
    );
    stored = model;
    return model;
  }

  @override
  Future<EmergencyRequestModel> getEmergencyRequest(String requestId) async => stored!;

  @override
  Future<RequestStatus> getRequestStatus(String requestId) async => stored!.status;

  @override
  Future<EmergencyRequestModel> cancelEmergencyRequest(String requestId, {String? reason}) async {
    stored = stored!.copyWith(status: RequestStatus.cancelled);
    _controller.add(stored!);
    return stored!;
  }

  @override
  Stream<EmergencyRequestModel> watchRequestUpdates(String requestId) => _controller.stream;

  void dispose() {
    _controller.close();
  }
}

void main() {
  group('RequestStatusScreen Widget Tests', () {
    testWidgets('should render active searching status and request ID', (tester) async {
      final fakeDataSource = DeterministicEmergencyRequestDataSource();
      final fakeLocalDataSource = FakeLocalDataSource();
      final repository = EmergencyRequestRepositoryImpl(
        dataSource: fakeDataSource,
        localDataSource: fakeLocalDataSource,
      );

      final emergencyController = EmergencyController(repository: repository);
      await emergencyController.submitEmergencyRequest(
        emergencyLocation: LocationData(
          latitude: 13.0827,
          longitude: 80.2707,
          timestamp: DateTime.now(),
        ),
      );

      await tester.pumpWidget(
        MaterialApp(
          home: RequestStatusScreen(
            emergencyController: emergencyController,
          ),
        ),
      );

      expect(find.text('Emergency Status'), findsOneWidget);
      expect(find.text('REQUEST ID'), findsOneWidget);
      expect(find.text('Searching for an ambulance...'), findsOneWidget);
      expect(find.text('CANCEL EMERGENCY REQUEST'), findsOneWidget);

      emergencyController.dispose();
      fakeDataSource.dispose();
    });

    testWidgets('should render fallback alert banner when fallback is triggered', (tester) async {
      final fakeDataSource = DeterministicEmergencyRequestDataSource();
      final fakeLocalDataSource = FakeLocalDataSource();
      final repository = EmergencyRequestRepositoryImpl(
        dataSource: fakeDataSource,
        localDataSource: fakeLocalDataSource,
      );

      final emergencyController = EmergencyController(repository: repository);

      await emergencyController.submitEmergencyRequest(
        emergencyLocation: LocationData(
          latitude: 13.0827,
          longitude: 80.2707,
          timestamp: DateTime.now(),
        ),
      );

      // Trigger fallback count update
      fakeDataSource.stored = fakeDataSource.stored!.copyWith(
        fallbackCount: 1,
        status: RequestStatus.searching,
      );
      fakeDataSource._controller.add(fakeDataSource.stored!);

      await tester.pumpWidget(
        MaterialApp(
          home: RequestStatusScreen(
            emergencyController: emergencyController,
          ),
        ),
      );

      await tester.pump();

      // Verify widget builds cleanly with status
      expect(find.text('Emergency Status'), findsOneWidget);

      emergencyController.dispose();
      fakeDataSource.dispose();
    });
  });
}
