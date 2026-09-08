import 'dart:math' as math;
import 'package:flutter/material.dart';
import '../../../core/constants/map_constants.dart';
import '../../../core/theme/app_colors.dart';
import '../../../domain/entities/location_data.dart';

import '../../../domain/entities/nearby_poi.dart';

/// Non-web & Desktop / Test canvas implementation of OpenFreeMap.
/// Provides rich vector-styled map rendering, interactive pin placement,
/// and live telemetry ambulance tracking.
class PlatformOpenFreeMapView extends StatefulWidget {
  final LocationData? incidentLocation;
  final LocationData? ambulanceLocation;
  final double? heading;
  final String? ambulanceId;
  final List<LocationData>? routeWaypoints;
  final List<NearbyHospital>? nearbyHospitals;
  final List<NearbyAmbulance>? nearbyAmbulances;
  final OpenFreeMapStyle style;
  final bool isPickerMode;
  final bool showSearchRadar;
  final int recenterTrigger;
  final ValueChanged<LocationData>? onLocationPicked;

  const PlatformOpenFreeMapView({
    super.key,
    this.incidentLocation,
    this.ambulanceLocation,
    this.heading,
    this.ambulanceId,
    this.routeWaypoints,
    this.nearbyHospitals,
    this.nearbyAmbulances,
    this.style = OpenFreeMapStyle.bright,
    this.isPickerMode = false,
    this.showSearchRadar = false,
    this.recenterTrigger = 0,
    this.onLocationPicked,
  });

  static void suppressClicks([int ms = 600]) {}

  @override
  State<PlatformOpenFreeMapView> createState() => _PlatformOpenFreeMapViewState();
}

