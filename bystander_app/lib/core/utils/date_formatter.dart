import 'package:intl/intl.dart';

/// Utilities for formatting timestamps, durations, and metrics.
class DateFormatter {
  DateFormatter._();

  static final DateFormat _timeFormat = DateFormat('hh:mm:ss a');
  static final DateFormat _dateTimeFormat = DateFormat('dd MMM yyyy, hh:mm a');

  static String formatTime(DateTime? dateTime) {
    if (dateTime == null) return '--:--:--';
    return _timeFormat.format(dateTime.toLocal());
  }

  static String formatDateTime(DateTime? dateTime) {
    if (dateTime == null) return '--';
    return _dateTimeFormat.format(dateTime.toLocal());
  }

  static String formatDuration(Duration duration) {
    final minutes = duration.inMinutes;
    final seconds = duration.inSeconds % 60;
    if (minutes > 0) {
      return '$minutes min ${seconds > 0 ? '$seconds sec' : ''}';
    }
    return '$seconds sec';
  }

  static String formatElapsedSeconds(int seconds) {
    final min = seconds ~/ 60;
    final sec = seconds % 60;
    final minStr = min.toString().padLeft(2, '0');
    final secStr = sec.toString().padLeft(2, '0');
    return '$minStr:$secStr';
  }
}
