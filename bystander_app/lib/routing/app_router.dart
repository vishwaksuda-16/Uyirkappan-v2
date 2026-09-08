import 'package:flutter/material.dart';
import '../domain/repositories/tracking_repository.dart';
import '../presentation/controllers/emergency_controller.dart';
import '../presentation/controllers/location_controller.dart';
import '../presentation/controllers/simulation_controller.dart';
import '../presentation/screens/auth/auth_screen.dart';
import '../presentation/screens/emergency_form/emergency_details_screen.dart';
import '../presentation/screens/home/home_screen.dart';
import '../presentation/screens/location/location_picker_screen.dart';
import '../presentation/screens/review/review_request_screen.dart';
import '../presentation/screens/simulation/simulation_scenarios_screen.dart';
import '../presentation/screens/status/request_status_screen.dart';
import '../presentation/screens/tracking/tracking_placeholder_screen.dart';
import 'route_paths.dart';

import '../presentation/controllers/auth_controller.dart';
import '../data/datasources/remote/socket_service.dart';

/// Central application route generator.
class AppRouter {
  final EmergencyController emergencyController;
  final LocationController locationController;
  final SimulationController? simulationController;
  final TrackingRepository trackingRepository;
  final AuthController? authController;
  final SocketService? socketService;

  AppRouter({
    required this.emergencyController,
    required this.locationController,
    this.simulationController,
    required this.trackingRepository,
    this.authController,
    this.socketService,
  });

  Route<dynamic> onGenerateRoute(RouteSettings settings) {
    switch (settings.name) {
      case RoutePaths.home:
        return MaterialPageRoute(
          builder: (_) => HomeScreen(
            emergencyController: emergencyController,
            locationController: locationController,
            simulationController: simulationController,
            trackingRepository: trackingRepository,
            authController: authController,
            socketService: socketService,
          ),
        );

      case RoutePaths.auth:
        return MaterialPageRoute(
          builder: (_) => AuthScreen(
            authController: authController!,
          ),
        );

      case RoutePaths.locationPicker:
        return MaterialPageRoute(
          builder: (_) => LocationPickerScreen(
            locationController: locationController,
          ),
        );

      case RoutePaths.emergencyDetails:
        return MaterialPageRoute(
          builder: (_) => EmergencyDetailsScreen(
            emergencyController: emergencyController,
          ),
        );

      case RoutePaths.reviewRequest:
        return MaterialPageRoute(
          builder: (_) => ReviewRequestScreen(
            emergencyController: emergencyController,
            locationController: locationController,
          ),
        );

      case RoutePaths.requestStatus:
        return MaterialPageRoute(
          builder: (_) => RequestStatusScreen(
            emergencyController: emergencyController,
          ),
        );

      case RoutePaths.liveTracking:
        return MaterialPageRoute(
          builder: (_) => TrackingPlaceholderScreen(
            emergencyController: emergencyController,
            trackingRepository: trackingRepository,
          ),
        );

      case RoutePaths.simulationScenarios:
        return MaterialPageRoute(
          builder: (_) => simulationController != null
              ? SimulationScenariosScreen(
                  simulationController: simulationController!,
                )
              : const Scaffold(
                  body: Center(
                    child: Text('Simulation mode is disabled in production'),
                  ),
                ),
        );

      default:
        return MaterialPageRoute(
          builder: (_) => Scaffold(
            body: Center(
              child: Text('No route defined for ${settings.name}'),
            ),
          ),
        );
    }
  }
}
