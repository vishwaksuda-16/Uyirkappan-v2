import 'package:flutter/material.dart';
import '../../domain/entities/request_status.dart';

/// Helper methods for RequestStatus presentation logic.
class StatusHelper {
  StatusHelper._();

  static IconData getStatusIcon(RequestStatus status) {
    switch (status) {
      case RequestStatus.created:
      case RequestStatus.searching:
        return Icons.search_rounded;
      case RequestStatus.assigned:
      case RequestStatus.accepted:
        return Icons.assignment_turned_in_rounded;
      case RequestStatus.enRouteToPatient:
      case RequestStatus.enRouteToHospital:
        return Icons.directions_car_rounded;
      case RequestStatus.arrivedAtPatient:
      case RequestStatus.arrivedAtHospital:
        return Icons.location_on_rounded;
      case RequestStatus.patientOnboard:
        return Icons.local_hospital_rounded;
      case RequestStatus.completed:
        return Icons.check_circle_rounded;
      case RequestStatus.cancelled:
        return Icons.cancel_rounded;
      case RequestStatus.noAmbulanceAvailable:
        return Icons.error_outline_rounded;
    }
  }

  static double getProgressValue(RequestStatus status) {
    switch (status) {
      case RequestStatus.created:
        return 0.1;
      case RequestStatus.searching:
        return 0.2;
      case RequestStatus.assigned:
        return 0.35;
      case RequestStatus.accepted:
        return 0.5;
      case RequestStatus.enRouteToPatient:
        return 0.65;
      case RequestStatus.arrivedAtPatient:
        return 0.8;
      case RequestStatus.patientOnboard:
        return 0.9;
      case RequestStatus.enRouteToHospital:
      case RequestStatus.arrivedAtHospital:
      case RequestStatus.completed:
        return 1.0;
      case RequestStatus.cancelled:
      case RequestStatus.noAmbulanceAvailable:
        return 0.0;
    }
  }
}
