import 'dart:math' as math;

/// Represents a nearby registered hospital equipped for emergency triage and trauma intake.
class NearbyHospital {
  final String id;
  final String name;
  final double latitude;
  final double longitude;
  final String address;
  final double distanceKm;
  final int emergencyBeds;
  final String emergencyType;
  final String area;
  final String ownership;
  final String priority;

  const NearbyHospital({
    required this.id,
    required this.name,
    required this.latitude,
    required this.longitude,
    required this.address,
    required this.distanceKm,
    required this.emergencyBeds,
    this.emergencyType = '24/7 Level-1 Trauma ICU',
    this.area = '',
    this.ownership = 'Government',
    this.priority = 'High',
  });

  NearbyHospital copyWithDistance(double distance) {
    return NearbyHospital(
      id: id,
      name: name,
      latitude: latitude,
      longitude: longitude,
      address: address,
      distanceKm: distance,
      emergencyBeds: emergencyBeds,
      emergencyType: emergencyType,
      area: area,
      ownership: ownership,
      priority: priority,
    );
  }

  Map<String, dynamic> toJson() => {
        'id': id,
        'name': name,
        'latitude': latitude,
        'longitude': longitude,
        'address': address,
        'distanceKm': double.parse(distanceKm.toStringAsFixed(1)),
        'emergencyBeds': emergencyBeds,
        'emergencyType': emergencyType,
        'area': area,
        'ownership': ownership,
      };
}

/// Represents a nearby registered ambulance unit active in the emergency grid.
class NearbyAmbulance {
  final String id;
  final String name;
  final String type; // 'ALS' (Advanced Life Support) or 'BLS' (Basic Life Support)
  final double latitude;
  final double longitude;
  final String status; // 'AVAILABLE' | 'EN_ROUTE' | 'STANDBY'
  final int etaMinutes;
  final String baseStation;
  final double distanceKm;
  final String nearestHospital;
  final String coverageAreas;

  const NearbyAmbulance({
    required this.id,
    required this.name,
    required this.type,
    required this.latitude,
    required this.longitude,
    required this.status,
    required this.etaMinutes,
    required this.baseStation,
    this.distanceKm = 0.0,
    this.nearestHospital = '',
    this.coverageAreas = '',
  });

  NearbyAmbulance copyWithDistance(double distance, int eta) {
    return NearbyAmbulance(
      id: id,
      name: name,
      type: type,
      latitude: latitude,
      longitude: longitude,
      status: status,
      etaMinutes: eta,
      baseStation: baseStation,
      distanceKm: distance,
      nearestHospital: nearestHospital,
      coverageAreas: coverageAreas,
    );
  }

  Map<String, dynamic> toJson() => {
        'id': id,
        'name': name,
        'type': type,
        'latitude': latitude,
        'longitude': longitude,
        'status': status,
        'etaMinutes': etaMinutes,
        'baseStation': baseStation,
        'distanceKm': double.parse(distanceKm.toStringAsFixed(1)),
        'nearestHospital': nearestHospital,
      };
}

/// Helper service providing realistic nearby hospitals and standby ambulances
/// with 100% FIXED coordinates taken directly from verified Chennai emergency datasets.
class NearbyEmergencyService {
  NearbyEmergencyService._();

  /// Calculates Haversine distance in kilometers between two lat/lng points.
  static double distanceKm(double lat1, double lon1, double lat2, double lon2) {
    const p = 0.017453292519943295; // Math.PI / 180
    final a = 0.5 -
        math.cos((lat2 - lat1) * p) / 2 +
        math.cos(lat1 * p) *
            math.cos(lat2 * p) *
            (1 - math.cos((lon2 - lon1) * p)) /
            2;
    return 12742 * math.asin(math.sqrt(math.max(0.0, a))); // 2 * R; R = 6371 km
  }

