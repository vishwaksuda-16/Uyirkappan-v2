import 'package:flutter/material.dart';
import '../../../core/constants/app_constants.dart';
import '../../../core/theme/app_colors.dart';
import '../../../core/theme/app_text_styles.dart';
import '../../../routing/route_paths.dart';
import '../../controllers/emergency_controller.dart';
import '../../widgets/counter_stepper.dart';
import '../../widgets/type_selector_grid.dart';

/// Screen 3: Emergency Information Capture (Emergency Type & Number of Victims).
class EmergencyDetailsScreen extends StatefulWidget {
  final EmergencyController emergencyController;

  const EmergencyDetailsScreen({
    super.key,
    required this.emergencyController,
  });

  @override
  State<EmergencyDetailsScreen> createState() => _EmergencyDetailsScreenState();
}

class _EmergencyDetailsScreenState extends State<EmergencyDetailsScreen> {
  late TextEditingController _notesController;

  @override
  void initState() {
    super.initState();
    _notesController = TextEditingController(text: widget.emergencyController.additionalNotes);
  }

  @override
  void dispose() {
    _notesController.dispose();
    super.dispose();
  }

  void _onProceedToReview() {
    widget.emergencyController.setAdditionalNotes(_notesController.text.trim());
    Navigator.pushNamed(context, RoutePaths.reviewRequest);
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('Emergency Information'),
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
                          'STEP 1 OF 2',
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
                        'Incident Details',
                        style: TextStyle(fontSize: 13, fontWeight: FontWeight.w600),
                      ),
                    ],
                  ),

                  const SizedBox(height: 20),

                  // Section 1: Number of Victims
                  const Text('Number of Victims / Patients', style: AppTextStyles.sectionHeader),
                  const SizedBox(height: 4),
                  const Text(
                    'Helps dispatch the appropriate number of ambulances and medical kits.',
                    style: TextStyle(fontSize: 12, color: AppColors.textSecondaryLight),
                  ),
                  const SizedBox(height: 12),
                  ListenableBuilder(
                    listenable: widget.emergencyController,
                    builder: (context, _) {
                      return CounterStepper(
                        count: widget.emergencyController.victimCount,
                        min: AppConstants.minVictims,
                        max: AppConstants.maxVictims,
                        onIncrement: widget.emergencyController.incrementVictimCount,
                        onDecrement: widget.emergencyController.decrementVictimCount,
                      );
                    },
                  ),

                  const SizedBox(height: 28),

                  // Section 2: Emergency Category
                  const Text('Emergency Category', style: AppTextStyles.sectionHeader),
                  const SizedBox(height: 4),
                  const Text(
                    'Select the primary medical distress to alert the response team.',
                    style: TextStyle(fontSize: 12, color: AppColors.textSecondaryLight),
                  ),
                  const SizedBox(height: 14),
                  ListenableBuilder(
                    listenable: widget.emergencyController,
                    builder: (context, _) {
                      return TypeSelectorGrid(
                        selectedType: widget.emergencyController.selectedType,
                        onSelected: (type) {
                          widget.emergencyController.setEmergencyType(type);
                        },
                      );
                    },
                  ),

                  const SizedBox(height: 20),

                  // Section 3: Optional Notes
                  const Text('Additional Incident Details (Optional)', style: AppTextStyles.sectionHeader),
                  const SizedBox(height: 4),
                  const Text(
                    'Any visible symptoms, trapped victims, or access barriers.',
                    style: TextStyle(fontSize: 12, color: AppColors.textSecondaryLight),
                  ),
                  const SizedBox(height: 10),
                  TextField(
                    controller: _notesController,
                    maxLines: 2,
                    decoration: InputDecoration(
                      hintText: 'e.g. 2nd floor, patient having chest tightness, bleeding',
                      filled: true,
                      fillColor: Theme.of(context).cardColor,
                      border: OutlineInputBorder(
                        borderRadius: BorderRadius.circular(14),
                        borderSide: BorderSide(color: Theme.of(context).dividerColor),
                      ),
                      contentPadding: const EdgeInsets.all(14),
                    ),
                  ),

                  const SizedBox(height: 24),
                ],
              ),
            ),
          ),

          // Bottom Action Bar
          Container(
            padding: const EdgeInsets.all(20),
            decoration: BoxDecoration(
              color: Theme.of(context).scaffoldBackgroundColor,
              border: Border(top: BorderSide(color: Theme.of(context).dividerColor)),
            ),
            child: SafeArea(
              child: SizedBox(
                width: double.infinity,
                height: 54,
                child: ElevatedButton(
                  onPressed: _onProceedToReview,
                  child: const Row(
                    mainAxisAlignment: MainAxisAlignment.center,
                    children: [
                      Text('REVIEW REQUEST', style: TextStyle(fontSize: 16, fontWeight: FontWeight.w800)),
                      SizedBox(width: 8),
                      Icon(Icons.arrow_forward_rounded, size: 20),
                    ],
                  ),
                ),
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
