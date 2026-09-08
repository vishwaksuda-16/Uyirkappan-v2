/// Represents an authenticated user in UyirKappan.
class UserProfile {
  final String id;
  final String name;
  final String email;
  final String phone;
  final String role;
  final String? token;
  final DateTime? createdAt;

  const UserProfile({
    required this.id,
    required this.name,
    required this.email,
    required this.phone,
    this.role = 'BYSTANDER',
    this.token,
    this.createdAt,
  });

  UserProfile copyWith({
    String? id,
    String? name,
    String? email,
    String? phone,
    String? role,
    String? token,
    DateTime? createdAt,
  }) {
    return UserProfile(
      id: id ?? this.id,
      name: name ?? this.name,
      email: email ?? this.email,
      phone: phone ?? this.phone,
      role: role ?? this.role,
      token: token ?? this.token,
      createdAt: createdAt ?? this.createdAt,
    );
  }

  factory UserProfile.fromJson(Map<String, dynamic> json, {String? token}) {
    // Accommodate user object nested under 'user' key or root
    final data = json['user'] is Map<String, dynamic> ? json['user'] as Map<String, dynamic> : json;
    final jwt = token ?? json['token'] as String? ?? json['accessToken'] as String?;

    return UserProfile(
      id: data['id'] as String? ?? data['_id'] as String? ?? 'BYSTANDER-${DateTime.now().millisecondsSinceEpoch}',
      name: data['name'] as String? ?? 'Bystander Responder',
      email: data['email'] as String? ?? 'bystander@uyirkappan.demo',
      phone: data['phone'] as String? ?? '+91 98401 23456',
      role: data['role'] as String? ?? 'BYSTANDER',
      token: jwt,
      createdAt: data['createdAt'] != null ? DateTime.tryParse(data['createdAt'] as String) : null,
    );
  }

  Map<String, dynamic> toJson() => {
        'id': id,
        'name': name,
        'email': email,
        'phone': phone,
        'role': role,
        if (token != null) 'token': token,
        if (createdAt != null) 'createdAt': createdAt!.toIso8601String(),
      };
}