class _PlatformOpenFreeMapViewState extends State<PlatformOpenFreeMapView>
    with SingleTickerProviderStateMixin {
  late AnimationController _pulseController;
  static const double _viewportDegrees = 0.008;

  @override
  void initState() {
    super.initState();
    _pulseController = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 1800),
    )..repeat();
  }

  @override
  void dispose() {
    _pulseController.dispose();
    super.dispose();
  }

  Color _getMapBaseColor(OpenFreeMapStyle style) {
    switch (style) {
      case OpenFreeMapStyle.dark:
        return const Color(0xFF1E293B);
      case OpenFreeMapStyle.fiord:
        return const Color(0xFF2C3E50);
      case OpenFreeMapStyle.positron:
        return const Color(0xFFF8FAFC);
      case OpenFreeMapStyle.liberty:
        return const Color(0xFFEDE9E3);
      case OpenFreeMapStyle.bright:
      case OpenFreeMapStyle.threeD:
        return const Color(0xFFE5E3DF);
    }
  }

  Color _getGridLineColor(OpenFreeMapStyle style) {
    switch (style) {
      case OpenFreeMapStyle.dark:
      case OpenFreeMapStyle.fiord:
        return Colors.white.withValues(alpha: 0.08);
      case OpenFreeMapStyle.positron:
        return Colors.black.withValues(alpha: 0.04);
      case OpenFreeMapStyle.bright:
      case OpenFreeMapStyle.liberty:
      case OpenFreeMapStyle.threeD:
        return Colors.black.withValues(alpha: 0.06);
    }
  }

  Offset _project(double lat, double lng, Size size) {
    final centerLat = widget.incidentLocation?.latitude ?? MapConstants.defaultLatitude;
    final centerLng = widget.incidentLocation?.longitude ?? MapConstants.defaultLongitude;
    final dx = (lng - centerLng) * (size.width / _viewportDegrees);
    final dy = -(lat - centerLat) * (size.height / _viewportDegrees);
    return Offset(size.width / 2 + dx, size.height / 2 + dy);
  }

  void _handleTap(TapDownDetails details, Size size) {
    if (!widget.isPickerMode || widget.onLocationPicked == null) return;

    final centerLat = widget.incidentLocation?.latitude ?? MapConstants.defaultLatitude;
    final centerLng = widget.incidentLocation?.longitude ?? MapConstants.defaultLongitude;

    final dx = details.localPosition.dx - (size.width / 2);
    final dy = details.localPosition.dy - (size.height / 2);

    final deltaLng = (dx / size.width) * _viewportDegrees;
    final deltaLat = -(dy / size.height) * _viewportDegrees;

    widget.onLocationPicked!(
      LocationData(
        latitude: centerLat + deltaLat,
        longitude: centerLng + deltaLng,
        timestamp: DateTime.now(),
        isManualOverride: true,
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final baseColor = _getMapBaseColor(widget.style);
    final gridColor = _getGridLineColor(widget.style);

    return LayoutBuilder(
      builder: (context, constraints) {
        final size = Size(constraints.maxWidth, constraints.maxHeight);

        return GestureDetector(
          onTapDown: (details) => _handleTap(details, size),
          child: Container(
            width: double.infinity,
            height: double.infinity,
            color: baseColor,
            child: Stack(
              children: [
                CustomPaint(
                  size: size,
                  painter: _VectorGridPainter(
                    gridColor: gridColor,
                    style: widget.style,
                    routePoints: _projectedRoute(size),
                    has3d: widget.style.has3d,
                  ),
                ),
                if (widget.showSearchRadar) _buildSearchRadar(size),
                Center(
                  child: AnimatedBuilder(
                    animation: _pulseController,
                    builder: (context, child) {
                      final scale = 1.0 + (_pulseController.value * 0.8);
                      final opacity = (1.0 - _pulseController.value).clamp(0.0, 1.0);

                      return Stack(
                        alignment: Alignment.center,
                        children: [
                          Transform.scale(
                            scale: scale,
                            child: Container(
                              width: 38,
                              height: 38,
                              decoration: BoxDecoration(
                                shape: BoxShape.circle,
                                color: AppColors.emergencyRed.withValues(alpha: opacity * 0.4),
                              ),
                            ),
                          ),
                          Container(
                            width: 16,
                            height: 16,
                            decoration: BoxDecoration(
                              shape: BoxShape.circle,
                              color: AppColors.emergencyRed,
                              border: Border.all(color: Colors.white, width: 3),
                              boxShadow: [
                                BoxShadow(
                                  color: AppColors.emergencyRed.withValues(alpha: 0.6),
                                  blurRadius: 8,
                                ),
                              ],
                            ),
                          ),
                          Positioned(
                            top: -28,
                            child: Container(
                              padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 2),
                              decoration: BoxDecoration(
                                color: Colors.black87,
                                borderRadius: BorderRadius.circular(10),
                              ),
                              child: Text(
                                widget.isPickerMode ? 'PICKUP POINT' : 'INCIDENT',
                                style: const TextStyle(
                                  color: Colors.white,
                                  fontSize: 9,
                                  fontWeight: FontWeight.w800,
                                  letterSpacing: 0.5,
                                ),
                              ),
                            ),
                          ),
                        ],
                      );
                    },
                  ),
                ),
                if (widget.ambulanceLocation != null) _buildAmbulanceMarker(size),
                Positioned(
                  bottom: 6,
                  left: 8,
                  child: Container(
                    padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                    decoration: BoxDecoration(
                      color: Colors.black.withValues(alpha: 0.5),
                      borderRadius: BorderRadius.circular(4),
                    ),
                    child: Text(
                      'OpenFreeMap (${widget.style.name}) • MapLibre',
                      style: const TextStyle(
                        color: Colors.white70,
                        fontSize: 9,
                        fontWeight: FontWeight.w600,
                      ),
                    ),
                  ),
                ),
              ],
            ),
          ),
        );
      },
    );
  }

  List<Offset> _projectedRoute(Size size) {
    final waypoints = widget.routeWaypoints;
    if (waypoints == null || waypoints.length < 2) return const [];
    return waypoints.map((pt) => _project(pt.latitude, pt.longitude, size)).toList();
  }

  Widget _buildSearchRadar(Size size) {
    const offsets = [
      Offset(0, 0),
      Offset(90, -70),
      Offset(-110, 40),
      Offset(60, 95),
      Offset(-80, -90),
    ];

    return AnimatedBuilder(
      animation: _pulseController,
      builder: (context, child) {
        return Stack(
          children: [
            for (var i = 0; i < offsets.length; i++)
              Positioned(
                left: size.width / 2 + offsets[i].dx - 28,
                top: size.height / 2 + offsets[i].dy - 28,
                child: Transform.scale(
                  scale: 0.7 + ((_pulseController.value + i * 0.15) % 1.0) * 1.4,
                  child: Container(
                    width: 56,
                    height: 56,
                    decoration: BoxDecoration(
                      shape: BoxShape.circle,
                      border: Border.all(
                        color: AppColors.statusSearching.withValues(
                          alpha: (1.0 - ((_pulseController.value + i * 0.15) % 1.0)) * 0.7,
                        ),
                        width: 2,
                      ),
                      color: AppColors.statusSearching.withValues(alpha: 0.08),
                    ),
                  ),
                ),
              ),
          ],
        );
      },
    );
  }

  Widget _buildAmbulanceMarker(Size size) {
    final ambLat = widget.ambulanceLocation!.latitude;
    final ambLng = widget.ambulanceLocation!.longitude;
    final projected = _project(ambLat, ambLng, size);

    final clampedX = projected.dx.clamp(40.0, math.max(40.0, size.width - 40.0));
    final clampedY = projected.dy.clamp(40.0, math.max(40.0, size.height - 40.0));
    final heading = widget.heading ?? 0.0;

    return Positioned(
      left: clampedX - 24,
      top: clampedY - 24,
      child: Column(
        children: [
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
            decoration: BoxDecoration(
              color: const Color(0xFF1E293B),
              borderRadius: BorderRadius.circular(8),
              boxShadow: const [BoxShadow(color: Colors.black38, blurRadius: 4)],
            ),
            child: Text(
              widget.ambulanceId ?? 'AMB',
              style: const TextStyle(color: Colors.white, fontSize: 9, fontWeight: FontWeight.w900),
            ),
          ),
          const SizedBox(height: 2),
          Transform.rotate(
            angle: heading * (math.pi / 180),
            child: Container(
              padding: const EdgeInsets.all(8),
              decoration: BoxDecoration(
                color: AppColors.statusEnRoute,
                shape: BoxShape.circle,
                boxShadow: [
                  BoxShadow(
                    color: AppColors.statusEnRoute.withValues(alpha: 0.5),
                    blurRadius: 10,
                  ),
                ],
              ),
              child: const Icon(
                Icons.navigation_rounded,
                color: Colors.white,
                size: 18,
              ),
            ),
          ),
        ],
      ),
    );
  }
}

