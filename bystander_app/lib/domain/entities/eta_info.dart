/// Entity representing ETA estimation provided by future backend/dispatch algorithms.
class EtaInfo {
  final int estimatedMinutes;
  final double? distanceMeters;
  final DateTime lastCalculatedAt;
  final String? trafficCondition;

  const EtaInfo({
    required this.estimatedMinutes,
    this.distanceMeters,
    required this.lastCalculatedAt,
    this.trafficCondition,
  });

  String get formattedEta {
    if (estimatedMinutes <= 0) return '< 1 min';
    return '$estimatedMinutes min';
  }

  EtaInfo copyWith({
    int? estimatedMinutes,
    double? distanceMeters,
    DateTime? lastCalculatedAt,
    String? trafficCondition,
  }) {
    return EtaInfo(
      estimatedMinutes: estimatedMinutes ?? this.estimatedMinutes,
      distanceMeters: distanceMeters ?? this.distanceMeters,
      lastCalculatedAt: lastCalculatedAt ?? this.lastCalculatedAt,
      trafficCondition: trafficCondition ?? this.trafficCondition,
    );
  }
}
