import 'dart:math' as math;
import '../../domain/entities/location_data.dart';

class RouteScoreBreakdown {
  final String routeLabel;
  final double distanceKm;
  final int baseEtaMinutes;
  final int trafficPenaltyMinutes;
  final int closurePenaltyMinutes;
  final int reliabilityMinutes;
  final int weightedEtaMinutes;
  final double effectiveCost;
  final String source;

  const RouteScoreBreakdown({
    required this.routeLabel,
    required this.distanceKm,
    required this.baseEtaMinutes,
    required this.trafficPenaltyMinutes,
    required this.closurePenaltyMinutes,
    required this.reliabilityMinutes,
    required this.weightedEtaMinutes,
    required this.effectiveCost,
    this.source = 'simulated',
  });
}

/// Container for primary chosen route and evaluated alternative corridors.
class MultiRouteCandidates {
  final List<LocationData> primaryRoute;
  final List<List<LocationData>> alternativeRoutes;
  final List<String> alternativeLabels;
  final List<int> etaMinutesList;
  final List<double> distanceKmList;
  final List<RouteScoreBreakdown> scoreBreakdown;
  final String decisionReason;

  const MultiRouteCandidates({
    required this.primaryRoute,
    required this.alternativeRoutes,
    this.alternativeLabels = const [],
    this.etaMinutesList = const [],
    this.distanceKmList = const [],
    this.scoreBreakdown = const [],
    this.decisionReason = 'Route selected using the lowest weighted travel cost.',
  });
}

class _RouteProfile {
  final String label;
  final double curvature;
  final double distanceMultiplier;
  final int etaOffset;
  final double trafficPenalty;
  final double closurePenalty;
  final double reliabilityBias;

  const _RouteProfile({
    required this.label,
    required this.curvature,
    required this.distanceMultiplier,
    required this.etaOffset,
    required this.trafficPenalty,
    required this.closurePenalty,
    required this.reliabilityBias,
  });
}

class _WeightedRouteCandidate {
  final List<LocationData> route;
  final String label;
  final double distanceKm;
  final int baseEtaMinutes;
  final int trafficPenaltyMinutes;
  final int closurePenaltyMinutes;
  final int reliabilityMinutes;
  final int weightedEtaMinutes;
  final double effectiveCost;
  final String source;

  const _WeightedRouteCandidate({
    required this.route,
    required this.label,
    required this.distanceKm,
    required this.baseEtaMinutes,
    required this.trafficPenaltyMinutes,
    required this.closurePenaltyMinutes,
    required this.reliabilityMinutes,
    required this.weightedEtaMinutes,
    required this.effectiveCost,
    this.source = 'simulated',
  });
}

/// Builds realistic street-like polyline paths between points for emergency navigation.
class MapRouteGeometry {
  MapRouteGeometry._();

  /// Builds realistic multi-segment urban road waypoints from [from] to [to].
  static List<LocationData> buildSimulatedRoute({
    required LocationData from,
    required LocationData to,
    DateTime? timestamp,
    double orthogonalCurvature = 0.0,
  }) {
    final now = timestamp ?? DateTime.now();

    final deltaLat = to.latitude - from.latitude;
    final deltaLng = to.longitude - from.longitude;

    // Normal orthogonal vector for curve deflection
    final normLat = -deltaLng * orthogonalCurvature;
    final normLng = deltaLat * orthogonalCurvature;

    // Realistic urban road segments with arterial bends
    final step1 = LocationData(
      latitude: from.latitude + deltaLat * 0.25 + normLat * 0.5,
      longitude: from.longitude + deltaLng * 0.08 + normLng * 0.5,
      timestamp: now,
    );
    final step2 = LocationData(
      latitude: from.latitude + deltaLat * 0.45 + normLat * 1.0,
      longitude: from.longitude + deltaLng * 0.38 + normLng * 1.0,
      timestamp: now,
    );
    final step3 = LocationData(
      latitude: from.latitude + deltaLat * 0.65 + normLat * 0.9,
      longitude: from.longitude + deltaLng * 0.72 + normLng * 0.9,
      timestamp: now,
    );
    final step4 = LocationData(
      latitude: from.latitude + deltaLat * 0.85 + normLat * 0.4,
      longitude: from.longitude + deltaLng * 0.90 + normLng * 0.4,
      timestamp: now,
    );

    return [
      from.copyWith(timestamp: now),
      step1,
      step2,
      step3,
      step4,
      to.copyWith(timestamp: now),
    ];
  }

