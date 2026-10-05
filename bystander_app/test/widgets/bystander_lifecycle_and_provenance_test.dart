import 'dart:async';
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:uyirkappan_bystander/data/datasources/emergency_request_datasource.dart';
import 'package:uyirkappan_bystander/data/datasources/tracking_datasource.dart';
import 'package:uyirkappan_bystander/data/models/emergency_request_model.dart';
import 'package:uyirkappan_bystander/data/models/eta_model.dart';
import 'package:uyirkappan_bystander/data/models/tracking_model.dart';
import 'package:uyirkappan_bystander/data/repositories/emergency_request_repository_impl.dart';
import 'package:uyirkappan_bystander/data/repositories/tracking_repository_impl.dart';
import 'package:uyirkappan_bystander/domain/entities/emergency_type.dart';
import 'package:uyirkappan_bystander/domain/entities/location_data.dart';
import 'package:uyirkappan_bystander/domain/entities/request_status.dart';
import 'package:uyirkappan_bystander/presentation/controllers/emergency_controller.dart';
import 'package:uyirkappan_bystander/presentation/screens/status/request_status_screen.dart';
import 'package:uyirkappan_bystander/presentation/widgets/gps_provenance_badge.dart';
import 'package:uyirkappan_bystander/presentation/widgets/stale_telemetry_banner.dart';
import '../unit/mock_repository_test.dart';

class StubEmergencyRequestDataSource implements EmergencyRequestDataSource {
  EmergencyRequestModel? stored;
  final _controller = StreamController<EmergencyRequestModel>.broadcast();

  @override
  Future<EmergencyRequestModel> createEmergencyRequest(EmergencyRequestModel request) async {
    stored = request.copyWith(
      requestId: request.requestId.isEmpty ? 'UK-TEST-9001' : request.requestId,
      createdAt: DateTime.now(),
    );
    return stored!;
  }

  @override
  Future<EmergencyRequestModel> getEmergencyRequest(String requestId) async => stored!;

  @override
  Future<RequestStatus> getRequestStatus(String requestId) async => stored!.status;

  @override
  Future<String?> recommendHospitalDestination({
    required EmergencyType emergencyType,
    required int victimCount,
    required LocationData emergencyLocation,
  }) async => 'Apollo Hospital Greams Road';

  @override
  Future<EmergencyRequestModel> cancelEmergencyRequest(String requestId, {String? reason}) async {
    stored = stored!.copyWith(status: RequestStatus.cancelled);
    _controller.add(stored!);
    return stored!;
  }

  @override
  Stream<EmergencyRequestModel> watchRequestUpdates(String requestId) => _controller.stream;

  void emitUpdate(EmergencyRequestModel update) {
    stored = update;
    _controller.add(update);
  }

  void dispose() {
    _controller.close();
  }
}

class StubTrackingDataSource implements TrackingDataSource {
  TrackingModel? telemetry;
  final _controller = StreamController<TrackingModel>.broadcast();
  final _etaController = StreamController<EtaModel>.broadcast();

  @override
  Future<TrackingModel?> getTrackingInfo(String requestId) async => telemetry;

  @override
  Future<EtaModel?> getEta(String requestId) async => telemetry?.eta as EtaModel?;

  @override
  Stream<TrackingModel> watchTrackingUpdates(String requestId) => _controller.stream;

  @override
  Stream<EtaModel> watchEtaUpdates(String requestId) => _etaController.stream;

  void emitTelemetry(TrackingModel model) {
    telemetry = model;
    _controller.add(model);
  }

  void dispose() {
    _controller.close();
    _etaController.close();
  }
}

