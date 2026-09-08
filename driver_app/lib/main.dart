import 'package:flutter/material.dart';
import 'app/app.dart';
import 'core/config/app_config.dart';
import 'core/storage/local_storage_service.dart';
import 'repositories/driver_repository_impl.dart';
import 'services/api/real_api_service.dart';
import 'services/location/real_location_service.dart';
import 'services/socket/real_socket_service.dart';

void main() async {
  WidgetsFlutterBinding.ensureInitialized();

  // Environment configuration (defaults to live production backend)
  const apiBaseUrl = String.fromEnvironment('API_BASE_URL', defaultValue: 'http://localhost:4000/api');
  const socketUrl = String.fromEnvironment('SOCKET_URL', defaultValue: 'http://localhost:4000');

  const config = AppConfig(
    apiBaseUrl: apiBaseUrl,
    socketUrl: socketUrl,
    appMode: AppMode.real,
  );

  // Storage
  final storage = SharedPreferencesLocalStorageService();
  await storage.init();

  // Real Production Services
  final socketService = RealSocketService(config: config, storage: storage);
  final apiService = RealApiService(config: config);
  final locationService = RealLocationService();

  final repository = DriverRepositoryImpl(
    config: config,
    apiService: apiService,
    socketService: socketService,
    locationService: locationService,
    storage: storage,
  );

  runApp(UyirKappanDriverApp(
    repository: repository,
  ));
}
