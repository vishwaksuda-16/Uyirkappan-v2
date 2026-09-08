import 'package:flutter/material.dart';
import '../../../core/theme/app_colors.dart';
import '../../../core/theme/app_text_styles.dart';
import '../../../core/utils/location_formatter.dart';
import '../../../routing/route_paths.dart';
import '../../controllers/emergency_controller.dart';
import '../../controllers/location_controller.dart';

/// Screen 4: Review Emergency Request before final dispatch submission.
class ReviewRequestScreen extends StatelessWidget {
  final EmergencyController emergencyController;
  final LocationController locationController;

  const ReviewRequestScreen({
    super.key,
    required this.emergencyController,
    required this.locationController,
  });

  Future<void> _submitRequest(BuildContext context) async {
    final emergencyLoc = locationController.emergencyLocation;
    if (emergencyLoc == null) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Text('Please wait for GPS location or adjust manually before submitting.'),
          backgroundColor: AppColors.emergencyRed,
        ),
      );
      return;
    }

    final success = await emergencyController.submitEmergencyRequest(
      emergencyLocation: emergencyLoc,
      requesterLocation: locationController.deviceLocation,
    );

    if (success && context.mounted) {
      Navigator.pushNamedAndRemoveUntil(
        context,
        RoutePaths.requestStatus,
        (route) => route.isFirst,
      );
    }
  }

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final selectedType = emergencyController.selectedType;
    final victimCount = emergencyController.victimCount;
    final notes = emergencyController.additionalNotes;
    final loc = locationController.emergencyLocation;

    return Scaffold(
      appBar: AppBar(
        title: const Text('Review Emergency Request'),
      ),
      body: Center(
        child: ConstrainedBox(
          constraints: const BoxConstraints(maxWidth: 640),
          child: Column(
            children: [
              Expanded(
                child: SingleChildScrollView(
              padding: const EdgeInsets.all(20),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  // Step Indicator
                  Row(
                    children: [
                      Container(
                        padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                        decoration: BoxDecoration(
                          color: AppColors.emergencyRed,
                          borderRadius: BorderRadius.circular(12),
                        ),
                        child: const Text(
                          'STEP 2 OF 2',
                          style: TextStyle(
                            color: Colors.white,
                            fontSize: 10,
                            fontWeight: FontWeight.w900,
                            letterSpacing: 0.8,
                          ),
                        ),
                      ),
                      const SizedBox(width: 8),
                      const Text(
                        'Verification & Confirmation',
                        style: TextStyle(fontSize: 13, fontWeight: FontWeight.w600),
                      ),
                    ],
                  ),

                  const SizedBox(height: 20),

                  // Summary Card
                  Card(
                    child: Padding(
                      padding: const EdgeInsets.all(20),
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          // Emergency Type Row
                          Row(
                            children: [
                              Container(
                                padding: const EdgeInsets.all(12),
                                decoration: const BoxDecoration(
                                  color: AppColors.emergencyLightRed,
                                  shape: BoxShape.circle,
                                ),
                                child: Icon(selectedType.icon, color: AppColors.emergencyDarkRed, size: 28),
                              ),
                              const SizedBox(width: 14),
                              Expanded(
                                child: Column(
                                  crossAxisAlignment: CrossAxisAlignment.start,
                                  children: [
                                    const Text('EMERGENCY TYPE', style: AppTextStyles.caption),
                                    const SizedBox(height: 2),
                                    Text(
                                      selectedType.displayName,
                                      style: AppTextStyles.sectionHeader.copyWith(fontSize: 16),
                                    ),
                                  ],
                                ),
                              ),
                            ],
                          ),

                          const SizedBox(height: 16),
                          const Divider(),
                          const SizedBox(height: 16),

                          // Victims Row
                          Row(
                            children: [
                              const Icon(Icons.group_rounded, color: AppColors.emergencyRed, size: 24),
                              const SizedBox(width: 14),
                              Expanded(
                                child: Column(
                                  crossAxisAlignment: CrossAxisAlignment.start,
                                  children: [
                                    const Text('VICTIM COUNT', style: AppTextStyles.caption),
                                    const SizedBox(height: 2),
                                    Text(
                                      '$victimCount ${victimCount == 1 ? 'Person' : 'People'} requiring assistance',
                                      style: const TextStyle(fontSize: 15, fontWeight: FontWeight.w700),
                                    ),
                                  ],
                                ),
                              ),
                            ],
                          ),

                          const SizedBox(height: 16),
                          const Divider(),
                          const SizedBox(height: 16),

                          // Location Row
                          Row(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              const Icon(Icons.location_on_rounded, color: AppColors.emergencyRed, size: 24),
                              const SizedBox(width: 14),
                              Expanded(
                                child: Column(
                                  crossAxisAlignment: CrossAxisAlignment.start,
                                  children: [
                                    const Text('PICKUP LOCATION', style: AppTextStyles.caption),
                                    const SizedBox(height: 2),
                                    Text(
                                      loc?.readableAddress ?? 'Emergency Pinpoint Location',
                                      style: const TextStyle(fontSize: 14, fontWeight: FontWeight.w700),
                                    ),
                                    const SizedBox(height: 4),
                                    Text(
                                      'Coordinates: ${LocationFormatter.formatCoordinates(loc?.latitude, loc?.longitude)}',
                                      style: const TextStyle(fontSize: 12, color: AppColors.textSecondaryLight),
                                    ),
                                    Text(
                                      'Accuracy: ${LocationFormatter.formatAccuracy(loc?.accuracy)}',
                                      style: const TextStyle(fontSize: 12, color: AppColors.textSecondaryLight),
                                    ),
                                  ],
                                ),
                              ),
                            ],
                          ),

                          if (notes.isNotEmpty) ...[
                            const SizedBox(height: 16),
                            const Divider(),
                            const SizedBox(height: 16),
                            Row(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                const Icon(Icons.notes_rounded, color: AppColors.textSecondaryLight, size: 24),
                                const SizedBox(width: 14),
                                Expanded(
                                  child: Column(
                                    crossAxisAlignment: CrossAxisAlignment.start,
                                    children: [
                                      const Text('INCIDENT NOTES', style: AppTextStyles.caption),
                                      const SizedBox(height: 2),
                                      Text(
                                        notes,
                                        style: const TextStyle(fontSize: 13, height: 1.3),
                                      ),
                                    ],
                                  ),
                                ),
                              ],
                            ),
                          ],
                        ],
                      ),
                    ),
                  ),

                  const SizedBox(height: 16),

                  // Edit button
                  OutlinedButton.icon(
                    onPressed: () => Navigator.pop(context),
                    icon: const Icon(Icons.edit_rounded, size: 18),
                    label: const Text('EDIT INCIDENT DETAILS'),
                    style: OutlinedButton.styleFrom(
                      minimumSize: const Size(double.infinity, 48),
                    ),
                  ),

                  const SizedBox(height: 16),

                  // Error notice if previous submission failed
                  ListenableBuilder(
                    listenable: emergencyController,
                    builder: (context, _) {
                      if (emergencyController.errorMessage != null) {
                        return Container(
                          padding: const EdgeInsets.all(12),
                          decoration: BoxDecoration(
                            color: AppColors.emergencyLightRed,
                            borderRadius: BorderRadius.circular(12),
                            border: Border.all(color: AppColors.emergencyRed),
                          ),
                          child: Row(
                            children: [
                              const Icon(Icons.error_outline_rounded, color: AppColors.emergencyRed, size: 20),
                              const SizedBox(width: 8),
                              Expanded(
                                child: Text(
                                  emergencyController.errorMessage!,
                                  style: const TextStyle(
                                    color: AppColors.emergencyDarkRed,
                                    fontSize: 12,
                                    fontWeight: FontWeight.w600,
                                  ),
                                ),
                              ),
                            ],
                          ),
                        );
                      }
                      return const SizedBox.shrink();
                    },
                  ),
                ],
              ),
            ),
          ),

          // Bottom Submission CTA
          Container(
            padding: const EdgeInsets.all(20),
            decoration: BoxDecoration(
              color: theme.scaffoldBackgroundColor,
              border: Border(top: BorderSide(color: theme.dividerColor)),
            ),
            child: SafeArea(
              child: ListenableBuilder(
                listenable: emergencyController,
                builder: (context, _) {
                  final isSubmitting = emergencyController.submissionState == SubmissionState.submitting;

                  return SizedBox(
                    width: double.infinity,
                    height: 56,
                    child: ElevatedButton(
                      onPressed: isSubmitting ? null : () => _submitRequest(context),
                      style: ElevatedButton.styleFrom(
                        backgroundColor: AppColors.emergencyRed,
                        elevation: 4,
                      ),
                      child: isSubmitting
                          ? const Row(
                              mainAxisAlignment: MainAxisAlignment.center,
                              children: [
                                SizedBox(
                                  width: 20,
                                  height: 20,
                                  child: CircularProgressIndicator(
                                    strokeWidth: 2.5,
                                    color: Colors.white,
                                  ),
                                ),
                                SizedBox(width: 12),
                                Text(
                                  'SENDING DISPATCH REQUEST...',
                                  style: TextStyle(fontSize: 15, fontWeight: FontWeight.w800),
                                ),
                              ],
                            )
                          : const Row(
                              mainAxisAlignment: MainAxisAlignment.center,
                              children: [
                                Icon(Icons.send_rounded, size: 20),
                                SizedBox(width: 10),
                                Text(
                                  'CONFIRM & DISPATCH AMBULANCE',
                                  style: TextStyle(fontSize: 16, fontWeight: FontWeight.w900),
                                ),
                              ],
                            ),
                    ),
                  );
                },
              ),
            ),
          ),
        ],
      ),
    ),
  ),
);
}
}
