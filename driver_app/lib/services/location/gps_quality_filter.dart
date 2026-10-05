import '../../core/utils/geo_utils.dart';
import 'location_provider.dart';

enum GpsQualityOutcome {
  valid,
  degradedAccuracy,
  rejectedInvalidCoordinates,
  rejectedStale,
  rejectedImpossibleJump,
}

class GpsQualityEvaluation {
  final GpsQualityOutcome outcome;
  final String? message;
  final bool isUsable;

  const GpsQualityEvaluation({
    required this.outcome,
    this.message,
    required this.isUsable,
  });

  bool get isValid => outcome == GpsQualityOutcome.valid;
  bool get isDegraded => outcome == GpsQualityOutcome.degradedAccuracy;
}

/// Validates location updates against spatial bounds, staleness, accuracy, and kinematic plausibility.
class GpsQualityFilter {
  final Duration maxStaleDuration;
  final double maxAccuracyMeters;
  final double maxSpeedKmh;
  final double maxJumpMetersPerSecond;

  const GpsQualityFilter({
    this.maxStaleDuration = const Duration(seconds: 30),
    this.maxAccuracyMeters = 100.0,
    this.maxSpeedKmh = 180.0,
    this.maxJumpMetersPerSecond = 50.0,
  });

  /// Evaluates coordinate boundaries [-90, 90] and [-180, 180].
  bool isValidCoordinates(double lat, double lng) {
    if (lat.isNaN || lng.isNaN || lat.isInfinite || lng.isInfinite) return false;
    return lat >= -90.0 && lat <= 90.0 && lng >= -180.0 && lng <= 180.0;
  }

  /// Detects whether the timestamp is excessively in the past or far future.
  bool isStale(DateTime timestamp, {DateTime? now}) {
    final current = now ?? DateTime.now();
    final difference = current.difference(timestamp);
    // Stale if older than max duration or if timestamp is from future (> 5 min)
    return difference > maxStaleDuration || difference < const Duration(minutes: -5);
  }

  /// Evaluates GPS horizontal accuracy against configured threshold.
  bool isAccuracyDegraded(double? accuracy) {
    if (accuracy == null) return false;
    return accuracy > maxAccuracyMeters;
  }

  /// Detects unrealistic teleportation or impossible velocity between updates.
  bool isImpossibleJump(RawLocationData previous, RawLocationData current) {
    final timeDeltaSec = current.timestamp.difference(previous.timestamp).inMilliseconds / 1000.0;
    if (timeDeltaSec <= 0.0) return false;

    final distanceKm = GeoUtils.distanceKm(
      GeoPoint(previous.latitude, previous.longitude),
      GeoPoint(current.latitude, current.longitude),
    );
    final distanceMeters = distanceKm * 1000.0;
    final apparentSpeedKmh = (distanceKm / timeDeltaSec) * 3600.0;
    final apparentSpeedMps = distanceMeters / timeDeltaSec;

    // Check against max speed and instantaneous jump limit
    return apparentSpeedKmh > maxSpeedKmh || apparentSpeedMps > maxJumpMetersPerSecond;
  }

  /// Comprehensive evaluation of a new location update relative to the previous known fix.
  GpsQualityEvaluation evaluate(RawLocationData? previous, RawLocationData current, {DateTime? now}) {
    // 1. Validate coordinate boundaries
    if (!isValidCoordinates(current.latitude, current.longitude)) {
      return const GpsQualityEvaluation(
        outcome: GpsQualityOutcome.rejectedInvalidCoordinates,
        message: 'Coordinates out of bounds (-90 to 90, -180 to 180)',
        isUsable: false,
      );
    }

    // 2. Validate timestamp freshness
    if (isStale(current.timestamp, now: now)) {
      return const GpsQualityEvaluation(
        outcome: GpsQualityOutcome.rejectedStale,
        message: 'Location timestamp is excessively stale',
        isUsable: false,
      );
    }

    // 3. Detect impossible kinematic jumps
    if (previous != null && isImpossibleJump(previous, current)) {
      return const GpsQualityEvaluation(
        outcome: GpsQualityOutcome.rejectedImpossibleJump,
        message: 'Impossible kinematic displacement detected (GPS jump)',
        isUsable: false,
      );
    }

    // 4. Check horizontal accuracy
    if (isAccuracyDegraded(current.accuracy)) {
      return GpsQualityEvaluation(
        outcome: GpsQualityOutcome.degradedAccuracy,
        message: 'Accuracy degraded (${current.accuracy?.toStringAsFixed(1)}m > ${maxAccuracyMeters.toStringAsFixed(1)}m)',
        isUsable: true, // Degraded signals may still be usable with caveat
      );
    }

    return const GpsQualityEvaluation(
      outcome: GpsQualityOutcome.valid,
      message: 'Location valid and within nominal accuracy bounds',
      isUsable: true,
    );
  }
}
