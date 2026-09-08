import 'package:shared_preferences/shared_preferences.dart';
import '../constants/app_constants.dart';

abstract class LocalStorageService {
  Future<void> init();
  Future<void> saveAuthToken(String token);
  Future<String?> getAuthToken();
  Future<void> saveDriverId(String driverId);
  Future<String?> getDriverId();
  Future<void> saveAmbulanceId(String ambulanceId);
  Future<String?> getAmbulanceId();
  Future<void> saveDriverEmail(String email);
  Future<String?> getDriverEmail();
  Future<void> clearAuth();
  Future<int> getTodayRequestsCount();
  Future<void> incrementTodayRequests();
  Future<int> getTodayCompletedCount();
  Future<void> incrementTodayCompleted();
}

class SharedPreferencesLocalStorageService implements LocalStorageService {
  SharedPreferences? _prefs;

  @override
  Future<void> init() async {
    _prefs ??= await SharedPreferences.getInstance();
  }

  @override
  Future<void> saveAuthToken(String token) async {
    await init();
    await _prefs!.setString(AppConstants.prefAuthToken, token);
  }

  @override
  Future<String?> getAuthToken() async {
    await init();
    return _prefs!.getString(AppConstants.prefAuthToken);
  }

  @override
  Future<void> saveDriverId(String driverId) async {
    await init();
    await _prefs!.setString(AppConstants.prefDriverId, driverId);
  }

  @override
  Future<String?> getDriverId() async {
    await init();
    return _prefs!.getString(AppConstants.prefDriverId);
  }

  @override
  Future<void> saveAmbulanceId(String ambulanceId) async {
    await init();
    await _prefs!.setString(AppConstants.prefAmbulanceId, ambulanceId);
  }

  @override
  Future<String?> getAmbulanceId() async {
    await init();
    return _prefs!.getString(AppConstants.prefAmbulanceId);
  }

  @override
  Future<void> saveDriverEmail(String email) async {
    await init();
    await _prefs!.setString(AppConstants.prefDriverEmail, email);
  }

  @override
  Future<String?> getDriverEmail() async {
    await init();
    return _prefs!.getString(AppConstants.prefDriverEmail);
  }

  @override
  Future<void> clearAuth() async {
    await init();
    await _prefs!.remove(AppConstants.prefAuthToken);
    await _prefs!.remove(AppConstants.prefDriverId);
    await _prefs!.remove(AppConstants.prefAmbulanceId);
    await _prefs!.remove(AppConstants.prefDriverEmail);
  }

  @override
  Future<int> getTodayRequestsCount() async {
    await init();
    return _prefs!.getInt(AppConstants.prefTodayRequestCount) ?? 0;
  }

  @override
  Future<void> incrementTodayRequests() async {
    await init();
    final current = await getTodayRequestsCount();
    await _prefs!.setInt(AppConstants.prefTodayRequestCount, current + 1);
  }

  @override
  Future<int> getTodayCompletedCount() async {
    await init();
    return _prefs!.getInt(AppConstants.prefTodayCompletedCount) ?? 0;
  }

  @override
  Future<void> incrementTodayCompleted() async {
    await init();
    final current = await getTodayCompletedCount();
    await _prefs!.setInt(AppConstants.prefTodayCompletedCount, current + 1);
  }
}
