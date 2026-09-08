import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../core/constants/app_constants.dart';
import '../core/theme/app_theme.dart';
import '../repositories/driver_repository.dart';
import '../services/simulation/simulation_engine.dart';
import '../state/auth_state.dart';
import '../state/driver_state.dart';
import '../state/navigation_state.dart';
import 'routes.dart';

class UyirKappanDriverApp extends StatelessWidget {
  final DriverRepository repository;
  final SimulationEngine? simulationEngine;

  const UyirKappanDriverApp({
    super.key,
    required this.repository,
    this.simulationEngine,
  });

  @override
  Widget build(BuildContext context) {
    return MultiProvider(
      providers: [
        Provider<DriverRepository>.value(value: repository),
        if (simulationEngine != null)
          ChangeNotifierProvider<SimulationEngine>.value(value: simulationEngine!),
        ChangeNotifierProvider<AuthState>(
          create: (_) => AuthState(repository: repository),
        ),
        ChangeNotifierProvider<DriverState>(
          create: (_) => DriverState(repository: repository),
        ),
        ChangeNotifierProvider<NavigationState>(
          create: (_) => NavigationState(repository: repository),
        ),
      ],
      child: MaterialApp(
        title: AppConstants.appName,
        debugShowCheckedModeBanner: false,
        theme: AppTheme.darkTheme,
        initialRoute: AppRoutes.login,
        routes: AppRoutes.routes,
      ),
    );
  }
}
