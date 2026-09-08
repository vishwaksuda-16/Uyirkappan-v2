import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:uyirkappan_bystander/presentation/widgets/counter_stepper.dart';

void main() {
  group('CounterStepper Widget Tests', () {
    testWidgets('should render count and trigger increment/decrement callbacks', (tester) async {
      int count = 2;
      bool incrementCalled = false;
      bool decrementCalled = false;

      await tester.pumpWidget(
        MaterialApp(
          home: Scaffold(
            body: StatefulBuilder(
              builder: (context, setState) {
                return CounterStepper(
                  count: count,
                  min: 1,
                  max: 10,
                  onIncrement: () {
                    incrementCalled = true;
                    setState(() => count++);
                  },
                  onDecrement: () {
                    decrementCalled = true;
                    setState(() => count--);
                  },
                );
              },
            ),
          ),
        ),
      );

      expect(find.text('2'), findsOneWidget);
      expect(find.text('VICTIMS'), findsOneWidget);

      // Tap decrement
      await tester.tap(find.byIcon(Icons.remove_rounded));
      await tester.pump();

      expect(decrementCalled, isTrue);
      expect(find.text('1'), findsOneWidget);
      expect(find.text('VICTIM'), findsOneWidget);

      // Tap increment
      await tester.tap(find.byIcon(Icons.add_rounded));
      await tester.pump();

      expect(incrementCalled, isTrue);
      expect(find.text('2'), findsOneWidget);
    });
  });
}
