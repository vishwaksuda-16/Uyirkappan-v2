import '../models/emergency_request_model.dart';
import '../../domain/entities/emergency_type.dart';
import '../../domain/entities/location_data.dart';
import '../../domain/entities/request_status.dart';

/// Abstract contract for Emergency Request data sources (both Mock and Remote).
abstract class EmergencyRequestDataSource {
  Future<EmergencyRequestModel> createEmergencyRequest(EmergencyRequestModel request);
  Future<EmergencyRequestModel> getEmergencyRequest(String requestId);
  Future<RequestStatus> getRequestStatus(String requestId);
  Future<EmergencyRequestModel> cancelEmergencyRequest(String requestId, {String? reason});
  Future<String?> recommendHospitalDestination({
    required EmergencyType emergencyType,
    required int victimCount,
    required LocationData emergencyLocation,
  });
  Stream<EmergencyRequestModel> watchRequestUpdates(String requestId);
}
