# UyirKappan — OpenFreeMap & MapLibre GL Integration Guide

## 1. Executive Summary & Overview

UyirKappan uses **OpenFreeMap** and **MapLibre GL** as its primary mapping engine. This completely open-source mapping stack provides full vector tile rendering, zero API keys, no monthly usage billing, and zero rate limits.

```
┌──────────────────────────────────────────────────────────────────┐
│                   OpenFreeMap Vector Tile API                    │
│   (https://tiles.openfreemap.org/styles/bright, liberty, etc.)  │
└─────────────────────────────────┬────────────────────────────────┘
                                  │
                                  ▼
┌──────────────────────────────────────────────────────────────────┐
│                  MapLibre GL JS v5 (WebGL Engine)                │
│    Client-side vector tile decompression, style parsing, 60fps   │
└─────────────────────────────────┬────────────────────────────────┘
                                  │
                                  ▼
┌──────────────────────────────────────────────────────────────────┐
│                UyirKappan MapLibre Bridge Layer                  │
│       (web/maplibre_bridge.js + HtmlElementView Web Platform)    │
└─────────────────────────────────┬────────────────────────────────┘
                                  │
                                  ▼
┌──────────────────────────────────────────────────────────────────┐
│                Flutter Presentation Architecture                 │
│         OpenFreeMapView (Location Picker & Live Tracking)        │
└──────────────────────────────────────────────────────────────────┘
```

---

## 2. OpenFreeMap vs. Proprietary Mapping (Google Maps / Mapbox)

| Feature | OpenFreeMap + MapLibre GL | Google Maps / Mapbox |
|---|---|---|
| **Cost** | 100% Free & Open Source | Pay-per-load / Pay-per-tile |
| **API Keys** | **None required** | Mandatory key with billing enabled |
| **Rate Limits** | Unlimited | Strict quota limits |
| **Rendering** | Hardware-accelerated WebGL vector tiles | Raster or proprietary vector |
| **Self-Hosting** | Planet Btrfs image available for offline/on-premise | Impossible (SaaS locked) |
| **Custom Styling** | Fully editable via open-source Maputnik | Locked to proprietary dashboard |

---

## 3. Supported OpenFreeMap Styles & Endpoints

OpenFreeMap serves pre-compiled, high-performance MapLibre style JSON files:

### 1. Bright Style (Default Primary Style)
- **Endpoint**: `https://tiles.openfreemap.org/styles/bright`
- **Characteristics**: Vibrant, high-contrast palette designed specifically for navigation and street clarity. Roads, buildings, and water bodies are distinctly delineated for rapid emergency triage.

### 2. Liberty Style
- **Endpoint**: `https://tiles.openfreemap.org/styles/liberty`
- **Characteristics**: Classic, comprehensive OpenStreetMap cartography with land-use zones, parks, points of interest, and topography.

### 3. Positron Style
- **Endpoint**: `https://tiles.openfreemap.org/styles/positron`
- **Characteristics**: Clean, monochrome, light-gray minimalist aesthetic. Ideal for high-contrast overlays where emergency incident markers and ambulance routes must stand out without visual clutter.

### 4. Dark Style
- **Endpoint**: `https://tiles.openfreemap.org/styles/dark`
- **Characteristics**: Sleek, high-contrast dark theme optimized for night-time emergency dispatches and OLED power saving.

### 5. Fiord Style
- **Endpoint**: `https://tiles.openfreemap.org/styles/fiord`
- **Characteristics**: Moody, cool-toned blue/slate palette with prominent road networks.

### 6. 3D Building Extrusions
- **Mechanism**: Toggled in MapLibre via dynamic `fill-extrusion` layers on the OpenMapTiles `building` source layer, tilted to a $55^\circ$ pitch for realistic urban depth.

---

## 4. Architecture & Implementation in the Codebase

