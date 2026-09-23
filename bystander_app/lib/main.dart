import 'package:flutter/material.dart';
import 'package:http/http.dart' as http;
import 'core/theme/app_theme.dart';
import 'data/datasources/local/request_local_datasource.dart';
import 'data/datasources/remote/remote_auth_datasource.dart';
import 'data/datasources/remote/remote_emergency_request_datasource.dart';
import 'data/datasources/remote/remote_tracking_datasource.dart';
import 'data/datasources/remote/socket_service.dart';
import 'data/repositories/emergency_request_repository_impl.dart';
import 'data/repositories/tracking_repository_impl.dart';
import 'presentation/controllers/auth_controller.dart';
import 'presentation/controllers/emergency_controller.dart';
import 'presentation/controllers/location_controller.dart';
import 'routing/app_router.dart';
import 'routing/route_paths.dart';

void main() async {
  WidgetsFlutterBinding.ensureInitialized();

  // 1. Initialize Local Data Source (Persistence & History)
  final localDataSource = RequestLocalDataSourceImpl();

  // 2. Initialize Real-Time Socket.IO Service & HTTP Client
  final httpClient = http.Client();
  final socketService = SocketService();

  // 3. Initialize Authentication (Module 1 Integration)
  final remoteAuthDataSource = RemoteAuthDataSource(client: httpClient);
  final authController = AuthController(
    authDataSource: remoteAuthDataSource,
    socketService: socketService,
  );
  await authController.checkExistingAuth();

  // 4. Initialize Remote REST DataSources
  final remoteRequestDataSource = RemoteEmergencyRequestDataSource(
    client: httpClient,
    tokenProvider: () async => authController.token,
    socketService: socketService,
  );
  final remoteTrackingDataSource = RemoteTrackingDataSource(
    client: httpClient,
    tokenProvider: () async => authController.token,
    socketService: socketService,
  );

  // 5. Initialize Repositories using Remote Backend DataSources
  final emergencyRepository = EmergencyRequestRepositoryImpl(
    dataSource: remoteRequestDataSource,
    localDataSource: localDataSource,
  );

  final trackingRepository = TrackingRepositoryImpl(
    dataSource: remoteTrackingDataSource,
  );

  // 6. Initialize Presentation Controllers
  final locationController = LocationController();
  final emergencyController = EmergencyController(
    repository: emergencyRepository,
    socketService: socketService,
  );

  // 7. Initialize App Router
  final appRouter = AppRouter(
    emergencyController: emergencyController,
    locationController: locationController,
    trackingRepository: trackingRepository,
    authController: authController,
    socketService: socketService,
  );

  runApp(UyirKappanBystanderApp(
    appRouter: appRouter,
    authController: authController,
  ));
}

/// Global ValueNotifier for toggling between Light and Dark mode across the application.
/// Defaulted to Dark mode to match the Driver and Hospital tactical emergency theme.
final ValueNotifier<ThemeMode> appThemeModeNotifier = ValueNotifier<ThemeMode>(ThemeMode.dark);

/// Root Application Widget for UyirKappan Module 1 (Bystander App).
class UyirKappanBystanderApp extends StatelessWidget {
  final AppRouter appRouter;
  final AuthController? authController;

  const UyirKappanBystanderApp({
    super.key,
    required this.appRouter,
    this.authController,
  });

  @override
  Widget build(BuildContext context) {
    return ValueListenableBuilder<ThemeMode>(
      valueListenable: appThemeModeNotifier,
      builder: (context, themeMode, _) {
        return MaterialApp(
          title: 'UyirKappan — Bystander Emergency Response',
          debugShowCheckedModeBanner: false,
          theme: AppTheme.lightTheme,
          darkTheme: AppTheme.darkTheme,
          themeMode: themeMode,
          initialRoute: (authController?.isAuthenticated == true)
              ? RoutePaths.home
              : RoutePaths.auth,
          onGenerateRoute: appRouter.onGenerateRoute,
          builder: (context, child) {
            return child ?? const SizedBox.shrink();
          },
        );
      },
    );
  }
}
