/// Constants for OpenFreeMap styles and MapLibre configuration.
class MapConstants {
  MapConstants._();

  /// Primary requested OpenFreeMap style: Bright
  static const String styleBright = 'https://tiles.openfreemap.org/styles/bright';

  /// Detailed topographic vector style
  static const String styleLiberty = 'https://tiles.openfreemap.org/styles/liberty';

  /// Minimalist light gray vector style
  static const String stylePositron = 'https://tiles.openfreemap.org/styles/positron';

  /// High-contrast dark vector style for nighttime triage
  static const String styleDark = 'https://tiles.openfreemap.org/styles/dark';

  /// High-contrast moody vector style
  static const String styleFiord = 'https://tiles.openfreemap.org/styles/fiord';

  /// Default starting style
  static const String defaultStyle = styleBright;

  /// Default coordinates (Chennai Central / Anna Salai hub)
  static const double defaultLatitude = 13.0827;
  static const double defaultLongitude = 80.2707;

  /// Default zoom levels
  static const double defaultZoom = 14.0;
  static const double pickerZoom = 15.5;
  static const double trackingZoom = 14.5;
}

/// Enumeration of selectable OpenFreeMap styles.
enum OpenFreeMapStyle {
  bright(
    name: 'Bright',
    description: 'High-contrast navigation style',
    url: MapConstants.styleBright,
    has3d: false,
  ),
  liberty(
    name: 'Liberty',
    description: 'Detailed OpenStreetMap vector style',
    url: MapConstants.styleLiberty,
    has3d: false,
  ),
  positron(
    name: 'Positron',
    description: 'Minimalist light vector style',
    url: MapConstants.stylePositron,
    has3d: false,
  ),
  dark(
    name: 'Dark',
    description: 'Nighttime emergency dark style',
    url: MapConstants.styleDark,
    has3d: false,
  ),
  fiord(
    name: 'Fiord',
    description: 'High-contrast moody vector style',
    url: MapConstants.styleFiord,
    has3d: false,
  ),
  threeD(
    name: '3D Buildings',
    description: '3D building extrusions enabled',
    url: MapConstants.styleBright,
    has3d: true,
  );

  final String name;
  final String description;
  final String url;
  final bool has3d;

  const OpenFreeMapStyle({
    required this.name,
    required this.description,
    required this.url,
    required this.has3d,
  });
}
