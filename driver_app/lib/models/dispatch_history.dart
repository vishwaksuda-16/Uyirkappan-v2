class DispatchAttempt {
  final int attemptNumber;
  final String ambulanceId;
  final DateTime timestamp;
  final String outcome; // TIMEOUT, REJECTED, ACCEPTED
  final String? reason;

  const DispatchAttempt({
    required this.attemptNumber,
    required this.ambulanceId,
    required this.timestamp,
    required this.outcome,
    this.reason,
  });

  Map<String, dynamic> toJson() {
    return {
      'attemptNumber': attemptNumber,
      'ambulanceId': ambulanceId,
      'timestamp': timestamp.toIso8601String(),
      'outcome': outcome,
      'reason': reason,
    };
  }

  factory DispatchAttempt.fromJson(Map<String, dynamic> json) {
    return DispatchAttempt(
      attemptNumber: json['attemptNumber'] as int,
      ambulanceId: json['ambulanceId'] as String,
      timestamp: DateTime.parse(json['timestamp'] as String),
      outcome: json['outcome'] as String,
      reason: json['reason'] as String?,
    );
  }
}

class MissionMetrics {
  final String requestId;
  final DateTime? assignmentTime;
  final DateTime? responseTime;
  final String? driverResponse; // ACCEPTED, REJECTED, TIMEOUT
  final int fallbackCount;
  final double distanceTravelledKm;
  final double totalTravelTimeMinutes;
  final List<DispatchAttempt> attempts;

  const MissionMetrics({
    required this.requestId,
    this.assignmentTime,
    this.responseTime,
    this.driverResponse,
    this.fallbackCount = 0,
    this.distanceTravelledKm = 0.0,
    this.totalTravelTimeMinutes = 0.0,
    this.attempts = const [],
  });

  Duration? get driverResponseDuration {
    if (assignmentTime != null && responseTime != null) {
      return responseTime!.difference(assignmentTime!);
    }
    return null;
  }
}
