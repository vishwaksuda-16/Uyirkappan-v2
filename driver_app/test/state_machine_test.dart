import 'package:flutter_test/flutter_test.dart';
import 'package:driver_app/core/errors/app_exceptions.dart';
import 'package:driver_app/models/state_enums.dart';
import 'package:driver_app/state/state_machine.dart';

void main() {
  group('DriverStateMachine Tests', () {
    test('Valid complete emergency lifecycle transitions pass', () {
      // OFFLINE -> AVAILABLE
      expect(
        DriverStateMachine.canTransition(
          DriverLifecycleState.offline,
          DriverLifecycleState.available,
        ),
        isTrue,
      );

      // AVAILABLE -> ASSIGNMENT_RECEIVED
      expect(
        DriverStateMachine.canTransition(
          DriverLifecycleState.available,
          DriverLifecycleState.assignmentReceived,
        ),
        isTrue,
      );

      // ASSIGNMENT_RECEIVED -> ACCEPTED
      expect(
        DriverStateMachine.canTransition(
          DriverLifecycleState.assignmentReceived,
          DriverLifecycleState.accepted,
        ),
        isTrue,
      );

      // ACCEPTED -> EN_ROUTE_TO_PATIENT
      expect(
        DriverStateMachine.canTransition(
          DriverLifecycleState.accepted,
          DriverLifecycleState.enRouteToPatient,
        ),
        isTrue,
      );

      // EN_ROUTE_TO_PATIENT -> ARRIVED_AT_PATIENT
      expect(
        DriverStateMachine.canTransition(
          DriverLifecycleState.enRouteToPatient,
          DriverLifecycleState.arrivedAtPatient,
        ),
        isTrue,
      );

      // ARRIVED_AT_PATIENT -> PATIENT_ONBOARD
      expect(
        DriverStateMachine.canTransition(
          DriverLifecycleState.arrivedAtPatient,
          DriverLifecycleState.patientOnboard,
        ),
        isTrue,
      );

      // PATIENT_ONBOARD -> EN_ROUTE_TO_HOSPITAL
      expect(
        DriverStateMachine.canTransition(
          DriverLifecycleState.patientOnboard,
          DriverLifecycleState.enRouteToHospital,
        ),
        isTrue,
      );

      // EN_ROUTE_TO_HOSPITAL -> ARRIVED_AT_HOSPITAL
      expect(
        DriverStateMachine.canTransition(
          DriverLifecycleState.enRouteToHospital,
          DriverLifecycleState.arrivedAtHospital,
        ),
        isTrue,
      );

      // ARRIVED_AT_HOSPITAL -> COMPLETED
      expect(
        DriverStateMachine.canTransition(
          DriverLifecycleState.arrivedAtHospital,
          DriverLifecycleState.completed,
        ),
        isTrue,
      );

      // COMPLETED -> AVAILABLE
      expect(
        DriverStateMachine.canTransition(
          DriverLifecycleState.completed,
          DriverLifecycleState.available,
        ),
        isTrue,
      );
    });

    test('Valid alternate reject and timeout transitions pass', () {
      // ASSIGNMENT_RECEIVED -> REJECTED
      expect(
        DriverStateMachine.canTransition(
          DriverLifecycleState.assignmentReceived,
          DriverLifecycleState.rejected,
        ),
        isTrue,
      );

      // REJECTED -> AVAILABLE
      expect(
        DriverStateMachine.canTransition(
          DriverLifecycleState.rejected,
          DriverLifecycleState.available,
        ),
        isTrue,
      );

      // ASSIGNMENT_RECEIVED -> TIMEOUT
      expect(
        DriverStateMachine.canTransition(
          DriverLifecycleState.assignmentReceived,
          DriverLifecycleState.timeout,
        ),
        isTrue,
      );

      // TIMEOUT -> AVAILABLE
      expect(
        DriverStateMachine.canTransition(
          DriverLifecycleState.timeout,
          DriverLifecycleState.available,
        ),
        isTrue,
      );
    });

    test('Invalid transitions throw InvalidStateTransitionException', () {
      // Direct jump from AVAILABLE to PATIENT_ONBOARD must fail
      expect(
        () => DriverStateMachine.validateTransition(
          DriverLifecycleState.available,
          DriverLifecycleState.patientOnboard,
        ),
        throwsA(isA<InvalidStateTransitionException>()),
      );

      // Direct jump from OFFLINE to ACCEPTED must fail
      expect(
        () => DriverStateMachine.validateTransition(
          DriverLifecycleState.offline,
          DriverLifecycleState.accepted,
        ),
        throwsA(isA<InvalidStateTransitionException>()),
      );

      // Jump from ARRIVED_AT_PATIENT back to OFFLINE during emergency must fail
      expect(
        DriverStateMachine.canTransition(
          DriverLifecycleState.arrivedAtPatient,
          DriverLifecycleState.offline,
        ),
        isFalse,
      );
    });

    test('Primary action labels match documented lifecycle controls', () {
      expect(
        DriverStateMachine.getPrimaryActionLabel(
          DriverLifecycleState.enRouteToPatient,
        ),
        'ARRIVED AT PATIENT',
      );
      expect(
        DriverStateMachine.getPrimaryActionLabel(
          DriverLifecycleState.arrivedAtPatient,
        ),
        'PATIENT ONBOARD',
      );
      expect(
        DriverStateMachine.getPrimaryActionLabel(
          DriverLifecycleState.patientOnboard,
        ),
        'START NAVIGATION TO HOSPITAL',
      );
      expect(
        DriverStateMachine.getPrimaryActionLabel(
          DriverLifecycleState.enRouteToHospital,
        ),
        'ARRIVED AT HOSPITAL',
      );
      expect(
        DriverStateMachine.getPrimaryActionLabel(
          DriverLifecycleState.arrivedAtHospital,
        ),
        'COMPLETE MISSION',
      );
    });

    test('Availability mapping matches documented states', () {
      expect(
        DriverStateMachine.getAvailabilityForLifecycle(DriverLifecycleState.offline),
        AmbulanceAvailability.offline,
      );
      expect(
        DriverStateMachine.getAvailabilityForLifecycle(DriverLifecycleState.available),
        AmbulanceAvailability.available,
      );
      expect(
        DriverStateMachine.getAvailabilityForLifecycle(DriverLifecycleState.enRouteToPatient),
        AmbulanceAvailability.busy,
      );
      expect(
        DriverStateMachine.getAvailabilityForLifecycle(DriverLifecycleState.enRouteToHospital),
        AmbulanceAvailability.busy,
      );
    });
  });
}
