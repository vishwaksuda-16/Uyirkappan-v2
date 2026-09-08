import 'dart:async';
import 'package:flutter/foundation.dart';
import '../../core/constants/app_constants.dart';
import '../../core/errors/failures.dart';
import '../../data/datasources/remote/socket_service.dart';
import '../../domain/entities/emergency_request.dart';
import '../../domain/entities/emergency_type.dart';
import '../../domain/entities/location_data.dart';
import '../../domain/entities/request_status.dart';
import '../../domain/repositories/emergency_request_repository.dart';

enum SubmissionState {
  idle,
  submitting,
  active,
  completed,
  cancelled,
  error,
}

/// Primary Controller managing the emergency reporting workflow, form validation,
/// request submission, real-time lifecycle tracking, and persistent session recovery.
class EmergencyController extends ChangeNotifier {
  final EmergencyRequestRepository repository;
  final SocketService? socketService;

  // Form State
  EmergencyType _selectedType = EmergencyType.accident;
  int _victimCount = AppConstants.defaultVictims;
  String _additionalNotes = '';

  // Active Lifecycle State
  SubmissionState _submissionState = SubmissionState.idle;
  EmergencyRequest? _activeRequest;
  String? _errorMessage;
  int? _lastErrorCode;
  StreamSubscription<EmergencyRequest>? _requestSubscription;
  StreamSubscription<SocketEvent>? _socketEventSubscription;

  // Notifications & Realtime Event Stream
  String? _latestNotification;
  final List<String> _notifications = [];

  // Timers
  DateTime? _t0ClientPressTime;

  EmergencyController({
    required this.repository,
    this.socketService,
  }) {
    _initSocketEvents();
    recoverActiveSession();
  }

  // Getters
  EmergencyType get selectedType => _selectedType;
  int get victimCount => _victimCount;
  String get additionalNotes => _additionalNotes;
  SubmissionState get submissionState => _submissionState;
  EmergencyRequest? get activeRequest => _activeRequest;
  String? get errorMessage => _errorMessage;
  int? get lastErrorCode => _lastErrorCode;
  bool get hasActiveRequest => _activeRequest != null && _activeRequest!.status.isActive;
  String? get latestNotification => _latestNotification;
  List<String> get notifications => List.unmodifiable(_notifications);

  void _initSocketEvents() {
    if (socketService == null) return;
    _socketEventSubscription = socketService!.eventStream.listen((event) {
      _handleSocketEvent(event);
    });
  }

