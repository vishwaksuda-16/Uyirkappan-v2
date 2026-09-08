import 'dart:math' as math;
import 'package:flutter/material.dart';
import '../../core/constants/app_colors.dart';
import '../../core/utils/geo_utils.dart';
import '../../models/location_model.dart';
import '../../models/route_model.dart';
import '../../services/simulation/road_network.dart';

class TacticalMapCanvas extends StatelessWidget {
  final RouteModel? route;
  final AmbulanceLocation? currentLocation;
  final String destinationName;
  final bool isEnRouteToHospital;

  const TacticalMapCanvas({
    super.key,
    required this.route,
    required this.currentLocation,
    required this.destinationName,
    this.isEnRouteToHospital = false,
  });

  @override
  Widget build(BuildContext context) {
    return Container(
      color: const Color(0xFF070D18),
      child: Stack(
        children: [
          InteractiveViewer(
            boundaryMargin: const EdgeInsets.all(50),
            minScale: 0.8,
            maxScale: 2.5,
            child: SizedBox(
              width: double.infinity,
              height: double.infinity,
              child: CustomPaint(
                painter: _TacticalMapPainter(
                  route: route,
                  currentLocation: currentLocation,
                  isEnRouteToHospital: isEnRouteToHospital,
                ),
              ),
            ),
          ),
          // Tactical compass overlay in top-right
          Positioned(
            top: 16,
            right: 16,
            child: _buildCompassHud(),
          ),
          // Legend overlay in bottom-left
          Positioned(
            bottom: 16,
            left: 16,
            child: _buildLegend(),
          ),
        ],
      ),
    );
  }

