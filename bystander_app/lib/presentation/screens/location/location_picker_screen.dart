import 'package:flutter/material.dart';
import '../../../core/constants/map_constants.dart';
import '../../../core/theme/app_colors.dart';
import '../../../core/utils/location_formatter.dart';
import '../../../domain/entities/location_data.dart';
import '../../controllers/location_controller.dart';
import '../../widgets/map/map_style_selector.dart';
import '../../widgets/map/openfreemap_view.dart';

/// Clean, full-bleed Location Picker powered by OpenFreeMap vector tiles.
/// Bystanders can tap anywhere on the map, select landmarks, or fine-tune their incident position.
class LocationPickerScreen extends StatefulWidget {
  final LocationController locationController;

  const LocationPickerScreen({
    super.key,
    required this.locationController,
  });

  @override
  State<LocationPickerScreen> createState() => _LocationPickerScreenState();
}

class _LocationPickerScreenState extends State<LocationPickerScreen> {
  late double _selectedLat;
  late double _selectedLng;
  final TextEditingController _landmarkController = TextEditingController();
  OpenFreeMapStyle _selectedMapStyle = OpenFreeMapStyle.bright;

  // Preset Chennai emergency landmarks
  static const List<Map<String, dynamic>> _presets = [
    {'name': 'Chennai Central', 'lat': 13.0827, 'lng': 80.2707},
    {'name': 'Anna Nagar', 'lat': 13.0850, 'lng': 80.2100},
    {'name': 'T. Nagar', 'lat': 13.0418, 'lng': 80.2341},
    {'name': 'Guindy / Airport', 'lat': 13.0067, 'lng': 80.2025},
    {'name': 'Marina Beach', 'lat': 13.0500, 'lng': 80.2824},
  ];

  @override
  void initState() {
    super.initState();
    final currentLoc = widget.locationController.emergencyLocation;
    _selectedLat = currentLoc?.latitude ?? MapConstants.defaultLatitude;
    _selectedLng = currentLoc?.longitude ?? MapConstants.defaultLongitude;
  }

  @override
  void dispose() {
    _landmarkController.dispose();
    super.dispose();
  }

  void _selectPreset(String name, double lat, double lng) {
    setState(() {
      _selectedLat = lat;
      _selectedLng = lng;
      _landmarkController.text = name;
    });
  }

  void _adjustCoordinates(double latDelta, double lngDelta) {
    setState(() {
      _selectedLat += latDelta;
      _selectedLng += lngDelta;
    });
  }