  static MultiRouteCandidates buildMultiRouteCandidates({
    required LocationData from,
    required LocationData to,
    DateTime? timestamp,
    double trafficWeight = 1.0,
    double closureWeight = 1.0,
    double reliabilityWeight = 1.0,
    double distanceWeight = 2.0,
  }) {
    final now = timestamp ?? DateTime.now();

    final corridorProfiles = [
      const _RouteProfile(
        label: 'via Arterial Corridor',
        curvature: 0.05,
        distanceMultiplier: 1.18,
        etaOffset: 1,
        trafficPenalty: 0.05,
        closurePenalty: 0.08,
        reliabilityBias: 0.00,
      ),
      const _RouteProfile(
        label: 'via Bypass Connector',
        curvature: -0.18,
        distanceMultiplier: 1.28,
        etaOffset: 2,
        trafficPenalty: 0.10,
        closurePenalty: 0.18,
        reliabilityBias: 0.08,
      ),
      const _RouteProfile(
        label: 'via Local Connector',
        curvature: 0.22,
        distanceMultiplier: 1.34,
        etaOffset: 3,
        trafficPenalty: 0.15,
        closurePenalty: 0.28,
        reliabilityBias: 0.12,
      ),
      const _RouteProfile(
        label: 'via Emergency Access Road',
        curvature: -0.12,
        distanceMultiplier: 1.42,
        etaOffset: 4,
        trafficPenalty: 0.20,
        closurePenalty: 0.32,
        reliabilityBias: 0.16,
      ),
    ];

    final randomSeed = now.microsecondsSinceEpoch +
        from.latitude.round() * 1000000 +
        to.longitude.round() * 100000;
    final random = math.Random(randomSeed);
    final shuffledProfiles = [...corridorProfiles]..shuffle(random);

    final dLat = to.latitude - from.latitude;
    final dLng = to.longitude - from.longitude;
    final straightKm = math.sqrt(dLat * dLat + dLng * dLng) * 111.0;

    final routeCandidates = <_WeightedRouteCandidate>[];

    for (int i = 0; i < shuffledProfiles.length; i++) {
      final profile = shuffledProfiles[i];

      final route = buildSimulatedRoute(
        from: from,
        to: to,
        timestamp: now,
        orthogonalCurvature: profile.curvature,
      );

      final label = i == 0
          ? 'Selected Route'
          : i == 1
              ? 'Alternate Corridor 1'
              : 'Alternate Corridor 2';

      final distanceKm = double.parse((straightKm * profile.distanceMultiplier).toStringAsFixed(1));
      final baseEtaMinutes = math.max(2, (distanceKm * 1.5).round());

      final trafficComponent = (baseEtaMinutes * profile.trafficPenalty * trafficWeight).round();
      final closureComponent = (baseEtaMinutes * profile.closurePenalty * closureWeight).round();
      final reliabilityComponent = (baseEtaMinutes * profile.reliabilityBias * reliabilityWeight).round();

      final weightedEtaMinutes = math.max(
        baseEtaMinutes + profile.etaOffset,
        baseEtaMinutes + trafficComponent + closureComponent + reliabilityComponent,
      );

      final effectiveCost = weightedEtaMinutes + (distanceKm * distanceWeight);

      routeCandidates.add(
        _WeightedRouteCandidate(
          route: route,
          label: label,
          distanceKm: distanceKm,
          baseEtaMinutes: baseEtaMinutes,
          trafficPenaltyMinutes: trafficComponent,
          closurePenaltyMinutes: closureComponent,
          reliabilityMinutes: reliabilityComponent,
          weightedEtaMinutes: weightedEtaMinutes,
          effectiveCost: effectiveCost,
          source: 'simulated',
        ),
      );
    }

    routeCandidates.sort((a, b) {
      final costComparison = a.effectiveCost.compareTo(b.effectiveCost);
      if (costComparison != 0) return costComparison;
      return a.weightedEtaMinutes.compareTo(b.weightedEtaMinutes);
    });

    final rankedPrimary = routeCandidates.first;
    final rankedAlternatives = routeCandidates.skip(1).take(2).toList();

    final scoreBreakdown = routeCandidates
        .map(
          (candidate) => RouteScoreBreakdown(
            routeLabel: candidate.label,
            distanceKm: candidate.distanceKm,
            baseEtaMinutes: candidate.baseEtaMinutes,
            trafficPenaltyMinutes: candidate.trafficPenaltyMinutes,
            closurePenaltyMinutes: candidate.closurePenaltyMinutes,
            reliabilityMinutes: candidate.reliabilityMinutes,
            weightedEtaMinutes: candidate.weightedEtaMinutes,
            effectiveCost: candidate.effectiveCost,
            source: candidate.source,
          ),
        )
        .toList();

    final decisionReason =
        'Selected ${rankedPrimary.label} because it produced the lowest weighted travel cost (${rankedPrimary.effectiveCost.toStringAsFixed(1)}), after applying traffic, closure, and reliability penalties.';

    return MultiRouteCandidates(
      primaryRoute: rankedPrimary.route,
      alternativeRoutes: rankedAlternatives.map((candidate) => candidate.route).toList(),
      alternativeLabels: rankedAlternatives.map((candidate) => candidate.label).toList(),
      distanceKmList: [
        rankedPrimary.distanceKm,
        ...rankedAlternatives.map((candidate) => candidate.distanceKm),
      ],
      etaMinutesList: [
        rankedPrimary.weightedEtaMinutes,
        ...rankedAlternatives.map((candidate) => candidate.weightedEtaMinutes),
      ],
      scoreBreakdown: scoreBreakdown,
      decisionReason: decisionReason,
    );
  }

