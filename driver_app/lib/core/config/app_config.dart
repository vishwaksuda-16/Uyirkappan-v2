enum AppMode {
  simulation,
  real,
}

class AppConfig {
  final String apiBaseUrl;
  final String socketUrl;
  final AppMode appMode;
  final int assignmentTimeoutSeconds;
  final int simulationTickIntervalMs;
  final double simulationSpeedMultiplier;

  const AppConfig({
    this.apiBaseUrl = const String.fromEnvironment(
      'API_BASE_URL',
      defaultValue: 'http://localhost:4000/api',
    ),
    this.socketUrl = const String.fromEnvironment(
      'SOCKET_URL',
      defaultValue: 'http://localhost:4000',
    ),
    this.appMode = AppMode.real,
    this.assignmentTimeoutSeconds = 15,
    this.simulationTickIntervalMs = 1000,
    this.simulationSpeedMultiplier = 1.0,
  });

  bool get isSimulation => appMode == AppMode.simulation;
  bool get isReal => appMode == AppMode.real;

  AppConfig copyWith({
    String? apiBaseUrl,
    String? socketUrl,
    AppMode? appMode,
    int? assignmentTimeoutSeconds,
    int? simulationTickIntervalMs,
    double? simulationSpeedMultiplier,
  }) {
    return AppConfig(
      apiBaseUrl: apiBaseUrl ?? this.apiBaseUrl,
      socketUrl: socketUrl ?? this.socketUrl,
      appMode: appMode ?? this.appMode,
      assignmentTimeoutSeconds:
          assignmentTimeoutSeconds ?? this.assignmentTimeoutSeconds,
      simulationTickIntervalMs:
          simulationTickIntervalMs ?? this.simulationTickIntervalMs,
      simulationSpeedMultiplier:
          simulationSpeedMultiplier ?? this.simulationSpeedMultiplier,
    );
  }
}
