import '../models/eta_model.dart';
import '../models/tracking_model.dart';

/// Abstract contract for Tracking telemetry data sources (both Mock and Remote).
abstract class TrackingDataSource {
  Future<TrackingModel?> getTrackingInfo(String requestId);
  Future<EtaModel?> getEta(String requestId);
  Stream<TrackingModel> watchTrackingUpdates(String requestId);
  Stream<EtaModel> watchEtaUpdates(String requestId);
}
