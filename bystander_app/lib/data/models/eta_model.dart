import '../../domain/entities/eta_info.dart';

/// Data model for EtaInfo with JSON serialization.
class EtaModel extends EtaInfo {
  const EtaModel({
    required super.estimatedMinutes,
    super.distanceMeters,
    required super.lastCalculatedAt,
    super.trafficCondition,
  });

  factory EtaModel.fromJson(Map<String, dynamic> json) {
    return EtaModel(
      estimatedMinutes: json['estimatedMinutes'] as int? ?? 0,
      distanceMeters: (json['distanceMeters'] as num?)?.toDouble(),
      lastCalculatedAt: json['lastCalculatedAt'] != null
          ? DateTime.parse(json['lastCalculatedAt'] as String)
          : DateTime.now(),
      trafficCondition: json['trafficCondition'] as String?,
    );
  }

  factory EtaModel.fromEntity(EtaInfo entity) {
    return EtaModel(
      estimatedMinutes: entity.estimatedMinutes,
      distanceMeters: entity.distanceMeters,
      lastCalculatedAt: entity.lastCalculatedAt,
      trafficCondition: entity.trafficCondition,
    );
  }

  Map<String, dynamic> toJson() {
    return {
      'estimatedMinutes': estimatedMinutes,
      if (distanceMeters != null) 'distanceMeters': distanceMeters,
      'lastCalculatedAt': lastCalculatedAt.toIso8601String(),
      if (trafficCondition != null) 'trafficCondition': trafficCondition,
    };
  }
}
