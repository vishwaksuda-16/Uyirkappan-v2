import '../entities/eta_info.dart';
import '../entities/tracking_info.dart';

/// Abstract repository interface for ambulance tracking telemetry.
/// Provides placeholders and stream hooks for future Module 6 WebSocket integration.
abstract class TrackingRepository {
  /// Fetches latest known telemetry for the assigned ambulance.
  Future<TrackingInfo?> getTrackingInfo(String requestId);

  /// Fetches latest ETA estimation for the active emergency.
  Future<EtaInfo?> getEta(String requestId);

  /// Subscribes to live telemetry and location updates of the vehicle.
  Stream<TrackingInfo> watchTrackingUpdates(String requestId);

  /// Subscribes to live ETA updates.
  Stream<EtaInfo> watchEtaUpdates(String requestId);
}
