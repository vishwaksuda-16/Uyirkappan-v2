import 'package:flutter_test/flutter_test.dart';
import 'package:driver_app/app/app.dart';
import 'package:driver_app/core/config/app_config.dart';
import 'package:driver_app/core/storage/local_storage_service.dart';
import 'package:driver_app/repositories/driver_repository_impl.dart';
import 'package:driver_app/services/api/simulated_api_service.dart';
import 'package:driver_app/services/location/simulated_location_service.dart';
import 'package:driver_app/services/simulation/simulation_engine.dart';
import 'package:driver_app/services/socket/simulated_socket_service.dart';

class MockStorage implements LocalStorageService {
  final Map<String, dynamic> _data = {};

  @override
  Future<void> init() async {}

  @override
  Future<void> saveAuthToken(String token) async => _data['token'] = token;

  @override
  Future<String?> getAuthToken() async => _data['token'] as String?;

  @override
  Future<void> saveDriverId(String driverId) async => _data['driverId'] = driverId;

  @override
  Future<String?> getDriverId() async => _data['driverId'] as String?;

  @override
  Future<void> saveAmbulanceId(String ambulanceId) async =>
      _data['ambulanceId'] = ambulanceId;

  @override
  Future<String?> getAmbulanceId() async => _data['ambulanceId'] as String?;

  @override
  Future<void> saveDriverEmail(String email) async => _data['email'] = email;

  @override
  Future<String?> getDriverEmail() async => _data['email'] as String?;

  @override
  Future<void> clearAuth() async => _data.clear();

  @override
  Future<int> getTodayRequestsCount() async => (_data['requests'] as int?) ?? 0;

  @override
  Future<void> incrementTodayRequests() async {
    final cur = await getTodayRequestsCount();
    _data['requests'] = cur + 1;
  }

  @override
  Future<int> getTodayCompletedCount() async => (_data['completed'] as int?) ?? 0;

  @override
  Future<void> incrementTodayCompleted() async {
    final cur = await getTodayCompletedCount();
    _data['completed'] = cur + 1;
  }
}

void main() {
  testWidgets('App renders LoginScreen with branding and quick demo accounts', (tester) async {
    const config = AppConfig();
    final storage = MockStorage();
    final apiService = SimulatedApiService();
    final socketService = SimulatedSocketService();
    final locationService = SimulatedLocationService();
    final simulationEngine = SimulationEngine(socketService: socketService);

    final repository = DriverRepositoryImpl(
      config: config,
      apiService: apiService,
      socketService: socketService,
      locationService: locationService,
      storage: storage,
    );

    await tester.pumpWidget(UyirKappanDriverApp(
      repository: repository,
      simulationEngine: simulationEngine,
    ));

    await tester.pumpAndSettle();

    // Verify branding
    expect(find.text('UYIRKAPPAN'), findsOneWidget);
    expect(find.text('AMBULANCE DRIVER PORTAL • MODULE 2'), findsOneWidget);
    expect(find.text('AUTHENTICATE & ENTER SHIFT'), findsOneWidget);

    // Verify predefined checklist & simulation demo account chips (Section 1 & 11)
    expect(find.textContaining('driver1'), findsWidgets);
    expect(find.textContaining('driver3'), findsWidgets);
  });
}
