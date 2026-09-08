import 'dart:convert';
import 'package:shared_preferences/shared_preferences.dart';
import '../../../core/constants/app_constants.dart';
import '../../models/emergency_request_model.dart';

/// Local DataSource for persisting active emergency request ID, offline state,
/// and past emergency request history (Item 13 of verification checklist).
abstract class RequestLocalDataSource {
  Future<void> saveActiveRequestId(String requestId);
  Future<String?> getActiveRequestId();
  Future<void> clearActiveRequestId();
  Future<void> saveRequestToHistory(EmergencyRequestModel request);
  Future<List<EmergencyRequestModel>> getPastRequests();
}

class RequestLocalDataSourceImpl implements RequestLocalDataSource {
  final SharedPreferences? _prefs;
  static const String _historyKey = 'uyirkappan_request_history';

  RequestLocalDataSourceImpl([this._prefs]);

  Future<SharedPreferences> _getPrefs() async {
    return _prefs ?? await SharedPreferences.getInstance();
  }

  @override
  Future<void> saveActiveRequestId(String requestId) async {
    final prefs = await _getPrefs();
    await prefs.setString(AppConstants.keyActiveRequestId, requestId);
  }

  @override
  Future<String?> getActiveRequestId() async {
    final prefs = await _getPrefs();
    return prefs.getString(AppConstants.keyActiveRequestId);
  }

  @override
  Future<void> clearActiveRequestId() async {
    final prefs = await _getPrefs();
    await prefs.remove(AppConstants.keyActiveRequestId);
  }

  @override
  Future<void> saveRequestToHistory(EmergencyRequestModel request) async {
    final prefs = await _getPrefs();
    final list = await getPastRequests();
    // Update existing or prepend new
    final existingIndex = list.indexWhere((r) => r.requestId == request.requestId);
    if (existingIndex >= 0) {
      list[existingIndex] = request;
    } else {
      list.insert(0, request);
    }
    // Retain maximum 20 most recent
    final trimmed = list.take(20).map((r) => r.toJson()).toList();
    await prefs.setString(_historyKey, jsonEncode(trimmed));
  }

  @override
  Future<List<EmergencyRequestModel>> getPastRequests() async {
    final prefs = await _getPrefs();
    final jsonStr = prefs.getString(_historyKey);
    if (jsonStr == null || jsonStr.isEmpty) return [];
    try {
      final decoded = jsonDecode(jsonStr) as List;
      return decoded.map((e) => EmergencyRequestModel.fromJson(e as Map<String, dynamic>)).toList();
    } catch (_) {
      return [];
    }
  }
}
