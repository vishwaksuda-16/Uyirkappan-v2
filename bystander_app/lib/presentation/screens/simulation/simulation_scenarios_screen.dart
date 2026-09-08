import 'package:flutter/material.dart';
import '../../../core/theme/app_colors.dart';
import '../../../core/theme/app_text_styles.dart';
import '../../../data/datasources/mock/mock_emergency_request_datasource.dart';
import '../../controllers/simulation_controller.dart';

/// Screen for selecting development simulation scenarios for viva/evaluation demonstrations.
class SimulationScenariosScreen extends StatelessWidget {
  final SimulationController simulationController;

  const SimulationScenariosScreen({
    super.key,
    required this.simulationController,
  });

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('Simulation Scenarios'),
      ),
      body: ListenableBuilder(
        listenable: simulationController,
        builder: (context, _) {
          final activeScenario = simulationController.currentScenario;
          final isFast = simulationController.isFastSimulation;

          return Center(
            child: ConstrainedBox(
              constraints: const BoxConstraints(maxWidth: 680),
              child: SingleChildScrollView(
                padding: const EdgeInsets.all(20),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    // Simulation Information Box
                    Container(
                      padding: const EdgeInsets.all(16),
                      decoration: BoxDecoration(
                        color: Colors.amber.shade50,
                        borderRadius: BorderRadius.circular(16),
                        border: Border.all(color: Colors.amber.shade700),
                      ),
                      child: Row(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Icon(Icons.info_rounded, color: Colors.amber.shade900, size: 24),
                          const SizedBox(width: 12),
                          Expanded(
                            child: Column(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                Text(
                                  'Controlled Simulation Mode',
                                  style: TextStyle(
                                    fontSize: 14,
                                    fontWeight: FontWeight.w800,
                                    color: Colors.amber.shade900,
                                  ),
                                ),
                                const SizedBox(height: 4),
                                Text(
                                  'Select a scenario below to test the client-side lifecycle handling, UI transitions, cascading fallback, and tracking integration.',
                                  style: TextStyle(fontSize: 12, color: Colors.amber.shade900, height: 1.3),
                                ),
                              ],
                            ),
                          ),
                        ],
                      ),
                    ),

                    const SizedBox(height: 20),

                    // Speed Switcher
                    Card(
                      child: Padding(
                        padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
                        child: Row(
                          mainAxisAlignment: MainAxisAlignment.spaceBetween,
                          children: [
                            Column(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                const Text('Simulation Speed', style: TextStyle(fontWeight: FontWeight.w700)),
                                Text(
                                  isFast ? 'Fast Mode (~3s transitions)' : 'Real-time Pace (~8s transitions)',
                                  style: const TextStyle(fontSize: 12, color: AppColors.textSecondaryLight),
                                ),
                              ],
                            ),
                            Switch(
                              value: isFast,
                              activeThumbColor: AppColors.emergencyRed,
                              onChanged: (_) => simulationController.toggleSimulationSpeed(),
                            ),
                          ],
                        ),
                      ),
                    ),

                    const SizedBox(height: 24),

                    const Text('Select Demo Scenario', style: AppTextStyles.sectionHeader),
                    const SizedBox(height: 12),

                    ...SimulationScenarioType.values.map((scenario) {
                      final isSelected = scenario == activeScenario;
                      return Padding(
                        padding: const EdgeInsets.only(bottom: 12),
                        child: Material(
                          color: Colors.transparent,
                          child: InkWell(
                            onTap: () {
                              simulationController.selectScenario(scenario);
                              ScaffoldMessenger.of(context).showSnackBar(
                                SnackBar(
                                  content: Text('Switched to ${simulationController.getScenarioTitle(scenario)}'),
                                  duration: const Duration(seconds: 2),
                                ),
                              );
                            },
                            borderRadius: BorderRadius.circular(16),
                            child: Container(
                              padding: const EdgeInsets.all(16),
                              decoration: BoxDecoration(
                                color: isSelected ? AppColors.emergencyLightRed : Theme.of(context).cardColor,
                                borderRadius: BorderRadius.circular(16),
                                border: Border.all(
                                  color: isSelected ? AppColors.emergencyRed : Theme.of(context).dividerColor,
                                  width: isSelected ? 2.0 : 1.0,
                                ),
                              ),
                              child: Column(
                                crossAxisAlignment: CrossAxisAlignment.start,
                                children: [
                                  Row(
                                    children: [
                                      Icon(
                                        isSelected ? Icons.radio_button_checked : Icons.radio_button_off,
                                        color: isSelected ? AppColors.emergencyRed : Theme.of(context).disabledColor,
                                        size: 22,
                                      ),
                                      const SizedBox(width: 10),
                                      Expanded(
                                        child: Text(
                                          simulationController.getScenarioTitle(scenario),
                                          style: TextStyle(
                                            fontSize: 15,
                                            fontWeight: isSelected ? FontWeight.w800 : FontWeight.w700,
                                            color: isSelected ? AppColors.emergencyDarkRed : null,
                                          ),
                                        ),
                                      ),
                                    ],
                                  ),
                                  Padding(
                                    padding: const EdgeInsets.only(left: 32, right: 12, bottom: 4, top: 4),
                                    child: Text(
                                      simulationController.getScenarioDescription(scenario),
                                      style: TextStyle(
                                        fontSize: 12,
                                        color: isSelected
                                            ? AppColors.emergencyDarkRed.withValues(alpha: 0.85)
                                            : AppColors.textSecondaryLight,
                                        height: 1.3,
                                      ),
                                    ),
                                  ),
                                ],
                              ),
                            ),
                          ),
                        ),
                      );
                    }),
                  ],
                ),
              ),
            ),
          );
        },
      ),
    );
  }
}