  /// 30 FIXED HOSPITALS from verified CSV dataset. Coordinates NEVER change.
  static const List<NearbyHospital> fixedHospitals = [
    NearbyHospital(
      id: 'H001',
      name: 'Rajiv Gandhi Government General Hospital',
      latitude: 13.0810,
      longitude: 80.2774,
      address: 'EVR Periyar Salai, Park Town, Chennai',
      distanceKm: 0.0,
      emergencyBeds: 45,
      emergencyType: 'Govt Level-1 Trauma & Emergency ICU',
      area: 'Park Town',
      ownership: 'Government',
      priority: 'High',
    ),
    NearbyHospital(
      id: 'H002',
      name: 'Government Stanley Medical College Hospital',
      latitude: 13.1068,
      longitude: 80.2865,
      address: 'Old Jail Road, Royapuram, Chennai',
      distanceKm: 0.0,
      emergencyBeds: 36,
      emergencyType: 'Govt Emergency Care & Burns Unit',
      area: 'Royapuram',
      ownership: 'Government',
      priority: 'High',
    ),
    NearbyHospital(
      id: 'H003',
      name: 'Government Kilpauk Medical College Hospital',
      latitude: 13.0783,
      longitude: 80.2426,
      address: 'Poonamallee High Road, Kilpauk, Chennai',
      distanceKm: 0.0,
      emergencyBeds: 32,
      emergencyType: 'Govt Emergency & Trauma Care',
      area: 'Kilpauk',
      ownership: 'Government',
      priority: 'High',
    ),
    NearbyHospital(
      id: 'H004',
      name: 'Government Royapettah Hospital',
      latitude: 13.0545,
      longitude: 80.2635,
      address: 'Westcott Road, Royapettah, Chennai',
      distanceKm: 0.0,
      emergencyBeds: 28,
      emergencyType: 'Govt 24/7 Trauma Unit',
      area: 'Royapettah',
      ownership: 'Government',
      priority: 'High',
    ),
    NearbyHospital(
      id: 'H005',
      name: 'Government Omandurar Medical College Hospital',
      latitude: 13.0697,
      longitude: 80.2747,
      address: 'Walajah Road, Anna Salai, Chennai',
      distanceKm: 0.0,
      emergencyBeds: 30,
      emergencyType: 'Govt Multispeciality Emergency',
      area: 'Anna Salai',
      ownership: 'Government',
      priority: 'High',
    ),
    NearbyHospital(
      id: 'H006',
      name: 'Institute of Child Health and Hospital for Children',
      latitude: 13.0735,
      longitude: 80.2607,
      address: 'Halls Road, Egmore, Chennai',
      distanceKm: 0.0,
      emergencyBeds: 22,
      emergencyType: 'Pediatric Emergency & Trauma ICU',
      area: 'Egmore',
      ownership: 'Government',
      priority: 'Medium',
    ),
    NearbyHospital(
      id: 'H007',
      name: 'Apollo Hospitals Greams Road',
      latitude: 13.0444,
      longitude: 80.2496,
      address: 'Greams Lane, Thousand Lights, Chennai',
      distanceKm: 0.0,
      emergencyBeds: 26,
      emergencyType: 'Private 24/7 Cardiac & Trauma Centre',
      area: 'Thousand Lights',
      ownership: 'Private',
      priority: 'High',
    ),
    NearbyHospital(
      id: 'H008',
      name: 'Fortis Malar Hospital',
      latitude: 13.0067,
      longitude: 80.2565,
      address: 'Gandhi Nagar, Adyar, Chennai',
      distanceKm: 0.0,
      emergencyBeds: 20,
      emergencyType: 'Cardiac & Critical Trauma Care',
      area: 'Adyar',
      ownership: 'Private',
      priority: 'High',
    ),
    NearbyHospital(
      id: 'H009',
      name: 'MIOT International',
      latitude: 13.0215,
      longitude: 80.1789,
      address: 'Mount-Poonamallee Road, Manapakkam, Chennai',
      distanceKm: 0.0,
      emergencyBeds: 34,
      emergencyType: 'Level-1 Polytrauma & Ortho ICU',
      area: 'Manapakkam',
      ownership: 'Private',
      priority: 'High',
    ),
    NearbyHospital(
      id: 'H010',
      name: 'Sri Ramachandra Medical Centre',
      latitude: 13.0387,
      longitude: 80.1407,
      address: 'Mount-Poonamallee Road, Porur, Chennai',
      distanceKm: 0.0,
      emergencyBeds: 38,
      emergencyType: 'Tertiary Academic Emergency Bay',
      area: 'Porur',
      ownership: 'Private/Teaching',
      priority: 'High',
    ),
    NearbyHospital(
      id: 'H011',
      name: 'Madras Medical Mission',
      latitude: 13.0857,
      longitude: 80.1867,
      address: 'J.J. Nagar, Mogappair, Chennai',
      distanceKm: 0.0,
      emergencyBeds: 25,
      emergencyType: 'Adult & Pediatric Cardiac Emergency',
      area: 'Mogappair',
      ownership: 'Private',
      priority: 'High',
    ),
    NearbyHospital(
      id: 'H012',
      name: 'Sundaram Medical Foundation',
      latitude: 13.0850,
      longitude: 80.2101,
      address: 'Shanthi Colony, Anna Nagar, Chennai',
      distanceKm: 0.0,
      emergencyBeds: 18,
      emergencyType: 'Community Trauma & Critical Care',
      area: 'Anna Nagar',
      ownership: 'Private',
      priority: 'Medium',
    ),
    NearbyHospital(
      id: 'H013',
      name: 'SIMS Hospital',
      latitude: 13.0522,
      longitude: 80.2110,
      address: 'Jawaharlal Nehru Salai, Vadapalani, Chennai',
      distanceKm: 0.0,
      emergencyBeds: 28,
      emergencyType: 'Comprehensive Trauma & Stroke Center',
      area: 'Vadapalani',
      ownership: 'Private',
      priority: 'High',
    ),
    NearbyHospital(
      id: 'H014',
      name: 'Vijaya Hospital',
      latitude: 13.0506,
      longitude: 80.2120,
      address: 'N.S.K. Salai, Vadapalani, Chennai',
      distanceKm: 0.0,
      emergencyBeds: 24,
      emergencyType: '24/7 Multispeciality Emergency',
      area: 'Vadapalani',
      ownership: 'Private',
      priority: 'High',
    ),
    NearbyHospital(
      id: 'H015',
      name: 'Kauvery Hospital Vadapalani',
      latitude: 13.0527,
      longitude: 80.2124,
      address: 'Arcot Road, Vadapalani, Chennai',
      distanceKm: 0.0,
      emergencyBeds: 22,
      emergencyType: 'Emergency Medicine & Critical Care',
      area: 'Vadapalani',
      ownership: 'Private',
      priority: 'High',
    ),
    NearbyHospital(
      id: 'H016',
      name: 'Apollo Speciality Hospital OMR',
      latitude: 12.9597,
      longitude: 80.2461,
      address: 'OMR, Perungudi, Chennai',
      distanceKm: 0.0,
      emergencyBeds: 26,
      emergencyType: 'OMR Corridor Emergency & Trauma Bay',
      area: 'Perungudi',
      ownership: 'Private',
      priority: 'High',
    ),
    NearbyHospital(
      id: 'H017',
      name: 'Gleneagles HealthCity Chennai',
      latitude: 12.9054,
      longitude: 80.2286,
      address: 'Cheran Nagar, Perumbakkam, Chennai',
      distanceKm: 0.0,
      emergencyBeds: 35,
      emergencyType: 'Organ Transplant & Polytrauma ICU',
      area: 'Perumbakkam',
      ownership: 'Private',
      priority: 'High',
    ),
    NearbyHospital(
      id: 'H018',
      name: 'Chettinad Hospital and Research Institute',
      latitude: 12.7970,
      longitude: 80.2205,
      address: 'Rajiv Gandhi Salai, Kelambakkam, Chennai',
      distanceKm: 0.0,
      emergencyBeds: 30,
      emergencyType: 'Teaching Trauma & Critical Care Center',
      area: 'Kelambakkam',
      ownership: 'Private/Teaching',
      priority: 'High',
    ),
    NearbyHospital(
      id: 'H019',
      name: 'Dr. Kamakshi Memorial Hospital',
      latitude: 12.9498,
      longitude: 80.2104,
      address: 'Radha Nagar, Pallikaranai, Chennai',
      distanceKm: 0.0,
      emergencyBeds: 22,
      emergencyType: 'Emergency Triage & Cardiac Bay',
      area: 'Pallikaranai',
      ownership: 'Private',
      priority: 'High',
    ),
    NearbyHospital(
      id: 'H020',
      name: 'Prashanth Super Speciality Hospital',
      latitude: 12.9799,
      longitude: 80.2207,
      address: 'Velachery Bypass Road, Velachery, Chennai',
      distanceKm: 0.0,
      emergencyBeds: 24,
      emergencyType: '24/7 South Chennai Trauma Center',
      area: 'Velachery',
      ownership: 'Private',
      priority: 'High',
    ),
    NearbyHospital(
      id: 'H021',
      name: 'Hindu Mission Hospital',
      latitude: 12.9246,
      longitude: 80.1132,
      address: 'GST Road, Tambaram, Chennai',
      distanceKm: 0.0,
      emergencyBeds: 26,
      emergencyType: 'South-West Highway Trauma & Critical Care',
      area: 'Tambaram',
      ownership: 'Private',
      priority: 'High',
    ),
    NearbyHospital(
      id: 'H022',
      name: 'Government Hospital Tambaram',
      latitude: 12.9241,
      longitude: 80.1275,
      address: 'GST Road, Tambaram, Chennai',
      distanceKm: 0.0,
      emergencyBeds: 25,
      emergencyType: 'Govt Emergency Care & Trauma Wing',
      area: 'Tambaram',
      ownership: 'Government',
      priority: 'Medium',
    ),
    NearbyHospital(
      id: 'H023',
      name: 'ESIC Medical College and Hospital',
      latitude: 13.0380,
      longitude: 80.2044,
      address: 'Ashok Pillar Road, K.K. Nagar, Chennai',
      distanceKm: 0.0,
      emergencyBeds: 32,
      emergencyType: 'Govt Central Emergency & Trauma Center',
      area: 'K.K. Nagar',
      ownership: 'Government',
      priority: 'High',
    ),
    NearbyHospital(
      id: 'H024',
      name: 'Billroth Hospitals',
      latitude: 13.0789,
      longitude: 80.2240,
      address: '4th Avenue, Shenoy Nagar, Chennai',
      distanceKm: 0.0,
      emergencyBeds: 18,
      emergencyType: 'Emergency Medicine & ICU Care',
      area: 'Shenoy Nagar',
      ownership: 'Private',
      priority: 'Medium',
    ),
    NearbyHospital(
      id: 'H025',
      name: 'Apollo Hospitals Tondiarpet',
      latitude: 13.1271,
      longitude: 80.2890,
      address: 'TH Road, Tondiarpet, Chennai',
      distanceKm: 0.0,
      emergencyBeds: 24,
      emergencyType: 'North Chennai 24/7 Trauma Bay',
      area: 'Tondiarpet',
      ownership: 'Private',
      priority: 'High',
    ),
    NearbyHospital(
      id: 'H026',
      name: 'CSI Rainy Multispeciality Hospital',
      latitude: 13.1133,
      longitude: 80.2860,
      address: 'GA Road, Old Washermenpet, Chennai',
      distanceKm: 0.0,
      emergencyBeds: 16,
      emergencyType: 'Community Emergency Medical Center',
      area: 'Old Washermenpet',
      ownership: 'Private',
      priority: 'Medium',
    ),
    NearbyHospital(
      id: 'H027',
      name: 'MGM Healthcare',
      latitude: 13.0718,
      longitude: 80.2218,
      address: 'Nelson Manickam Road, Aminjikarai, Chennai',
      distanceKm: 0.0,
      emergencyBeds: 30,
      emergencyType: 'Advanced Trauma, ECMO & Cardiac ICU',
      area: 'Aminjikarai',
      ownership: 'Private',
      priority: 'High',
    ),
    NearbyHospital(
      id: 'H028',
      name: 'Kauvery Hospital Alwarpet',
      latitude: 13.0337,
      longitude: 80.2572,
      address: 'TTK Road, Alwarpet, Chennai',
      distanceKm: 0.0,
      emergencyBeds: 26,
      emergencyType: 'Emergency Medicine, Stroke & Trauma Care',
      area: 'Alwarpet',
      ownership: 'Private',
      priority: 'High',
    ),
    NearbyHospital(
      id: 'H029',
      name: 'Adyar Cancer Institute',
      latitude: 13.0061,
      longitude: 80.2508,
      address: 'East Canal Bank Road, Adyar, Chennai',
      distanceKm: 0.0,
      emergencyBeds: 14,
      emergencyType: 'Oncology Emergency & Supportive ICU',
      area: 'Adyar',
      ownership: 'Specialized',
      priority: 'Medium',
    ),
    NearbyHospital(
      id: 'H030',
      name: 'Government Hospital of Thoracic Medicine',
      latitude: 12.9431,
      longitude: 80.1285,
      address: 'GST Road, Tambaram Sanatorium, Chennai',
      distanceKm: 0.0,
      emergencyBeds: 20,
      emergencyType: 'Govt Respiratory & Thoracic Emergency',
      area: 'Tambaram Sanatorium',
      ownership: 'Government',
      priority: 'Medium',
    ),
  ];

