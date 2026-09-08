/// Abstraction for device network connectivity checking.
abstract class NetworkInfo {
  Future<bool> get isConnected;
}

class AlwaysConnectedNetworkInfo implements NetworkInfo {
  const AlwaysConnectedNetworkInfo();

  @override
  Future<bool> get isConnected async => true;
}
