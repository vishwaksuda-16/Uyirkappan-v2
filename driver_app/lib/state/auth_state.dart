import 'package:flutter/foundation.dart';
import '../core/errors/app_exceptions.dart';
import '../models/driver.dart';
import '../repositories/driver_repository.dart';

class AuthState extends ChangeNotifier {
  final DriverRepository _repository;

  Driver? _currentDriver;
  bool _isLoading = false;
  String? _errorMessage;

  AuthState({required DriverRepository repository}) : _repository = repository;

  Driver? get currentDriver => _currentDriver;
  bool get isAuthenticated => _currentDriver != null;
  bool get isLoading => _isLoading;
  String? get errorMessage => _errorMessage;

  Future<void> restoreSession() async {
    _isLoading = true;
    notifyListeners();

    try {
      _currentDriver = await _repository.restoreSession();
    } catch (_) {
      _currentDriver = null;
    } finally {
      _isLoading = false;
      notifyListeners();
    }
  }

  Future<bool> login(String driverId, String password) async {
    _isLoading = true;
    _errorMessage = null;
    notifyListeners();

    try {
      _currentDriver = await _repository.login(driverId, password);
      _isLoading = false;
      notifyListeners();
      return true;
    } on AppException catch (e) {
      _errorMessage = e.message;
      _isLoading = false;
      notifyListeners();
      return false;
    } catch (e) {
      _errorMessage = 'An unexpected error occurred during authentication.';
      _isLoading = false;
      notifyListeners();
      return false;
    }
  }

  Future<void> logout() async {
    await _repository.logout();
    _currentDriver = null;
    _errorMessage = null;
    notifyListeners();
  }

  void clearError() {
    _errorMessage = null;
    notifyListeners();
  }
}
