import 'state_enums.dart';

class Driver {
  final String driverId;
  final String name;
  final String providerId;
  final String ambulanceId;
  final String phone;
  final String email;
  final String role;
  final AmbulanceAvailability availability;
  final String? token;

  const Driver({
    required this.driverId,
    required this.name,
    required this.providerId,
    required this.ambulanceId,
    required this.phone,
    this.email = 'driver1@uyirkappan.demo',
    this.role = 'DRIVER',
    this.availability = AmbulanceAvailability.offline,
    this.token,
  });

  Driver copyWith({
    String? driverId,
    String? name,
    String? providerId,
    String? ambulanceId,
    String? phone,
    String? email,
    String? role,
    AmbulanceAvailability? availability,
    String? token,
  }) {
    return Driver(
      driverId: driverId ?? this.driverId,
      name: name ?? this.name,
      providerId: providerId ?? this.providerId,
      ambulanceId: ambulanceId ?? this.ambulanceId,
      phone: phone ?? this.phone,
      email: email ?? this.email,
      role: role ?? this.role,
      availability: availability ?? this.availability,
      token: token ?? this.token,
    );
  }

  Map<String, dynamic> toJson() {
    return {
      'driverId': driverId,
      'name': name,
      'providerId': providerId,
      'ambulanceId': ambulanceId,
      'phone': phone,
      'email': email,
      'role': role,
      'availability': availability.displayName,
      if (token != null) 'token': token,
    };
  }

  factory Driver.fromJson(Map<String, dynamic> json) {
    // Handle nested { user: { ... }, token: "..." } structure
    final userMap = (json['user'] is Map<String, dynamic>)
        ? json['user'] as Map<String, dynamic>
        : json;
    final token = (json['token'] as String?) ?? (userMap['token'] as String?);

    return Driver(
      driverId: (userMap['driverId'] as String?) ??
          (userMap['id'] as String?) ??
          'DRV-001',
      name: (userMap['name'] as String?) ?? 'Ambulance Driver',
      providerId: (userMap['providerId'] as String?) ?? 'PROVIDER-01',
      ambulanceId: (userMap['ambulanceId'] as String?) ?? 'AMB-001',
      phone: (userMap['phone'] as String?) ?? '',
      email: (userMap['email'] as String?) ?? 'driver1@uyirkappan.demo',
      role: (userMap['role'] as String?) ?? 'DRIVER',
      availability: userMap['availability'] != null
          ? AmbulanceAvailability.fromString(userMap['availability'] as String)
          : AmbulanceAvailability.offline,
      token: token,
    );
  }
}