  /// Concatenates multi-route legs (e.g. Ambulance -> Incident -> Hospital)
  static MultiRouteCandidates combineLegs({
    required MultiRouteCandidates leg1,
    MultiRouteCandidates? leg2,
  }) {
    if (leg2 == null) return leg1;

    final combinedPrimary = [
      ...leg1.primaryRoute,
      ...leg2.primaryRoute.skip(1),
    ];

    final List<List<LocationData>> combinedAlts = [];
    final altCount = math.min(leg1.alternativeRoutes.length, leg2.alternativeRoutes.length);

    for (int i = 0; i < altCount; i++) {
      combinedAlts.add([
        ...leg1.alternativeRoutes[i],
        ...leg2.alternativeRoutes[i].skip(1),
      ]);
    }

    final totalDist0 = (leg1.distanceKmList.isNotEmpty ? leg1.distanceKmList[0] : 0.0) +
        (leg2.distanceKmList.isNotEmpty ? leg2.distanceKmList[0] : 0.0);
    final totalEta0 = (leg1.etaMinutesList.isNotEmpty ? leg1.etaMinutesList[0] : 0) +
        (leg2.etaMinutesList.isNotEmpty ? leg2.etaMinutesList[0] : 0);

    return MultiRouteCandidates(
      primaryRoute: combinedPrimary,
      alternativeRoutes: combinedAlts,
      alternativeLabels: leg1.alternativeLabels,
      distanceKmList: [
        double.parse(totalDist0.toStringAsFixed(1)),
        double.parse((totalDist0 * 1.2).toStringAsFixed(1)),
        double.parse((totalDist0 * 1.35).toStringAsFixed(1)),
      ],
      etaMinutesList: [
        totalEta0,
        totalEta0 + 3,
        totalEta0 + 5,
      ],
      scoreBreakdown: leg1.scoreBreakdown,
      decisionReason: leg1.decisionReason,
    );
  }

  /// Interpolates a route of [waypoints] into [totalSteps] finely spaced steps
  /// for smooth, vehicular movement along road corridors without teleporting.
  static List<LocationData> interpolatePath(
    List<LocationData> waypoints, {
    int totalSteps = 24,
  }) {
    if (waypoints.isEmpty) return [];
    if (waypoints.length == 1) return [waypoints.first];
    if (totalSteps <= waypoints.length) return waypoints;

    final List<LocationData> result = [];
    final int segments = waypoints.length - 1;
    final int stepsPerSegment = (totalSteps / segments).ceil();

    for (int i = 0; i < segments; i++) {
      final start = waypoints[i];
      final end = waypoints[i + 1];

      for (int s = 0; s < stepsPerSegment; s++) {
        final t = s / stepsPerSegment;
        final lat = start.latitude + (end.latitude - start.latitude) * t;
        final lng = start.longitude + (end.longitude - start.longitude) * t;
        result.add(
          LocationData(
            latitude: lat,
            longitude: lng,
            timestamp: DateTime.now(),
          ),
        );
      }
    }

    result.add(waypoints.last);
    return result;
  }

  /// Computes compass heading angle in degrees (0 - 360) from [from] to [to].
  static double headingDegrees(LocationData from, LocationData to) {
    final dLng = to.longitude - from.longitude;
    final dLat = to.latitude - from.latitude;
    final degrees = math.atan2(dLng, dLat) * (180 / math.pi);
    return (degrees + 360) % 360;
  }
}
