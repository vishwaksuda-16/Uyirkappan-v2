import 'dart:async';
import 'package:flutter/foundation.dart';
import '../core/errors/app_exceptions.dart';
import '../models/ambulance.dart';
import '../models/assignment.dart';
import '../models/driver.dart';
import '../models/hospital.dart';
import '../models/state_enums.dart';
import '../repositories/driver_repository.dart';
import 'state_machine.dart';

class DriverState extends ChangeNotifier {
  final DriverRepository _repository;

  AmbulanceAvailability _availability = AmbulanceAvailability.offline;
  DriverLifecycleState _lifecycleState = DriverLifecycleState.offline;
  ConnectionStatus _connectionStatus = ConnectionStatus.disconnected;

  Assignment? _pendingAssignment;
  Assignment? _activeAssignment;
  Ambulance? _currentAmbulance;

  int _todayRequestsCount = 0;
  int _todayCompletedCount = 0;
  String? _feedbackMessage;
  String? _errorMessage;

  StreamSubscription<Assignment>? _assignmentSub;
  StreamSubscription<String>? _cancelledSub;
  StreamSubscription<Hospital>? _hospitalSub;
  StreamSubscription<ConnectionStatus>? _connectionSub;

  DriverState({required DriverRepository repository}) : _repository = repository {
    _initStreams();
    _loadMetrics();
  }

  AmbulanceAvailability get availability => _availability;
  DriverLifecycleState get lifecycleState => _lifecycleState;
  ConnectionStatus get connectionStatus => _connectionStatus;
  Assignment? get pendingAssignment => _pendingAssignment;
  Assignment? get activeAssignment => _activeAssignment;
  Ambulance? get currentAmbulance => _currentAmbulance;
  int get todayRequestsCount => _todayRequestsCount;
  int get todayCompletedCount => _todayCompletedCount;
  String? get feedbackMessage => _feedbackMessage;
  String? get errorMessage => _errorMessage;

  bool get isAvailable => _availability == AmbulanceAvailability.available;
  bool get isBusy => _availability == AmbulanceAvailability.busy;
  bool get isOffline => _availability == AmbulanceAvailability.offline;
  bool get hasActiveEmergency => _activeAssignment != null && _lifecycleState.isActiveEmergency;

  void _initStreams() {
    _connectionStatus = _repository.connectionStatus;
    _connectionSub = _repository.connectionStatusStream.listen((status) {
      _connectionStatus = status;
      if (status == ConnectionStatus.connected) {
        _syncActiveAssignment();
      }
      notifyListeners();
    });

    // Listen for incoming assignments from dispatch
    _assignmentSub = _repository.onAssignmentReceived.listen((assignment) {
      receiveAssignment(assignment);
    });

    // Listen for cancellations
    _cancelledSub = _repository.onAssignmentCancelled.listen((requestId) {
      cancelAssignment(requestId);
    });

    // Listen for hospital assignment
    _hospitalSub = _repository.onHospitalAssigned.listen((hospital) {
      updateDestinationHospital(hospital);
    });
  }

  Future<void> _syncActiveAssignment() async {
    try {
      final active = await _repository.getActiveAssignment();
      if (active != null) {
        if (active.status.isActiveEmergency) {
          _activeAssignment = active;
          _lifecycleState = active.status;
          _availability = AmbulanceAvailability.busy;
          notifyListeners();
        } else if (active.status == DriverLifecycleState.assignmentReceived &&
            _pendingAssignment == null) {
          receiveAssignment(active);
        }
      }
    } catch (_) {}
  }

  Future<void> _loadMetrics() async {
    _todayRequestsCount = await _repository.getTodayRequestsCount();
    _todayCompletedCount = await _repository.getTodayCompletedCount();
    notifyListeners();
  }

  void initializeForDriver(Driver driver) {
    _availability = driver.availability;
    _lifecycleState = driver.availability == AmbulanceAvailability.available
        ? DriverLifecycleState.available
        : DriverLifecycleState.offline;
    _currentAmbulance = Ambulance(
      ambulanceId: driver.ambulanceId,
      providerId: driver.providerId,
      driverId: driver.driverId,
      status: _lifecycleState,
      availability: _availability,
    );
    notifyListeners();
    _syncActiveAssignment();
  }