  void _resetToDeviceGPS() {
    final deviceLoc = widget.locationController.deviceLocation;
    if (deviceLoc != null) {
      setState(() {
        _selectedLat = deviceLoc.latitude;
        _selectedLng = deviceLoc.longitude;
      });
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Text('Re-centered to detected GPS position'),
          duration: Duration(seconds: 2),
        ),
      );
    }
  }

  void _confirmLocation() {
    widget.locationController.setManualEmergencyLocation(
      latitude: _selectedLat,
      longitude: _selectedLng,
      address: _landmarkController.text.trim().isNotEmpty
          ? _landmarkController.text.trim()
          : 'Near Pinpoint Marker (${_selectedLat.toStringAsFixed(4)}, ${_selectedLng.toStringAsFixed(4)})',
    );

    ScaffoldMessenger.of(context).showSnackBar(
      const SnackBar(
        content: Text('Emergency pickup location updated'),
        backgroundColor: AppColors.success,
        duration: Duration(seconds: 2),
      ),
    );

    Navigator.pop(context);
  }

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final isDark = theme.brightness == Brightness.dark;

    return Scaffold(
      body: Stack(
        children: [
          // 1. Full-Bleed OpenFreeMap MapLibre Canvas
          Positioned.fill(
            child: OpenFreeMapView(
              incidentLocation: LocationData(
                latitude: _selectedLat,
                longitude: _selectedLng,
                timestamp: DateTime.now(),
                isManualOverride: true,
              ),
              style: _selectedMapStyle,
              isPickerMode: true,
              onLocationPicked: (newLoc) {
                setState(() {
                  _selectedLat = newLoc.latitude;
                  _selectedLng = newLoc.longitude;
                });
              },
            ),
          ),

          // 2. Top Floating Navigation & Preset Bar
          Positioned(
            top: 0,
            left: 0,
            right: 0,
            child: SafeArea(
              child: Center(
                child: ConstrainedBox(
                  constraints: const BoxConstraints(maxWidth: 540),
                  child: Padding(
                    padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 8),
                    child: Column(
                      mainAxisSize: MainAxisSize.min,
                      children: [
                    // Top Bar (Back button, Title, and Style Selector)
                    Container(
                      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 6),
                      decoration: BoxDecoration(
                        color: isDark ? const Color(0xFF1E293B).withValues(alpha: 0.95) : Colors.white.withValues(alpha: 0.95),
                        borderRadius: BorderRadius.circular(20),
                        boxShadow: [
                          BoxShadow(
                            color: Colors.black.withValues(alpha: 0.12),
                            blurRadius: 14,
                            offset: const Offset(0, 4),
                          ),
                        ],
                      ),
                      child: Row(
                        children: [
                          IconButton(
                            icon: const Icon(Icons.arrow_back_rounded),
                            onPressed: () => Navigator.pop(context),
                            tooltip: 'Back',
                            visualDensity: VisualDensity.compact,
                          ),
                          const SizedBox(width: 6),
                          Expanded(
                            child: Column(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              mainAxisSize: MainAxisSize.min,
                              children: [
                                const Text(
                                  'PINPOINT INCIDENT',
                                  style: TextStyle(
                                    fontSize: 13,
                                    fontWeight: FontWeight.w900,
                                    letterSpacing: 0.5,
                                    color: AppColors.emergencyRed,
                                  ),
                                ),
                                Text(
                                  'Tap map to position ambulance pickup',
                                  style: TextStyle(
                                    fontSize: 11,
                                    color: isDark ? Colors.white70 : Colors.black54,
                                    fontWeight: FontWeight.w500,
                                  ),
                                  maxLines: 1,
                                  overflow: TextOverflow.ellipsis,
                                ),
                              ],
                            ),
                          ),
                          IconButton(
                            icon: const Icon(Icons.my_location_rounded, color: AppColors.emergencyRed, size: 20),
                            tooltip: 'Center on detected GPS',
                            visualDensity: VisualDensity.compact,
                            onPressed: _resetToDeviceGPS,
                          ),
                        ],
                      ),
                    ),

                    const SizedBox(height: 8),

                    // Map Style Selector on its own horizontal row
                    MapStyleSelector(
                      currentStyle: _selectedMapStyle,
                      onStyleSelected: (style) {
                        setState(() => _selectedMapStyle = style);
                      },
                    ),

                    const SizedBox(height: 8),

                    // Quick Landmark Preset Chips
                    SizedBox(
                      height: 36,
                      child: ListView.builder(
                        scrollDirection: Axis.horizontal,
                        itemCount: _presets.length,
                        itemBuilder: (context, index) {
                          final preset = _presets[index];
                          final name = preset['name'] as String;
                          final lat = preset['lat'] as double;
                          final lng = preset['lng'] as double;
                          final isSelected = (_selectedLat - lat).abs() < 0.005 && (_selectedLng - lng).abs() < 0.005;

                          return Padding(
                            padding: const EdgeInsets.only(right: 8),
                            child: InkWell(
                              onTap: () => _selectPreset(name, lat, lng),
                              borderRadius: BorderRadius.circular(18),
                              child: AnimatedContainer(
                                duration: const Duration(milliseconds: 200),
                                padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
                                decoration: BoxDecoration(
                                  color: isSelected
                                      ? AppColors.emergencyRed
                                      : (isDark ? const Color(0xFF1E293B).withValues(alpha: 0.9) : Colors.white.withValues(alpha: 0.9)),
                                  borderRadius: BorderRadius.circular(18),
                                  border: Border.all(
                                    color: isSelected ? AppColors.emergencyRed : Colors.black.withValues(alpha: 0.08),
                                  ),
                                  boxShadow: [
                                    BoxShadow(
                                      color: Colors.black.withValues(alpha: 0.08),
                                      blurRadius: 6,
                                      offset: const Offset(0, 2),
                                    ),
                                  ],
                                ),
                                child: Row(
                                  mainAxisSize: MainAxisSize.min,
                                  children: [
                                    Icon(
                                      Icons.location_on_rounded,
                                      size: 14,
                                      color: isSelected ? Colors.white : AppColors.emergencyRed,
                                    ),
                                    const SizedBox(width: 6),
                                    Text(
                                      name,
                                      style: TextStyle(
                                        color: isSelected ? Colors.white : (isDark ? Colors.white : Colors.black87),
                                        fontSize: 11,
                                        fontWeight: isSelected ? FontWeight.w800 : FontWeight.w600,
                                      ),
                                    ),
                                  ],
                                ),
                              ),
                            ),
                          );
                        },
                      ),
                    ),
                  ],
                ),
              ),
            ),
          ),
        ),
      ),

          // 3. Floating Right-Side Controls (GPS Re-center & Micro-adjusters)
          Positioned(
            right: 14,
            bottom: 210,
            child: Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                // GPS Re-center FAB
                FloatingActionButton.small(
                  heroTag: 'recenter_gps',
                  onPressed: _resetToDeviceGPS,
                  backgroundColor: Colors.white,
                  foregroundColor: AppColors.emergencyDarkRed,
                  elevation: 4,
                  tooltip: 'Snap to Detected GPS',
                  child: const Icon(Icons.my_location_rounded, size: 20),
                ),
                const SizedBox(height: 10),
                // Micro-nudge coordinate buttons
                Container(
                  decoration: BoxDecoration(
                    color: Colors.white,
                    borderRadius: BorderRadius.circular(20),
                    boxShadow: [
                      BoxShadow(
                        color: Colors.black.withValues(alpha: 0.12),
                        blurRadius: 8,
                        offset: const Offset(0, 2),
                      ),
                    ],
                  ),
                  child: Column(
                    children: [
                      IconButton(
                        icon: const Icon(Icons.keyboard_arrow_up_rounded),
                        visualDensity: VisualDensity.compact,
                        color: Colors.black87,
                        tooltip: 'Nudge North',
                        onPressed: () => _adjustCoordinates(0.001, 0),
                      ),
                      const Divider(height: 1, thickness: 1),
                      IconButton(
                        icon: const Icon(Icons.keyboard_arrow_down_rounded),
                        visualDensity: VisualDensity.compact,
                        color: Colors.black87,
                        tooltip: 'Nudge South',
                        onPressed: () => _adjustCoordinates(-0.001, 0),
                      ),
                    ],
                  ),
                ),
              ],
            ),
          ),

          // 4. Bottom Confirmation Floating Panel
          Positioned(
            left: 0,
            right: 0,
            bottom: 14,
            child: SafeArea(
              top: false,
              child: Center(
                child: ConstrainedBox(
                  constraints: const BoxConstraints(maxWidth: 540),
                  child: Padding(
                    padding: const EdgeInsets.symmetric(horizontal: 14),
                    child: Container(
                      padding: const EdgeInsets.all(18),
                decoration: BoxDecoration(
                  color: isDark ? const Color(0xFF1E293B) : Colors.white,
                  borderRadius: BorderRadius.circular(24),
                  boxShadow: [
                    BoxShadow(
                      color: Colors.black.withValues(alpha: 0.18),
                      blurRadius: 24,
                      offset: const Offset(0, 6),
                    ),
                  ],
                ),
                child: Column(
                  mainAxisSize: MainAxisSize.min,
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Row(
                      mainAxisAlignment: MainAxisAlignment.spaceBetween,
                      children: [
                        Row(
                          children: [
                            Container(
                              padding: const EdgeInsets.all(6),
                              decoration: BoxDecoration(
                                color: AppColors.emergencyRed.withValues(alpha: 0.12),
                                shape: BoxShape.circle,
                              ),
                              child: const Icon(
                                Icons.pin_drop_rounded,
                                color: AppColors.emergencyRed,
                                size: 16,
                              ),
                            ),
                            const SizedBox(width: 8),
                            const Text(
                              'PICKUP TARGET',
                              style: TextStyle(
                                fontSize: 11,
                                fontWeight: FontWeight.w800,
                                letterSpacing: 0.6,
                                color: AppColors.textSecondaryLight,
                              ),
                            ),
                          ],
                        ),
                        Container(
                          padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                          decoration: BoxDecoration(
                            color: Colors.black.withValues(alpha: 0.05),
                            borderRadius: BorderRadius.circular(8),
                          ),
                          child: Text(
                            LocationFormatter.formatCoordinates(_selectedLat, _selectedLng),
                            style: const TextStyle(
                              fontSize: 12,
                              fontWeight: FontWeight.w800,
                              fontFamily: 'monospace',
                            ),
                          ),
                        ),
                      ],
                    ),
                    const SizedBox(height: 12),
                    TextField(
                      controller: _landmarkController,
                      style: const TextStyle(fontSize: 14),
                      decoration: InputDecoration(
                        hintText: 'Add floor / gate / building landmark...',
                        hintStyle: TextStyle(
                          color: isDark ? Colors.white38 : Colors.black38,
                          fontSize: 13,
                        ),
                        prefixIcon: const Icon(Icons.edit_road_rounded, size: 20, color: AppColors.emergencyRed),
                        filled: true,
                        fillColor: isDark ? const Color(0xFF0F172A) : Colors.grey.shade100,
                        border: OutlineInputBorder(
                          borderRadius: BorderRadius.circular(14),
                          borderSide: BorderSide.none,
                        ),
                        contentPadding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
                      ),
                    ),
                    const SizedBox(height: 14),
                    SizedBox(
                      width: double.infinity,
                      height: 50,
                      child: ElevatedButton.icon(
                        onPressed: _confirmLocation,
                        icon: const Icon(Icons.check_circle_rounded, size: 20),
                        label: const Text(
                          'CONFIRM EMERGENCY LOCATION',
                          style: TextStyle(fontSize: 14, fontWeight: FontWeight.w800, letterSpacing: 0.5),
                        ),
                        style: ElevatedButton.styleFrom(
                          backgroundColor: AppColors.emergencyRed,
                          foregroundColor: Colors.white,
                          shape: RoundedRectangleBorder(
                            borderRadius: BorderRadius.circular(16),
                          ),
                          elevation: 3,
                        ),
                      ),
                    ),
                  ],
                ),
              ),
            ),
          ),
        ),
      ),
    ),
        ],
      ),
    );
  }
}
