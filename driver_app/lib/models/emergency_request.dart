import '../core/utils/geo_utils.dart';

enum EmergencyPriority {
  critical,
  high,
  medium;

  String get displayName => name.toUpperCase();
}

class EmergencyRequest {
  final String requestId;
  final String emergencyType;
  final int victimCount;
  final String pickupLocationName;
  final GeoPoint pickupLocation;
  final EmergencyPriority priority;
  final DateTime reportedTime;
  final String bystanderPhone;
  final String? callerNotes;

  const EmergencyRequest({
    required this.requestId,
    required this.emergencyType,
    required this.victimCount,
    required this.pickupLocationName,
    required this.pickupLocation,
    this.priority = EmergencyPriority.critical,
    required this.reportedTime,
    this.bystanderPhone = '+91 98765 43210',
    this.callerNotes = 'Patient collapsed, difficulty breathing. Immediate ALS required.',
  });

  Map<String, dynamic> toJson() {
    return {
      'requestId': requestId,
      'emergencyType': emergencyType,
      'victimCount': victimCount,
      'pickupLocationName': pickupLocationName,
      'pickupLocation': {
        'latitude': pickupLocation.latitude,
        'longitude': pickupLocation.longitude,
      },
      'priority': priority.displayName,
      'reportedTime': reportedTime.toIso8601String(),
      'bystanderPhone': bystanderPhone,
      'callerNotes': callerNotes,
    };
  }

  factory EmergencyRequest.fromJson(Map<String, dynamic> json) {
    final locJson = json['pickupLocation'] as Map<String, dynamic>? ?? {};
    return EmergencyRequest(
      requestId: json['requestId'] as String,
      emergencyType: json['emergencyType'] as String,
      victimCount: (json['victimCount'] as num?)?.toInt() ?? 1,
      pickupLocationName: json['pickupLocationName'] as String? ?? 'Node 24',
      pickupLocation: GeoPoint(
        (locJson['latitude'] as num?)?.toDouble() ?? 13.0850,
        (locJson['longitude'] as num?)?.toDouble() ?? 80.2750,
      ),
      priority: json['priority'] != null
          ? EmergencyPriority.values.firstWhere(
              (p) => p.displayName == json['priority'],
              orElse: () => EmergencyPriority.critical,
            )
          : EmergencyPriority.critical,
      reportedTime: json['reportedTime'] != null
          ? DateTime.parse(json['reportedTime'] as String)
          : DateTime.now(),
      bystanderPhone: json['bystanderPhone'] as String? ?? '+91 98765 43210',
      callerNotes: json['callerNotes'] as String?,
    );
  }
}
