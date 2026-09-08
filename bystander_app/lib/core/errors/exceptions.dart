/// Custom exceptions thrown by DataSources.
class ServerException implements Exception {
  final String message;
  final int? statusCode;
  final String? code;

  const ServerException(this.message, [this.statusCode, this.code]);

  @override
  String toString() => 'ServerException: $message ($statusCode)';
}

class NetworkException implements Exception {
  final String message;
  const NetworkException([this.message = 'No active network connection']);

  @override
  String toString() => 'NetworkException: $message';
}

class LocationException implements Exception {
  final String message;
  final String? code;

  const LocationException(this.message, [this.code]);

  @override
  String toString() => 'LocationException: $message';
}

class CacheException implements Exception {
  final String message;
  const CacheException(this.message);

  @override
  String toString() => 'CacheException: $message';
}
