/// Centralized Real-Time WebSocket / SSE Event Names.
/// Adheres strictly to the integration contract for Module 6 (Tracking & Real-time Layer).
class EventConstants {
  EventConstants._();

  // Inbound real-time events emitted by backend Socket.IO
  static const String emergencyCreated = 'EMERGENCY_CREATED';
  static const String ambulanceAssigned = 'AMBULANCE_ASSIGNED';
  static const String assignmentAccepted = 'ASSIGNMENT_ACCEPTED';
  static const String ambulanceLocationUpdated = 'AMBULANCE_LOCATION_UPDATED';
  static const String etaUpdated = 'ETA_UPDATED';
  static const String statusUpdated = 'STATUS_UPDATED';
  static const String fallbackStarted = 'FALLBACK_STARTED';
  static const String ambulanceReassigned = 'AMBULANCE_REASSIGNED';
  static const String ambulanceArrived = 'AMBULANCE_ARRIVED';
  static const String emergencyCompleted = 'EMERGENCY_COMPLETED';

  // Backwards-compatible aliases
  static const String driverAccepted = assignmentAccepted;
  static const String locationUpdated = ambulanceLocationUpdated;
  static const String fallbackTriggered = fallbackStarted;
  static const String requestCompleted = emergencyCompleted;

  // Outbound client events
  static const String joinEmergency = 'join_emergency';
  static const String leaveEmergency = 'leave_emergency';
}
