import 'dart:async';
// ignore: library_prefixes
import 'package:socket_io_client/socket_io_client.dart' as IO;
import '../../core/config/app_config.dart';
import '../../core/storage/local_storage_service.dart';
import '../../models/assignment.dart';
import '../../models/hospital.dart';
import '../../models/location_model.dart';
import '../../models/route_model.dart';
import '../../models/state_enums.dart';
import 'socket_service.dart';

class RealSocketService implements SocketService {
  final AppConfig config;
  final LocalStorageService storage;

  IO.Socket? _socket;
  ConnectionStatus _status = ConnectionStatus.disconnected;

  final _connectionController = StreamController<ConnectionStatus>.broadcast();
  final _assignmentReceivedController = StreamController<Assignment>.broadcast();
  final _assignmentCancelledController = StreamController<String>.broadcast();
  final _etaUpdatedController = StreamController<int>.broadcast();
  final _routeUpdatedController = StreamController<RouteModel>.broadcast();
  final _hospitalAssignedController = StreamController<Hospital>.broadcast();
  final _demoAssignmentController = StreamController<Map<String, dynamic>>.broadcast();

  RealSocketService({
    required this.config,
    required this.storage,
  });

  @override
  ConnectionStatus get connectionStatus => _status;

  @override
  Stream<ConnectionStatus> get connectionStatusStream =>
      _connectionController.stream;

  @override
  Stream<Assignment> get onAssignmentReceived =>
      _assignmentReceivedController.stream;

  @override
  Stream<String> get onAssignmentCancelled =>
      _assignmentCancelledController.stream;

  @override
  Stream<int> get onEtaUpdated => _etaUpdatedController.stream;

  @override
  Stream<RouteModel> get onRouteUpdated => _routeUpdatedController.stream;

  @override
  Stream<Hospital> get onHospitalAssigned =>
      _hospitalAssignedController.stream;

  @override
  Stream<Map<String, dynamic>> get onDemoAssignmentCreated =>
      _demoAssignmentController.stream;

  @override
  Future<void> connect() async {
    final token = await storage.getAuthToken();

    _setStatus(ConnectionStatus.connecting);

    // Clean up existing socket if any
    _socket?.dispose();

    try {
      // Connect pattern: io('http://localhost:5000', { auth: { token: 'JWT' } })
      _socket = IO.io(
        config.socketUrl,
        IO.OptionBuilder()
            .setTransports(['websocket', 'polling'])
            .setAuth({'token': token ?? ''})
            .enableAutoConnect()
            .enableReconnection()
            .setReconnectionDelay(1000)
            .setReconnectionAttempts(9999)
            .build(),
      );

      _setupListeners();
    } catch (_) {
      _setStatus(ConnectionStatus.disconnected);
    }
  }

  void _setupListeners() {
    if (_socket == null) return;

    _socket!.onConnect((_) {
      _setStatus(ConnectionStatus.connected);
      // Rooms are auto-joined by the backend on connection authentication —
      // user:{userId} and driver:{ambulanceId} are created server-side.
      // Do NOT emit 'join' events; the backend does not listen for them.
    });

    _socket!.onReconnect((_) {
      _setStatus(ConnectionStatus.connected);
      // Same as onConnect: no client-side room join needed after reconnect.
    });

    _socket!.onDisconnect((_) {
      _setStatus(ConnectionStatus.disconnected);
    });

    _socket!.onConnectError((_) {
      _setStatus(ConnectionStatus.disconnected);
    });

    // 1. Listen for AMBULANCE_ASSIGNED (and alias ASSIGNMENT_RECEIVED)
    _socket!.on('AMBULANCE_ASSIGNED', (data) {
      _handleIncomingAssignment(data);
    });
    _socket!.on('ASSIGNMENT_RECEIVED', (data) {
      _handleIncomingAssignment(data);
    });

    // 2. Listen for ASSIGNMENT_REJECTED (and alias ASSIGNMENT_CANCELLED)
    _socket!.on('ASSIGNMENT_REJECTED', (data) {
      _handleAssignmentCancelled(data);
    });
    _socket!.on('ASSIGNMENT_CANCELLED', (data) {
      _handleAssignmentCancelled(data);
    });
    _socket!.on('DEMO_RESET', (_) {
      _assignmentCancelledController.add('ALL');
    });
    _socket!.on('SYSTEM_RESET', (_) {
      _assignmentCancelledController.add('ALL');
    });

    // 3. Listen for ETA_UPDATED
    _socket!.on('ETA_UPDATED', (data) {
      _handleEtaUpdated(data);
    });

    // 4. Listen for STATUS_UPDATED
    _socket!.on('STATUS_UPDATED', (data) {
      // Handled for real-time synchronization
    });

    // 5. Additional navigation events
    _socket!.on('ROUTE_UPDATED', (data) {
      if (data is Map<String, dynamic>) {
        try {
          final route = RouteModel.fromJson(data);
          _routeUpdatedController.add(route);
        } catch (_) {}
      }
    });

    _socket!.on('HOSPITAL_ASSIGNED', (data) {
      if (data is Map<String, dynamic>) {
        try {
          final hospital = Hospital.fromJson(data);
          _hospitalAssignedController.add(hospital);
        } catch (_) {}
      }
    });

    // 6. Demo assignment broadcasts for quick-switching
    _socket!.on('DEMO_ASSIGNMENT_CREATED', (data) {
      if (data is Map<String, dynamic>) {
        _demoAssignmentController.add(Map<String, dynamic>.from(data));
      }
    });
    _socket!.on('ASSIGNMENT_CREATED', (data) {
      if (data is Map<String, dynamic>) {
        _demoAssignmentController.add(Map<String, dynamic>.from(data));
      }
    });
  }

