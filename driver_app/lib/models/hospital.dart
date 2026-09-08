import '../core/utils/geo_utils.dart';

class Hospital {
  final String hospitalId;
  final String name;
  final GeoPoint location;
  final String address;
  final double distanceKm;
  final int etaMinutes;
  final int availableBeds;
  final List<String> specialties;
  final String emergencyContact;

  const Hospital({
    required this.hospitalId,
    required this.name,
    required this.location,
    required this.address,
    this.distanceKm = 6.4,
    this.etaMinutes = 11,
    this.availableBeds = 4,
    this.specialties = const ['Cardiology ICU', 'Trauma Center', 'Cath Lab'],
    this.emergencyContact = '+91 44 2829 0200',
  });

  Map<String, dynamic> toJson() {
    return {
      'hospitalId': hospitalId,
      'name': name,
      'location': {
        'latitude': location.latitude,
        'longitude': location.longitude,
      },
      'address': address,
      'distanceKm': distanceKm,
      'etaMinutes': etaMinutes,
      'availableBeds': availableBeds,
      'specialties': specialties,
      'emergencyContact': emergencyContact,
    };
  }

  factory Hospital.fromJson(Map<String, dynamic> json) {
    final locJson = json['location'] as Map<String, dynamic>? ?? {};
    return Hospital(
      hospitalId: json['hospitalId'] as String,
      name: json['name'] as String,
      location: GeoPoint(
        (locJson['latitude'] as num?)?.toDouble() ?? 13.0600,
        (locJson['longitude'] as num?)?.toDouble() ?? 80.2500,
      ),
      address: json['address'] as String? ?? 'Greams Road, Chennai',
      distanceKm: (json['distanceKm'] as num?)?.toDouble() ?? 6.4,
      etaMinutes: (json['etaMinutes'] as num?)?.toInt() ?? 11,
      availableBeds: (json['availableBeds'] as num?)?.toInt() ?? 4,
      specialties: (json['specialties'] as List<dynamic>?)
              ?.map((e) => e.toString())
              .toList() ??
          const ['Trauma Center'],
      emergencyContact: json['emergencyContact'] as String? ?? '+91 44 2829 0200',
    );
  }
}
