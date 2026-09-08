import '../../models/ambulance.dart';
import '../../models/assignment.dart';
import '../../models/driver.dart';
import '../../models/location_model.dart';
import '../../models/route_model.dart';
import '../../models/state_enums.dart';

abstract class ApiService {
  /// POST /api/auth/login
  Future<Driver> login(String identifier, String password);

  /// GET /api/drivers/me
  Future<Driver> getDriverProfile(String driverId);

  /// PATCH /api/ambulances/:id/status
  Future<Ambulance> updateAmbulanceStatus(
    String ambulanceId,
    AmbulanceAvailability availability, {
    DriverLifecycleState? lifecycleState,
  });

  /// GET /api/driver/assignment
  Future<Assignment?> getActiveAssignment();

  /// GET /api/drivers/:id/assignments (legacy/fallback)
  Future<List<Assignment>> getAssignments(String driverId);

  /// POST /api/assignments/:id/accept
  Future<Assignment> acceptAssignment(String assignmentId);

  /// POST /api/assignments/:id/reject
  Future<void> rejectAssignment(String assignmentId, {String? reason});

  /// PATCH /api/assignments/:id/status
  Future<Assignment> updateAssignmentStatus(
    String assignmentId,
    DriverLifecycleState status,
  );

  /// POST /api/ambulances/:id/location
  Future<void> postLocationUpdate(
    String ambulanceId,
    AmbulanceLocation location,
  );

  /// GET /api/assignments/:id/route
  Future<RouteModel> getAssignmentRoute(String assignmentId);
}