void main() {
  group('Phase 9 — GPS Provenance Badge Tests', () {
    testWidgets('renders Real GPS badge with green styling and icon', (tester) async {
      await tester.pumpWidget(
        const MaterialApp(
          home: Scaffold(
            body: GpsProvenanceBadge(
              isRealGps: true,
              isStale: false,
            ),
          ),
        ),
      );

      expect(find.text('● GPS LIVE (REAL)'), findsOneWidget);
      expect(find.byIcon(Icons.gps_fixed_rounded), findsOneWidget);
    });

    testWidgets('renders Simulation GPS badge with amber styling and icon', (tester) async {
      await tester.pumpWidget(
        const MaterialApp(
          home: Scaffold(
            body: GpsProvenanceBadge(
              isRealGps: false,
              isStale: false,
            ),
          ),
        ),
      );

      expect(find.text('○ GPS SIMULATION'), findsOneWidget);
      expect(find.byIcon(Icons.gps_not_fixed_rounded), findsOneWidget);
    });

    testWidgets('renders staleness lag indicator when telemetry is stale', (tester) async {
      await tester.pumpWidget(
        const MaterialApp(
          home: Scaffold(
            body: GpsProvenanceBadge(
              isRealGps: true,
              isStale: true,
              secondsSinceUpdate: 52,
            ),
          ),
        ),
      );

      expect(find.text('● GPS LIVE (REAL)'), findsOneWidget);
      expect(find.text('52s lag'), findsOneWidget);
    });
  });

  group('Phase 9 — Stale Telemetry Banner Tests', () {
    testWidgets('renders reassuring delay notification with exact seconds', (tester) async {
      await tester.pumpWidget(
        const MaterialApp(
          home: Scaffold(
            body: StaleTelemetryBanner(secondsDelayed: 60),
          ),
        ),
      );

      expect(find.text('Telemetry Connection Re-establishing'), findsOneWidget);
      expect(
        find.text('Telemetry update delayed; last received 60 seconds ago. Unit is continuing on assigned route.'),
        findsOneWidget,
      );
      expect(find.byIcon(Icons.sync_problem_rounded), findsOneWidget);
    });
  });

  group('Phase 9 — RequestStatusScreen Comprehensive Lifecycle & Provenance Tests', () {
    late StubEmergencyRequestDataSource requestDataSource;
    late StubTrackingDataSource trackingDataSource;
    late EmergencyRequestRepositoryImpl requestRepository;
    late TrackingRepositoryImpl trackingRepository;
    late EmergencyController emergencyController;

    setUp(() {
      requestDataSource = StubEmergencyRequestDataSource();
      trackingDataSource = StubTrackingDataSource();
      requestRepository = EmergencyRequestRepositoryImpl(
        dataSource: requestDataSource,
        localDataSource: FakeLocalDataSource(),
      );
      trackingRepository = TrackingRepositoryImpl(dataSource: trackingDataSource);
      emergencyController = EmergencyController(repository: requestRepository);
    });

    tearDown(() {
      emergencyController.dispose();
      requestDataSource.dispose();
      trackingDataSource.dispose();
    });

    testWidgets('displays assigned unit with live Real GPS badge and driver contact', (tester) async {
      await emergencyController.submitEmergencyRequest(
        emergencyLocation: LocationData(
          latitude: 13.0827,
          longitude: 80.2707,
          timestamp: DateTime.now(),
        ),
      );

      // Simulate assignment with Real GPS telemetry
      final assignedModel = requestDataSource.stored!.copyWith(
        status: RequestStatus.assigned,
        assignedAmbulanceId: 'AMB-CH-007',
        assignedDriverName: 'Murugan Pillai',
        driverPhone: '+91 98400 11223',
        currentETA: 4,
      );
      requestDataSource.emitUpdate(assignedModel);

      trackingDataSource.telemetry = TrackingModel(
        ambulanceId: 'AMB-CH-007',
        requestId: assignedModel.requestId,
        latitude: 13.0850,
        longitude: 80.2720,
        timestamp: DateTime.now(),
        status: RequestStatus.assigned,
        provider: 'real',
        gpsSource: 'DEVICE',
        isSimulated: false,
        driverName: 'Murugan Pillai',
        driverPhone: '+91 98400 11223',
      );

      await tester.pumpWidget(
        MaterialApp(
          home: RequestStatusScreen(
            emergencyController: emergencyController,
            trackingRepository: trackingRepository,
          ),
        ),
      );

      await tester.pumpAndSettle();

      expect(find.text('AMB-CH-007'), findsOneWidget);
      expect(find.text('● GPS LIVE (REAL)'), findsOneWidget);
      expect(find.text('Murugan Pillai'), findsOneWidget);
      expect(find.text('+91 98400 11223'), findsOneWidget);
      expect(find.text('Estimated Arrival Time: 4 minutes'), findsOneWidget);
      expect(find.text('OPEN LIVE MAP TRACKING'), findsOneWidget);
    });

    testWidgets('displays cascading fallback notification and preserves requestId', (tester) async {
      await emergencyController.submitEmergencyRequest(
        emergencyLocation: LocationData(
          latitude: 13.0827,
          longitude: 80.2707,
          timestamp: DateTime.now(),
        ),
      );

      final origId = emergencyController.activeRequest!.requestId;

      // Trigger fallback count 1
      requestDataSource.emitUpdate(
        requestDataSource.stored!.copyWith(
          status: RequestStatus.searching,
          fallbackCount: 1,
        ),
      );

      await tester.pumpWidget(
        MaterialApp(
          home: RequestStatusScreen(
            emergencyController: emergencyController,
            trackingRepository: trackingRepository,
          ),
        ),
      );

      await tester.pumpAndSettle();

      expect(find.text('Your ambulance assignment is being updated. (Attempt #2)'), findsOneWidget);
      expect(find.text(origId), findsOneWidget);
      expect(
        find.text(
          'Initial unit could not proceed. Cascading fallback is automatically re-assigning the next nearest ambulance. Please stay where you are.',
        ),
        findsOneWidget,
      );
    });

    testWidgets('displays NO_AMBULANCE_AVAILABLE state with 108 Helpline CTA', (tester) async {
      await emergencyController.submitEmergencyRequest(
        emergencyLocation: LocationData(
          latitude: 13.0827,
          longitude: 80.2707,
          timestamp: DateTime.now(),
        ),
      );

      requestDataSource.emitUpdate(
        requestDataSource.stored!.copyWith(
          status: RequestStatus.noAmbulanceAvailable,
        ),
      );

      await tester.pumpWidget(
        MaterialApp(
          home: RequestStatusScreen(
            emergencyController: emergencyController,
            trackingRepository: trackingRepository,
          ),
        ),
      );

      await tester.pumpAndSettle();

      expect(find.text('CALL EMERGENCY HELPLINE DIRECTLY'), findsOneWidget);
      expect(find.text('DIAL 108 NOW'), findsOneWidget);
      expect(find.text('CREATE NEW REQUEST'), findsOneWidget);
    });

    testWidgets('displays CANCELLED state and disables cancel button', (tester) async {
      await emergencyController.submitEmergencyRequest(
        emergencyLocation: LocationData(
          latitude: 13.0827,
          longitude: 80.2707,
          timestamp: DateTime.now(),
        ),
      );

      requestDataSource.emitUpdate(
        requestDataSource.stored!.copyWith(
          status: RequestStatus.cancelled,
        ),
      );

      await tester.pumpWidget(
        MaterialApp(
          home: RequestStatusScreen(
            emergencyController: emergencyController,
            trackingRepository: trackingRepository,
          ),
        ),
      );

      await tester.pumpAndSettle();

      expect(find.text('Emergency cancelled'), findsOneWidget);
      expect(find.text('CREATE NEW REQUEST'), findsOneWidget);
      expect(find.text('CANCEL EMERGENCY REQUEST'), findsNothing);
    });

    testWidgets('displays cancel confirmation modal and recalls unit when confirmed', (tester) async {
      await emergencyController.submitEmergencyRequest(
        emergencyLocation: LocationData(
          latitude: 13.0827,
          longitude: 80.2707,
          timestamp: DateTime.now(),
        ),
      );

      await tester.pumpWidget(
        MaterialApp(
          home: RequestStatusScreen(
            emergencyController: emergencyController,
            trackingRepository: trackingRepository,
          ),
        ),
      );

      await tester.pumpAndSettle();

      // Tap Cancel Button
      await tester.ensureVisible(find.text('CANCEL EMERGENCY REQUEST'));
      await tester.tap(find.text('CANCEL EMERGENCY REQUEST'));
      await tester.pumpAndSettle();

      // Verify Dialog appeared
      expect(find.text('Cancel Emergency Request?'), findsOneWidget);
      expect(find.text('CANCEL EMERGENCY'), findsOneWidget);

      // Confirm Cancellation
      await tester.tap(find.text('CANCEL EMERGENCY'));
      await tester.pumpAndSettle();

      expect(emergencyController.activeRequest?.status, RequestStatus.cancelled);
    });

    testWidgets('renders all 7 active lifecycle states with multi-cue status badge and icon', (tester) async {
      final statuses = [
        RequestStatus.searching,
        RequestStatus.assigned,
        RequestStatus.accepted,
        RequestStatus.enRouteToPatient,
        RequestStatus.arrivedAtPatient,
        RequestStatus.patientOnboard,
        RequestStatus.enRouteToHospital,
        RequestStatus.arrivedAtHospital,
        RequestStatus.completed,
      ];

      for (final st in statuses) {
        final req = EmergencyRequestModel(
          requestId: 'UK-STATUS-TEST',
          requesterId: 'user-01',
          emergencyType: EmergencyType.cardiacEmergency,
          victimCount: 1,
          emergencyLocation: LocationData(latitude: 13.0827, longitude: 80.2707, timestamp: DateTime.now()),
          createdAt: DateTime.now(),
          status: st,
          assignedAmbulanceId: st.isActive ? 'AMB-TEST' : null,
        );

        requestDataSource.stored = req;
        emergencyController.resetForm();
        await emergencyController.submitEmergencyRequest(
          emergencyLocation: req.emergencyLocation,
        );
        requestDataSource.emitUpdate(req);

        await tester.pumpWidget(
          MaterialApp(
            home: RequestStatusScreen(
              emergencyController: emergencyController,
              trackingRepository: trackingRepository,
            ),
          ),
        );

        await tester.pumpAndSettle();

        // Assert user description is displayed
        expect(find.text(st.userDescription), findsOneWidget);
      }
    });

    testWidgets('renders cleanly on narrow 320x568 screen with zero overflow', (tester) async {
      tester.view.physicalSize = const Size(320, 568);
      tester.view.devicePixelRatio = 1.0;
      addTearDown(tester.view.resetPhysicalSize);
      addTearDown(tester.view.resetDevicePixelRatio);

      await emergencyController.submitEmergencyRequest(
        emergencyLocation: LocationData(
          latitude: 13.0827,
          longitude: 80.2707,
          timestamp: DateTime.now(),
        ),
      );

      final assignedModel = requestDataSource.stored!.copyWith(
        status: RequestStatus.enRouteToPatient,
        assignedAmbulanceId: 'AMB-320',
        assignedDriverName: 'Compact Tester',
        driverPhone: '+91 99999 88888',
        currentETA: 5,
      );
      requestDataSource.emitUpdate(assignedModel);

      await tester.pumpWidget(
        MaterialApp(
          home: RequestStatusScreen(
            emergencyController: emergencyController,
            trackingRepository: trackingRepository,
          ),
        ),
      );

      await tester.pumpAndSettle();

      expect(tester.takeException(), isNull);
      expect(find.text('AMB-320'), findsOneWidget);
    });
  });
}
