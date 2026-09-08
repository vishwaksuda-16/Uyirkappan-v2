/// Real-Time Event Envelope for future WebSocket / Server-Sent Events integration.
class EventPayloadModel {
  final String event;
  final String requestId;
  final DateTime timestamp;
  final Map<String, dynamic> data;

  const EventPayloadModel({
    required this.event,
    required this.requestId,
    required this.timestamp,
    required this.data,
  });

  factory EventPayloadModel.fromJson(Map<String, dynamic> json) {
    return EventPayloadModel(
      event: json['event'] as String? ?? 'UNKNOWN',
      requestId: json['requestId'] as String? ?? '',
      timestamp: json['timestamp'] != null
          ? DateTime.parse(json['timestamp'] as String)
          : DateTime.now(),
      data: (json['data'] as Map<String, dynamic>?) ?? {},
    );
  }

  Map<String, dynamic> toJson() {
    return {
      'event': event,
      'requestId': requestId,
      'timestamp': timestamp.toIso8601String(),
      'data': data,
    };
  }
}