  void _handleSocketEvent(SocketEvent event) {
    String notif = '';
    switch (event.event) {
      case 'EMERGENCY_CREATED':
        final reqId = event.data['requestId'] ?? _activeRequest?.requestId ?? '';
        notif = 'Emergency created: $reqId';
        break;
      case 'AMBULANCE_ASSIGNED':
        final ambId = event.data['ambulanceId'] ?? event.data['assignedAmbulanceId'] ?? 'AMB';
        final eta = event.data['estimatedETA'] ?? event.data['eta'] ?? event.data['currentETA'] ?? '5';
        notif = 'Ambulance $ambId assigned. ETA: $eta minutes';
        if (_activeRequest != null) {
          final etaNum = (eta is num) ? eta.toInt() : int.tryParse(eta.toString());
          _activeRequest = _activeRequest!.copyWith(
            assignedAmbulanceId: ambId.toString(),
            status: RequestStatus.assigned,
            currentETA: etaNum ?? _activeRequest!.currentETA,
          );
        }
        break;
      case 'ASSIGNMENT_ACCEPTED':
        notif = 'Driver accepted. En route to pickup';
        if (_activeRequest != null) {
          _activeRequest = _activeRequest!.copyWith(
            status: RequestStatus.accepted,
          );
        }
        break;
      case 'AMBULANCE_LOCATION_UPDATED':
        // Silently handled by map tracking
        return;
      case 'ETA_UPDATED':
        final etaMin = event.data['etaMinutes'] ?? event.data['eta'] ?? event.data['currentETA'];
        if (etaMin != null) {
          notif = 'ETA updated: $etaMin minutes';
          if (_activeRequest != null) {
            _activeRequest = _activeRequest!.copyWith(currentETA: (etaMin as num).toInt());
            notifyListeners();
          }
        }
        return;
      case 'STATUS_UPDATED':
        final st = event.data['status'] ?? '';
        notif = 'Status updated: $st';
        if (_activeRequest != null && st.toString().isNotEmpty) {
          _activeRequest = _activeRequest!.copyWith(
            status: RequestStatus.fromCode(st.toString()),
          );
        }
        break;
      case 'FALLBACK_STARTED':
        notif = 'Finding another available ambulance...';
        if (_activeRequest != null) {
          _activeRequest = _activeRequest!.copyWith(
            status: RequestStatus.searching,
            assignedAmbulanceId: null,
            fallbackCount: _activeRequest!.fallbackCount + 1,
          );
        }
        break;
      case 'AMBULANCE_REASSIGNED':
        final ambId = event.data['ambulanceId'] ?? event.data['assignedAmbulanceId'] ?? 'AMB';
        final eta = event.data['estimatedETA'] ?? event.data['eta'] ?? event.data['currentETA'] ?? '4';
        final attempts = event.data['attemptNumber'] ?? event.data['attempts'];
        notif = 'Ambulance reassigned to $ambId. New ETA: $eta minutes';
        if (_activeRequest != null) {
          final etaNum = (eta is num) ? eta.toInt() : int.tryParse(eta.toString());
          final attemptNum = (attempts is num) ? attempts.toInt() : int.tryParse(attempts?.toString() ?? '');
          _activeRequest = _activeRequest!.copyWith(
            assignedAmbulanceId: ambId.toString(),
            status: RequestStatus.assigned,
            currentETA: etaNum ?? _activeRequest!.currentETA,
            fallbackCount: attemptNum != null ? (attemptNum - 1) : (_activeRequest!.fallbackCount + 1),
          );
        }
        break;
      case 'AMBULANCE_ARRIVED':
        notif = 'Ambulance has arrived at your location';
        break;
      case 'EMERGENCY_COMPLETED':
        notif = 'Emergency response completed';
        break;
      default:
        notif = '${event.event}: ${event.data}';
    }

    if (notif.isNotEmpty) {
      _latestNotification = notif;
      _notifications.insert(0, '[${DateTime.now().toIso8601String().substring(11, 19)}] $notif');
      notifyListeners();
    }
  }

  // Form Mutators
  void setEmergencyType(EmergencyType type) {
    _selectedType = type;
    notifyListeners();
  }

  void setVictimCount(int count) {
    if (count >= AppConstants.minVictims && count <= AppConstants.maxVictims) {
      _victimCount = count;
      notifyListeners();
    }
  }

  void incrementVictimCount() {
    if (_victimCount < AppConstants.maxVictims) {
      _victimCount++;
      notifyListeners();
    }
  }

  void decrementVictimCount() {
    if (_victimCount > AppConstants.minVictims) {
      _victimCount--;
      notifyListeners();
    }
  }

  void setAdditionalNotes(String notes) {
    _additionalNotes = notes;
    notifyListeners();
  }

  /// Records client-side T0 timestamp when user presses "Request Ambulance".
  void markT0Timestamp() {
    _t0ClientPressTime = DateTime.now();
  }

  /// Validates input and submits the emergency request through the repository.
  Future<bool> submitEmergencyRequest({
    required LocationData emergencyLocation,
    LocationData? requesterLocation,
    String? requesterId,
  }) async {
    // 1. Validation
    if (_victimCount < AppConstants.minVictims) {
      _errorMessage = 'Victim count must be at least ${AppConstants.minVictims}';
      notifyListeners();
      return false;
    }

    _submissionState = SubmissionState.submitting;
    _errorMessage = null;
    _lastErrorCode = null;
    notifyListeners();

    final t0 = _t0ClientPressTime ?? DateTime.now();

    final draft = EmergencyRequest(
      requestId: '',
      requesterId: requesterId ?? '',
      emergencyType: _selectedType,
      victimCount: _victimCount,
      emergencyLocation: emergencyLocation,
      requesterLocation: requesterLocation,
      createdAt: DateTime.now(),
      status: RequestStatus.created,
      additionalNotes: _additionalNotes.isNotEmpty ? _additionalNotes : null,
      t0UserPressed: t0,
    );

    try {
      final created = await repository.submitEmergencyRequest(draft);
      _activeRequest = created;
      _submissionState = SubmissionState.active;
      _subscribeToUpdates(created.requestId);
      _latestNotification = 'Emergency request registered: ${created.requestId}';
      _notifications.insert(0, _latestNotification!);
      notifyListeners();
      return true;
    } on ServerFailure catch (f) {
      _submissionState = SubmissionState.error;
      _errorMessage = f.message;
      _lastErrorCode = f.statusCode;
      notifyListeners();
      return false;
    } on NetworkFailure catch (f) {
      _submissionState = SubmissionState.error;
      _errorMessage = f.message;
      _lastErrorCode = 503;
      notifyListeners();
      return false;
    } catch (e) {
      _submissionState = SubmissionState.error;
      _errorMessage = 'Failed to create emergency request: $e';
      notifyListeners();
      return false;
    }
  }

