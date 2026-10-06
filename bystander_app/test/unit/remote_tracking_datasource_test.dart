import 'dart:convert';

import 'package:flutter_test/flutter_test.dart';
import 'package:http/http.dart' as http;
import 'package:http/testing.dart';
import 'package:uyirkappan_bystander/data/datasources/remote/remote_tracking_datasource.dart';
import 'package:uyirkappan_bystander/data/datasources/remote/socket_service.dart';

void main() {
  group('RemoteTrackingDataSource', () {
    test('parses live ETA, route distance, and zero speed without inventing values', () async {
      final client = MockClient((_) async => http.Response(
            jsonEncode({
              'tracking': {
                'requestId': 'REQ-1',
                'ambulanceId': 'AMB-1',
                'location': {
                  'latitude': 13.05,
                  'longitude': 80.25,
                  'speed': 0,
                  'timestamp': '2025-01-01T00:00:00.000Z',
                },
                'eta': 3,
                'distanceKm': 1.75,
                'status': 'EN_ROUTE_TO_PATIENT',
              },
            }),
            200,
          ));
      final source = RemoteTrackingDataSource(
        client: client,
        baseUrl: 'https://example.test',
      );

      final tracking = await source.getTrackingInfo('REQ-1');

      expect(tracking?.eta?.estimatedMinutes, 3);
      expect(tracking?.eta?.distanceMeters, 1750);
      expect(tracking?.speedKmH, 0);
    });

    test('does not create a tracking point when the response has no location', () async {
      final client = MockClient((_) async => http.Response(
            jsonEncode({
              'tracking': {
                'requestId': 'REQ-1',
                'ambulanceId': 'AMB-1',
                'location': null,
                'eta': 3,
                'status': 'ACCEPTED',
              },
            }),
            200,
          ));
      final source = RemoteTrackingDataSource(
        client: client,
        baseUrl: 'https://example.test',
      );

      expect(await source.getTrackingInfo('REQ-1'), isNull);
    });

    test('ignores ETA updates for a different emergency request', () async {
      final socketService = SocketService();
      final source = RemoteTrackingDataSource(
        client: MockClient((_) async => http.Response('{}', 200)),
        baseUrl: 'https://example.test',
        socketService: socketService,
      );
      final etaFuture = source.watchEtaUpdates('REQ-1').first;

      socketService.emitSimulatedEvent('ETA_UPDATED', {
        'requestId': 'REQ-OTHER',
        'etaMinutes': 2,
      });
      socketService.emitSimulatedEvent('ETA_UPDATED', {
        'requestId': 'REQ-1',
        'etaMinutes': 7,
      });

      expect((await etaFuture).estimatedMinutes, 7);
      socketService.dispose();
    });
  });
}
