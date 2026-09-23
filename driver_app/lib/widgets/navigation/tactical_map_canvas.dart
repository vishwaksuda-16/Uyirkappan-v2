import 'dart:math' as math;
import 'package:flutter/material.dart';
import '../../core/constants/app_colors.dart';
import '../../core/utils/geo_utils.dart';
import '../../models/location_model.dart';
import '../../models/route_model.dart';

class TacticalMapCanvas extends StatelessWidget {
  final RouteModel? route;
  final RouteModel? alternativeRoute;
  final AmbulanceLocation? currentLocation;
  final String destinationName;
  final bool isEnRouteToHospital;
  final String? ambulanceId;

  const TacticalMapCanvas({
    super.key,
    required this.route,
    this.alternativeRoute,
    required this.currentLocation,
    required this.destinationName,
    this.isEnRouteToHospital = false,
    this.ambulanceId,
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
                  alternativeRoute: alternativeRoute,
                  currentLocation: currentLocation,
                  destinationName: destinationName,
                  isEnRouteToHospital: isEnRouteToHospital,
                  ambulanceId: ambulanceId,
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
    final hasAlt = alternativeRoute != null && alternativeRoute!.waypoints.isNotEmpty;
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
          const SizedBox(width: 10),
          _legendItem(AppColors.tacticalCyan, 'Selected Route'),
          const SizedBox(width: 10),
          if (hasAlt) ...[
            _legendItem(const Color(0xFF64748B), 'Alternative Route'),
            const SizedBox(width: 10),
          ],
          _legendItem(AppColors.hospitalBadge, isEnRouteToHospital ? 'Hospital' : 'Scene'),
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
  final RouteModel? alternativeRoute;
  final AmbulanceLocation? currentLocation;
  final String destinationName;
  final bool isEnRouteToHospital;
  final String? ambulanceId;

  _TacticalMapPainter({
    required this.route,
    this.alternativeRoute,
    required this.currentLocation,
    required this.destinationName,
    required this.isEnRouteToHospital,
    this.ambulanceId,
  });

  double _minLat = 13.04;
  double _maxLat = 13.10;
  double _minLon = 80.22;
  double _maxLon = 80.29;

  void _calculateBounds() {
    double minLat = 999.0;
    double maxLat = -999.0;
    double minLon = 999.0;
    double maxLon = -999.0;
    bool hasPoints = false;

    void includePoint(GeoPoint pt) {
      if (pt.latitude == 0 && pt.longitude == 0) return;
      hasPoints = true;
      if (pt.latitude < minLat) minLat = pt.latitude;
      if (pt.latitude > maxLat) maxLat = pt.latitude;
      if (pt.longitude < minLon) minLon = pt.longitude;
      if (pt.longitude > maxLon) maxLon = pt.longitude;
    }

    if (route != null) {
      for (final wp in route!.waypoints) {
        includePoint(wp.location);
      }
    }
    if (alternativeRoute != null) {
      for (final wp in alternativeRoute!.waypoints) {
        includePoint(wp.location);
      }
    }
    if (currentLocation != null) {
      includePoint(currentLocation!.toGeoPoint);
    }

    if (hasPoints && minLat < maxLat && minLon < maxLon) {
      final latPad = math.max((maxLat - minLat) * 0.15, 0.005);
      final lonPad = math.max((maxLon - minLon) * 0.15, 0.005);
      _minLat = minLat - latPad;
      _maxLat = maxLat + latPad;
      _minLon = minLon - lonPad;
      _maxLon = maxLon + lonPad;
    } else {
      _minLat = 12.95;
      _maxLat = 13.15;
      _minLon = 80.15;
      _maxLon = 80.30;
    }
  }

  Offset _geoToCanvas(GeoPoint point, Size size) {
    final lonSpan = (_maxLon - _minLon) > 0 ? (_maxLon - _minLon) : 0.05;
    final latSpan = (_maxLat - _minLat) > 0 ? (_maxLat - _minLat) : 0.05;
    final xNorm = ((point.longitude - _minLon) / lonSpan).clamp(0.0, 1.0);
    final yNorm = (1.0 - ((point.latitude - _minLat) / latSpan)).clamp(0.0, 1.0);

    const padding = 40.0;
    final drawWidth = size.width - (padding * 2);
    final drawHeight = size.height - (padding * 2);

    return Offset(
      padding + (xNorm * drawWidth),
      padding + (yNorm * drawHeight),
    );
  }

  @override
  void paint(Canvas canvas, Size size) {
    _calculateBounds();
    _drawTacticalGrid(canvas, size);
    _drawAlternativeRoute(canvas, size);
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

  void _drawAlternativeRoute(Canvas canvas, Size size) {
    final alt = alternativeRoute;
    if (alt == null || alt.waypoints.length < 2) return;

    final altPaint = Paint()
      ..color = const Color(0xFF64748B)
      ..strokeWidth = 4.0
      ..style = PaintingStyle.stroke
      ..strokeCap = StrokeCap.round
      ..strokeJoin = StrokeJoin.round;

    final path = Path();
    for (int i = 0; i < alt.waypoints.length; i++) {
      final pt = _geoToCanvas(alt.waypoints[i].location, size);
      if (i == 0) {
        path.moveTo(pt.dx, pt.dy);
      } else {
        path.lineTo(pt.dx, pt.dy);
      }
    }
    canvas.drawPath(path, altPaint);
  }

  void _drawActiveRoute(Canvas canvas, Size size) {
    final waypoints = route?.waypoints;
    if (waypoints == null || waypoints.length < 2) return;

    // Glowing underlay
    final glowPaint = Paint()
      ..color = AppColors.tacticalCyan.withValues(alpha: 0.25)
      ..strokeWidth = 10.0
      ..style = PaintingStyle.stroke
      ..strokeCap = StrokeCap.round
      ..strokeJoin = StrokeJoin.round;

    final path = Path();
    for (int i = 0; i < waypoints.length; i++) {
      final pt = _geoToCanvas(waypoints[i].location, size);
      if (i == 0) {
        path.moveTo(pt.dx, pt.dy);
      } else {
        path.lineTo(pt.dx, pt.dy);
      }
    }
    canvas.drawPath(path, glowPaint);

    // Primary route line
    final activeRoutePaint = Paint()
      ..color = AppColors.tacticalCyan
      ..strokeWidth = 4.0
      ..style = PaintingStyle.stroke
      ..strokeCap = StrokeCap.round
      ..strokeJoin = StrokeJoin.round;
    canvas.drawPath(path, activeRoutePaint);

    // Label on active route
    if (waypoints.length > 2) {
      final midPt = _geoToCanvas(waypoints[waypoints.length ~/ 2].location, size);
      final labelText = route?.routeId != null ? '★ ROUTE ${route!.routeId} (Selected)' : '★ OPTIMAL ROUTE (Selected)';
      final labelSpan = TextSpan(
        text: labelText,
        style: const TextStyle(
          color: Colors.white,
          fontSize: 8,
          fontWeight: FontWeight.w900,
          backgroundColor: Color(0xDD0369A1),
        ),
      );
      final tp = TextPainter(text: labelSpan, textDirection: TextDirection.ltr)..layout();
      tp.paint(canvas, Offset(midPt.dx - tp.width / 2, midPt.dy + 10));
    }
  }

  void _drawWaypoints(Canvas canvas, Size size) {
    final waypoints = route?.waypoints ?? [];
    if (waypoints.isEmpty) return;

    for (int i = 0; i < waypoints.length; i++) {
      final wp = waypoints[i];
      final offset = _geoToCanvas(wp.location, size);
      final isStart = i == 0;
      final isEnd = i == waypoints.length - 1;

      final paint = Paint()
        ..color = isEnd
            ? (isEnRouteToHospital ? AppColors.hospitalBadge : AppColors.emergencyRed)
            : isStart
                ? const Color(0xFF0284C7)
                : const Color(0xFF475569)
        ..style = PaintingStyle.fill;

      canvas.drawCircle(offset, isStart || isEnd ? 7 : 4, paint);

      // Label: show destination/origin name or node name
      final labelText = isEnd
          ? destinationName
          : isStart
              ? (isEnRouteToHospital ? 'Patient Pickup Scene' : 'Ambulance Start')
              : wp.nodeName;

      final textSpan = TextSpan(
        text: labelText,
        style: TextStyle(
          color: isStart || isEnd ? Colors.white : AppColors.textMuted,
          fontSize: 9,
          fontWeight: isStart || isEnd ? FontWeight.w800 : FontWeight.w500,
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

    // Dynamic speed badge above ambulance
    final ambNum = ambulanceId ?? currentLocation?.ambulanceId ?? 'Ambulance';
    final badgeSpan = TextSpan(
      text: '$ambNum • ${currentLocation!.speed.round()} km/h',
      style: const TextStyle(
        color: Colors.white,
        fontSize: 9,
        fontWeight: FontWeight.w800,
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
