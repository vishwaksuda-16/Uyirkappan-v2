import 'package:flutter_test/flutter_test.dart';
import 'package:uyirkappan_bystander/core/utils/location_formatter.dart';
import 'package:uyirkappan_bystander/data/models/location_model.dart';
import 'package:uyirkappan_bystander/domain/entities/location_data.dart';

void main() {
  group('LocationData and LocationModel Tests', () {
    final location = LocationData(
      latitude: 13.0827,
      longitude: 80.2707,
      accuracy: 4.8,
      altitude: 12.0,
      speed: 0.0,
      heading: 90.0,
      timestamp: DateTime(2026, 9, 1, 12, 0, 0),
      readableAddress: 'Anna Salai, Chennai',
      isManualOverride: false,
    );

    test('should serialize and deserialize LocationModel JSON correctly', () {
      final model = LocationModel.fromEntity(location);
      final json = model.toJson();

      expect(json['latitude'], 13.0827);
      expect(json['longitude'], 80.2707);
      expect(json['accuracy'], 4.8);
      expect(json['isManualOverride'], false);

      final deserialized = LocationModel.fromJson(json);
      expect(deserialized.latitude, location.latitude);
      expect(deserialized.longitude, location.longitude);
      expect(deserialized.accuracy, location.accuracy);
      expect(deserialized.readableAddress, location.readableAddress);
    });

    test('LocationFormatter should format coordinates and accuracy strings properly', () {
      expect(LocationFormatter.formatCoordinates(13.08271, 80.27071), '13.08271, 80.27071');
      expect(LocationFormatter.formatCoordinates(null, null), 'Coordinates unavailable');

      expect(LocationFormatter.formatAccuracy(8.4), '±8.4 m');
      expect(LocationFormatter.formatAccuracy(1500.0), '±1.50 km');
      expect(LocationFormatter.formatAccuracy(null), 'Accuracy unavailable');

      expect(LocationFormatter.formatDistance(450), '450 m');
      expect(LocationFormatter.formatDistance(2400), '2.4 km');
    });
  });
}
