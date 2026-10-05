enum AppMode {
  simulation,
  real,
}

enum LocationProviderMode {
  simulation,
  real,
}

class AppConfig {
  final String apiBaseUrl;
  final String socketUrl;
  final AppMode appMode;
  final LocationProviderMode locationProviderMode;
  final int assignmentTimeoutSeconds;
  final int simulationTickIntervalMs;
  final double simulationSpeedMultiplier;

  const AppConfig({
    this.apiBaseUrl = const String.fromEnvironment(
      'API_BASE_URL',
      defaultValue: 'http://localhost:5000/api',
    ),
    this.socketUrl = const String.fromEnvironment(
      'SOCKET_URL',
      defaultValue: 'http://localhost:5000',
    ),
    this.appMode = AppMode.real,
    this.locationProviderMode = const String.fromEnvironment('LOCATION_PROVIDER') == 'real'
        ? LocationProviderMode.real
        : LocationProviderMode.simulation,
    this.assignmentTimeoutSeconds = 60,
    this.simulationTickIntervalMs = 1000,
    this.simulationSpeedMultiplier = 1.0,
  });

  bool get isSimulation => appMode == AppMode.simulation;
  bool get isReal => appMode == AppMode.real;
  bool get isRealGps => locationProviderMode == LocationProviderMode.real;

  AppConfig copyWith({
    String? apiBaseUrl,
    String? socketUrl,
    AppMode? appMode,
    LocationProviderMode? locationProviderMode,
    int? assignmentTimeoutSeconds,
    int? simulationTickIntervalMs,
    double? simulationSpeedMultiplier,
  }) {
    return AppConfig(
      apiBaseUrl: apiBaseUrl ?? this.apiBaseUrl,
      socketUrl: socketUrl ?? this.socketUrl,
      appMode: appMode ?? this.appMode,
      locationProviderMode: locationProviderMode ?? this.locationProviderMode,
      assignmentTimeoutSeconds:
          assignmentTimeoutSeconds ?? this.assignmentTimeoutSeconds,
      simulationTickIntervalMs:
          simulationTickIntervalMs ?? this.simulationTickIntervalMs,
      simulationSpeedMultiplier:
          simulationSpeedMultiplier ?? this.simulationSpeedMultiplier,
    );
  }
}
