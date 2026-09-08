/// Utilities for coordinate display and distance calculation.
class LocationFormatter {
  LocationFormatter._();

  static String formatCoordinates(double? lat, double? lng) {
    if (lat == null || lng == null) return 'Coordinates unavailable';
    return '${lat.toStringAsFixed(5)}, ${lng.toStringAsFixed(5)}';
  }

  static String formatAccuracy(double? accuracyMeters) {
    if (accuracyMeters == null || accuracyMeters <= 0) return 'Accuracy unavailable';
    if (accuracyMeters < 1000) {
      return '±${accuracyMeters.toStringAsFixed(1)} m';
    }
    return '±${(accuracyMeters / 1000).toStringAsFixed(2)} km';
  }

  static String formatDistance(double meters) {
    if (meters < 1000) {
      return '${meters.toStringAsFixed(0)} m';
    }
    return '${(meters / 1000).toStringAsFixed(1)} km';
  }
}
