import '../../core/utils/geo_utils.dart';
import '../../models/hospital.dart';
import '../../models/route_model.dart';

class RoadNetwork {
  RoadNetwork._();

  // Defined nodes with real-world Chennai coordinate mappings
  static const Map<String, RouteWaypoint> nodes = {
    'Node 10': RouteWaypoint(
      nodeId: 'Node 10',
      nodeName: 'Ambulance Base Station',
      location: GeoPoint(13.0827, 80.2707),
      roadName: 'Poonamallee High Road',
    ),
    'Node 11': RouteWaypoint(
      nodeId: 'Node 11',
      nodeName: 'Ripon Building Junction',
      location: GeoPoint(13.0835, 80.2740),
      roadName: 'EVR Periyar Salai',
    ),
    'Node 12': RouteWaypoint(
      nodeId: 'Node 12',
      nodeName: 'Central Station Flyover',
      location: GeoPoint(13.0818, 80.2762),
      roadName: 'Central Flyover',
    ),
    'Node 13': RouteWaypoint(
      nodeId: 'Node 13',
      nodeName: 'Park Town Junction',
      location: GeoPoint(13.0790, 80.2745),
      roadName: 'Pallavan Salai',
    ),
    'Node 14': RouteWaypoint(
      nodeId: 'Node 14',
      nodeName: 'Greams Road Approach',
      location: GeoPoint(13.0610, 80.2520),
      roadName: 'Greams Road',
    ),
    'Node 15': RouteWaypoint(
      nodeId: 'Node 15',
      nodeName: 'Island Grounds Cross',
      location: GeoPoint(13.0740, 80.2780),
      roadName: 'Anna Salai North',
    ),
    'Node 17': RouteWaypoint(
      nodeId: 'Node 17',
      nodeName: 'Bypass Avenue',
      location: GeoPoint(13.0720, 80.2680),
      roadName: 'Chintadripet Link',
    ),
    'Node 18': RouteWaypoint(
      nodeId: 'Node 18',
      nodeName: 'Thousand Lights Junction',
      location: GeoPoint(13.0628, 80.2540),
      roadName: 'Anna Salai South',
    ),
    'Node 19': RouteWaypoint(
      nodeId: 'Node 19',
      nodeName: 'LIC Metro Intersection',
      location: GeoPoint(13.0680, 80.2650),
      roadName: 'Anna Salai Central',
    ),
    'Node 21': RouteWaypoint(
      nodeId: 'Node 21',
      nodeName: 'Royapettah High Road',
      location: GeoPoint(13.0580, 80.2620),
      roadName: 'Royapettah Link',
    ),
    'Node 24': RouteWaypoint(
      nodeId: 'Node 24',
      nodeName: 'Mount Road Junction (Patient Location)',
      location: GeoPoint(13.0645, 80.2600),
      roadName: 'Mount Road Sector 4',
    ),
    'Hospital H1': RouteWaypoint(
      nodeId: 'Hospital H1',
      nodeName: 'Apollo Trauma & Emergency Center (HOSP-01)',
      location: GeoPoint(13.0585, 80.2505),
      roadName: 'Greams Lane Emergency Gate',
    ),
  };

  // Standard Hospital H1 destination (matching HOSP-01)
  static const Hospital hospitalH1 = Hospital(
    hospitalId: 'HOSP-01',
    name: 'Apollo Trauma & Emergency Center (HOSP-01)',
    location: GeoPoint(13.0585, 80.2505),
    address: '21 Greams Lane, Thousand Lights, Chennai',
    distanceKm: 6.4,
    etaMinutes: 11,
    availableBeds: 5,
    specialties: ['Cardiology ICU', 'Advanced Trauma', 'Stroke Unit', 'Cath Lab'],
    emergencyContact: '+91 44 2829 0200',
  );

  /// Primary route to patient: Node 10 -> Node 12 -> Node 15 -> Node 19 -> Node 24 (Doc page 12)
  static RouteModel getPrimaryRouteToPatient() {
    final wpKeys = ['Node 10', 'Node 12', 'Node 15', 'Node 19', 'Node 24'];
    final waypoints = wpKeys.map((k) => nodes[k]!).toList();
    return RouteModel(
      routeId: 'ROUTE-PATIENT-001',
      waypoints: waypoints,
      totalDistanceKm: 4.2,
      estimatedMinutes: 8,
    );
  }

  /// Alternate route to patient during road blockage: 10 -> 11 -> 13 -> 17 -> 24 (Doc page 15)
  static RouteModel getReroutedPathToPatient() {
    final wpKeys = ['Node 10', 'Node 11', 'Node 13', 'Node 17', 'Node 24'];
    final waypoints = wpKeys.map((k) => nodes[k]!).toList();
    return RouteModel(
      routeId: 'ROUTE-PATIENT-REROUTE',
      waypoints: waypoints,
      totalDistanceKm: 5.1,
      estimatedMinutes: 11,
      isRerouted: true,
      alertMessage: 'TRAFFIC ALERT: Central Flyover blocked. Rerouted via Chintadripet Link.',
    );
  }

  /// Primary route to hospital: Node 24 -> Node 21 -> Node 18 -> Node 14 -> Hospital H1 (Doc page 17)
  static RouteModel getRouteToHospital() {
    final wpKeys = ['Node 24', 'Node 21', 'Node 18', 'Node 14', 'Hospital H1'];
    final waypoints = wpKeys.map((k) => nodes[k]!).toList();
    return RouteModel(
      routeId: 'ROUTE-HOSPITAL-001',
      waypoints: waypoints,
      totalDistanceKm: 6.4,
      estimatedMinutes: 11,
    );
  }
}
