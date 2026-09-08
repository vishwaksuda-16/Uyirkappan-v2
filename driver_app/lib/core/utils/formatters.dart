class Formatters {
  Formatters._();

  static String formatDistance(double km) {
    if (km < 1.0) {
      final meters = (km * 1000).round();
      return '$meters m';
    }
    return '${km.toStringAsFixed(1)} km';
  }

  static String formatEta(int minutes) {
    if (minutes <= 0) return '< 1 min';
    if (minutes < 10) return '0$minutes min';
    return '$minutes min';
  }

  static String formatSpeed(double speedKmh) {
    return '${speedKmh.round()} km/h';
  }

  static String formatTime(DateTime time) {
    final hour = time.hour.toString().padLeft(2, '0');
    final min = time.minute.toString().padLeft(2, '0');
    final sec = time.second.toString().padLeft(2, '0');
    return '$hour:$min:$sec';
  }
}
