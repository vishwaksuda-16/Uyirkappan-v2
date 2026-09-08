import '../../../domain/entities/eta_info.dart';
import '../../../domain/entities/tracking_info.dart';
import '../../../domain/repositories/tracking_repository.dart';
import '../datasources/tracking_datasource.dart';

/// Concrete repository implementation for vehicle telemetry and ETA streams.
class TrackingRepositoryImpl implements TrackingRepository {
  final TrackingDataSource dataSource;

  TrackingRepositoryImpl({required this.dataSource});

  @override
  Future<TrackingInfo?> getTrackingInfo(String requestId) async {
    return await dataSource.getTrackingInfo(requestId);
  }

  @override
  Future<EtaInfo?> getEta(String requestId) async {
    return await dataSource.getEta(requestId);
  }

  @override
  Stream<TrackingInfo> watchTrackingUpdates(String requestId) {
    return dataSource.watchTrackingUpdates(requestId);
  }

  @override
  Stream<EtaInfo> watchEtaUpdates(String requestId) {
    return dataSource.watchEtaUpdates(requestId);
  }
}