  /// 40 FIXED AMBULANCE BASES from verified CSV dataset. Coordinates NEVER change.
  static const List<NearbyAmbulance> fixedAmbulances = [
    NearbyAmbulance(
      id: 'A001',
      name: 'Ambulance Base - Ennore',
      type: 'ALS',
      latitude: 13.2146,
      longitude: 80.3203,
      status: 'AVAILABLE',
      etaMinutes: 6,
      baseStation: 'Ennore Port Corridor Post',
      nearestHospital: 'Apollo Hospitals Tondiarpet',
      coverageAreas: 'Ennore, Kathivakkam, Ernavoor',
    ),
    NearbyAmbulance(
      id: 'A002',
      name: 'Ambulance Base - Tiruvottiyur',
      type: 'BLS',
      latitude: 13.1600,
      longitude: 80.3010,
      status: 'AVAILABLE',
      etaMinutes: 5,
      baseStation: 'Tiruvottiyur High Road Depot',
      nearestHospital: 'Apollo Hospitals Tondiarpet',
      coverageAreas: 'Tiruvottiyur, Kaladipet, Wimco Nagar',
    ),
    NearbyAmbulance(
      id: 'A003',
      name: 'Ambulance Base - Manali',
      type: 'ALS',
      latitude: 13.1667,
      longitude: 80.2580,
      status: 'STANDBY',
      etaMinutes: 7,
      baseStation: 'Manali Industrial Division',
      nearestHospital: 'Government Stanley Medical College Hospital',
      coverageAreas: 'Manali, Manali New Town, Mathur',
    ),
    NearbyAmbulance(
      id: 'A004',
      name: 'Ambulance Base - Madhavaram',
      type: 'ALS',
      latitude: 13.1482,
      longitude: 80.2314,
      status: 'AVAILABLE',
      etaMinutes: 5,
      baseStation: 'Madhavaram Junction Post',
      nearestHospital: 'Government Stanley Medical College Hospital',
      coverageAreas: 'Madhavaram, Moolakadai, Milk Colony',
    ),
    NearbyAmbulance(
      id: 'A005',
      name: 'Ambulance Base - Red Hills/Puzhal',
      type: 'BLS',
      latitude: 13.1580,
      longitude: 80.2035,
      status: 'AVAILABLE',
      etaMinutes: 8,
      baseStation: 'Puzhal Highway Depot',
      nearestHospital: 'Government Stanley Medical College Hospital',
      coverageAreas: 'Puzhal, Red Hills, Kavangarai',
    ),
    NearbyAmbulance(
      id: 'A006',
      name: 'Ambulance Base - Tondiarpet',
      type: 'ALS',
      latitude: 13.1270,
      longitude: 80.2895,
      status: 'AVAILABLE',
      etaMinutes: 4,
      baseStation: 'Tondiarpet Central Depot',
      nearestHospital: 'Apollo Hospitals Tondiarpet',
      coverageAreas: 'Tondiarpet, New Washermenpet, Korukkupet',
    ),
    NearbyAmbulance(
      id: 'A007',
      name: 'Ambulance Base - Royapuram',
      type: 'BLS',
      latitude: 13.1130,
      longitude: 80.2940,
      status: 'AVAILABLE',
      etaMinutes: 4,
      baseStation: 'Royapuram Harbour Approach Unit',
      nearestHospital: 'Government Stanley Medical College Hospital',
      coverageAreas: 'Royapuram, Old Washermenpet, Harbour',
    ),
    NearbyAmbulance(
      id: 'A008',
      name: 'Ambulance Base - Perambur',
      type: 'ALS',
      latitude: 13.1180,
      longitude: 80.2337,
      status: 'AVAILABLE',
      etaMinutes: 5,
      baseStation: 'Perambur Railway Station Post',
      nearestHospital: 'Government Kilpauk Medical College Hospital',
      coverageAreas: 'Perambur, Sembium, Vyasarpadi',
    ),
    NearbyAmbulance(
      id: 'A009',
      name: 'Ambulance Base - Basin Bridge',
      type: 'BLS',
      latitude: 13.1019,
      longitude: 80.2717,
      status: 'AVAILABLE',
      etaMinutes: 4,
      baseStation: 'Basin Bridge Junction Depot',
      nearestHospital: 'Government Stanley Medical College Hospital',
      coverageAreas: 'Basin Bridge, Pulianthope, Choolai',
    ),
    NearbyAmbulance(
      id: 'A010',
      name: 'Ambulance Base - Park Town/Central',
      type: 'ALS',
      latitude: 13.0813,
      longitude: 80.2769,
      status: 'AVAILABLE',
      etaMinutes: 3,
      baseStation: 'Chennai Central Rapid Station',
      nearestHospital: 'Rajiv Gandhi Government General Hospital',
      coverageAreas: 'Central, George Town, Broadway, Park Town',
    ),
    NearbyAmbulance(
      id: 'A011',
      name: 'Ambulance Base - Egmore',
      type: 'ALS',
      latitude: 13.0732,
      longitude: 80.2609,
      status: 'AVAILABLE',
      etaMinutes: 4,
      baseStation: 'Egmore Station Terminal',
      nearestHospital: 'Institute of Child Health and Hospital for Children',
      coverageAreas: 'Egmore, Chintadripet, Purasawalkam',
    ),
    NearbyAmbulance(
      id: 'A012',
      name: 'Ambulance Base - Kilpauk',
      type: 'ALS',
      latitude: 13.0780,
      longitude: 80.2430,
      status: 'AVAILABLE',
      etaMinutes: 3,
      baseStation: 'Kilpauk PH Road Division',
      nearestHospital: 'Government Kilpauk Medical College Hospital',
      coverageAreas: 'Kilpauk, Kellys, Chetpet',
    ),
    NearbyAmbulance(
      id: 'A013',
      name: 'Ambulance Base - Anna Nagar',
      type: 'BLS',
      latitude: 13.0850,
      longitude: 80.2100,
      status: 'AVAILABLE',
      etaMinutes: 5,
      baseStation: 'Anna Nagar Roundtana Post',
      nearestHospital: 'Sundaram Medical Foundation',
      coverageAreas: 'Anna Nagar, Shenoy Nagar, Aminjikarai',
    ),
    NearbyAmbulance(
      id: 'A014',
      name: 'Ambulance Base - Mogappair',
      type: 'ALS',
      latitude: 13.0837,
      longitude: 80.1750,
      status: 'AVAILABLE',
      etaMinutes: 6,
      baseStation: 'Mogappair West Depot',
      nearestHospital: 'Madras Medical Mission',
      coverageAreas: 'Mogappair, Nolambur, Collector Nagar',
    ),
    NearbyAmbulance(
      id: 'A015',
      name: 'Ambulance Base - Ambattur',
      type: 'BLS',
      latitude: 13.1143,
      longitude: 80.1548,
      status: 'AVAILABLE',
      etaMinutes: 6,
      baseStation: 'Ambattur Industrial Estate Post',
      nearestHospital: 'Madras Medical Mission',
      coverageAreas: 'Ambattur, Padi, Korattur',
    ),
    NearbyAmbulance(
      id: 'A016',
      name: 'Ambulance Base - Avadi',
      type: 'ALS',
      latitude: 13.1067,
      longitude: 80.0970,
      status: 'STANDBY',
      etaMinutes: 9,
      baseStation: 'Avadi Checkpost Station',
      nearestHospital: 'Madras Medical Mission',
      coverageAreas: 'Avadi, Pattabiram, Thirumullaivoyal',
    ),
    NearbyAmbulance(
      id: 'A017',
      name: 'Ambulance Base - Koyambedu',
      type: 'ALS',
      latitude: 13.0694,
      longitude: 80.1948,
      status: 'AVAILABLE',
      etaMinutes: 4,
      baseStation: 'Koyambedu Bus Terminal Hub',
      nearestHospital: 'MGM Healthcare',
      coverageAreas: 'Koyambedu, Arumbakkam, MMDA Colony',
    ),
    NearbyAmbulance(
      id: 'A018',
      name: 'Ambulance Base - Vadapalani',
      type: 'ALS',
      latitude: 13.0524,
      longitude: 80.2120,
      status: 'AVAILABLE',
      etaMinutes: 3,
      baseStation: 'Vadapalani Junction Depot',
      nearestHospital: 'SIMS Hospital',
      coverageAreas: 'Vadapalani, Saligramam, Kodambakkam',
    ),
    NearbyAmbulance(
      id: 'A019',
      name: 'Ambulance Base - Nungambakkam',
      type: 'BLS',
      latitude: 13.0604,
      longitude: 80.2420,
      status: 'AVAILABLE',
      etaMinutes: 4,
      baseStation: 'Nungambakkam High Road Post',
      nearestHospital: 'Apollo Hospitals Greams Road',
      coverageAreas: 'Nungambakkam, Thousand Lights, Chetpet',
    ),
    NearbyAmbulance(
      id: 'A020',
      name: 'Ambulance Base - Anna Salai/Teynampet',
      type: 'ALS',
      latitude: 13.0418,
      longitude: 80.2505,
      status: 'AVAILABLE',
      etaMinutes: 4,
      baseStation: 'Anna Salai Teynampet Post',
      nearestHospital: 'Apollo Hospitals Greams Road',
      coverageAreas: 'Teynampet, Thousand Lights, Alwarpet',
    ),
    NearbyAmbulance(
      id: 'A021',
      name: 'Ambulance Base - Royapettah',
      type: 'ALS',
      latitude: 13.0543,
      longitude: 80.2640,
      status: 'AVAILABLE',
      etaMinutes: 3,
      baseStation: 'Royapettah Hospital Gate Depot',
      nearestHospital: 'Government Royapettah Hospital',
      coverageAreas: 'Royapettah, Triplicane, Mylapore',
    ),
    NearbyAmbulance(
      id: 'A022',
      name: 'Ambulance Base - Mylapore',
      type: 'BLS',
      latitude: 13.0339,
      longitude: 80.2697,
      status: 'AVAILABLE',
      etaMinutes: 5,
      baseStation: 'Luz Corner Mylapore Post',
      nearestHospital: 'Kauvery Hospital Alwarpet',
      coverageAreas: 'Mylapore, Mandaveli, Santhome',
    ),
    NearbyAmbulance(
      id: 'A023',
      name: 'Ambulance Base - T. Nagar',
      type: 'ALS',
      latitude: 13.0418,
      longitude: 80.2341,
      status: 'AVAILABLE',
      etaMinutes: 4,
      baseStation: 'Panagal Park T. Nagar Unit',
      nearestHospital: 'Kauvery Hospital Alwarpet',
      coverageAreas: 'T. Nagar, West Mambalam, Nandanam',
    ),
    NearbyAmbulance(
      id: 'A024',
      name: 'Ambulance Base - Ashok Nagar/KK Nagar',
      type: 'BLS',
      latitude: 13.0385,
      longitude: 80.2040,
      status: 'AVAILABLE',
      etaMinutes: 4,
      baseStation: 'KK Nagar ESIC Station',
      nearestHospital: 'ESIC Medical College and Hospital',
      coverageAreas: 'K.K. Nagar, Ashok Nagar, Jafferkhanpet',
    ),
    NearbyAmbulance(
      id: 'A025',
      name: 'Ambulance Base - Porur',
      type: 'ALS',
      latitude: 13.0359,
      longitude: 80.1588,
      status: 'AVAILABLE',
      etaMinutes: 4,
      baseStation: 'Porur Mount-Poonamallee Junction',
      nearestHospital: 'Sri Ramachandra Medical Centre',
      coverageAreas: 'Porur, Iyyappanthangal, Karambakkam',
    ),
    NearbyAmbulance(
      id: 'A026',
      name: 'Ambulance Base - Poonamallee',
      type: 'BLS',
      latitude: 13.0473,
      longitude: 80.0945,
      status: 'AVAILABLE',
      etaMinutes: 7,
      baseStation: 'Poonamallee Bypass Depot',
      nearestHospital: 'Sri Ramachandra Medical Centre',
      coverageAreas: 'Poonamallee, Kattupakkam, Senneerkuppam',
    ),
    NearbyAmbulance(
      id: 'A027',
      name: 'Ambulance Base - Guindy',
      type: 'ALS',
      latitude: 13.0067,
      longitude: 80.2206,
      status: 'AVAILABLE',
      etaMinutes: 4,
      baseStation: 'Kathipara Interchange Terminal',
      nearestHospital: 'MIOT International',
      coverageAreas: 'Guindy, Ekkatuthangal, St Thomas Mount',
    ),
    NearbyAmbulance(
      id: 'A028',
      name: 'Ambulance Base - Manapakkam',
      type: 'ALS',
      latitude: 13.0210,
      longitude: 80.1790,
      status: 'AVAILABLE',
      etaMinutes: 3,
      baseStation: 'Manapakkam MIOT Approach Depot',
      nearestHospital: 'MIOT International',
      coverageAreas: 'Manapakkam, Ramapuram, Nandambakkam',
    ),
    NearbyAmbulance(
      id: 'A029',
      name: 'Ambulance Base - Adyar',
      type: 'ALS',
      latitude: 13.0065,
      longitude: 80.2568,
      status: 'AVAILABLE',
      etaMinutes: 3,
      baseStation: 'Adyar Bridge Depot',
      nearestHospital: 'Fortis Malar Hospital',
      coverageAreas: 'Adyar, Kotturpuram, Besant Nagar',
    ),
    NearbyAmbulance(
      id: 'A030',
      name: 'Ambulance Base - Thiruvanmiyur',
      type: 'BLS',
      latitude: 12.9850,
      longitude: 80.2594,
      status: 'AVAILABLE',
      etaMinutes: 5,
      baseStation: 'Thiruvanmiyur ECR Inception Unit',
      nearestHospital: 'Fortis Malar Hospital',
      coverageAreas: 'Thiruvanmiyur, Indira Nagar, Kottivakkam',
    ),
    NearbyAmbulance(
      id: 'A031',
      name: 'Ambulance Base - Velachery',
      type: 'ALS',
      latitude: 12.9815,
      longitude: 80.2180,
      status: 'AVAILABLE',
      etaMinutes: 4,
      baseStation: 'Velachery Bypass Hub',
      nearestHospital: 'Prashanth Super Speciality Hospital',
      coverageAreas: 'Velachery, Taramani, Dhandeeswaram',
    ),
    NearbyAmbulance(
      id: 'A032',
      name: 'Ambulance Base - Pallikaranai',
      type: 'BLS',
      latitude: 12.9495,
      longitude: 80.2100,
      status: 'AVAILABLE',
      etaMinutes: 5,
      baseStation: 'Pallikaranai Medavakkam Corridor Depot',
      nearestHospital: 'Dr. Kamakshi Memorial Hospital',
      coverageAreas: 'Pallikaranai, Narayanapuram, Medavakkam',
    ),
    NearbyAmbulance(
      id: 'A033',
      name: 'Ambulance Base - Perungudi',
      type: 'ALS',
      latitude: 12.9600,
      longitude: 80.2455,
      status: 'AVAILABLE',
      etaMinutes: 4,
      baseStation: 'Perungudi OMR Toll Gate Post',
      nearestHospital: 'Apollo Speciality Hospital OMR',
      coverageAreas: 'Perungudi, Kandanchavadi, Taramani',
    ),
    NearbyAmbulance(
      id: 'A034',
      name: 'Ambulance Base - Sholinganallur',
      type: 'ALS',
      latitude: 12.9010,
      longitude: 80.2279,
      status: 'AVAILABLE',
      etaMinutes: 5,
      baseStation: 'Sholinganallur Junction Terminal',
      nearestHospital: 'Gleneagles HealthCity Chennai',
      coverageAreas: 'Sholinganallur, Karapakkam, Semmenchery',
    ),
    NearbyAmbulance(
      id: 'A035',
      name: 'Ambulance Base - Medavakkam',
      type: 'BLS',
      latitude: 12.9180,
      longitude: 80.1920,
      status: 'AVAILABLE',
      etaMinutes: 6,
      baseStation: 'Medavakkam Koot Road Depot',
      nearestHospital: 'Gleneagles HealthCity Chennai',
      coverageAreas: 'Medavakkam, Perumbakkam, Kovilambakkam',
    ),
    NearbyAmbulance(
      id: 'A036',
      name: 'Ambulance Base - Tambaram',
      type: 'ALS',
      latitude: 12.9249,
      longitude: 80.1000,
      status: 'AVAILABLE',
      etaMinutes: 4,
      baseStation: 'Tambaram Railway Station West Depot',
      nearestHospital: 'Hindu Mission Hospital',
      coverageAreas: 'Tambaram, East Tambaram, West Tambaram',
    ),
    NearbyAmbulance(
      id: 'A037',
      name: 'Ambulance Base - Pallavaram',
      type: 'BLS',
      latitude: 12.9675,
      longitude: 80.1491,
      status: 'AVAILABLE',
      etaMinutes: 5,
      baseStation: 'Pallavaram GST Road Post',
      nearestHospital: 'Hindu Mission Hospital',
      coverageAreas: 'Pallavaram, Chromepet, Pammal',
    ),
    NearbyAmbulance(
      id: 'A038',
      name: 'Ambulance Base - Chromepet',
      type: 'ALS',
      latitude: 12.9516,
      longitude: 80.1462,
      status: 'AVAILABLE',
      etaMinutes: 5,
      baseStation: 'Chromepet MIT Bridge Post',
      nearestHospital: 'Government Hospital Tambaram',
      coverageAreas: 'Chromepet, Chitlapakkam, Hasthinapuram',
    ),
    NearbyAmbulance(
      id: 'A039',
      name: 'Ambulance Base - ECR Neelankarai',
      type: 'BLS',
      latitude: 12.9495,
      longitude: 80.2598,
      status: 'AVAILABLE',
      etaMinutes: 6,
      baseStation: 'Neelankarai ECR Coastal Unit',
      nearestHospital: 'Apollo Speciality Hospital OMR',
      coverageAreas: 'Neelankarai, Palavakkam, Injambakkam',
    ),
    NearbyAmbulance(
      id: 'A040',
      name: 'Ambulance Base - Kelambakkam',
      type: 'ALS',
      latitude: 12.7870,
      longitude: 80.2200,
      status: 'AVAILABLE',
      etaMinutes: 7,
      baseStation: 'Kelambakkam OMR South Depot',
      nearestHospital: 'Chettinad Hospital and Research Institute',
      coverageAreas: 'Kelambakkam, Navalur, Padur',
    ),
  ];

