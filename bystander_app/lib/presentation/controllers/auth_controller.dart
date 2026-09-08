import 'package:flutter/foundation.dart';
import '../../data/datasources/auth_datasource.dart';
import '../../domain/entities/user_profile.dart';

/// Presentation controller managing user authentication, registration, token persistence,
/// and role display for the Bystander Mobile Application.
class AuthController extends ChangeNotifier {
  final AuthDataSource authDataSource;

  UserProfile? _currentUser;
  bool _isLoading = false;
  String? _errorMessage;

  AuthController({required this.authDataSource}) {
    checkExistingAuth();
  }

  UserProfile? get currentUser => _currentUser;
  bool get isLoading => _isLoading;
  String? get errorMessage => _errorMessage;
  bool get isAuthenticated => _currentUser != null;
  String? get token => _currentUser?.token;
  String get displayName => _currentUser?.name ?? 'Guest Bystander';
  String get role => _currentUser?.role ?? 'BYSTANDER';

  /// Restores session on app startup if JWT token exists.
  Future<void> checkExistingAuth() async {
    _isLoading = true;
    notifyListeners();
    try {
      final savedProfile = await authDataSource.getCurrentUser();
      if (savedProfile != null) {
        _currentUser = savedProfile;
      }
    } catch (_) {
      // No saved session
    } finally {
      _isLoading = false;
      notifyListeners();
    }
  }

  /// Login with email and password via POST /api/auth/login.
  Future<bool> login({required String email, required String password}) async {
    _isLoading = true;
    _errorMessage = null;
    notifyListeners();
    try {
      final profile = await authDataSource.login(email: email, password: password);
      _currentUser = profile;
      _isLoading = false;
      notifyListeners();
      return true;
    } catch (e) {
      _isLoading = false;
      _errorMessage = e.toString().replaceAll('ServerException: ', '').replaceAll('NetworkException: ', '');
      notifyListeners();
      return false;
    }
  }

  /// Instant 1-tap login with official demo credentials:
  /// bystander@uyirkappan.demo / password123
  Future<bool> loginDemo() async {
    return login(
      email: 'bystander@uyirkappan.demo',
      password: 'password123',
    );
  }

  /// Register via POST /api/auth/register with payload:
  /// { "name": "...", "phone": "...", "email": "...", "password": "...", "role": "BYSTANDER" }
  Future<bool> register({
    required String name,
    required String phone,
    required String email,
    required String password,
    String role = 'BYSTANDER',
  }) async {
    _isLoading = true;
    _errorMessage = null;
    notifyListeners();
    try {
      final profile = await authDataSource.register(
        name: name,
        phone: phone,
        email: email,
        password: password,
        role: role,
      );
      _currentUser = profile;
      _isLoading = false;
      notifyListeners();
      return true;
    } catch (e) {
      _isLoading = false;
      _errorMessage = e.toString().replaceAll('ServerException: ', '').replaceAll('NetworkException: ', '');
      notifyListeners();
      return false;
    }
  }

  /// Clear token and logout.
  Future<void> logout() async {
    await authDataSource.clearSession();
    _currentUser = null;
    _errorMessage = null;
    notifyListeners();
  }

  void clearError() {
    _errorMessage = null;
    notifyListeners();
  }
}
