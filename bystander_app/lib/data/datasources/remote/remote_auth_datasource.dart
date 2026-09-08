import 'dart:convert';
import 'package:http/http.dart' as http;
import 'package:shared_preferences/shared_preferences.dart';
import '../../../core/constants/api_constants.dart';
import '../../../core/errors/exceptions.dart';
import '../../../domain/entities/user_profile.dart';
import '../adaptive/adaptive_datasources.dart';
import '../auth_datasource.dart';

/// Real REST implementation of AuthDataSource communicating with the backend.
/// Automatically falls back to offline demo credentials if backend on port 4000 is offline.
class RemoteAuthDataSource implements AuthDataSource {
  final http.Client client;
  final String baseUrl;
  static const String _tokenKey = 'uyirkappan_jwt_token';
  static const String _userKey = 'uyirkappan_user_profile';

  RemoteAuthDataSource({
    required this.client,
    this.baseUrl = ApiConstants.defaultBaseUrl,
  });

  @override
  Future<UserProfile> login({
    required String email,
    required String password,
  }) async {
    // If running in simulation mode, immediately return authenticated profile
    if (!useRemoteBackendNotifier.value) {
      final simProfile = UserProfile(
        id: 'BYSTANDER-${DateTime.now().millisecondsSinceEpoch}',
        name: email.toLowerCase().contains('demo') ? 'Bystander Demo User' : 'Bystander User',
        email: email.trim(),
        phone: '+91 98401 23456',
        role: 'BYSTANDER',
        token: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.sim.${DateTime.now().millisecondsSinceEpoch}',
        createdAt: DateTime.now(),
      );
      await saveToken(simProfile.token!);
      await _saveProfile(simProfile);
      return simProfile;
    }

    final uri = Uri.parse('$baseUrl${ApiConstants.authLogin}');
    try {
      final response = await client.post(
        uri,
        headers: {ApiConstants.headerContentType: ApiConstants.contentTypeJson},
        body: jsonEncode({
          'email': email.trim(),
          'password': password,
        }),
      );

      if (response.statusCode == 200 || response.statusCode == 201) {
        final body = jsonDecode(response.body) as Map<String, dynamic>;
        final token = body['token'] as String? ?? body['accessToken'] as String? ?? 'demo-jwt-token';
        final profile = UserProfile.fromJson(body, token: token);
        await saveToken(token);
        await _saveProfile(profile);
        return profile;
      } else if (response.statusCode == 401) {
        throw const ServerException('Invalid credentials. Please check your email and password.', 401);
      } else {
        throw ServerException('Login failed: ${response.body}', response.statusCode);
      }
    } catch (e) {
      if (e is ServerException) rethrow;
      // Backend is unreachable, gracefully fallback to local demo profile
      final fallbackProfile = UserProfile(
        id: 'BYSTANDER-DEMO-01',
        name: email.trim().toLowerCase() == 'bystander@uyirkappan.demo' ? 'Bystander Demo User' : 'Bystander User',
        email: email.trim(),
        phone: '+91 98401 23456',
        role: 'BYSTANDER',
        token: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.demo.bystander',
        createdAt: DateTime.now(),
      );
      await saveToken(fallbackProfile.token!);
      await _saveProfile(fallbackProfile);
      return fallbackProfile;
    }
  }

  @override
  Future<UserProfile> register({
    required String name,
    required String phone,
    required String email,
    required String password,
    String role = 'BYSTANDER',
  }) async {
    // If running in simulation mode, immediately return registered profile
    if (!useRemoteBackendNotifier.value) {
      final simProfile = UserProfile(
        id: 'BYSTANDER-${DateTime.now().millisecondsSinceEpoch}',
        name: name.trim(),
        email: email.trim(),
        phone: phone.trim(),
        role: role,
        token: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.sim.${DateTime.now().millisecondsSinceEpoch}',
        createdAt: DateTime.now(),
      );
      await saveToken(simProfile.token!);
      await _saveProfile(simProfile);
      return simProfile;
    }

    final uri = Uri.parse('$baseUrl${ApiConstants.authRegister}');
    try {
      final response = await client.post(
        uri,
        headers: {ApiConstants.headerContentType: ApiConstants.contentTypeJson},
        body: jsonEncode({
          'name': name.trim(),
          'phone': phone.trim(),
          'email': email.trim(),
          'password': password,
          'role': role,
        }),
      );

      if (response.statusCode == 200 || response.statusCode == 201) {
        final body = jsonDecode(response.body) as Map<String, dynamic>;
        final token = body['token'] as String? ?? body['accessToken'] as String? ?? 'demo-jwt-token';
        final profile = UserProfile.fromJson(body, token: token);
        await saveToken(token);
        await _saveProfile(profile);
        return profile;
      } else {
        throw ServerException('Registration failed: ${response.body}', response.statusCode);
      }
    } catch (e) {
      if (e is ServerException) rethrow;
      // Offline fallback registration
      final offlineProfile = UserProfile(
        id: 'BYSTANDER-${DateTime.now().millisecondsSinceEpoch}',
        name: name.trim(),
        email: email.trim(),
        phone: phone.trim(),
        role: role,
        token: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.demo.registered',
        createdAt: DateTime.now(),
      );
      await saveToken(offlineProfile.token!);
      await _saveProfile(offlineProfile);
      return offlineProfile;
    }
  }

  @override
  Future<UserProfile?> getCurrentUser({String? token}) async {
    final jwt = token ?? await getSavedToken();
    if (jwt == null || jwt.isEmpty) return null;

    final uri = Uri.parse('$baseUrl${ApiConstants.authMe}');
    try {
      final response = await client.get(
        uri,
        headers: ApiConstants.authHeaders(jwt),
      );

      if (response.statusCode == 200) {
        final body = jsonDecode(response.body) as Map<String, dynamic>;
        final profile = UserProfile.fromJson(body, token: jwt);
        await _saveProfile(profile);
        return profile;
      }
    } catch (_) {}

    // Fall back to locally stored profile
    return _getSavedProfile();
  }

  @override
  Future<String?> getSavedToken() async {
    final prefs = await SharedPreferences.getInstance();
    return prefs.getString(_tokenKey);
  }

  @override
  Future<void> saveToken(String token) async {
    final prefs = await SharedPreferences.getInstance();
    await prefs.setString(_tokenKey, token);
  }

  @override
  Future<void> clearSession() async {
    final prefs = await SharedPreferences.getInstance();
    await prefs.remove(_tokenKey);
    await prefs.remove(_userKey);
  }

  Future<void> _saveProfile(UserProfile profile) async {
    final prefs = await SharedPreferences.getInstance();
    await prefs.setString(_userKey, jsonEncode(profile.toJson()));
  }

  Future<UserProfile?> _getSavedProfile() async {
    final prefs = await SharedPreferences.getInstance();
    final jsonStr = prefs.getString(_userKey);
    if (jsonStr == null || jsonStr.isEmpty) return null;
    try {
      final map = jsonDecode(jsonStr) as Map<String, dynamic>;
      return UserProfile.fromJson(map);
    } catch (_) {
      return null;
    }
  }
}
