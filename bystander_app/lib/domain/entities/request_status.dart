import 'package:flutter/material.dart';
import '../../core/theme/app_colors.dart';

/// Complete lifecycle state of an EmergencyRequest.
enum RequestStatus {
  created(
    code: 'CREATED',
    userMessage: 'Request Created',
    userDescription: 'Emergency request registered. Preparing dispatch...',
    color: AppColors.statusSearching,
    isActive: true,
  ),
  searching(
    code: 'SEARCHING',
    userMessage: 'Searching for an ambulance...',
    userDescription: 'Finding the nearest available emergency vehicle in Chennai network...',
    color: AppColors.statusSearching,
    isActive: true,
  ),
  assigned(
    code: 'ASSIGNED',
    userMessage: 'Ambulance assigned, waiting for driver confirmation',
    userDescription: 'Emergency unit assigned. Waiting for driver to confirm response...',
    color: AppColors.statusAssigned,
    isActive: true,
  ),
  accepted(
    code: 'DRIVER_ACCEPTED',
    userMessage: 'Driver accepted, en route to pickup',
    userDescription: 'Ambulance driver has confirmed and is en route to pickup location.',
    color: AppColors.statusAccepted,
    isActive: true,
  ),
  enRouteToPatient(
    code: 'EN_ROUTE_TO_PATIENT',
    userMessage: 'Ambulance is on the way',
    userDescription: 'Ambulance is actively traveling to your emergency location.',
    color: AppColors.statusEnRoute,
    isActive: true,
  ),
  arrivedAtPatient(
    code: 'ARRIVED_AT_PATIENT',
    userMessage: 'Ambulance has arrived',
    userDescription: 'Paramedics have reached the emergency location.',
    color: AppColors.statusArrived,
    isActive: true,
  ),
  patientOnboard(
    code: 'PATIENT_ONBOARD',
    userMessage: 'Patient onboard, proceeding to hospital',
    userDescription: 'Patient is stabilized inside unit and proceeding to hospital.',
    color: AppColors.statusEnRoute,
    isActive: true,
  ),
  enRouteToHospital(
    code: 'EN_ROUTE_TO_HOSPITAL',
    userMessage: 'En route to hospital',
    userDescription: 'Ambulance is navigating along green corridor to destination hospital.',
    color: AppColors.statusEnRoute,
    isActive: true,
  ),
  arrivedAtHospital(
    code: 'ARRIVED_AT_HOSPITAL',
    userMessage: 'Arrived at hospital',
    userDescription: 'Ambulance has safely reached the emergency trauma bay.',
    color: AppColors.statusCompleted,
    isActive: true,
  ),
  completed(
    code: 'COMPLETED',
    userMessage: 'Emergency response completed',
    userDescription: 'The emergency response case has been successfully closed.',
    color: AppColors.statusCompleted,
    isActive: false,
  ),
  cancelled(
    code: 'CANCELLED',
    userMessage: 'Emergency cancelled',
    userDescription: 'This emergency request was cancelled by the requester or operator.',
    color: AppColors.statusCancelled,
    isActive: false,
  ),
  noAmbulanceAvailable(
    code: 'NO_AMBULANCE_AVAILABLE',
    userMessage: 'No ambulance currently available',
    userDescription: 'All local emergency vehicles are currently busy. Please call 108 helpline immediately.',
    color: AppColors.emergencyRed,
    isActive: false,
  );

  final String code;
  final String userMessage;
  final String userDescription;
  final Color color;
  final bool isActive;

  const RequestStatus({
    required this.code,
    required this.userMessage,
    required this.userDescription,
    required this.color,
    required this.isActive,
  });

  /// Section 11: Cancellation is only allowed when status is:
  /// SEARCHING, ASSIGNED, DRIVER_ACCEPTED, EN_ROUTE_TO_PATIENT.
  bool get canCancel =>
      this == RequestStatus.searching ||
      this == RequestStatus.assigned ||
      this == RequestStatus.accepted ||
      this == RequestStatus.enRouteToPatient;

  static RequestStatus fromCode(String code) {
    final normalized = code.trim().toUpperCase();
    if (normalized == 'DRIVER_ACCEPTED' || normalized == 'ACCEPTED') {
      return RequestStatus.accepted;
    }
    return RequestStatus.values.firstWhere(
      (s) => s.code.toUpperCase() == normalized,
      orElse: () => RequestStatus.searching,
    );
  }
}