  /// Recovers an active request from local storage if the app was closed during an emergency.
  Future<void> recoverActiveSession() async {
    try {
      final persistedId = await repository.getActivePersistedRequestId();
      if (persistedId != null && persistedId.isNotEmpty) {
        final existing = await repository.getEmergencyRequest(persistedId);
        if (existing.status.isActive) {
          _activeRequest = existing;
          _submissionState = SubmissionState.active;
          _subscribeToUpdates(persistedId);
          notifyListeners();
        } else {
          await repository.clearActivePersistedRequest();
        }
      }
    } catch (_) {
      await repository.clearActivePersistedRequest();
    }
  }

  /// Cancels the currently active emergency request.
  /// Section 11: Cancel is only allowed when status is SEARCHING, ASSIGNED, DRIVER_ACCEPTED, EN_ROUTE_TO_PATIENT.
  Future<bool> cancelActiveRequest({String? reason}) async {
    if (_activeRequest == null) return false;

    if (!_activeRequest!.status.canCancel) {
      _errorMessage = 'Cannot cancel emergency at stage ${_activeRequest!.status.userMessage}';
      notifyListeners();
      return false;
    }

    try {
      final cancelled = await repository.cancelEmergencyRequest(
        _activeRequest!.requestId,
        reason: reason,
      );
      _activeRequest = cancelled;
      _submissionState = SubmissionState.cancelled;
      _unsubscribe();
      _latestNotification = 'Emergency cancelled';
      _notifications.insert(0, _latestNotification!);
      notifyListeners();
      return true;
    } on ServerFailure catch (f) {
      _errorMessage = f.message;
      _lastErrorCode = f.statusCode;
      notifyListeners();
      return false;
    } catch (e) {
      _errorMessage = 'Failed to cancel request: $e';
      notifyListeners();
      return false;
    }
  }

  /// Fetches past emergency requests from history (Section 13).
  Future<List<EmergencyRequest>> getPastRequests() async {
    try {
      return await repository.getPastRequests();
    } catch (_) {
      return [];
    }
  }

  /// Resets controller state for creating a new emergency request.
  void resetForm() {
    _unsubscribe();
    _submissionState = SubmissionState.idle;
    _activeRequest = null;
    _errorMessage = null;
    _lastErrorCode = null;
    _victimCount = AppConstants.defaultVictims;
    _selectedType = EmergencyType.accident;
    _additionalNotes = '';
    _t0ClientPressTime = null;
    _latestNotification = null;
    notifyListeners();
  }

  void _subscribeToUpdates(String requestId) {
    _unsubscribe();
    _requestSubscription = repository.watchRequestUpdates(requestId).listen(
      (updatedRequest) {
        _activeRequest = updatedRequest;
        if (updatedRequest.status == RequestStatus.completed) {
          _submissionState = SubmissionState.completed;
        } else if (updatedRequest.status == RequestStatus.cancelled) {
          _submissionState = SubmissionState.cancelled;
        }
        notifyListeners();
      },
      onError: (error) {
        // Keep active state on transient stream errors
      },
    );
  }

  void _unsubscribe() {
    _requestSubscription?.cancel();
    _requestSubscription = null;
  }

  void clearNotification() {
    _latestNotification = null;
    notifyListeners();
  }

  void clearError() {
    _errorMessage = null;
    _lastErrorCode = null;
    notifyListeners();
  }

  @override
  void dispose() {
    _unsubscribe();
    _socketEventSubscription?.cancel();
    super.dispose();
  }
}
