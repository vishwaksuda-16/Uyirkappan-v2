import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:uyirkappan_bystander/data/datasources/mock/mock_emergency_request_datasource.dart';
import 'package:uyirkappan_bystander/data/repositories/emergency_request_repository_impl.dart';
import 'package:uyirkappan_bystander/domain/entities/emergency_type.dart';
import 'package:uyirkappan_bystander/presentation/controllers/emergency_controller.dart';
import 'package:uyirkappan_bystander/presentation/controllers/location_controller.dart';
import 'package:uyirkappan_bystander/presentation/screens/review/review_request_screen.dart';
import '../unit/mock_repository_test.dart';

void main() {
  group('ReviewRequestScreen Widget Tests', () {
    testWidgets('should display verified emergency type, victims, and location summary', (tester) async {
      final mockDataSource = MockEmergencyRequestDataSource();
      final fakeLocalDataSource = FakeLocalDataSource();
      final repository = EmergencyRequestRepositoryImpl(
        dataSource: mockDataSource,
        localDataSource: fakeLocalDataSource,
      );

      final emergencyController = EmergencyController(repository: repository);
      emergencyController.setEmergencyType(EmergencyType.cardiacEmergency);
      emergencyController.setVictimCount(3);
      emergencyController.setAdditionalNotes('Elderly patient collapsed');

      final locationController = LocationController();

      await tester.pumpWidget(
        MaterialApp(
          home: ReviewRequestScreen(
            emergencyController: emergencyController,
            locationController: locationController,
          ),
        ),
      );

      expect(find.text('Review Emergency Request'), findsOneWidget);
      expect(find.text('Cardiac Emergency'), findsOneWidget);
      expect(find.text('3 People requiring assistance'), findsOneWidget);
      expect(find.text('Elderly patient collapsed'), findsOneWidget);
      expect(find.text('CONFIRM & DISPATCH AMBULANCE'), findsOneWidget);
      expect(find.text('EDIT INCIDENT DETAILS'), findsOneWidget);
    });
  });
}