  /// Returns all 30 fixed hospitals with accurate distances calculated from [userLat, userLng].
  /// Coordinates NEVER change.
  static List<NearbyHospital> getAllHospitals({double? userLat, double? userLng}) {
    if (userLat == null || userLng == null) {
      return List.unmodifiable(fixedHospitals);
    }
    final list = fixedHospitals.map((h) {
      final dist = distanceKm(userLat, userLng, h.latitude, h.longitude);
      return h.copyWithDistance(dist);
    }).toList();
    list.sort((a, b) => a.distanceKm.compareTo(b.distanceKm));
    return list;
  }

  /// Returns all 40 fixed ambulance bases with accurate distances calculated from [userLat, userLng].
  /// Coordinates NEVER change.
  static List<NearbyAmbulance> getAllAmbulances({double? userLat, double? userLng}) {
    if (userLat == null || userLng == null) {
      return List.unmodifiable(fixedAmbulances);
    }
    final list = fixedAmbulances.map((a) {
      final dist = distanceKm(userLat, userLng, a.latitude, a.longitude);
      // Realistic ETA: ~1.5 min per km with emergency sirens + 1 min dispatch lead
      final eta = math.max(2, (dist * 1.5).round() + 1);
      return a.copyWithDistance(dist, eta);
    }).toList();
    list.sort((a, b) => a.distanceKm.compareTo(b.distanceKm));
    return list;
  }