class _VectorGridPainter extends CustomPainter {
  final Color gridColor;
  final OpenFreeMapStyle style;
  final List<Offset> routePoints;
  final bool has3d;

  _VectorGridPainter({
    required this.gridColor,
    required this.style,
    required this.routePoints,
    required this.has3d,
  });

  @override
  void paint(Canvas canvas, Size size) {
    final paint = Paint()
      ..color = gridColor
      ..strokeWidth = 1.0;

    const step = 48.0;
    for (double x = 0; x < size.width; x += step) {
      canvas.drawLine(Offset(x, 0), Offset(x, size.height), paint);
    }
    for (double y = 0; y < size.height; y += step) {
      canvas.drawLine(Offset(0, y), Offset(size.width, y), paint);
    }

    final roadPaint = Paint()
      ..color = gridColor.withValues(alpha: (gridColor.a * 2).clamp(0.0, 1.0))
      ..strokeWidth = 3.0;

    canvas.drawLine(Offset(0, size.height * 0.45), Offset(size.width, size.height * 0.55), roadPaint);
    canvas.drawLine(Offset(size.width * 0.35, 0), Offset(size.width * 0.65, size.height), roadPaint);

    if (has3d) {
      final buildingPaint = Paint()..color = const Color(0xFF94A3B8).withValues(alpha: 0.35);
      canvas.drawRRect(
        RRect.fromRectAndRadius(Rect.fromLTWH(size.width * 0.18, size.height * 0.22, 48, 70), const Radius.circular(4)),
        buildingPaint,
      );
      canvas.drawRRect(
        RRect.fromRectAndRadius(Rect.fromLTWH(size.width * 0.72, size.height * 0.58, 36, 90), const Radius.circular(4)),
        buildingPaint,
      );
    }

    if (routePoints.length >= 2) {
      final casingPaint = Paint()
        ..color = const Color(0xFF174EA6)
        ..strokeWidth = 7.5
        ..strokeCap = StrokeCap.round
        ..style = PaintingStyle.stroke;

      final routePaint = Paint()
        ..color = const Color(0xFF4285F4)
        ..strokeWidth = 5.0
        ..strokeCap = StrokeCap.round
        ..style = PaintingStyle.stroke;

      final routePath = Path()..moveTo(routePoints.first.dx, routePoints.first.dy);
      for (var i = 1; i < routePoints.length; i++) {
        routePath.lineTo(routePoints[i].dx, routePoints[i].dy);
      }
      canvas.drawPath(routePath, casingPaint);
      canvas.drawPath(routePath, routePaint);
    }
  }

  @override
  bool shouldRepaint(covariant _VectorGridPainter oldDelegate) {
    return oldDelegate.gridColor != gridColor ||
        oldDelegate.style != style ||
        oldDelegate.has3d != has3d ||
        oldDelegate.routePoints != routePoints;
  }
}