  Widget _buildCompassHud() {
    final heading = currentLocation?.heading ?? 0.0;
    return Container(
      padding: const EdgeInsets.all(8),
      decoration: BoxDecoration(
        color: AppColors.surface.withValues(alpha: 0.85),
        borderRadius: BorderRadius.circular(10),
        border: Border.all(color: AppColors.cardBorder),
      ),
      child: Column(
        children: [
          Transform.rotate(
            angle: (heading * math.pi / 180),
            child: const Icon(
              Icons.navigation,
              color: AppColors.tacticalCyan,
              size: 24,
            ),
          ),
          const SizedBox(height: 2),
          Text(
            '${heading.round()}° ${GeoUtils.bearingToDirection(heading)}',
            style: const TextStyle(
              color: AppColors.textPrimary,
              fontSize: 10,
              fontWeight: FontWeight.w700,
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildLegend() {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
      decoration: BoxDecoration(
        color: AppColors.surface.withValues(alpha: 0.85),
        borderRadius: BorderRadius.circular(8),
        border: Border.all(color: AppColors.cardBorder),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          _legendItem(AppColors.emergencyRed, 'Ambulance'),
          const SizedBox(width: 12),
          _legendItem(AppColors.tacticalCyan, 'Active Route'),
          const SizedBox(width: 12),
          _legendItem(AppColors.hospitalBadge, 'Hospital'),
        ],
      ),
    );
  }

  Widget _legendItem(Color color, String label) {
    return Row(
      mainAxisSize: MainAxisSize.min,
      children: [
        Container(
          width: 8,
          height: 8,
          decoration: BoxDecoration(color: color, shape: BoxShape.circle),
        ),
        const SizedBox(width: 4),
        Text(
          label,
          style: const TextStyle(
            color: AppColors.textSecondary,
            fontSize: 10,
            fontWeight: FontWeight.w600,
          ),
        ),
      ],
    );
  }
}

class _TacticalMapPainter extends CustomPainter {
  final RouteModel? route;
  final AmbulanceLocation? currentLocation;
  final bool isEnRouteToHospital;

  _TacticalMapPainter({
    required this.route,
    required this.currentLocation,
    required this.isEnRouteToHospital,
  });

  // Coordinate bounding box for Chennai simulation region
  static const double minLat = 13.0500;
  static const double maxLat = 13.0900;
  static const double minLon = 80.2450;
  static const double maxLon = 80.2850;

  Offset _geoToCanvas(GeoPoint point, Size size) {
    // Normalization to [0, 1]
    final xNorm = (point.longitude - minLon) / (maxLon - minLon);
    // Invert Y because canvas Y increases downwards
    final yNorm = 1.0 - ((point.latitude - minLat) / (maxLat - minLat));

    final padding = 40.0;
    final drawWidth = size.width - (padding * 2);
    final drawHeight = size.height - (padding * 2);

    return Offset(
      padding + (xNorm * drawWidth),
      padding + (yNorm * drawHeight),
    );
  }

  @override
  void paint(Canvas canvas, Size size) {
    _drawTacticalGrid(canvas, size);
    _drawAllRoadNetwork(canvas, size);
    _drawActiveRoute(canvas, size);
    _drawWaypoints(canvas, size);
    _drawAmbulanceMarker(canvas, size);
  }

  void _drawTacticalGrid(Canvas canvas, Size size) {
    final gridPaint = Paint()
      ..color = const Color(0xFF132034)
      ..strokeWidth = 0.5;

    const step = 40.0;
    for (double x = 0; x < size.width; x += step) {
      canvas.drawLine(Offset(x, 0), Offset(x, size.height), gridPaint);
    }
    for (double y = 0; y < size.height; y += step) {
      canvas.drawLine(Offset(0, y), Offset(size.width, y), gridPaint);
    }
  }

  void _drawAllRoadNetwork(Canvas canvas, Size size) {
    final roadPaint = Paint()
      ..color = const Color(0xFF1E2F48)
      ..strokeWidth = 3.0
      ..strokeCap = StrokeCap.round;

    // Draw background interconnected road network
    final nodeKeys = RoadNetwork.nodes.keys.toList();
    for (int i = 0; i < nodeKeys.length - 1; i++) {
      final p1 = _geoToCanvas(RoadNetwork.nodes[nodeKeys[i]]!.location, size);
      final p2 = _geoToCanvas(RoadNetwork.nodes[nodeKeys[i + 1]]!.location, size);
      canvas.drawLine(p1, p2, roadPaint);
    }
  }

  void _drawActiveRoute(Canvas canvas, Size size) {
    if (route == null || route!.waypoints.length < 2) return;

    final path = Path();
    final waypoints = route!.waypoints;

    final first = _geoToCanvas(waypoints.first.location, size);
    path.moveTo(first.dx, first.dy);

    for (int i = 1; i < waypoints.length; i++) {
      final pt = _geoToCanvas(waypoints[i].location, size);
      path.lineTo(pt.dx, pt.dy);
    }

    // Glow underlay
    final glowPaint = Paint()
      ..color = AppColors.tacticalCyan.withValues(alpha: 0.3)
      ..strokeWidth = 10.0
      ..style = PaintingStyle.stroke
      ..strokeCap = StrokeCap.round
      ..strokeJoin = StrokeJoin.round;
    canvas.drawPath(path, glowPaint);

    // Main route stroke
    final activeRoutePaint = Paint()
      ..color = AppColors.tacticalCyan
      ..strokeWidth = 4.0
      ..style = PaintingStyle.stroke
      ..strokeCap = StrokeCap.round
      ..strokeJoin = StrokeJoin.round;
    canvas.drawPath(path, activeRoutePaint);
  }

  void _drawWaypoints(Canvas canvas, Size size) {
    final nodes = RoadNetwork.nodes.values;
    for (final node in nodes) {
      final offset = _geoToCanvas(node.location, size);
      final isHospital = node.nodeId.contains('Hospital');
      final isPickup = node.nodeId == 'Node 24';

      final paint = Paint()
        ..color = isHospital
            ? AppColors.hospitalBadge
            : isPickup
                ? AppColors.emergencyRed
                : const Color(0xFF475569)
        ..style = PaintingStyle.fill;

      canvas.drawCircle(offset, isHospital || isPickup ? 7 : 4, paint);

      // Label
      final textSpan = TextSpan(
        text: node.nodeId,
        style: TextStyle(
          color: isHospital || isPickup ? Colors.white : AppColors.textMuted,
          fontSize: 9,
          fontWeight: isHospital || isPickup ? FontWeight.w800 : FontWeight.w500,
        ),
      );
      final textPainter = TextPainter(
        text: textSpan,
        textDirection: TextDirection.ltr,
      )..layout();

      textPainter.paint(
        canvas,
        Offset(offset.dx - (textPainter.width / 2), offset.dy + 8),
      );
    }
  }

  void _drawAmbulanceMarker(Canvas canvas, Size size) {
    if (currentLocation == null) return;

    final pos = _geoToCanvas(
      GeoPoint(currentLocation!.latitude, currentLocation!.longitude),
      size,
    );

    // Pulse aura
    final auraPaint = Paint()
      ..color = AppColors.emergencyRed.withValues(alpha: 0.25)
      ..style = PaintingStyle.fill;
    canvas.drawCircle(pos, 18, auraPaint);

    // Inner marker
    final markerPaint = Paint()
      ..color = AppColors.emergencyRed
      ..style = PaintingStyle.fill;
    canvas.drawCircle(pos, 9, markerPaint);

    // Direction arrow
    final angle = (currentLocation!.heading * math.pi / 180);
    final arrowPaint = Paint()
      ..color = Colors.white
      ..strokeWidth = 2.0
      ..style = PaintingStyle.stroke
      ..strokeCap = StrokeCap.round;

    final arrowLength = 14.0;
    final tip = Offset(
      pos.dx + arrowLength * math.sin(angle),
      pos.dy - arrowLength * math.cos(angle),
    );
    canvas.drawLine(pos, tip, arrowPaint);

    // Speed badge above ambulance
    final badgeSpan = TextSpan(
      text: 'AMB-003 • ${currentLocation!.speed.round()} km/h',
      style: const TextStyle(
        color: Colors.white,
        fontSize: 9,
        fontWeight: FontWeight.w700,
        backgroundColor: Color(0xDD1E293B),
      ),
    );
    final textPainter = TextPainter(
      text: badgeSpan,
      textDirection: TextDirection.ltr,
    )..layout();

    textPainter.paint(
      canvas,
      Offset(pos.dx - (textPainter.width / 2), pos.dy - 24),
    );
  }

  @override
  bool shouldRepaint(covariant _TacticalMapPainter oldDelegate) => true;
}
