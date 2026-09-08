// ignore_for_file: avoid_web_libraries_in_flutter, deprecated_member_use
import 'dart:async';
import 'dart:html' as html;
import 'dart:js' as js;
import 'dart:ui_web' as ui_web;
import 'package:flutter/material.dart';
import '../../../core/constants/map_constants.dart';
import '../../../domain/entities/location_data.dart';
import '../../../domain/entities/nearby_poi.dart';

/// Web implementation of OpenFreeMap powered by MapLibre GL JS (WebGL).
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

  static DateTime? _suppressUntil;

  static void suppressClicks([int ms = 600]) {
    _suppressUntil = DateTime.now().add(Duration(milliseconds: ms));
    try {
      final value = js.context['uyirkappanMaps'];
      if (value is js.JsObject && value.hasProperty('suppressAllClicks')) {
        value.callMethod('suppressAllClicks', [ms]);
      }
    } catch (_) {}
  }

  @override
  State<PlatformOpenFreeMapView> createState() => _PlatformOpenFreeMapViewState();
}

class _PlatformOpenFreeMapViewState extends State<PlatformOpenFreeMapView> {
  static int _instanceCounter = 0;
  late final String _mapId;
  late final String _viewType;
  html.DivElement? _containerElement;
  bool _isMapInitialized = false;
  StreamSubscription? _eventSub;
  int _initAttempts = 0;

  @override
  void initState() {
    super.initState();
    _instanceCounter++;
    _mapId = 'maplibre-canvas-$_instanceCounter';
    _viewType = 'maplibre-view-$_instanceCounter';

    ui_web.platformViewRegistry.registerViewFactory(
      _viewType,
      (int viewId) {
        final element = html.DivElement()
          ..id = _mapId
          ..style.width = '100%'
          ..style.height = '100%'
          ..style.position = 'relative'
          ..style.overflow = 'hidden';

        _containerElement = element;

        try {
          final jsMaps = js.context['uyirkappanMaps'];
          if (jsMaps != null) {
            jsMaps.callMethod('registerContainer', [_mapId, element]);
          }
        } catch (e) {
          debugPrint('Error registering MapLibre container with JS bridge: $e');
        }

        return element;
      },
    );

    // Listen to CustomEvent from MapLibre JS bridge
    _eventSub = html.window.on['uyirkappan_location_picked_$_mapId'].listen((html.Event event) {
      if (event is html.CustomEvent && event.detail != null) {
        try {
          final jsDetail = js.JsObject.fromBrowserObject(event.detail);
          final lat = jsDetail['lat'];
          final lng = jsDetail['lng'];
          _onJsLocationPicked(lat, lng);
        } catch (e) {
          debugPrint('Error processing picked location: $e');
        }
      }
    });

    WidgetsBinding.instance.addPostFrameCallback((_) {
      _initMapLibre();
    });
  }

  void _onJsLocationPicked(dynamic lat, dynamic lng) {
    if (!widget.isPickerMode) {
      return;
    }
    if (PlatformOpenFreeMapView._suppressUntil != null &&
        DateTime.now().isBefore(PlatformOpenFreeMapView._suppressUntil!)) {
      return;
    }
    if (lat is num && lng is num && widget.onLocationPicked != null) {
      widget.onLocationPicked!(
        LocationData(
          latitude: lat.toDouble(),
          longitude: lng.toDouble(),
          timestamp: DateTime.now(),
          isManualOverride: true,
        ),
      );
    }
  }

  js.JsObject? get _jsMaps {
    final value = js.context['uyirkappanMaps'];
    if (value is js.JsObject) return value;
    return null;
  }

  void _initMapLibre() {
    final jsMaps = _jsMaps;
    if (jsMaps == null) {
      if (_initAttempts < 50 && mounted) {
        _initAttempts++;
        Future.delayed(const Duration(milliseconds: 80), () {
          if (mounted) _initMapLibre();
        });
      }
      return;
    }

    final lat = widget.incidentLocation?.latitude ?? MapConstants.defaultLatitude;
    final lng = widget.incidentLocation?.longitude ?? MapConstants.defaultLongitude;

    if (_containerElement != null) {
      _callJs('registerContainer', [_mapId, _containerElement]);
    }

    _callJs('initMap', [
      _mapId,
      lat,
      lng,
      widget.isPickerMode ? MapConstants.pickerZoom : MapConstants.trackingZoom,
      widget.style.url,
      widget.isPickerMode,
      0,
      widget.style.has3d,
    ]);

    _isMapInitialized = true;
    _syncOverlays();
  }

  void _callJs(String method, List<dynamic> args) {
    try {
      final jsMaps = _jsMaps;
      if (jsMaps != null && jsMaps.hasProperty(method)) {
        jsMaps.callMethod(method, args);
      }
    } catch (e) {
      debugPrint('Warning calling JS method $method on uyirkappanMaps: $e');
    }
  }