### Layer 1: Web Engine & CDN Integration
In [`web/index.html`](file:///d:/Projects/Uyirkaapan/web/index.html), MapLibre GL JS v5 and its styles are loaded directly:

```html
<!-- MapLibre GL JS v5 for OpenFreeMap Integration -->
<script src="https://unpkg.com/maplibre-gl@5/dist/maplibre-gl.js"></script>
<link href="https://unpkg.com/maplibre-gl@5/dist/maplibre-gl.css" rel="stylesheet" />
<script src="maplibre_bridge.js"></script>
```

### Layer 2: JavaScript Interop Bridge
[`web/maplibre_bridge.js`](file:///d:/Projects/Uyirkaapan/web/maplibre_bridge.js) exposes high-level, lifecycle-safe functions under `window.uyirkappanMaps`:

- `initMap(containerId, lat, lng, zoom, styleUrl, isPickerMode)`: Creates the MapLibre map instance, sets center/zoom, adds navigation controls, and binds click handlers.
- `updateIncidentMarker(containerId, lat, lng)`: Renders a pulsing red emergency marker at the incident location.
- `updateAmbulanceMarker(containerId, lat, lng, headingDegrees, ambulanceId)`: Renders an ambulance vehicle marker with license/unit badge and rotates the vehicle according to telemetry compass heading ($0^\circ-360^\circ$).
- `drawRoute(containerId, coordinates)`: Dynamically adds or updates a GeoJSON `LineString` layer showing the road route from the ambulance to the victim.
- `setStyle(containerId, styleUrl, enable3D)`: Hot-swaps the map vector style on the fly.
- `flyTo(containerId, lat, lng, zoom)`: Smooth camera panning to target coordinates.

### Layer 3: Cross-Platform Flutter Abstraction
To ensure full cross-platform compatibility across Web, Desktop (Windows), and Automated Tests (`flutter test`), the app utilizes conditional compilation:

- [`lib/presentation/widgets/map/openfreemap_view.dart`](file:///d:/Projects/Uyirkaapan/lib/presentation/widgets/map/openfreemap_view.dart):
  Exports `OpenFreeMapView` using conditional imports:
  ```dart
  import 'openfreemap_view_stub.dart'
      if (dart.library.html) 'openfreemap_view_web.dart' as platform_map;
  ```
- [`lib/presentation/widgets/map/openfreemap_view_web.dart`](file:///d:/Projects/Uyirkaapan/lib/presentation/widgets/map/openfreemap_view_web.dart):
  Registers an HTML `DivElement` in `ui_web.platformViewRegistry` and bridges Flutter state to MapLibre GL JS WebGL canvas.
- [`lib/presentation/widgets/map/openfreemap_view_stub.dart`](file:///d:/Projects/Uyirkaapan/lib/presentation/widgets/map/openfreemap_view_stub.dart):
  A pure Dart/Canvas vector map fallback that handles coordinate projection, incident pins, moving ambulance markers with heading rotation, and route polylines for native desktop and automated test runners.
- [`lib/presentation/widgets/map/map_style_selector.dart`](file:///d:/Projects/Uyirkaapan/lib/presentation/widgets/map/map_style_selector.dart):
  An interactive floating chip bar allowing users to switch styles between Bright, Liberty, Positron, Dark, Fiord, and 3D on the fly.

---

## 5. Real-Time vs. Simulated Versions

The map seamlessly switches between real-world device execution and demonstration simulations:

### A. Real-Time GPS Mode
1. **Device GPS Auto-Detection**:
   - `LocationController` uses `geolocator` to query high-accuracy device GPS.
   - Coordinates are passed directly to `OpenFreeMapView` as `incidentLocation`.
2. **Interactive Location Picker Screen** ([`LocationPickerScreen`](file:///d:/Projects/Uyirkaapan/lib/presentation/screens/location/location_picker_screen.dart)):
   - Bystanders can tap or drag anywhere on the OpenFreeMap vector map.
   - The bridge captures `map.on('click')` and fires a custom event back to Flutter, updating `_selectedLat` and `_selectedLng` instantly.
   - Bystanders can fine-tune with the directional D-pad ($\pm 0.0015^\circ$) or select known preset landmark coordinates (Chennai Central, Anna Nagar, T. Nagar, Airport).
3. **Live Telemetry Stream**:
   - When connected to a live backend (`USE_REMOTE_BACKEND=true`), WebSocket / SSE telemetry updates the ambulance position, speed, and ETA countdown.

### B. Simulated Demonstration Mode
When running in local simulation mode, all 4 demonstration scenarios reflect visually on the OpenFreeMap canvas:

1. **Scenario 1 — Normal Dispatch**:
   - Initial state: Map centers on the emergency incident in Chennai ($13.0827^\circ \text{N}, 80.2707^\circ \text{E}$).
   - Status transitions to `EN_ROUTE_TO_PATIENT`: Ambulance marker `AMB-CH-042` spawns at dispatch depot coordinates ($13.0900^\circ \text{N}, 80.2780^\circ \text{E}$) and approaches the incident location along the street network.
   - Dynamic polyline connects ambulance to patient with live vehicle heading rotation.
   - Dynamic ETA counts down ($8\text{ min} \rightarrow 1\text{ min}$) alongside live telemetry.
2. **Scenario 2 — Driver Rejection with Cascading Fallback**:
   - Initial unit `AMB-CH-011` is assigned on the map.
   - Driver rejects: Map immediately displays the top **Cascading Fallback Alert Banner** (*"Finding another ambulance..."*).
   - Secondary vehicle `AMB-CH-089` spawns from another station, re-routes on the map, and heads to the patient.
3. **Scenario 3 — Driver Timeout with Cascading Fallback**:
   - Initial unit `AMB-CH-033` fails to respond within the SLA window.
   - System auto-triggers cascading fallback; secondary unit `AMB-CH-099` is assigned and navigates to the incident.
4. **Scenario 4 — No Ambulance Available**:
   - Map displays searching pulses across the Chennai metropolitan area.
   - Fleet capacity exhausted: triggers `NO_AMBULANCE_AVAILABLE` and displays direct 108 helpline integration.

---

### C. Camera Stabilization & UX Enhancements
To deliver a smooth user experience during live vehicle tracking and pin selection:
1. **Destination-Keyed Camera Framing**:
   - The map bounds calculation is keyed to the destination coordinate leg (`destKey`) rather than the moving ambulance coordinate.
   - This completely eliminates continuous camera zoom jitter and bounce as the ambulance drives toward the victim.
2. **Normalized Longitude Coordinates**:
   - Prevents antimeridian wrapping anomalies when computing bounding boxes for `fitBounds`.
3. **Cross-Platform Native Cursors**:
   - Replaced crosshair cursor with standard natural arrow pointer (`default`) and click hand (`pointer`) across all map view modes.

---

## 6. How to Customize Styles (Maputnik) & Self-Host

### Customizing via Maputnik Editor
1. Open the Maputnik open-source style editor in your browser:
   - [Customize Bright Style](https://maputnik.github.io/editor?style=https://tiles.openfreemap.org/styles/bright)
   - [Customize Liberty Style](https://maputnik.github.io/editor?style=https://tiles.openfreemap.org/styles/liberty)
   - [Customize Positron Style](https://maputnik.github.io/editor?style=https://tiles.openfreemap.org/styles/positron)
2. In Maputnik:
   - Toggle layer visibility (e.g. emphasize hospitals, emergency routes, or remove commercial POIs).
   - Alter road and water colors to match organization branding.
3. Export the resulting `style.json` and host it on your CDN or static file server.
4. Pass your custom style URL into `MapConstants.styleBright` or `OpenFreeMapStyle`.

### Self-Hosting OpenFreeMap
For sovereign, offline, or air-gapped hospital deployments:
1. Download full planet or regional Btrfs vector tile images from [hyperknot/openfreemap](https://github.com/hyperknot/openfreemap).
2. Run via Docker:
   ```bash
   docker run -p 8080:8080 -v /path/to/tiles:/data openfreemap/server
   ```
3. Update `lib/core/constants/map_constants.dart`:
   ```dart
   static const String styleBright = 'https://maps.yourhospital.org/styles/bright';
   ```

---

## 7. How Downstream Modules Integrate with the Map

- **Module 4 (Driver Application)**:
  Emits driver GPS telemetry (`latitude`, `longitude`, `headingDegrees`, `speedKmH`) via WebSocket topic `/topic/tracking/:ambulanceId`.
  The Bystander application's `TrackingRepository` consumes this stream and passes it directly to `OpenFreeMapView(ambulanceLocation: ...)`.

- **Module 6 (Routing Engine & Dijkstra Algorithm)**:
  Computes shortest path road geometry between ambulance depot and patient.
  Provides a list of coordinate waypoints `[[lng, lat], [lng, lat], ...]`.
  Passed into `OpenFreeMapView(routeWaypoints: ...)` to draw real-time turn-by-turn route polylines on the MapLibre canvas.
