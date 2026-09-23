import 'dart:async';
import '../../models/assignment.dart';
import '../../models/hospital.dart';
import '../../models/location_model.dart';
import '../../models/route_model.dart';
import '../../models/state_enums.dart';

abstract class SocketService {
  ConnectionStatus get connectionStatus;
  Stream<ConnectionStatus> get connectionStatusStream;

  // Incoming event streams
  Stream<Assignment> get onAssignmentReceived;
  Stream<String> get onAssignmentCancelled;
  Stream<int> get onEtaUpdated;
  Stream<RouteModel> get onRouteUpdated;
  Stream<Hospital> get onHospitalAssigned;
  Stream<Map<String, dynamic>> get onDemoAssignmentCreated;

  // Lifecycle
  Future<void> connect();
  Future<void> disconnect();

  // Outgoing emissions
  void emitLocationUpdate(AmbulanceLocation location);
  void emitStatusUpdate(String ambulanceId, DriverLifecycleState status);
  void emitAssignmentResponse(String assignmentId, String response);
}
