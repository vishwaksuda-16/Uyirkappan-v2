import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:uyirkappan_bystander/data/datasources/mock/mock_emergency_request_datasource.dart';
import 'package:uyirkappan_bystander/data/repositories/emergency_request_repository_impl.dart';
import 'package:uyirkappan_bystander/presentation/controllers/emergency_controller.dart';
import 'package:uyirkappan_bystander/presentation/controllers/location_controller.dart';
import 'package:uyirkappan_bystander/presentation/controllers/simulation_controller.dart';
import 'package:uyirkappan_bystander/presentation/screens/home/home_screen.dart';
import '../unit/mock_repository_test.dart';

void main() {
  group('HomeScreen Widget Tests', () {
    testWidgets('should render branding, emergency button, and location card', (tester) async {
      final mockDataSource = MockEmergencyRequestDataSource();
      final fakeLocalDataSource = FakeLocalDataSource();
      final repository = EmergencyRequestRepositoryImpl(
        dataSource: mockDataSource,
        localDataSource: fakeLocalDataSource,
      );

      final emergencyController = EmergencyController(repository: repository);
      final locationController = LocationController();
      final simulationController = SimulationController(mockDataSource: mockDataSource);

      await tester.pumpWidget(
        MaterialApp(
          home: HomeScreen(
            emergencyController: emergencyController,
            locationController: locationController,
            simulationController: simulationController,
          ),
        ),
      );

      await tester.pump();

      expect(find.text('UyirKappan'), findsOneWidget);
      expect(find.text('REQUEST AMBULANCE'), findsOneWidget);
      expect(find.text('Emergency Medical Assistance'), findsOneWidget);
      expect(find.text('Direct Emergency Helpline'), findsOneWidget);
    });

    testWidgets('map pin taps update the pickup coordinates shown on the screen', (tester) async {
      final mockDataSource = MockEmergencyRequestDataSource();
      final repository = EmergencyRequestRepositoryImpl(
        dataSource: mockDataSource,
        localDataSource: FakeLocalDataSource(),
      );
      final emergencyController = EmergencyController(repository: repository);
      final locationController = LocationController();
      locationController.setManualEmergencyLocation(
        latitude: 13.0448,
        longitude: 80.2234,
      );

      await tester.pumpWidget(
        MaterialApp(
          home: HomeScreen(
            emergencyController: emergencyController,
            locationController: locationController,
            simulationController: SimulationController(mockDataSource: mockDataSource),
          ),
        ),
      );
      await tester.pump();

      expect(find.text('13.04480° N, 80.22340° E'), findsOneWidget);
      await tester.tapAt(const Offset(400, 200));
      await tester.pump(const Duration(milliseconds: 200));

      expect(locationController.isManualOverride, isTrue);
      expect(locationController.emergencyLocation!.latitude, isNot(13.0448));
      expect(find.text('13.04480° N, 80.22340° E'), findsNothing);
    });
  });
}
