import 'package:flutter_test/flutter_test.dart';
import 'package:uyirkappan_bystander/core/utils/status_helper.dart';
import 'package:uyirkappan_bystander/domain/entities/request_status.dart';

void main() {
  group('RequestStatus and StatusHelper Tests', () {
    test('should properly map status from string codes', () {
      expect(RequestStatus.fromCode('CREATED'), RequestStatus.created);
      expect(RequestStatus.fromCode('SEARCHING'), RequestStatus.searching);
      expect(RequestStatus.fromCode('ASSIGNED'), RequestStatus.assigned);
      expect(RequestStatus.fromCode('ACCEPTED'), RequestStatus.accepted);
      expect(RequestStatus.fromCode('EN_ROUTE_TO_PATIENT'), RequestStatus.enRouteToPatient);
      expect(RequestStatus.fromCode('ARRIVED_AT_PATIENT'), RequestStatus.arrivedAtPatient);
      expect(RequestStatus.fromCode('PATIENT_ONBOARD'), RequestStatus.patientOnboard);
      expect(RequestStatus.fromCode('COMPLETED'), RequestStatus.completed);
      expect(RequestStatus.fromCode('CANCELLED'), RequestStatus.cancelled);
      expect(RequestStatus.fromCode('NO_AMBULANCE_AVAILABLE'), RequestStatus.noAmbulanceAvailable);
    });

    test('should have human readable messages for all statuses', () {
      for (final status in RequestStatus.values) {
        expect(status.userMessage.isNotEmpty, isTrue);
        expect(status.userDescription.isNotEmpty, isTrue);
        expect(StatusHelper.getStatusIcon(status), isNotNull);
        expect(StatusHelper.getProgressValue(status), inInclusiveRange(0.0, 1.0));
      }
    });

    test('isActive flag should be false only for final completed/cancelled/unavailable states', () {
      expect(RequestStatus.created.isActive, isTrue);
      expect(RequestStatus.searching.isActive, isTrue);
      expect(RequestStatus.assigned.isActive, isTrue);
      expect(RequestStatus.accepted.isActive, isTrue);
      expect(RequestStatus.enRouteToPatient.isActive, isTrue);
      expect(RequestStatus.completed.isActive, isFalse);
      expect(RequestStatus.cancelled.isActive, isFalse);
      expect(RequestStatus.noAmbulanceAvailable.isActive, isFalse);
    });
  });
}
