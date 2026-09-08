import '../../domain/entities/user_profile.dart';

/// Contract for Authentication and Session Management adhering to backend specifications.
abstract class AuthDataSource {
  /// POST /api/auth/login
  Future<UserProfile> login({
    required String email,
    required String password,
  });

  /// POST /api/auth/register
  Future<UserProfile> register({
    required String name,
    required String phone,
    required String email,
    required String password,
    String role = 'BYSTANDER',
  });

  /// GET /api/auth/me
  Future<UserProfile?> getCurrentUser({String? token});

  /// Retrieves persisted JWT token from device storage.
  Future<String?> getSavedToken();

  /// Persists authenticated JWT token.
  Future<void> saveToken(String token);

  /// Clears stored user session & token.
  Future<void> clearSession();
}
