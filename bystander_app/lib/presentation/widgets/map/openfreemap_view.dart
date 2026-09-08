import 'package:flutter/material.dart';
import '../../../core/constants/map_constants.dart';
import '../../../domain/entities/location_data.dart';
import '../../../domain/entities/nearby_poi.dart';
import 'openfreemap_view_stub.dart'
    if (dart.library.html) 'openfreemap_view_web.dart' as platform_map;

/// Cross-platform OpenFreeMap + MapLibre GL map component for UyirKappan.
class OpenFreeMapView extends StatelessWidget {
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

  const OpenFreeMapView({
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

  static void suppressClicks([int ms = 600]) {
    platform_map.PlatformOpenFreeMapView.suppressClicks(ms);
  }

  @override
  Widget build(BuildContext context) {
    return platform_map.PlatformOpenFreeMapView(
      incidentLocation: incidentLocation,
      ambulanceLocation: ambulanceLocation,
      heading: heading,
      ambulanceId: ambulanceId,
      routeWaypoints: routeWaypoints,
      nearbyHospitals: nearbyHospitals,
      nearbyAmbulances: nearbyAmbulances,
      style: style,
      isPickerMode: isPickerMode,
      showSearchRadar: showSearchRadar,
      recenterTrigger: recenterTrigger,
      onLocationPicked: onLocationPicked,
    );
  }
}