  Future<void> setAvailability(AmbulanceAvailability newAvailability) async {
    if (_availability == newAvailability) return;
    if (_lifecycleState.isActiveEmergency) {
      _errorMessage = 'Cannot change availability during an active emergency.';
      notifyListeners();
      return;
    }

    final targetLifecycle = newAvailability == AmbulanceAvailability.available
        ? DriverLifecycleState.available
        : DriverLifecycleState.offline;

    try {
      DriverStateMachine.validateTransition(_lifecycleState, targetLifecycle);
      _availability = newAvailability;
      _lifecycleState = targetLifecycle;

      if (_currentAmbulance != null) {
        _currentAmbulance = await _repository.updateAvailability(
          _currentAmbulance!.ambulanceId,
          newAvailability,
          lifecycleState: targetLifecycle,
        );
      }
      _feedbackMessage = newAvailability == AmbulanceAvailability.available
          ? 'Status set to AVAILABLE. Ready for dispatch.'
          : 'Status set to OFFLINE. Not receiving dispatches.';
      notifyListeners();
    } catch (e) {
      _errorMessage = e.toString();
      notifyListeners();
    }
  }

  void receiveAssignment(Assignment assignment) {
    // Only accept incoming assignment if ambulance is AVAILABLE
    if (_availability != AmbulanceAvailability.available) {
      return;
    }

    try {
      DriverStateMachine.validateTransition(
        _lifecycleState,
        DriverLifecycleState.assignmentReceived,
      );
      _pendingAssignment = assignment;
      _lifecycleState = DriverLifecycleState.assignmentReceived;
      _availability = AmbulanceAvailability.busy;
      _todayRequestsCount++;
      _repository.incrementTodayRequests();
      _feedbackMessage = '🚨 Emergency Assignment Received: ${assignment.requestId}';
      notifyListeners();
    } catch (e) {
      _errorMessage = e.toString();
      notifyListeners();
    }
  }

  Future<bool> acceptAssignment() async {
    if (_pendingAssignment == null) return false;
    final assignment = _pendingAssignment!;

    try {
      DriverStateMachine.validateTransition(
        _lifecycleState,
        DriverLifecycleState.accepted,
      );

      final accepted = await _repository.acceptAssignment(assignment.assignmentId);
      _activeAssignment = assignment.copyWith(
        status: DriverLifecycleState.accepted,
        etaMinutes: accepted.etaMinutes > 0 ? accepted.etaMinutes : assignment.etaMinutes,
        respondedAt: DateTime.now(),
        response: 'ACCEPTED',
      );
      _pendingAssignment = null;
      _lifecycleState = DriverLifecycleState.accepted;
      _availability = AmbulanceAvailability.busy;
      _feedbackMessage = 'Assignment accepted. Initializing navigation to patient.';
      notifyListeners();
      return true;
    } catch (e) {
      _errorMessage = e.toString();
      notifyListeners();
      return false;
    }
  }

  Future<void> rejectAssignment({String? reason}) async {
    if (_pendingAssignment == null) return;
    final assignment = _pendingAssignment!;

    try {
      await _repository.rejectAssignment(
        assignment.assignmentId,
        reason: reason ?? 'Driver declined',
      );
      _pendingAssignment = null;
      _lifecycleState = DriverLifecycleState.available;
      _availability = AmbulanceAvailability.available;
      _feedbackMessage =
          'Assignment declined. The system is finding another available ambulance.';
      notifyListeners();
    } catch (e) {
      _errorMessage = e.toString();
      notifyListeners();
    }
  }

  Future<void> timeoutAssignment() async {
    if (_pendingAssignment == null) return;
    final assignment = _pendingAssignment!;

    try {
      await _repository.rejectAssignment(
        assignment.assignmentId,
        reason: 'Assignment response timed out (15s)',
      );
    } on ConflictException {
      // 409: Backend already timed out and started fallback before Flutter timer fired.
      // This is expected in normal operation — just clear local state without error.
    } catch (e) {
      _errorMessage = e.toString();
    }

    // Always clear pending assignment on timeout, regardless of whether the
    // backend reject succeeded or returned 409 (backend already handled it).
    _pendingAssignment = null;
    _lifecycleState = DriverLifecycleState.available;
    _availability = AmbulanceAvailability.available;
    _feedbackMessage =
        'Assignment response window expired. Dispatch engine initiated fallback.';
    notifyListeners();
  }

  Future<void> advanceToEnRouteToPatient() async {
    if (_activeAssignment == null) return;
    try {
      DriverStateMachine.validateTransition(
        _lifecycleState,
        DriverLifecycleState.enRouteToPatient,
      );
      _lifecycleState = DriverLifecycleState.enRouteToPatient;
      await _repository.updateAssignmentStatus(
        _activeAssignment!.assignmentId,
        _lifecycleState,
      );
      notifyListeners();
    } catch (e) {
      _errorMessage = e.toString();
      notifyListeners();
    }
  }

