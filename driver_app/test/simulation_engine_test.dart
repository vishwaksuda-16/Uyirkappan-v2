import 'package:flutter_test/flutter_test.dart';
import 'package:driver_app/core/utils/geo_utils.dart';
import 'package:driver_app/services/location/simulated_location_service.dart';
import 'package:driver_app/services/simulation/road_network.dart';
import 'package:driver_app/services/simulation/simulation_engine.dart';
import 'package:driver_app/services/socket/simulated_socket_service.dart';

void main() {
  group('Simulation & Telemetry Tests', () {
    late SimulatedSocketService socketService;
    late SimulationEngine engine;

    setUp(() {
      socketService = SimulatedSocketService();
      engine = SimulationEngine(socketService: socketService);
    });

    tearDown(() {
      socketService.dispose();
    });

    test('Generates documented emergency assignment UK-000001', () {
      final assignment = engine.generateMockAssignment(
        requestId: 'UK-000001',
        ambulanceId: 'AMB-003',
        driverId: 'DRV-003',
      );

      expect(assignment.requestId, 'UK-000001');
      expect(assignment.ambulanceId, 'AMB-003');
      expect(assignment.driverId, 'DRV-003');
      expect(assignment.emergency.emergencyType, 'Cardiac Emergency');
      expect(assignment.emergency.victimCount, 1);
      expect(assignment.timeoutSeconds, 15);
      expect(assignment.destinationHospital?.hospitalId, anyOf('HOSP-01', 'H1'));
    });

    test('Records auditable dispatch attempts correctly', () {
      engine.recordAttempt(ambulanceId: 'AMB-003', outcome: 'TIMEOUT');
      engine.recordAttempt(ambulanceId: 'AMB-005', outcome: 'REJECTED', reason: 'On break');
      engine.recordAttempt(ambulanceId: 'AMB-002', outcome: 'ACCEPTED');

      final attempts = engine.dispatchAttempts;
      expect(attempts.length, 3);
      expect(attempts[0].attemptNumber, 1);
      expect(attempts[0].ambulanceId, 'AMB-003');
      expect(attempts[0].outcome, 'TIMEOUT');

      expect(attempts[1].attemptNumber, 2);
      expect(attempts[1].ambulanceId, 'AMB-005');
      expect(attempts[1].outcome, 'REJECTED');

      expect(attempts[2].attemptNumber, 3);
      expect(attempts[2].ambulanceId, 'AMB-002');
      expect(attempts[2].outcome, 'ACCEPTED');
    });

    test('GeoUtils computes distance and bearing accurately', () {
      const p1 = GeoPoint(13.0827, 80.2707); // Chennai Central
      const p2 = GeoPoint(13.0645, 80.2600); // Mount Road

      final distance = GeoUtils.distanceKm(p1, p2);
      expect(distance, greaterThan(1.0));
      expect(distance, lessThan(5.0));

      final bearing = GeoUtils.calculateBearing(p1, p2);
      expect(bearing, greaterThanOrEqualTo(0.0));
      expect(bearing, lessThan(360.0));

      final interpolated = GeoUtils.interpolate(p1, p2, 0.5);
      expect(interpolated.latitude, closeTo((p1.latitude + p2.latitude) / 2, 0.0001));
    });

    test('RoadNetwork has documented routes to patient and hospital', () {
      final routeToPatient = RoadNetwork.getPrimaryRouteToPatient();
      expect(routeToPatient.waypoints.length, 5);
      expect(routeToPatient.waypoints.first.nodeId, 'Node 10');
      expect(routeToPatient.waypoints.last.nodeId, 'Node 24');

      final routeToHospital = RoadNetwork.getRouteToHospital();
      expect(routeToHospital.waypoints.length, 5);
      expect(routeToHospital.waypoints.first.nodeId, 'Node 24');
      expect(routeToHospital.waypoints.last.nodeId, 'Hospital H1');
    });

    test('SimulatedLocationService initializes and emits location', () async {
      final locationService = SimulatedLocationService();
      final route = RoadNetwork.getPrimaryRouteToPatient();

      final firstLocationFuture = locationService.locationStream.first;
      locationService.startTracking(route, 'AMB-003', requestId: 'UK-000001');

      final loc = await firstLocationFuture;
      expect(loc.ambulanceId, 'AMB-003');
      expect(loc.requestId, 'UK-000001');
      expect(loc.latitude, closeTo(13.0827, 0.001));
      expect(loc.speed, greaterThanOrEqualTo(20.0));

      locationService.dispose();
    });
  });
}
