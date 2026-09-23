import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../../core/constants/app_colors.dart';
import '../../state/auth_state.dart';
import '../../state/driver_state.dart';
import '../../widgets/common/status_badge.dart';

class DriverProfileScreen extends StatelessWidget {
  const DriverProfileScreen({super.key});

  @override
  Widget build(BuildContext context) {
    final authState = context.watch<AuthState>();
    final driverState = context.watch<DriverState>();
    final driver = authState.currentDriver;
    final ambulance = driverState.currentAmbulance;

    return Scaffold(
      backgroundColor: AppColors.background,
      appBar: AppBar(
        title: const Text('Driver Profile & Vehicle'),
      ),
      body: SafeArea(
        child: SingleChildScrollView(
          padding: const EdgeInsets.all(20),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              // Avatar & Header Card
              Container(
                padding: const EdgeInsets.all(24),
                decoration: BoxDecoration(
                  color: AppColors.surface,
                  borderRadius: BorderRadius.circular(18),
                  border: Border.all(color: AppColors.cardBorder),
                ),
                child: Column(
                  children: [
                    Container(
                      width: 72,
                      height: 72,
                      decoration: BoxDecoration(
                        color: AppColors.surfaceElevated,
                        shape: BoxShape.circle,
                        border: Border.all(color: AppColors.tacticalCyan, width: 2),
                      ),
                      child: const Icon(
                        Icons.person,
                        size: 40,
                        color: AppColors.tacticalCyan,
                      ),
                    ),
                    const SizedBox(height: 14),
                    Text(
                      driver?.name ?? 'Driver Name',
                      style: const TextStyle(
                        color: AppColors.textPrimary,
                        fontSize: 20,
                        fontWeight: FontWeight.w800,
                      ),
                    ),
                    const SizedBox(height: 4),
                    Text(
                      'Driver ID: ${driver?.driverId ?? "DRV-003"}',
                      style: const TextStyle(
                        color: AppColors.textSecondary,
                        fontSize: 13,
                        fontWeight: FontWeight.w600,
                      ),
                    ),
                    const SizedBox(height: 12),
                    StatusBadge(availability: driverState.availability),
                  ],
                ),
              ),
              const SizedBox(height: 20),

              // Assigned Ambulance Specs
              const Text(
                'ASSIGNED VEHICLE SPECIFICATIONS',
                style: TextStyle(
                  color: AppColors.textMuted,
                  fontSize: 11,
                  fontWeight: FontWeight.w700,
                  letterSpacing: 1.0,
                ),
              ),
              const SizedBox(height: 8),
              Container(
                padding: const EdgeInsets.all(18),
                decoration: BoxDecoration(
                  color: AppColors.surface,
                  borderRadius: BorderRadius.circular(16),
                  border: Border.all(color: AppColors.cardBorder),
                ),
                child: Column(
                  children: [
                    _infoRow('Ambulance ID', ambulance?.ambulanceId ?? 'AMB-003', Icons.local_hospital),
                    const Divider(height: 20),
                    _infoRow('Plate Number', ambulance?.vehiclePlateNumber ?? 'TN 09 EM 1083', Icons.pin),
                    const Divider(height: 20),
                    _infoRow('Vehicle Type', ambulance?.vehicleType ?? 'Advanced Life Support (ALS)', Icons.airport_shuttle),
                    const Divider(height: 20),
                    _infoRow('Provider Org', driver?.providerId ?? 'SIM-PROVIDER-01', Icons.business),
                    const Divider(height: 20),
                    _infoRow('Contact Phone', driver?.phone ?? '+91 98401 23456', Icons.phone),
                  ],
                ),
              ),
              const SizedBox(height: 20),

              // Authorization & Security Notice (Section 31 of Documentation)
              Container(
                padding: const EdgeInsets.all(16),
                decoration: BoxDecoration(
                  color: AppColors.surfaceElevated,
                  borderRadius: BorderRadius.circular(14),
                  border: Border.all(color: AppColors.infoBlue.withValues(alpha: 0.3)),
                ),
                child: Row(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    const Icon(Icons.verified_user, color: AppColors.infoBlue, size: 20),
                    const SizedBox(width: 12),
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          const Text(
                            'Authorization Boundary Enforced',
                            style: TextStyle(
                              color: AppColors.textPrimary,
                              fontSize: 13,
                              fontWeight: FontWeight.w700,
                            ),
                          ),
                          const SizedBox(height: 4),
                          Text(
                            'Driver ${driver?.driverId ?? "DRV-003"} is authorized only for assigned vehicle ${driver?.ambulanceId ?? "AMB-003"}. State modification requests to other ambulances are strictly rejected by the backend dispatch engine.',
                            style: const TextStyle(
                              color: AppColors.textSecondary,
                              fontSize: 11,
                              height: 1.4,
                            ),
                          ),
                        ],
                      ),
                    ),
                  ],
                ),
              ),
              const SizedBox(height: 32),

              // Logout Button
              SizedBox(
                width: double.infinity,
                child: OutlinedButton.icon(
                  style: OutlinedButton.styleFrom(
                    foregroundColor: AppColors.emergencyRed,
                    side: const BorderSide(color: AppColors.emergencyRed),
                    padding: const EdgeInsets.symmetric(vertical: 16),
                  ),
                  onPressed: () async {
                    context.read<DriverState>().resetOnLogout();
                    await authState.logout();
                    if (context.mounted) {
                      Navigator.pushNamedAndRemoveUntil(context, '/login', (route) => false);
                    }
                  },
                  icon: const Icon(Icons.logout, size: 20),
                  label: const Text(
                    'LOGOUT & END SHIFT',
                    style: TextStyle(fontWeight: FontWeight.w800, letterSpacing: 0.8),
                  ),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }

  Widget _infoRow(String label, String value, IconData icon) {
    return Row(
      children: [
        Icon(icon, size: 18, color: AppColors.textMuted),
        const SizedBox(width: 12),
        Expanded(
          child: Text(
            label,
            style: const TextStyle(color: AppColors.textSecondary, fontSize: 13),
          ),
        ),
        Text(
          value,
          style: const TextStyle(
            color: AppColors.textPrimary,
            fontSize: 13,
            fontWeight: FontWeight.w700,
          ),
        ),
      ],
    );
  }
}
