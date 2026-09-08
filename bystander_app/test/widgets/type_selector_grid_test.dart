import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:uyirkappan_bystander/domain/entities/emergency_type.dart';
import 'package:uyirkappan_bystander/presentation/widgets/type_selector_grid.dart';

void main() {
  group('TypeSelectorGrid Widget Tests', () {
    testWidgets('should render all emergency types and handle selection', (tester) async {
      EmergencyType selected = EmergencyType.accident;

      await tester.pumpWidget(
        MaterialApp(
          home: Scaffold(
            body: StatefulBuilder(
              builder: (context, setState) {
                return SingleChildScrollView(
                  child: TypeSelectorGrid(
                    selectedType: selected,
                    onSelected: (type) {
                      setState(() => selected = type);
                    },
                  ),
                );
              },
            ),
          ),
        ),
      );

      expect(find.text('Accident / Collision'), findsOneWidget);
      expect(find.text('Cardiac Emergency'), findsOneWidget);
      expect(find.text('Breathing Difficulty'), findsOneWidget);
      expect(find.text('Unconscious Person'), findsOneWidget);
      expect(find.text('Trauma / Severe Bleeding'), findsOneWidget);

      // Tap Cardiac Emergency
      await tester.tap(find.text('Cardiac Emergency'));
      await tester.pump();

      expect(selected, EmergencyType.cardiacEmergency);
    });
  });
}
