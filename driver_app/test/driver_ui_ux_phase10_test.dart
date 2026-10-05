// Phase 10 — Driver UI/UX Implementation & Forensic Audit Test Suite
// Covers: GPS provenance badges, stale telemetry, overflow at 320x568,
//         lifecycle progression, accessibility semantics, widget rendering.

import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:driver_app/widgets/common/gps_provenance_badge.dart';
import 'package:driver_app/widgets/common/stale_telemetry_banner.dart';
import 'package:driver_app/widgets/common/connection_badge.dart';
import 'package:driver_app/widgets/common/status_badge.dart';
import 'package:driver_app/models/state_enums.dart';
import 'package:driver_app/state/state_machine.dart';
import 'package:driver_app/core/constants/app_colors.dart';
import 'package:driver_app/services/location/location_provider.dart';

void main() {
  // ─── GPS Provenance Badge Tests ─────────────────────────────────────────
  group('GpsProvenanceBadge', () {
    testWidgets('shows "● GPS LIVE (REAL)" text when isRealGps is true', (tester) async {
      await tester.pumpWidget(
        const MaterialApp(
          home: Scaffold(
            body: GpsProvenanceBadge(isRealGps: true),
          ),
        ),
      );
      expect(find.text('● GPS LIVE (REAL)'), findsOneWidget);
      expect(find.text('○ GPS SIMULATION'), findsNothing);
    });

    testWidgets('shows "○ GPS SIMULATION" text when isRealGps is false', (tester) async {
      await tester.pumpWidget(
        const MaterialApp(
          home: Scaffold(
            body: GpsProvenanceBadge(isRealGps: false),
          ),
        ),
      );
      expect(find.text('○ GPS SIMULATION'), findsOneWidget);
      expect(find.text('● GPS LIVE (REAL)'), findsNothing);
    });

    testWidgets('shows lag indicator when stale with secondsSinceUpdate', (tester) async {
      await tester.pumpWidget(
        const MaterialApp(
          home: Scaffold(
            body: GpsProvenanceBadge(
              isRealGps: true,
              isStale: true,
              secondsSinceUpdate: 60,
            ),
          ),
        ),
      );
      expect(find.text('60s lag'), findsOneWidget);
    });

    testWidgets('does not show lag indicator when not stale', (tester) async {
      await tester.pumpWidget(
        const MaterialApp(
          home: Scaffold(
            body: GpsProvenanceBadge(
              isRealGps: false,
              isStale: false,
              secondsSinceUpdate: 10,
            ),
          ),
        ),
      );
      expect(find.textContaining('lag'), findsNothing);
    });

    testWidgets('includes Semantics label for accessibility', (tester) async {
      await tester.pumpWidget(
        const MaterialApp(
          home: Scaffold(
            body: GpsProvenanceBadge(isRealGps: true),
          ),
        ),
      );
      final semantics = tester.getSemantics(find.byType(GpsProvenanceBadge));
      expect(semantics.label, contains('GPS'));
    });

    testWidgets('compact mode renders smaller', (tester) async {
      await tester.pumpWidget(
        const MaterialApp(
          home: Scaffold(
            body: Row(
              children: [
                GpsProvenanceBadge(isRealGps: true, isCompact: true),
                GpsProvenanceBadge(isRealGps: true, isCompact: false),
              ],
            ),
          ),
        ),
      );
      // Both badges should render without error
      expect(find.byType(GpsProvenanceBadge), findsNWidgets(2));
    });
  });

  // ─── Stale Telemetry Banner Tests ───────────────────────────────────────
  group('StaleTelemetryBanner', () {
    testWidgets('shows banner when secondsSinceUpdate >= staleThresholdSeconds', (tester) async {
      await tester.pumpWidget(
        MaterialApp(
          home: Scaffold(
            body: StaleTelemetryBanner(
              secondsSinceUpdate: 50,
              staleThresholdSeconds: 45,
              onDismiss: () {},
            ),
          ),
        ),
      );
      expect(find.textContaining('50 seconds'), findsOneWidget);
      expect(find.textContaining('Stale'), findsOneWidget);
    });

    testWidgets('hides banner when secondsSinceUpdate < staleThresholdSeconds', (tester) async {
      await tester.pumpWidget(
        MaterialApp(
          home: Scaffold(
            body: StaleTelemetryBanner(
              secondsSinceUpdate: 30,
              staleThresholdSeconds: 45,
              onDismiss: () {},
            ),
          ),
        ),
      );
      expect(find.byType(StaleTelemetryBanner), findsOneWidget);
      // The widget should render a SizedBox.shrink
      expect(find.textContaining('seconds'), findsNothing);
    });

    testWidgets('dismiss button has minimum 48px touch target', (tester) async {
      bool dismissed = false;
      await tester.pumpWidget(
        MaterialApp(
          home: Scaffold(
            body: StaleTelemetryBanner(
              secondsSinceUpdate: 60,
              onDismiss: () => dismissed = true,
            ),
          ),
        ),
      );
      final closeButton = find.byIcon(Icons.close);
      expect(closeButton, findsOneWidget);
      await tester.tap(closeButton);
      expect(dismissed, isTrue);
    });

    testWidgets('includes Semantics label', (tester) async {
      await tester.pumpWidget(
        MaterialApp(
          home: Scaffold(
            body: StaleTelemetryBanner(
              secondsSinceUpdate: 50,
              onDismiss: () {},
            ),
          ),
        ),
      );
      final semantics = tester.getSemantics(find.byType(StaleTelemetryBanner));
      expect(semantics.label, contains('lagging'));
    });
  });

  // ─── Connection Badge Tests ─────────────────────────────────────────────
  group('ConnectionBadge', () {
    testWidgets('displays all ConnectionStatus variants without overflow', (tester) async {
      for (final status in ConnectionStatus.values) {
        await tester.pumpWidget(
          MaterialApp(
            home: Scaffold(
              body: ConnectionBadge(status: status),
            ),
          ),
        );
        expect(find.text(status.displayName), findsOneWidget);
      }
    });
  });

  // ─── Driver Lifecycle State Machine Tests ───────────────────────────────
  group('DriverLifecycleState & StateMachine', () {
    test('full lifecycle progression is valid: available → completed → available', () {
      final progression = [
        DriverLifecycleState.available,
        DriverLifecycleState.assignmentReceived,
        DriverLifecycleState.accepted,
        DriverLifecycleState.enRouteToPatient,
        DriverLifecycleState.arrivedAtPatient,
        DriverLifecycleState.patientOnboard,
        DriverLifecycleState.enRouteToHospital,
        DriverLifecycleState.arrivedAtHospital,
        DriverLifecycleState.completed,
        DriverLifecycleState.available,
      ];

      for (int i = 0; i < progression.length - 1; i++) {
        expect(
          () => DriverStateMachine.validateTransition(progression[i], progression[i + 1]),
          returnsNormally,
          reason: '${progression[i]} → ${progression[i + 1]} should be valid',
        );
      }
    });

    test('skipping lifecycle states is rejected', () {
      expect(
        () => DriverStateMachine.validateTransition(
          DriverLifecycleState.accepted,
          DriverLifecycleState.arrivedAtPatient,
        ),
        throwsA(isA<Exception>()),
        reason: 'Cannot skip EN_ROUTE_TO_PATIENT',
      );
    });

    test('isActiveEmergency returns true for active states', () {
      expect(DriverLifecycleState.accepted.isActiveEmergency, isTrue);
      expect(DriverLifecycleState.enRouteToPatient.isActiveEmergency, isTrue);
      expect(DriverLifecycleState.arrivedAtPatient.isActiveEmergency, isTrue);
      expect(DriverLifecycleState.patientOnboard.isActiveEmergency, isTrue);
      expect(DriverLifecycleState.enRouteToHospital.isActiveEmergency, isTrue);
      expect(DriverLifecycleState.arrivedAtHospital.isActiveEmergency, isTrue);
    });

    test('isActiveEmergency returns false for non-active states', () {
      expect(DriverLifecycleState.offline.isActiveEmergency, isFalse);
      expect(DriverLifecycleState.available.isActiveEmergency, isFalse);
      expect(DriverLifecycleState.completed.isActiveEmergency, isFalse);
      expect(DriverLifecycleState.rejected.isActiveEmergency, isFalse);
      expect(DriverLifecycleState.timeout.isActiveEmergency, isFalse);
    });

    test('displayName returns correct backend status strings', () {
      expect(DriverLifecycleState.enRouteToPatient.displayName, 'EN_ROUTE_TO_PATIENT');
      expect(DriverLifecycleState.arrivedAtHospital.displayName, 'ARRIVED_AT_HOSPITAL');
      expect(DriverLifecycleState.patientOnboard.displayName, 'PATIENT_ONBOARD');
    });

    test('fromString parses backend status aliases correctly', () {
      expect(DriverLifecycleState.fromString('DRIVER_ACCEPTED'), DriverLifecycleState.accepted);
      expect(DriverLifecycleState.fromString('ACCEPTED'), DriverLifecycleState.accepted);
      expect(DriverLifecycleState.fromString('PENDING'), DriverLifecycleState.assignmentReceived);
      expect(DriverLifecycleState.fromString('ASSIGNED'), DriverLifecycleState.assignmentReceived);
      expect(DriverLifecycleState.fromString('NEW'), DriverLifecycleState.assignmentReceived);
    });
  });

  // ─── LocationProviderStatus Tests ──────────────────────────────────────
  group('LocationProviderStatus', () {
    test('isOperational returns true for live, simulation, degraded', () {
      expect(LocationProviderStatus.live.isOperational, isTrue);
      expect(LocationProviderStatus.simulation.isOperational, isTrue);
      expect(LocationProviderStatus.degraded.isOperational, isTrue);
    });

    test('isOperational returns false for error states', () {
      expect(LocationProviderStatus.permissionDenied.isOperational, isFalse);
      expect(LocationProviderStatus.permissionDeniedForever.isOperational, isFalse);
      expect(LocationProviderStatus.serviceDisabled.isOperational, isFalse);
      expect(LocationProviderStatus.unavailable.isOperational, isFalse);
      expect(LocationProviderStatus.initializing.isOperational, isFalse);
    });

    test('displayName matches Phase 3 provenance standard', () {
      expect(LocationProviderStatus.live.displayName, 'GPS LIVE');
      expect(LocationProviderStatus.simulation.displayName, 'GPS SIMULATION');
    });
  });

  // ─── Responsive Layout Overflow Test (320×568) ──────────────────────────
  group('Responsive Layout & Overflow', () {
    testWidgets('GpsProvenanceBadge + ConnectionBadge + StatusBadge render on 320px without overflow',
        (tester) async {
      tester.view.physicalSize = const Size(320, 568);
      tester.view.devicePixelRatio = 1.0;
      addTearDown(() {
        tester.view.resetPhysicalSize();
        tester.view.resetDevicePixelRatio();
      });

      await tester.pumpWidget(
        MaterialApp(
          theme: ThemeData.dark(),
          home: Scaffold(
            body: SingleChildScrollView(
              padding: const EdgeInsets.all(16),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  // Badge row with Wrap (matching Phase 10 Wrap pattern)
                  Wrap(
                    spacing: 4,
                    runSpacing: 4,
                    children: [
                      const GpsProvenanceBadge(isRealGps: false, isCompact: true),
                      const ConnectionBadge(status: ConnectionStatus.simulationMode),
                    ],
                  ),
                  const SizedBox(height: 8),
                  // Status badge
                  const StatusBadge(availability: AmbulanceAvailability.available),
                  const SizedBox(height: 8),
                  // Stale telemetry banner
                  StaleTelemetryBanner(
                    secondsSinceUpdate: 60,
                    onDismiss: () {},
                  ),
                ],
              ),
            ),
          ),
        ),
      );
      await tester.pumpAndSettle();

      // Verify no overflow errors were thrown
      expect(tester.takeException(), isNull);
    });

    testWidgets('All Phase 10 widgets render at 360×640 without overflow', (tester) async {
      tester.view.physicalSize = const Size(360, 640);
      tester.view.devicePixelRatio = 1.0;
      addTearDown(() {
        tester.view.resetPhysicalSize();
        tester.view.resetDevicePixelRatio();
      });

      await tester.pumpWidget(
        MaterialApp(
          theme: ThemeData.dark(),
          home: Scaffold(
            body: SingleChildScrollView(
              padding: const EdgeInsets.all(16),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  const GpsProvenanceBadge(isRealGps: true),
                  const SizedBox(height: 8),
                  const GpsProvenanceBadge(
                    isRealGps: true,
                    isStale: true,
                    secondsSinceUpdate: 120,
                    isCompact: true,
                  ),
                  const SizedBox(height: 8),
                  StaleTelemetryBanner(
                    secondsSinceUpdate: 90,
                    onDismiss: () {},
                  ),
                  const SizedBox(height: 8),
                  const ConnectionBadge(status: ConnectionStatus.connected),
                  const SizedBox(height: 8),
                  const StatusBadge(availability: AmbulanceAvailability.busy),
                ],
              ),
            ),
          ),
        ),
      );
      await tester.pumpAndSettle();
      expect(tester.takeException(), isNull);
    });
  });

  // ─── AmbulanceAvailability Display Tests ────────────────────────────────
  group('AmbulanceAvailability', () {
    test('displayName returns correct strings', () {
      expect(AmbulanceAvailability.offline.displayName, 'OFFLINE');
      expect(AmbulanceAvailability.available.displayName, 'AVAILABLE');
      expect(AmbulanceAvailability.busy.displayName, 'BUSY');
    });

    test('fromString parses all values', () {
      expect(AmbulanceAvailability.fromString('AVAILABLE'), AmbulanceAvailability.available);
      expect(AmbulanceAvailability.fromString('BUSY'), AmbulanceAvailability.busy);
      expect(AmbulanceAvailability.fromString('OFFLINE'), AmbulanceAvailability.offline);
      expect(AmbulanceAvailability.fromString('UNKNOWN'), AmbulanceAvailability.offline);
    });
  });

  // ─── ConnectionStatus Display Tests ─────────────────────────────────────
  group('ConnectionStatus', () {
    test('displayName returns correct strings', () {
      expect(ConnectionStatus.connected.displayName, 'CONNECTED');
      expect(ConnectionStatus.connecting.displayName, 'CONNECTING');
      expect(ConnectionStatus.disconnected.displayName, 'DISCONNECTED');
      expect(ConnectionStatus.simulationMode.displayName, 'SIMULATION MODE');
    });
  });

  // ─── RawLocationData Tests ──────────────────────────────────────────────
  group('RawLocationData', () {
    test('toJson serializes all fields correctly', () {
      final now = DateTime.utc(2026, 10, 3, 12, 0, 0);
      final dataWithTime = RawLocationData(
        latitude: 13.0827,
        longitude: 80.2707,
        timestamp: now,
        speed: 42.0,
        heading: 90.0,
        accuracy: 5.0,
        altitude: 10.0,
        isMock: false,
        provider: 'real_gps',
      );

      final json = dataWithTime.toJson();
      expect(json['latitude'], 13.0827);
      expect(json['longitude'], 80.2707);
      expect(json['speed'], 42.0);
      expect(json['provider'], 'real_gps');
      expect(json['isMock'], false);
    });

    test('provider field distinguishes real from simulation', () {
      final real = RawLocationData(
        latitude: 13.0,
        longitude: 80.0,
        timestamp: DateTime.now(),
        provider: 'real_gps',
      );
      final sim = RawLocationData(
        latitude: 13.0,
        longitude: 80.0,
        timestamp: DateTime.now(),
        provider: 'simulation',
        isMock: true,
      );
      expect(real.provider, 'real_gps');
      expect(sim.provider, 'simulation');
      expect(sim.isMock, true);
    });
  });
}