  Future<void> advanceToArrivedAtPatient() async {
    if (_activeAssignment == null) return;
    try {
      DriverStateMachine.validateTransition(
        _lifecycleState,
        DriverLifecycleState.arrivedAtPatient,
      );
      _lifecycleState = DriverLifecycleState.arrivedAtPatient;
      await _repository.updateAssignmentStatus(
        _activeAssignment!.assignmentId,
        _lifecycleState,
      );
      _feedbackMessage =
          'Arrived at patient location. Bystander notified: 🚑 AMB-003 reached.';
      notifyListeners();
    } catch (e) {
      _errorMessage = e.toString();
      notifyListeners();
    }
  }

  Future<void> advanceToPatientOnboard() async {
    if (_activeAssignment == null) return;
    try {
      DriverStateMachine.validateTransition(
        _lifecycleState,
        DriverLifecycleState.patientOnboard,
      );
      _lifecycleState = DriverLifecycleState.patientOnboard;
      await _repository.updateAssignmentStatus(
        _activeAssignment!.assignmentId,
        _lifecycleState,
      );
      _feedbackMessage =
          'Patient onboarded. Destination hospital routing confirmed.';
      notifyListeners();
    } catch (e) {
      _errorMessage = e.toString();
      notifyListeners();
    }
  }

  Future<void> advanceToEnRouteToHospital() async {
    if (_activeAssignment == null) return;
    try {
      DriverStateMachine.validateTransition(
        _lifecycleState,
        DriverLifecycleState.enRouteToHospital,
      );
      _lifecycleState = DriverLifecycleState.enRouteToHospital;
      await _repository.updateAssignmentStatus(
        _activeAssignment!.assignmentId,
        _lifecycleState,
      );
      _feedbackMessage = 'En route to hospital. Emergency hospital dashboard notified.';
      notifyListeners();
    } catch (e) {
      _errorMessage = e.toString();
      notifyListeners();
    }
  }

  Future<void> advanceToArrivedAtHospital() async {
    if (_activeAssignment == null) return;
    try {
      DriverStateMachine.validateTransition(
        _lifecycleState,
        DriverLifecycleState.arrivedAtHospital,
      );
      _lifecycleState = DriverLifecycleState.arrivedAtHospital;
      await _repository.updateAssignmentStatus(
        _activeAssignment!.assignmentId,
        _lifecycleState,
      );
      _feedbackMessage = 'Arrived at destination hospital.';
      notifyListeners();
    } catch (e) {
      _errorMessage = e.toString();
      notifyListeners();
    }
  }

  Future<void> completeMission() async {
    if (_activeAssignment == null) return;
    try {
      DriverStateMachine.validateTransition(
        _lifecycleState,
        DriverLifecycleState.completed,
      );
      try {
        await _repository.updateAssignmentStatus(
          _activeAssignment!.assignmentId,
          DriverLifecycleState.completed,
        );
      } on ConflictException {
        // Backend auto-completes on ARRIVED_AT_HOSPITAL — 409 is expected
      }

      _todayCompletedCount++;
      await _repository.incrementTodayCompleted();

      // Automatically transitions to AVAILABLE per documentation
      DriverStateMachine.validateTransition(
        DriverLifecycleState.completed,
        DriverLifecycleState.available,
      );
      _activeAssignment = null;
      _lifecycleState = DriverLifecycleState.available;
      _availability = AmbulanceAvailability.available;
      _feedbackMessage = 'Mission completed successfully. Ambulance is now AVAILABLE.';
      notifyListeners();
    } catch (e) {
      _errorMessage = e.toString();
      notifyListeners();
    }
  }

  void cancelAssignment(String requestId) {
    if (_activeAssignment?.requestId == requestId ||
        _pendingAssignment?.requestId == requestId) {
      _activeAssignment = null;
      _pendingAssignment = null;
      _lifecycleState = DriverLifecycleState.available;
      _availability = AmbulanceAvailability.available;
      _feedbackMessage = 'Assignment cancelled by dispatch: $requestId';
      notifyListeners();
    }
  }

  void updateDestinationHospital(Hospital hospital) {
    if (_activeAssignment != null) {
      _activeAssignment = _activeAssignment!.copyWith(
        destinationHospital: hospital,
      );
      _feedbackMessage = 'Destination hospital updated: ${hospital.name}';
      notifyListeners();
    }
  }

  void clearFeedback() {
    _feedbackMessage = null;
    notifyListeners();
  }

  void clearError() {
    _errorMessage = null;
    notifyListeners();
  }

  @override
  void dispose() {
    _assignmentSub?.cancel();
    _cancelledSub?.cancel();
    _hospitalSub?.cancel();
    _connectionSub?.cancel();
    super.dispose();
  }
}