  // Removed _joinRooms() — backend auto-joins driver rooms on socket authentication.
  // The server reads the JWT on connect and calls socket.join('user:{id}') and
  // socket.join('driver:{ambulanceId}') itself. No client-side emit is needed.

  void _handleIncomingAssignment(dynamic data) {
    if (data is Map<String, dynamic>) {
      try {
        final assignment = Assignment.fromJson(data);
        _assignmentReceivedController.add(assignment);
      } catch (_) {}
    }
  }

  void _handleAssignmentCancelled(dynamic data) {
    String? requestId;
    if (data is Map<String, dynamic>) {
      requestId = data['requestId'] as String?;
    } else if (data is String) {
      requestId = data;
    }
    if (requestId != null) {
      _assignmentCancelledController.add(requestId);
    }
  }

  void _handleEtaUpdated(dynamic data) {
    int? eta;
    if (data is Map<String, dynamic>) {
      // Backend ETA_UPDATED payload: { requestId, etaMinutes }
      eta = (data['etaMinutes'] as num?)?.toInt() ??
          (data['eta'] as num?)?.toInt() ??
          (data['newEtaMinutes'] as num?)?.toInt() ??
          (data['estimatedETA'] as num?)?.toInt();
    } else if (data is num) {
      eta = data.toInt();
    }
    if (eta != null) {
      _etaUpdatedController.add(eta);
    }
  }

  void _setStatus(ConnectionStatus status) {
    _status = status;
    _connectionController.add(status);
  }

  @override
  Future<void> disconnect() async {
    _socket?.disconnect();
    _socket?.dispose();
    _socket = null;
    _setStatus(ConnectionStatus.disconnected);
  }

  @override
  void emitLocationUpdate(AmbulanceLocation location) {
    if (_socket != null && _socket!.connected) {
      _socket!.emit('location:update', location.toJson());
      _socket!.emit('AMBULANCE_LOCATION_UPDATED', {
        'ambulanceId': location.ambulanceId,
        'location': {
          'latitude': location.latitude,
          'longitude': location.longitude,
        },
        'speed': location.speed,
        'heading': location.heading,
        'requestId': location.requestId,
      });
    }
  }

  @override
  void emitStatusUpdate(String ambulanceId, DriverLifecycleState status) {
    if (_socket != null && _socket!.connected) {
      _socket!.emit('status:update', {
        'ambulanceId': ambulanceId,
        'status': status.displayName,
      });
      _socket!.emit('STATUS_UPDATED', {
        'ambulanceId': ambulanceId,
        'status': status.displayName,
      });
    }
  }

  @override
  void emitAssignmentResponse(String assignmentId, String response) {
    if (_socket != null && _socket!.connected) {
      _socket!.emit('assignment:response', {
        'assignmentId': assignmentId,
        'response': response,
      });
    }
  }

  void dispose() {
    disconnect();
    _connectionController.close();
    _assignmentReceivedController.close();
    _assignmentCancelledController.close();
    _etaUpdatedController.close();
    _routeUpdatedController.close();
    _hospitalAssignedController.close();
  }
}
