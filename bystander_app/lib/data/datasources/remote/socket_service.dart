import 'dart:async';
import 'package:flutter/foundation.dart';
import 'package:socket_io_client/socket_io_client.dart' as io;
import '../../../core/constants/api_constants.dart';

/// Representation of a real-time event received from the backend Socket.IO or simulation.
class SocketEvent {
  final String event;
  final Map<String, dynamic> data;
  final DateTime timestamp;

  SocketEvent({
    required this.event,
    required this.data,
    DateTime? timestamp,
  }) : timestamp = timestamp ?? DateTime.now();

  @override
  String toString() => 'SocketEvent(event: $event, data: $data)';
}

/// Service managing Socket.IO connection to http://localhost:4000
/// and listening for real-time dispatch and tracking events.
class SocketService {
  io.Socket? _socket;
  final _eventController = StreamController<SocketEvent>.broadcast();
  final _connectionController = StreamController<bool>.broadcast();
  bool _isConnected = false;
  String? _activeRoom;

  Stream<SocketEvent> get eventStream => _eventController.stream;
  Stream<bool> get connectionStream => _connectionController.stream;
  bool get isConnected => _isConnected;
  String? get activeRoom => _activeRoom;

  bool _loggedConnectError = false;

  /// Connect to Socket.IO backend at http://localhost:4000 with JWT authentication
  void connect({String? token, String? url}) {
    disconnect();
    final socketUrl = url ?? ApiConstants.socketUrl;

    try {
      _socket = io.io(
        socketUrl,
        io.OptionBuilder()
            .setTransports(['websocket', 'polling'])
            .disableAutoConnect()
            .setReconnectionAttempts(5)
            .setReconnectionDelay(2000)
            .setAuth({'token': token ?? ''})
            .build(),
      );

      void log(String msg) {
        if (kDebugMode) debugPrint(msg);
      }

      _socket?.onConnect((_) {
        log('[Socket.IO] Connected to live server');
        _loggedConnectError = false;
        _isConnected = true;
        _connectionController.add(true);
        if (_activeRoom != null) {
          _joinRoom(_activeRoom!);
        }
      });

      _socket?.onDisconnect((reason) {
        log('[Socket.IO] Disconnected: $reason');
        _isConnected = false;
        _connectionController.add(false);
      });

      _socket?.onConnectError((err) {
        if (!_loggedConnectError) {
          log('[Socket.IO] Notice: Backend is not reachable. Operating in offline/simulation mode.');
          _loggedConnectError = true;
        }
        _isConnected = false;
        _connectionController.add(false);
      });

      _socket?.onError((err) {
        if (!_loggedConnectError) {
          log('[Socket.IO] Notice: Backend is not reachable. Operating in offline/simulation mode.');
          _loggedConnectError = true;
        }
      });

      // Register the 10 mandated backend Socket.IO events
      const eventNames = [
        'EMERGENCY_CREATED',
        'AMBULANCE_ASSIGNED',
        'ASSIGNMENT_ACCEPTED',
        'AMBULANCE_LOCATION_UPDATED',
        'ETA_UPDATED',
        'STATUS_UPDATED',
        'FALLBACK_STARTED',
        'AMBULANCE_REASSIGNED',
        'AMBULANCE_ARRIVED',
        'EMERGENCY_COMPLETED',
      ];

      for (final eventName in eventNames) {
        _socket?.on(eventName, (payload) {
          log('[Socket.IO] Received $eventName');
          final Map<String, dynamic> data = payload is Map<String, dynamic>
              ? payload
              : (payload is Map ? Map<String, dynamic>.from(payload) : {'payload': payload});

          _eventController.add(SocketEvent(event: eventName, data: data));
        });
      }

      _socket?.connect();
    } catch (e) {
      if (kDebugMode) debugPrint('[Socket.IO] Initialization failed: $e');
    }
  }

  /// Joins room `emergency:{requestId}` by emitting the backend-expected
  /// `join_emergency` event with the plain requestId as argument.
  /// Backend: socket.on('join_emergency', (requestId) => socket.join(`emergency:${requestId}`))
  void joinEmergencyRoom(String requestId) {
    _activeRoom = requestId;
    _joinRoom(requestId);
  }

  void _joinRoom(String requestId) {
    if (_socket != null && _isConnected) {
      _socket!.emit('join_emergency', requestId);
      if (kDebugMode) debugPrint('[Socket.IO] Emitted join_emergency for room emergency:$requestId');
    }
  }

  /// Leaves room `emergency:{requestId}` by emitting `leave_emergency`.
  /// Backend: socket.on('leave_emergency', (requestId) => socket.leave(`emergency:${requestId}`))
  void leaveEmergencyRoom() {
    if (_socket != null && _isConnected && _activeRoom != null) {
      _socket!.emit('leave_emergency', _activeRoom);
      if (kDebugMode) debugPrint('[Socket.IO] Emitted leave_emergency for room emergency:$_activeRoom');
    }
    _activeRoom = null;
  }

  /// Allows simulated dispatch engine to inject events into the same broadcast stream
  void emitSimulatedEvent(String eventName, Map<String, dynamic> data) {
    _eventController.add(SocketEvent(event: eventName, data: data));
  }

  void disconnect() {
    if (_socket != null) {
      try {
        _socket!.dispose();
      } catch (_) {}
      _socket = null;
    }
    _isConnected = false;
  }

  void dispose() {
    disconnect();
    _eventController.close();
    _connectionController.close();
  }
}
