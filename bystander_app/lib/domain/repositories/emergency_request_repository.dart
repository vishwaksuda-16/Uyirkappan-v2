import '../entities/emergency_request.dart';
import '../entities/request_status.dart';

/// Abstract repository interface for Emergency Request operations.
/// Completely isolates UI from backend or mock implementations.
abstract class EmergencyRequestRepository {
  /// Submits a new emergency request.
  Future<EmergencyRequest> submitEmergencyRequest(EmergencyRequest request);

  /// Retrieves the current state of an emergency request by its unique ID.
  Future<EmergencyRequest> getEmergencyRequest(String requestId);

  /// Retrieves the current RequestStatus of an active request.
  Future<RequestStatus> getRequestStatus(String requestId);

  /// Cancels an existing emergency request with an optional reason.
  Future<EmergencyRequest> cancelEmergencyRequest(String requestId, {String? reason});

  /// Subscribes to real-time status and lifecycle updates for a request.
  Stream<EmergencyRequest> watchRequestUpdates(String requestId);

  /// Checks local persistence for an active ongoing emergency request.
  Future<String?> getActivePersistedRequestId();

  /// Clears the active persisted request on completion or cancellation.
  Future<void> clearActivePersistedRequest();

  /// Retrieves past emergency requests from history.
  Future<List<EmergencyRequest>> getPastRequests();
}
