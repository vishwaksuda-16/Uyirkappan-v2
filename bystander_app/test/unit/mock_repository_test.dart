import 'package:flutter_test/flutter_test.dart';
import 'package:uyirkappan_bystander/data/datasources/local/request_local_datasource.dart';
import 'package:uyirkappan_bystander/data/datasources/mock/mock_emergency_request_datasource.dart';
import 'package:uyirkappan_bystander/data/repositories/emergency_request_repository_impl.dart';
import 'package:uyirkappan_bystander/domain/entities/emergency_request.dart';
import 'package:uyirkappan_bystander/domain/entities/emergency_type.dart';
import 'package:uyirkappan_bystander/domain/entities/location_data.dart';
import 'package:uyirkappan_bystander/domain/entities/request_status.dart';

import 'package:uyirkappan_bystander/data/models/emergency_request_model.dart';

class FakeLocalDataSource implements RequestLocalDataSource {
  String? activeId;
  final List<EmergencyRequestModel> _history = [];

  @override
  Future<void> clearActiveRequestId() async {
    activeId = null;
  }

  @override
  Future<String?> getActiveRequestId() async {
    return activeId;
  }

  @override
  Future<void> saveActiveRequestId(String requestId) async {
    activeId = requestId;
  }

  @override
  Future<void> saveRequestToHistory(EmergencyRequestModel request) async {
    _history.add(request);
  }

  @override
  Future<List<EmergencyRequestModel>> getPastRequests() async {
    return _history;
  }
}

void main() {
  group('EmergencyRequestRepositoryImpl with MockDataSource Tests', () {
    late MockEmergencyRequestDataSource mockDataSource;
    late FakeLocalDataSource fakeLocalDataSource;
    late EmergencyRequestRepositoryImpl repository;

    setUp(() {
      mockDataSource = MockEmergencyRequestDataSource();
      fakeLocalDataSource = FakeLocalDataSource();
      repository = EmergencyRequestRepositoryImpl(
        dataSource: mockDataSource,
        localDataSource: fakeLocalDataSource,
      );
    });

    tearDown(() {
      mockDataSource.dispose();
    });

    final testDraft = EmergencyRequest(
      requestId: '',
      requesterId: 'TEST-USER-1',
      emergencyType: EmergencyType.accident,
      victimCount: 1,
      emergencyLocation: LocationData(
        latitude: 13.0827,
        longitude: 80.2707,
        timestamp: DateTime.now(),
      ),
      createdAt: DateTime.now(),
      status: RequestStatus.created,
    );

    test('should submit emergency request and persist active request ID', () async {
      final created = await repository.submitEmergencyRequest(testDraft);

      expect(created.requestId.startsWith('UK-'), isTrue);
      expect(created.status, RequestStatus.searching);
      expect(created.emergencyType, EmergencyType.accident);
      expect(fakeLocalDataSource.activeId, created.requestId);
    });

    test('should retrieve created emergency request by ID', () async {
      final created = await repository.submitEmergencyRequest(testDraft);
      final fetched = await repository.getEmergencyRequest(created.requestId);

      expect(fetched.requestId, created.requestId);
      expect(fetched.emergencyType, created.emergencyType);
    });

    test('should cancel emergency request and clear local persistence', () async {
      final created = await repository.submitEmergencyRequest(testDraft);
      expect(fakeLocalDataSource.activeId, isNotNull);

      final cancelled = await repository.cancelEmergencyRequest(
        created.requestId,
        reason: 'False alarm',
      );

      expect(cancelled.status, RequestStatus.cancelled);
      expect(fakeLocalDataSource.activeId, isNull);
    });

    test('should emit updates when listening to watchRequestUpdates', () async {
      final created = await repository.submitEmergencyRequest(testDraft);
      final stream = repository.watchRequestUpdates(created.requestId);

      expect(
        stream,
        emits(predicate<EmergencyRequest>((req) => req.requestId == created.requestId)),
      );
    });
  });
}
