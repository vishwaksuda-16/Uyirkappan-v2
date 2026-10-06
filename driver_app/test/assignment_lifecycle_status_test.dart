import 'package:flutter_test/flutter_test.dart';
import 'package:driver_app/models/assignment.dart';
import 'package:driver_app/models/state_enums.dart';

void main() {
  test('active assignment uses current emergency lifecycle from polling response', () {
    final assignment = Assignment.fromJson({
      'assignmentId': 'ASN-1',
      'requestId': 'REQ-1',
      'ambulanceId': 'AMB-1',
      'driverId': 'DRV-1',
      'status': 'ACCEPTED',
      'request': {
        'status': 'PATIENT_ONBOARD',
        'pickupLocation': {'latitude': 13.05, 'longitude': 80.25},
      },
      'assignedAt': '2026-10-06T00:00:00.000Z',
    });

    expect(assignment.status, DriverLifecycleState.patientOnboard);
  });

  test('pending assignment response is not replaced with emergency assigned status', () {
    final assignment = Assignment.fromJson({
      'assignmentId': 'ASN-2',
      'requestId': 'REQ-2',
      'ambulanceId': 'AMB-2',
      'driverId': 'DRV-2',
      'status': 'PENDING',
      'request': {'status': 'ASSIGNED'},
      'assignedAt': '2026-10-06T00:00:00.000Z',
    });

    expect(assignment.status, DriverLifecycleState.assignmentReceived);
  });
}
