import 'dart:async';
import 'package:flutter/foundation.dart';
import '../../models/emergency_request_model.dart';
import '../../models/eta_model.dart';
import '../../models/tracking_model.dart';
import '../../../domain/entities/request_status.dart';
import '../emergency_request_datasource.dart';
import '../mock/mock_emergency_request_datasource.dart';
import '../mock/mock_tracking_datasource.dart';
import '../remote/remote_emergency_request_datasource.dart';
import '../remote/remote_tracking_datasource.dart';
import '../tracking_datasource.dart';

/// Global notifier toggling between Live Backend mode
/// and Local Simulation mode (defaults to true for production live backend).
final ValueNotifier<bool> useRemoteBackendNotifier = ValueNotifier<bool>(
  const bool.fromEnvironment('USE_REMOTE_BACKEND', defaultValue: true),
);

/// Adaptive EmergencyRequestDataSource that dynamically switches between
/// real backend REST endpoints and offline/simulation mode while maintaining identical schema.
class AdaptiveEmergencyRequestDataSource implements EmergencyRequestDataSource {
  final RemoteEmergencyRequestDataSource remoteDataSource;
  final MockEmergencyRequestDataSource mockDataSource;
  final ValueNotifier<bool> useRemoteNotifier;

  AdaptiveEmergencyRequestDataSource({
    required this.remoteDataSource,
    required this.mockDataSource,
    required this.useRemoteNotifier,
  });

  @override
  Future<EmergencyRequestModel> createEmergencyRequest(EmergencyRequestModel request) async {
    if (useRemoteNotifier.value) {
      try {
        return await remoteDataSource.createEmergencyRequest(request);
      } catch (e) {
        if (kDebugMode) {
          debugPrint('[AdaptiveDataSource] Remote submission error: $e. Falling back to simulation.');
        }
        return await mockDataSource.createEmergencyRequest(request);
      }
    }
    return await mockDataSource.createEmergencyRequest(request);
  }

  @override
  Future<EmergencyRequestModel> getEmergencyRequest(String requestId) async {
    if (useRemoteNotifier.value) {
      try {
        return await remoteDataSource.getEmergencyRequest(requestId);
      } catch (_) {
        return await mockDataSource.getEmergencyRequest(requestId);
      }
    }
    return await mockDataSource.getEmergencyRequest(requestId);
  }

  @override
  Future<RequestStatus> getRequestStatus(String requestId) async {
    if (useRemoteNotifier.value) {
      try {
        return await remoteDataSource.getRequestStatus(requestId);
      } catch (_) {
        return await mockDataSource.getRequestStatus(requestId);
      }
    }
    return await mockDataSource.getRequestStatus(requestId);
  }

  @override
  Future<EmergencyRequestModel> cancelEmergencyRequest(String requestId, {String? reason}) async {
    if (useRemoteNotifier.value) {
      try {
        return await remoteDataSource.cancelEmergencyRequest(requestId, reason: reason);
      } catch (_) {
        return await mockDataSource.cancelEmergencyRequest(requestId, reason: reason);
      }
    }
    return await mockDataSource.cancelEmergencyRequest(requestId, reason: reason);
  }

  @override
  Stream<EmergencyRequestModel> watchRequestUpdates(String requestId) {
    if (useRemoteNotifier.value) {
      return remoteDataSource.watchRequestUpdates(requestId);
    }
    return mockDataSource.watchRequestUpdates(requestId);
  }
}

/// Adaptive TrackingDataSource providing live GPS tracking via Socket.IO/REST
/// or local simulated vehicle movement along Chennai road networks.
class AdaptiveTrackingDataSource implements TrackingDataSource {
  final RemoteTrackingDataSource remoteDataSource;
  final MockTrackingDataSource mockDataSource;
  final ValueNotifier<bool> useRemoteNotifier;

  AdaptiveTrackingDataSource({
    required this.remoteDataSource,
    required this.mockDataSource,
    required this.useRemoteNotifier,
  });

  @override
  Future<TrackingModel?> getTrackingInfo(String requestId) async {
    if (useRemoteNotifier.value) {
      try {
        return await remoteDataSource.getTrackingInfo(requestId);
      } catch (_) {
        return await mockDataSource.getTrackingInfo(requestId);
      }
    }
    return await mockDataSource.getTrackingInfo(requestId);
  }

  @override
  Future<EtaModel?> getEta(String requestId) async {
    if (useRemoteNotifier.value) {
      try {
        return await remoteDataSource.getEta(requestId);
      } catch (_) {
        return await mockDataSource.getEta(requestId);
      }
    }
    return await mockDataSource.getEta(requestId);
  }

  @override
  Stream<TrackingModel> watchTrackingUpdates(String requestId) {
    if (useRemoteNotifier.value) {
      return remoteDataSource.watchTrackingUpdates(requestId);
    }
    return mockDataSource.watchTrackingUpdates(requestId);
  }

  @override
  Stream<EtaModel> watchEtaUpdates(String requestId) {
    if (useRemoteNotifier.value) {
      return remoteDataSource.watchEtaUpdates(requestId);
    }
    return mockDataSource.watchEtaUpdates(requestId);
  }
}
