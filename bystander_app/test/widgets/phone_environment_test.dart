import 'dart:async';
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:uyirkappan_bystander/data/datasources/emergency_request_datasource.dart';
import 'package:uyirkappan_bystander/data/datasources/mock/mock_emergency_request_datasource.dart';
import 'package:uyirkappan_bystander/data/models/emergency_request_model.dart';
import 'package:uyirkappan_bystander/data/repositories/emergency_request_repository_impl.dart';
import 'package:uyirkappan_bystander/domain/entities/location_data.dart';
import 'package:uyirkappan_bystander/domain/entities/request_status.dart';
import 'package:uyirkappan_bystander/presentation/controllers/emergency_controller.dart';
import 'package:uyirkappan_bystander/presentation/controllers/location_controller.dart';
import 'package:uyirkappan_bystander/presentation/controllers/simulation_controller.dart';
import 'package:uyirkappan_bystander/presentation/screens/home/home_screen.dart';
import '../unit/mock_repository_test.dart';

class DeterministicPhoneTestDataSource implements EmergencyRequestDataSource {
  EmergencyRequestModel? stored;
  final _controller = StreamController<EmergencyRequestModel>.broadcast();

  @override
  Future<EmergencyRequestModel> createEmergencyRequest(EmergencyRequestModel request) async {
    stored = request.copyWith(requestId: 'UK-PHONE-001');
    return stored!;
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

  void emit(EmergencyRequestModel model) {
    stored = model;
    _controller.add(model);
  }

  void dispose() {
    _controller.close();
  }
}

void main() {
  group('Phone Environment Layout & Overflow Tests', () {
    late DeterministicPhoneTestDataSource fakeDataSource;
    late FakeLocalDataSource fakeLocalDataSource;
    late EmergencyRequestRepositoryImpl repository;
    late EmergencyController emergencyController;
    late LocationController locationController;
    late SimulationController simulationController;

    setUp(() {
      fakeDataSource = DeterministicPhoneTestDataSource();
      fakeLocalDataSource = FakeLocalDataSource();
      repository = EmergencyRequestRepositoryImpl(
        dataSource: fakeDataSource,
        localDataSource: fakeLocalDataSource,
      );
      emergencyController = EmergencyController(repository: repository);
      locationController = LocationController();
      simulationController = SimulationController(mockDataSource: MockEmergencyRequestDataSource());
    });

    tearDown(() {
      fakeDataSource.dispose();
    });

    testWidgets('Idle state renders cleanly on 390x844 phone screen without RenderFlex overflow', (tester) async {
      tester.view.physicalSize = const Size(390, 844);
      tester.view.devicePixelRatio = 1.0;
      addTearDown(tester.view.resetPhysicalSize);
      addTearDown(tester.view.resetDevicePixelRatio);

      await tester.pumpWidget(
        MaterialApp(
          home: HomeScreen(
            emergencyController: emergencyController,
            locationController: locationController,
            simulationController: simulationController,
          ),
        ),
      );

      await tester.pump(const Duration(milliseconds: 300));

      expect(tester.takeException(), isNull);
      expect(find.text('UyirKappan'), findsOneWidget);
      expect(find.text('REQUEST AMBULANCE'), findsOneWidget);
      expect(find.text('Emergency Medical Assistance'), findsOneWidget);
      expect(find.text('Direct Emergency Helpline'), findsOneWidget);
    });

    testWidgets('Active searching / tracking state renders on 360x780 phone screen with zero RenderFlex overflow', (tester) async {
      tester.view.physicalSize = const Size(360, 780);
      tester.view.devicePixelRatio = 1.0;
      addTearDown(tester.view.resetPhysicalSize);
      addTearDown(tester.view.resetDevicePixelRatio);

      await emergencyController.submitEmergencyRequest(
        emergencyLocation: LocationData(
          latitude: 13.0827,
          longitude: 80.2707,
          timestamp: DateTime.now(),
        ),
      );

      fakeDataSource.emit(
        fakeDataSource.stored!.copyWith(
          status: RequestStatus.searching,
        ),
      );

      await tester.pumpWidget(
        MaterialApp(
          home: HomeScreen(
            emergencyController: emergencyController,
            locationController: locationController,
            simulationController: simulationController,
          ),
        ),
      );

      await tester.pump(const Duration(milliseconds: 300));

      expect(tester.takeException(), isNull);
      expect(find.text('CANCEL'), findsOneWidget);
      expect(find.text('DESTINATION HOSPITAL'), findsOneWidget);
    });

    testWidgets('Driver Accepted and En Route state renders on 360x640 compact screen with zero RenderFlex overflow', (tester) async {
      tester.view.physicalSize = const Size(360, 640);
      tester.view.devicePixelRatio = 1.0;
      addTearDown(tester.view.resetPhysicalSize);
      addTearDown(tester.view.resetDevicePixelRatio);

      await emergencyController.submitEmergencyRequest(
        emergencyLocation: LocationData(
          latitude: 13.0827,
          longitude: 80.2707,
          timestamp: DateTime.now(),
        ),
      );

      fakeDataSource.emit(
        fakeDataSource.stored!.copyWith(
          status: RequestStatus.accepted,
          assignedAmbulanceId: 'AMB-CH-023',
          assignedDriverName: 'Suresh Kumar (Paramedic Team)',
          hospitalDestination: 'Vijaya Hospital',
        ),
      );

      await tester.pumpWidget(
        MaterialApp(
          home: HomeScreen(
            emergencyController: emergencyController,
            locationController: locationController,
            simulationController: simulationController,
          ),
        ),
      );

      await tester.pump(const Duration(milliseconds: 300));

      expect(tester.takeException(), isNull);
      expect(find.text('AMB-CH-023'), findsOneWidget);
      expect(find.text('DESTINATION HOSPITAL'), findsOneWidget);
    });
  });
}
