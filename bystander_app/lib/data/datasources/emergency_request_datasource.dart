import '../models/emergency_request_model.dart';
import '../../domain/entities/request_status.dart';

/// Abstract contract for Emergency Request data sources (both Mock and Remote).
abstract class EmergencyRequestDataSource {
  Future<EmergencyRequestModel> createEmergencyRequest(EmergencyRequestModel request);
  Future<EmergencyRequestModel> getEmergencyRequest(String requestId);
  Future<RequestStatus> getRequestStatus(String requestId);
  Future<EmergencyRequestModel> cancelEmergencyRequest(String requestId, {String? reason});
  Stream<EmergencyRequestModel> watchRequestUpdates(String requestId);
}
