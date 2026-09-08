import 'dart:async';
import '../../../core/errors/exceptions.dart';
import '../../../core/errors/failures.dart';
import '../models/emergency_request_model.dart';
import '../../../domain/entities/emergency_request.dart';
import '../../../domain/entities/request_status.dart';
import '../../../domain/repositories/emergency_request_repository.dart';
import '../datasources/emergency_request_datasource.dart';
import '../datasources/local/request_local_datasource.dart';

/// Concrete repository implementation coordinating between local storage,
/// active data source (Mock or Remote), and domain contracts.
class EmergencyRequestRepositoryImpl implements EmergencyRequestRepository {
  final EmergencyRequestDataSource dataSource;
  final RequestLocalDataSource localDataSource;

  EmergencyRequestRepositoryImpl({
    required this.dataSource,
    required this.localDataSource,
  });

  @override
  Future<EmergencyRequest> submitEmergencyRequest(EmergencyRequest request) async {
    try {
      final model = EmergencyRequestModel.fromEntity(request);
      final created = await dataSource.createEmergencyRequest(model);

      // Persist active request ID locally for state recovery on restart
      await localDataSource.saveActiveRequestId(created.requestId);
      await localDataSource.saveRequestToHistory(created);

      return created;
    } on ServerException catch (e) {
      throw ServerFailure(e.message, e.statusCode, e.code);
    } on NetworkException catch (e) {
      throw NetworkFailure(e.message);
    } catch (e) {
      throw ServerFailure('Unexpected error submitting request: $e');
    }
  }

  @override
  Future<EmergencyRequest> getEmergencyRequest(String requestId) async {
    try {
      return await dataSource.getEmergencyRequest(requestId);
    } on ServerException catch (e) {
      throw ServerFailure(e.message, e.statusCode);
    } on NetworkException catch (e) {
      throw NetworkFailure(e.message);
    } catch (e) {
      throw ServerFailure('Failed to fetch emergency request: $e');
    }
  }

  @override
  Future<RequestStatus> getRequestStatus(String requestId) async {
    try {
      return await dataSource.getRequestStatus(requestId);
    } catch (e) {
      throw ServerFailure('Failed to fetch request status: $e');
    }
  }

  @override
  Future<EmergencyRequest> cancelEmergencyRequest(String requestId, {String? reason}) async {
    try {
      final cancelled = await dataSource.cancelEmergencyRequest(requestId, reason: reason);
      await localDataSource.clearActiveRequestId();
      await localDataSource.saveRequestToHistory(cancelled);
      return cancelled;
    } catch (e) {
      throw ServerFailure('Failed to cancel request: $e');
    }
  }

  @override
  Stream<EmergencyRequest> watchRequestUpdates(String requestId) {
    return dataSource.watchRequestUpdates(requestId).map((model) {
      // Auto-clear persistence if completed
      if (!model.status.isActive) {
        localDataSource.clearActiveRequestId();
      }
      localDataSource.saveRequestToHistory(model);
      return model;
    });
  }

  @override
  Future<String?> getActivePersistedRequestId() async {
    return await localDataSource.getActiveRequestId();
  }

  @override
  Future<void> clearActivePersistedRequest() async {
    await localDataSource.clearActiveRequestId();
  }

  @override
  Future<List<EmergencyRequest>> getPastRequests() async {
    return await localDataSource.getPastRequests();
  }
}