  /// Finds the geographically closest ambulance base from the 40 fixed bases.
  static NearbyAmbulance findNearestAmbulance(double lat, double lng) {
    NearbyAmbulance best = fixedAmbulances.first;
    double bestDist = double.infinity;
    for (final a in fixedAmbulances) {
      final dist = distanceKm(lat, lng, a.latitude, a.longitude);
      if (dist < bestDist) {
        bestDist = dist;
        best = a.copyWithDistance(dist, math.max(2, (dist * 1.5).round() + 1));
      }
    }
    return best;
  }

  /// Finds the geographically closest hospital from the 30 fixed hospitals.
  static NearbyHospital findNearestHospital(double lat, double lng) {
    NearbyHospital best = fixedHospitals.first;
    double bestDist = double.infinity;
    for (final h in fixedHospitals) {
      final dist = distanceKm(lat, lng, h.latitude, h.longitude);
      if (dist < bestDist) {
        bestDist = dist;
        best = h.copyWithDistance(dist);
      }
    }
    return best;
  }

  /// Backwards-compatible aliases for existing controllers and views.
  static List<NearbyHospital> getHospitalsAround(double centerLat, double centerLng) =>
      getAllHospitals(userLat: centerLat, userLng: centerLng);

  static List<NearbyAmbulance> getAmbulancesAround(double centerLat, double centerLng) =>
      getAllAmbulances(userLat: centerLat, userLng: centerLng);

  static List<NearbyAmbulance> getStandbyAmbulancesAround(double centerLat, double centerLng) =>
      getAllAmbulances(userLat: centerLat, userLng: centerLng);
}