  void _syncOverlays() {
    _updateIncident(fly: false);
    _updateNearbyHospitals();
    _updateNearbyAmbulances();
    if (widget.ambulanceLocation != null) {
      _updateAmbulance();
    }
    _updateRoute();
    _updateSearchRadar();
    _fitIfNeeded();
  }

  void _updateIncident({bool fly = true}) {
    if (widget.incidentLocation == null) return;
    _callJs('updateIncidentMarker', [
      _mapId,
      widget.incidentLocation!.latitude,
      widget.incidentLocation!.longitude,
      widget.incidentLocation?.isManualOverride ?? false,
    ]);
    if (fly) {
      _callJs('flyTo', [
        _mapId,
        widget.incidentLocation!.latitude,
        widget.incidentLocation!.longitude,
        widget.isPickerMode ? MapConstants.pickerZoom : MapConstants.trackingZoom,
      ]);
    }
  }

  void _updateNearbyHospitals() {
    final list = widget.nearbyHospitals?.map((h) => h.toJson()).toList() ?? [];
    _callJs('setNearbyHospitals', [_mapId, js.JsObject.jsify(list)]);
  }

  void _updateNearbyAmbulances() {
    final list = widget.nearbyAmbulances?.map((a) => a.toJson()).toList() ?? [];
    _callJs('setNearbyAmbulances', [_mapId, js.JsObject.jsify(list)]);
  }

  void _updateAmbulance() {
    if (widget.ambulanceLocation == null) {
      _callJs('clearAmbulanceMarker', [_mapId]);
      return;
    }
    _callJs('updateAmbulanceMarker', [
      _mapId,
      widget.ambulanceLocation!.latitude,
      widget.ambulanceLocation!.longitude,
      widget.heading ?? 0.0,
      widget.ambulanceId ?? 'AMB',
    ]);
  }

  void _updateRoute() {
    if (widget.routeWaypoints == null || widget.routeWaypoints!.isEmpty) {
      _callJs('clearRoute', [_mapId]);
      return;
    }
    final coords = widget.routeWaypoints!.map((pt) => [pt.longitude, pt.latitude]).toList();
    _callJs('drawRoute', [
      _mapId,
      js.JsObject.jsify(coords),
    ]);
  }

  void _updateSearchRadar() {
    _callJs('setSearchRadar', [_mapId, widget.showSearchRadar]);
  }

  void _updatePickerMode() {
    _callJs('setPickerMode', [_mapId, widget.isPickerMode]);
  }

  void _updateStyle() {
    _callJs('setStyle', [
      _mapId,
      widget.style.url,
      widget.style.has3d,
    ]);
  }

  void _fitIfNeeded() {
    final incident = widget.incidentLocation;
    final ambulance = widget.ambulanceLocation;
    if (incident == null || ambulance == null) return;
    _callJs('fitBounds', [
      _mapId,
      incident.latitude,
      incident.longitude,
      ambulance.latitude,
      ambulance.longitude,
    ]);
  }

  @override
  void didUpdateWidget(PlatformOpenFreeMapView oldWidget) {
    super.didUpdateWidget(oldWidget);

    if (!_isMapInitialized) {
      _initMapLibre();
      return;
    }

    if (oldWidget.isPickerMode != widget.isPickerMode) {
      _updatePickerMode();
    }

    if (oldWidget.style != widget.style) {
      _updateStyle();
    }

    final isRecenter = oldWidget.recenterTrigger != widget.recenterTrigger;
    final isInitial = oldWidget.incidentLocation == null && widget.incidentLocation != null;

    if (oldWidget.incidentLocation?.latitude != widget.incidentLocation?.latitude ||
        oldWidget.incidentLocation?.longitude != widget.incidentLocation?.longitude ||
        isRecenter) {
      _updateIncident(fly: isRecenter || isInitial);
    }

    if (oldWidget.ambulanceLocation != widget.ambulanceLocation ||
        oldWidget.heading != widget.heading ||
        oldWidget.ambulanceId != widget.ambulanceId) {
      _updateAmbulance();
      if (widget.ambulanceLocation != null &&
          oldWidget.ambulanceLocation == null) {
        _fitIfNeeded();
      }
    }

    if (oldWidget.routeWaypoints != widget.routeWaypoints) {
      _updateRoute();
    }

    if (oldWidget.showSearchRadar != widget.showSearchRadar) {
      _updateSearchRadar();
    }

    if (oldWidget.nearbyHospitals != widget.nearbyHospitals) {
      _updateNearbyHospitals();
    }

    if (oldWidget.nearbyAmbulances != widget.nearbyAmbulances) {
      _updateNearbyAmbulances();
    }
  }

  @override
  void dispose() {
    _eventSub?.cancel();
    _callJs('cleanMap', [_mapId]);
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return HtmlElementView(viewType: _viewType);
  }
}
