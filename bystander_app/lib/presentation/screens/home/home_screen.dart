import 'dart:async';
import 'package:flutter/material.dart';
import '../../../core/constants/app_constants.dart';
import '../../../core/constants/map_constants.dart';
import '../../../core/theme/app_colors.dart';
import '../../../domain/entities/emergency_request.dart';
import '../../../domain/entities/emergency_type.dart';
import '../../../domain/entities/location_data.dart';
import '../../../domain/entities/nearby_poi.dart';
import '../../../domain/entities/request_status.dart';
import '../../../domain/entities/tracking_info.dart';
import '../../../domain/repositories/tracking_repository.dart';
import '../../../routing/route_paths.dart';
import '../../controllers/emergency_controller.dart';
import '../../controllers/location_controller.dart';
import '../../controllers/simulation_controller.dart';
import '../../widgets/counter_stepper.dart';
import '../../widgets/emergency_button.dart';
import '../../widgets/map/map_style_selector.dart';
import '../../widgets/map/openfreemap_view.dart';
import '../../widgets/status_badge.dart';
import '../../../core/utils/map_route_geometry.dart';
import '../../../main.dart';
import '../../controllers/auth_controller.dart';
import '../../../data/datasources/remote/socket_service.dart';

/// Unified Main Screen for UyirKappan Module 1 (Bystander App).
/// The MapLibre map IS the main screen background, featuring interactive pinpointing,
/// one-tap emergency dispatch, and real-time ambulance tracking right on this screen.
class HomeScreen extends StatefulWidget {
  final EmergencyController emergencyController;
  final LocationController locationController;
  final SimulationController? simulationController;
  final TrackingRepository? trackingRepository;
  final AuthController? authController;
  final SocketService? socketService;

  const HomeScreen({
    super.key,
    required this.emergencyController,
    required this.locationController,
    this.simulationController,
    this.trackingRepository,
    this.authController,
    this.socketService,
  });

  @override
  State<HomeScreen> createState() => _HomeScreenState();
}

class _HomeScreenState extends State<HomeScreen> {
  OpenFreeMapStyle _selectedMapStyle = OpenFreeMapStyle.bright;
  TrackingInfo? _currentTelemetry;
  StreamSubscription<TrackingInfo>? _trackingSubscription;
  String? _lastSubscribedRequestId;
  bool _showHospitals = true;
  bool _showAmbulances = true;
  bool _isPinLocked = false;
  int _recenterCounter = 0;
  String? _activeTopBannerMessage;
  Timer? _topBannerTimer;
  bool _isDispatching = false;

  @override
  void initState() {
    super.initState();
    _checkAndSubscribeTracking();
    widget.emergencyController.addListener(_onEmergencyStateChanged);
    widget.locationController.addListener(_onLocationChanged);
    widget.authController?.addListener(_onAuthStateChanged);
  }

  @override
  void didUpdateWidget(HomeScreen oldWidget) {
    super.didUpdateWidget(oldWidget);
    _checkAndSubscribeTracking();
  }

  @override
  void dispose() {
    _topBannerTimer?.cancel();
    widget.emergencyController.removeListener(_onEmergencyStateChanged);
    widget.locationController.removeListener(_onLocationChanged);
    widget.authController?.removeListener(_onAuthStateChanged);
    _trackingSubscription?.cancel();
    super.dispose();
  }

  void _onAuthStateChanged() {
    if (mounted) setState(() {});
  }

  void _showTopBannerNotification(String message) {
    _topBannerTimer?.cancel();
    if (mounted) {
      setState(() {
        _activeTopBannerMessage = message;
      });
    }
    _topBannerTimer = Timer(const Duration(seconds: 4), () {
      if (mounted) {
        setState(() {
          _activeTopBannerMessage = null;
        });
      }
    });
  }

  void _onEmergencyStateChanged() {
    _checkAndSubscribeTracking();
    if (mounted) setState(() {});

    final notif = widget.emergencyController.latestNotification;
    if (notif != null && notif.isNotEmpty) {
      _showTopBannerNotification(notif);
      widget.emergencyController.clearNotification();
    }
  }

  void _onLocationChanged() {
    if (mounted) setState(() {});
  }

  void _checkAndSubscribeTracking() {
    final activeRequest = widget.emergencyController.activeRequest;
    if (activeRequest != null && activeRequest.status.isActive && widget.trackingRepository != null) {
      if (_lastSubscribedRequestId != activeRequest.requestId) {
        _lastSubscribedRequestId = activeRequest.requestId;
        _trackingSubscription?.cancel();
        _trackingSubscription = widget.trackingRepository!
            .watchTrackingUpdates(activeRequest.requestId)
            .listen((telemetry) {
          if (mounted) {
            setState(() => _currentTelemetry = telemetry);
          }
        });
      }
    } else {
      if (_lastSubscribedRequestId != null) {
        _lastSubscribedRequestId = null;
        _trackingSubscription?.cancel();
        _trackingSubscription = null;
      }
    }
  }

  void _togglePinLock() {
    OpenFreeMapView.suppressClicks();
    setState(() {
      _isPinLocked = !_isPinLocked;
    });
    ScaffoldMessenger.of(context).hideCurrentSnackBar();
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(
        duration: const Duration(seconds: 2),
        content: Text(
          _isPinLocked
              ? '🔒 Incident pickup location locked.'
              : '🔓 Location unlocked. Tap anywhere on map or drag pin to position pickup spot.',
          style: const TextStyle(fontWeight: FontWeight.w700),
        ),
      ),
    );
  }

  void _dispatchAmbulance() async {
    if (_isDispatching) return;
    setState(() => _isDispatching = true);

    OpenFreeMapView.suppressClicks();
    final loc = widget.locationController.emergencyLocation ??
        LocationData(
          latitude: MapConstants.defaultLatitude,
          longitude: MapConstants.defaultLongitude,
          timestamp: DateTime.now(),
        );

    // Show immediate user feedback
    ScaffoldMessenger.of(context).hideCurrentSnackBar();
    ScaffoldMessenger.of(context).showSnackBar(
      const SnackBar(
        duration: Duration(seconds: 4),
        content: Row(
          children: [
            SizedBox(
              width: 16,
              height: 16,
              child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white),
            ),
            SizedBox(width: 12),
            Expanded(
              child: Text(
                'Creating emergency... Contacting intelligent dispatch engine.',
                style: TextStyle(fontWeight: FontWeight.w700),
              ),
            ),
          ],
        ),
      ),
    );

    widget.emergencyController.markT0Timestamp();
    widget.emergencyController.setAdditionalNotes('Dispatched directly from main screen map');

    final success = await widget.emergencyController.submitEmergencyRequest(
      emergencyLocation: loc,
    );

    if (mounted) {
      setState(() => _isDispatching = false);
      if (!success) {
        final err = widget.emergencyController.errorMessage ?? 'Unknown dispatch failure';
        ScaffoldMessenger.of(context).hideCurrentSnackBar();
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            backgroundColor: AppColors.emergencyRed,
            duration: const Duration(seconds: 6),
            content: Row(
              children: [
                const Icon(Icons.error_outline, color: Colors.white),
                const SizedBox(width: 10),
                Expanded(
                  child: Text(
                    'Unable to create emergency: $err',
                    style: const TextStyle(fontWeight: FontWeight.w700),
                  ),
                ),
              ],
            ),
          ),
        );
      } else {
        final req = widget.emergencyController.activeRequest;
        ScaffoldMessenger.of(context).hideCurrentSnackBar();
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            backgroundColor: const Color(0xFF059669),
            duration: const Duration(seconds: 3),
            content: Text(
              '✅ Emergency registered: ${req?.requestId ?? ''}. Unit dispatched!',
              style: const TextStyle(fontWeight: FontWeight.w700),
            ),
          ),
        );
      }
    }
  }

  void _showCancelDialog() {
    showDialog(
      context: context,
      builder: (ctx) => AlertDialog(
        title: const Text('Cancel Emergency Request?'),
        content: const Text(
          'Are you sure you want to cancel this ambulance dispatch? This action will recall the assigned emergency unit.',
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(ctx),
            child: const Text('KEEP REQUEST ACTIVE'),
          ),
          FilledButton(
            onPressed: () async {
              Navigator.pop(ctx);
              await widget.emergencyController.cancelActiveRequest(reason: 'Cancelled by user');
              setState(() => _currentTelemetry = null);
            },
            style: FilledButton.styleFrom(backgroundColor: AppColors.emergencyRed),
            child: const Text('CANCEL EMERGENCY'),
          ),
        ],
      ),
    );
  }

  void _showRouteComparisonDialog(
    BuildContext context,
    MultiRouteCandidates routes,
  ) {
    showDialog(
      context: context,
      builder: (ctx) => AlertDialog(
        backgroundColor: const Color(0xFF0F172A),
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(20),
          side: const BorderSide(color: Color(0xFF334155), width: 1.5),
        ),
        title: const Row(
          children: [
            Icon(Icons.alt_route_rounded, color: Color(0xFF38BDF8), size: 24),
            SizedBox(width: 10),
            Text(
              'Route Selection',
              style: TextStyle(color: Colors.white, fontWeight: FontWeight.w800, fontSize: 18),
            ),
          ],
        ),
        content: SizedBox(
          width: 520,
          child: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              const Text(
                'The selected corridor is shown below. Alternate options are limited to Corridor 1 and Corridor 2.',
                style: TextStyle(color: Color(0xFF94A3B8), fontSize: 12),
              ),
              const SizedBox(height: 16),
              Container(
                decoration: BoxDecoration(
                  borderRadius: BorderRadius.circular(12),
                  border: Border.all(color: const Color(0xFF334155)),
                ),
                child: Column(
                  children: [
                    Container(
                      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
                      decoration: const BoxDecoration(
                        color: Color(0xFF1E293B),
                        borderRadius: BorderRadius.vertical(top: Radius.circular(11)),
                      ),
                      child: const Row(
                        children: [
                          Expanded(flex: 3, child: Text('Corridor', style: TextStyle(color: Colors.white70, fontSize: 11, fontWeight: FontWeight.w700))),
                          Expanded(flex: 2, child: Text('Distance', style: TextStyle(color: Colors.white70, fontSize: 11, fontWeight: FontWeight.w700))),
                          Expanded(flex: 2, child: Text('ETA', style: TextStyle(color: Colors.white70, fontSize: 11, fontWeight: FontWeight.w700))),
                        ],
                      ),
                    ),
                    Container(
                      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
                      color: const Color(0xFF174EA6).withValues(alpha: 0.25),
                      child: Row(
                        children: [
                          Expanded(
                            flex: 3,
                            child: Row(
                              children: [
                                const Icon(Icons.star_rounded, color: Color(0xFFFBBF24), size: 16),
                                const SizedBox(width: 4),
                                Expanded(
                                  child: Text(
                                    routes.scoreBreakdown.isNotEmpty ? routes.scoreBreakdown.first.routeLabel : 'Selected Route',
                                    style: const TextStyle(color: Colors.white, fontSize: 12, fontWeight: FontWeight.w800),
                                  ),
                                ),
                              ],
                            ),
                          ),
                          Expanded(
                            flex: 2,
                            child: Text(
                              routes.distanceKmList.isNotEmpty ? '${routes.distanceKmList.first.toStringAsFixed(1)} km' : '${routes.distanceKmList.isEmpty ? 4.2 : routes.distanceKmList.first} km',
                              style: const TextStyle(color: Colors.white, fontSize: 12),
                            ),
                          ),
                          Expanded(
                            flex: 2,
                            child: Text(
                              routes.etaMinutesList.isNotEmpty ? '${routes.etaMinutesList.first} min' : '${routes.etaMinutesList.isEmpty ? 8 : routes.etaMinutesList.first} min',
                              style: const TextStyle(color: Color(0xFF4ADE80), fontSize: 12, fontWeight: FontWeight.w700),
                            ),
                          ),
                        ],
                      ),
                    ),
                    const Divider(height: 1, color: Color(0xFF334155)),
                    Container(
                      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
                      child: Row(
                        children: [
                          Expanded(
                            flex: 3,
                            child: Text(
                              routes.alternativeLabels.isNotEmpty ? routes.alternativeLabels[0] : 'Alternate Corridor 1',
                              style: const TextStyle(color: Color(0xFFCBD5E1), fontSize: 12),
                            ),
                          ),
                          Expanded(
                            flex: 2,
                            child: Text(
                              routes.distanceKmList.length > 1 ? '${routes.distanceKmList[1].toStringAsFixed(1)} km' : '5.1 km',
                              style: const TextStyle(color: Color(0xFF94A3B8), fontSize: 12),
                            ),
                          ),
                          Expanded(
                            flex: 2,
                            child: Text(
                              routes.etaMinutesList.length > 1 ? '${routes.etaMinutesList[1]} min' : '11 min',
                              style: const TextStyle(color: Color(0xFFCBD5E1), fontSize: 12),
                            ),
                          ),
                        ],
                      ),
                    ),
                    const Divider(height: 1, color: Color(0xFF334155)),
                    Container(
                      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
                      child: Row(
                        children: [
                          Expanded(
                            flex: 3,
                            child: Text(
                              routes.alternativeLabels.length > 1 ? routes.alternativeLabels[1] : 'Alternate Corridor 2',
                              style: const TextStyle(color: Color(0xFFCBD5E1), fontSize: 12),
                            ),
                          ),
                          Expanded(
                            flex: 2,
                            child: Text(
                              routes.distanceKmList.length > 2 ? '${routes.distanceKmList[2].toStringAsFixed(1)} km' : '5.7 km',
                              style: const TextStyle(color: Color(0xFF94A3B8), fontSize: 12),
                            ),
                          ),
                          Expanded(
                            flex: 2,
                            child: Text(
                              routes.etaMinutesList.length > 2 ? '${routes.etaMinutesList[2]} min' : '13 min',
                              style: const TextStyle(color: Color(0xFFCBD5E1), fontSize: 12),
                            ),
                          ),
                        ],
                      ),
                    ),
                  ],
                ),
              ),
              const SizedBox(height: 14),
              Container(
                padding: const EdgeInsets.all(10),
                decoration: BoxDecoration(
                  color: const Color(0xFF1E293B),
                  borderRadius: BorderRadius.circular(10),
                  border: Border.all(color: const Color(0xFF38BDF8).withValues(alpha: 0.3)),
                ),
                child: Row(
                  children: [
                    const Icon(Icons.check_circle_outline, color: Color(0xFF38BDF8), size: 18),
                    const SizedBox(width: 8),
                    Expanded(
                      child: Text(
                        routes.decisionReason.isNotEmpty
                            ? routes.decisionReason
                            : 'Route selected using the lowest weighted travel cost.',
                        style: const TextStyle(color: Color(0xFFE2E8F0), fontSize: 11, fontStyle: FontStyle.italic),
                      ),
                    ),
                  ],
                ),
              ),
            ],
          ),
        ),
        actions: [
          FilledButton(
            onPressed: () => Navigator.pop(ctx),
            style: FilledButton.styleFrom(backgroundColor: const Color(0xFF38BDF8), foregroundColor: Colors.black),
            child: const Text('DISMISS', style: TextStyle(fontWeight: FontWeight.w800)),
          ),
        ],
      ),
    );
  }



  Widget _buildAuthUserPill({required bool isDesktop}) {
    final auth = widget.authController;
    final isAuth = auth?.isAuthenticated ?? false;
    final name = isAuth ? (auth?.displayName ?? 'Bystander') : 'LOGIN / REGISTER';
    final role = auth?.role ?? 'BYSTANDER';
    final isDark = Theme.of(context).brightness == Brightness.dark;

    return Tooltip(
      message: isAuth
          ? 'Logged in as $name ($role). Click for details & authentication.'
          : 'Click to open User Authentication & Management Screen (/auth)',
      child: InkWell(
        onTap: () {
          if (!isAuth) {
            Navigator.pushNamed(context, RoutePaths.auth).then((_) => setState(() {}));
          } else {
            _showUserProfileModal(context);
          }
        },
        borderRadius: BorderRadius.circular(20),
        child: Container(
          padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 7),
          decoration: BoxDecoration(
            color: isAuth
                ? (isDark ? const Color(0xFF1E293B) : const Color(0xFFF1F5F9))
                : (isDark ? AppColors.emergencyRed.withValues(alpha: 0.25) : const Color(0xFFFEE2E2)),
            borderRadius: BorderRadius.circular(20),
            border: Border.all(
              color: isAuth
                  ? (isDark ? Colors.white24 : Colors.black12)
                  : AppColors.emergencyRed,
              width: 1.2,
            ),
          ),
          child: Row(
            mainAxisSize: MainAxisSize.min,
            children: [
              Icon(
                isAuth ? Icons.account_circle_rounded : Icons.login_rounded,
                size: 16,
                color: AppColors.emergencyRed,
              ),
              const SizedBox(width: 6),
              ConstrainedBox(
                constraints: BoxConstraints(maxWidth: isDesktop ? 160 : 120),
                child: Text(
                  name,
                  style: TextStyle(
                    fontSize: 11.5,
                    fontWeight: FontWeight.w900,
                    color: isAuth ? null : AppColors.emergencyRed,
                  ),
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                ),
              ),
              if (isAuth) ...[
                const SizedBox(width: 4),
                Container(
                  padding: const EdgeInsets.symmetric(horizontal: 5, vertical: 1.5),
                  decoration: BoxDecoration(
                    color: Colors.blue.withValues(alpha: 0.15),
                    borderRadius: BorderRadius.circular(4),
                  ),
                  child: Text(
                    role,
                    style: const TextStyle(fontSize: 9, fontWeight: FontWeight.w900, color: Colors.blue),
                  ),
                ),
              ],
            ],
          ),
        ),
      ),
    );
  }

  Widget _buildHistoryButton({required bool isDesktop}) {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    return Tooltip(
      message: 'View Past Emergency Requests History (Section 13)',
      child: InkWell(
        onTap: () => _showRequestHistoryModal(),
        borderRadius: BorderRadius.circular(20),
        child: Container(
          padding: EdgeInsets.symmetric(horizontal: isDesktop ? 12 : 8, vertical: 7),
          decoration: BoxDecoration(
            color: isDark ? const Color(0xFF1E293B) : const Color(0xFFF1F5F9),
            borderRadius: BorderRadius.circular(20),
            border: Border.all(
              color: isDark ? Colors.white24 : Colors.black12,
              width: 1.1,
            ),
          ),
          child: Row(
            mainAxisSize: MainAxisSize.min,
            children: [
              const Icon(Icons.history_rounded, size: 16, color: AppColors.info),
              if (isDesktop) ...[
                const SizedBox(width: 5),
                const Text(
                  'HISTORY',
                  style: TextStyle(fontSize: 11, fontWeight: FontWeight.w800, color: AppColors.info),
                ),
              ],
            ],
          ),
        ),
      ),
    );
  }

  void _showUserProfileModal(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    final emailController = TextEditingController(text: 'bystander@uyirkappan.demo');
    final passController = TextEditingController(text: 'password123');
    bool obscurePassword = true;

    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (ctx) {
        final auth = widget.authController;
        final user = auth?.currentUser;

        return StatefulBuilder(
          builder: (context, setModalState) {
            return Material(
              color: isDark ? const Color(0xFF0F172A) : Colors.white,
              borderRadius: const BorderRadius.vertical(top: Radius.circular(28)),
              clipBehavior: Clip.antiAlias,
              child: Container(
                padding: const EdgeInsets.all(24),
                child: SingleChildScrollView(
                child: ConstrainedBox(
                  constraints: const BoxConstraints(maxWidth: 500),
                  child: Column(
                    mainAxisSize: MainAxisSize.min,
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Row(
                        mainAxisAlignment: MainAxisAlignment.spaceBetween,
                        children: [
                          Row(
                            children: [
                              Container(
                                padding: const EdgeInsets.all(10),
                                decoration: BoxDecoration(
                                  color: AppColors.emergencyRed.withValues(alpha: 0.15),
                                  shape: BoxShape.circle,
                                ),
                                child: const Icon(Icons.person_rounded, color: AppColors.emergencyRed, size: 24),
                              ),
                              const SizedBox(width: 12),
                              Column(
                                crossAxisAlignment: CrossAxisAlignment.start,
                                children: [
                                  Text(
                                    auth?.displayName ?? 'Bystander User',
                                    style: const TextStyle(fontSize: 17, fontWeight: FontWeight.w900),
                                  ),
                                  Container(
                                    padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 2),
                                    decoration: BoxDecoration(
                                      color: Colors.blue.withValues(alpha: 0.15),
                                      borderRadius: BorderRadius.circular(6),
                                    ),
                                    child: Text(
                                      'ROLE: ${auth?.role ?? "BYSTANDER"}',
                                      style: const TextStyle(fontSize: 10, fontWeight: FontWeight.w800, color: Colors.blue),
                                    ),
                                  ),
                                ],
                              ),
                            ],
                          ),
                          IconButton(
                            icon: const Icon(Icons.close_rounded),
                            onPressed: () => Navigator.pop(ctx),
                          ),
                        ],
                      ),
                      const SizedBox(height: 16),
                      const Divider(),
                      const SizedBox(height: 10),
                      // Details
                      _buildProfileInfoRow(Icons.email_outlined, 'Email', user?.email ?? 'bystander@uyirkappan.demo'),
                      const SizedBox(height: 8),
                      _buildProfileInfoRow(Icons.phone_outlined, 'Phone', user?.phone ?? '+91 98401 23456'),
                      const SizedBox(height: 8),
                      _buildProfileInfoRow(
                        Icons.key_rounded,
                        'JWT Token',
                        auth?.token != null ? 'Bearer ${auth!.token!.substring(0, 18)}... (Active)' : 'Not Set',
                      ),
                      const SizedBox(height: 18),
                      // 1-Tap Demo Credentials Login
                      SizedBox(
                        width: double.infinity,
                        child: FilledButton.icon(
                          onPressed: () async {
                            final success = await auth?.loginDemo() ?? false;
                            setModalState(() {});
                            if (ctx.mounted) {
                              ScaffoldMessenger.of(context).showSnackBar(
                                SnackBar(
                                  content: Text(success ? '✅ Verified login as bystander@uyirkappan.demo' : 'Login failed'),
                                  backgroundColor: success ? const Color(0xFF16A34A) : AppColors.emergencyRed,
                                ),
                              );
                            }
                          },
                          icon: const Icon(Icons.verified_user_rounded, size: 18),
                          label: const Text('1-TAP LOGIN AS DEMO BYSTANDER'),
                          style: FilledButton.styleFrom(
                            backgroundColor: const Color(0xFF16A34A),
                            padding: const EdgeInsets.symmetric(vertical: 14),
                            shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14)),
                          ),
                        ),
                      ),
                      const SizedBox(height: 12),
                      // Custom Credentials
                      Material(
                        color: Colors.transparent,
                        child: ExpansionTile(
                          title: const Text('Custom Login / Register (API)', style: TextStyle(fontSize: 13, fontWeight: FontWeight.bold)),
                        children: [
                          TextField(
                            controller: emailController,
                            decoration: const InputDecoration(labelText: 'Email', hintText: 'bystander@uyirkappan.demo'),
                          ),
                          const SizedBox(height: 8),
                          TextField(
                            controller: passController,
                            obscureText: obscurePassword,
                            decoration: InputDecoration(
                              labelText: 'Password',
                              hintText: 'password123',
                              suffixIcon: IconButton(
                                icon: Icon(
                                  obscurePassword ? Icons.visibility_off_outlined : Icons.visibility_outlined,
                                  size: 18,
                                ),
                                onPressed: () {
                                  setModalState(() {
                                    obscurePassword = !obscurePassword;
                                  });
                                },
                              ),
                            ),
                          ),
                          const SizedBox(height: 10),
                          Row(
                            children: [
                              Expanded(
                                child: ElevatedButton(
                                  onPressed: () async {
                                    await auth?.login(
                                      email: emailController.text.trim(),
                                      password: passController.text,
                                    );
                                    setModalState(() {});
                                  },
                                  child: const Text('POST /api/auth/login'),
                                ),
                              ),
                              const SizedBox(width: 8),
                              Expanded(
                                child: OutlinedButton(
                                  onPressed: () async {
                                    await auth?.register(
                                      name: 'Demo Bystander',
                                      phone: '+91 98401 23456',
                                      email: emailController.text.trim(),
                                      password: passController.text,
                                    );
                                    setModalState(() {});
                                  },
                                  child: const Text('POST /api/auth/register'),
                                ),
                              ),
                            ],
                          ),
                        ],
                      ),
                    ),
                    const SizedBox(height: 12),
                      SizedBox(
                        width: double.infinity,
                        child: OutlinedButton.icon(
                          onPressed: () {
                            Navigator.pop(ctx);
                            Navigator.pushNamed(context, RoutePaths.auth).then((_) => setState(() {}));
                          },
                          icon: const Icon(Icons.open_in_new_rounded, size: 16),
                          label: const Text('OPEN FULL AUTH & REGISTER SCREEN (/auth)'),
                          style: OutlinedButton.styleFrom(
                            padding: const EdgeInsets.symmetric(vertical: 12),
                            shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                          ),
                        ),
                      ),
                      const SizedBox(height: 8),
                      if (auth?.isAuthenticated == true)
                        SizedBox(
                          width: double.infinity,
                          child: OutlinedButton.icon(
                            onPressed: () async {
                              await auth?.logout();
                              setModalState(() {});
                              if (ctx.mounted) Navigator.pop(ctx);
                            },
                            icon: const Icon(Icons.logout_rounded, size: 18),
                            label: const Text('LOGOUT'),
                            style: OutlinedButton.styleFrom(
                              foregroundColor: AppColors.emergencyRed,
                              side: const BorderSide(color: AppColors.emergencyRed),
                              padding: const EdgeInsets.symmetric(vertical: 14),
                              shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14)),
                            ),
                          ),
                        ),
                    ],
                  ),
                ),
              ),
            ),
          );
        },
      );
      },
    );
  }

  Widget _buildProfileInfoRow(IconData icon, String label, String value) {
    return Row(
      children: [
        Icon(icon, size: 16, color: AppColors.textSecondaryLight),
        const SizedBox(width: 8),
        Text('$label: ', style: const TextStyle(fontSize: 12, fontWeight: FontWeight.bold)),
        Expanded(
          child: Text(
            value,
            style: const TextStyle(fontSize: 12),
            overflow: TextOverflow.ellipsis,
          ),
        ),
      ],
    );
  }

  void _showRequestHistoryModal() async {
    final requests = await widget.emergencyController.getPastRequests();
    if (!mounted) return;
    final isDark = Theme.of(context).brightness == Brightness.dark;

    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (ctx) {
        return Material(
          color: isDark ? const Color(0xFF0F172A) : Colors.white,
          borderRadius: const BorderRadius.vertical(top: Radius.circular(28)),
          clipBehavior: Clip.antiAlias,
          child: Container(
            height: MediaQuery.of(ctx).size.height * 0.75,
            padding: const EdgeInsets.all(24),
            child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  const Row(
                    children: [
                      Icon(Icons.history_rounded, color: AppColors.emergencyRed, size: 24),
                      SizedBox(width: 8),
                      Text(
                        'Past Emergency Requests',
                        style: TextStyle(fontSize: 18, fontWeight: FontWeight.w900),
                      ),
                    ],
                  ),
                  IconButton(
                    icon: const Icon(Icons.close_rounded),
                    onPressed: () => Navigator.pop(ctx),
                  ),
                ],
              ),
              const SizedBox(height: 6),
              Text(
                'Persistent log of emergency requests (Verification Section 13)',
                style: TextStyle(fontSize: 12, color: isDark ? Colors.white60 : Colors.black54),
              ),
              const SizedBox(height: 14),
              const Divider(),
              Expanded(
                child: requests.isEmpty
                    ? Center(
                        child: Column(
                          mainAxisSize: MainAxisSize.min,
                          children: [
                            Icon(Icons.assignment_outlined, size: 48, color: isDark ? Colors.white24 : Colors.black26),
                            const SizedBox(height: 12),
                            const Text('No past emergency requests recorded yet'),
                          ],
                        ),
                      )
                    : ListView.separated(
                        itemCount: requests.length,
                        separatorBuilder: (_, __) => const SizedBox(height: 10),
                        itemBuilder: (context, index) {
                          final r = requests[index];
                          return InkWell(
                            onTap: () => _showRequestDetailDialog(context, r),
                            borderRadius: BorderRadius.circular(14),
                            child: Container(
                              padding: const EdgeInsets.all(14),
                              decoration: BoxDecoration(
                                color: isDark ? const Color(0xFF1E293B) : const Color(0xFFF8FAFC),
                                borderRadius: BorderRadius.circular(14),
                                border: Border.all(color: isDark ? Colors.white12 : Colors.black12),
                              ),
                              child: Column(
                                crossAxisAlignment: CrossAxisAlignment.start,
                                children: [
                                  Row(
                                    mainAxisAlignment: MainAxisAlignment.spaceBetween,
                                    children: [
                                      Text(
                                        r.requestId,
                                        style: const TextStyle(fontWeight: FontWeight.w900, fontSize: 14),
                                      ),
                                      StatusBadge(status: r.status),
                                    ],
                                  ),
                                  const SizedBox(height: 6),
                                  Row(
                                    children: [
                                      Icon(r.emergencyType.icon, size: 15, color: AppColors.emergencyRed),
                                      const SizedBox(width: 5),
                                      Text(
                                        r.emergencyType.displayName,
                                        style: const TextStyle(fontSize: 12, fontWeight: FontWeight.w700),
                                      ),
                                      const SizedBox(width: 10),
                                      Text('• Victims: ${r.victimCount}', style: const TextStyle(fontSize: 11)),
                                    ],
                                  ),
                                  const SizedBox(height: 4),
                                  Text(
                                    'Created: ${r.createdAt.toLocal().toString().substring(0, 19)}',
                                    style: TextStyle(fontSize: 10.5, color: isDark ? Colors.white54 : Colors.black45),
                                  ),
                                ],
                              ),
                            ),
                          );
                        },
                      ),
              ),
            ],
          ),
        ),
      );
    },
    );
  }

  void _showRequestDetailDialog(BuildContext context, EmergencyRequest r) {
    final isDark = Theme.of(context).brightness == Brightness.dark;

    showDialog(
      context: context,
      builder: (ctx) => AlertDialog(
        backgroundColor: isDark ? const Color(0xFF0F172A) : Colors.white,
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(20)),
        title: Text('Emergency Details: ${r.requestId}', style: const TextStyle(fontSize: 16, fontWeight: FontWeight.bold)),
        content: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            _buildDetailItem('requestId', r.requestId),
            _buildDetailItem('emergencyType', r.emergencyType.code),
            _buildDetailItem('victimCount', '${r.victimCount}'),
            _buildDetailItem('pickupLocation', '${r.emergencyLocation.latitude.toStringAsFixed(4)}, ${r.emergencyLocation.longitude.toStringAsFixed(4)}'),
            _buildDetailItem('destinationHospitalId', r.hospitalDestination ?? 'N/A'),
            _buildDetailItem('assignedAmbulanceId', r.assignedAmbulanceId ?? 'N/A'),
            _buildDetailItem('status', '${r.status.code} ("${r.status.userMessage}")'),
            _buildDetailItem('currentETA', r.currentETA != null ? '${r.currentETA} min' : 'N/A'),
            _buildDetailItem('attempts', '${r.attempts}'),
          ],
        ),
        actions: [
          TextButton(onPressed: () => Navigator.pop(ctx), child: const Text('CLOSE')),
        ],
      ),
    );
  }

  Widget _buildDetailItem(String key, String val) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 3),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          SizedBox(width: 150, child: Text('$key:', style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 11.5))),
          Expanded(child: Text(val, style: const TextStyle(fontSize: 11.5))),
        ],
      ),
    );
  }

  void _showVoiceAssistanceModal() {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    final loc = widget.locationController.currentLocation;

    showDialog(
      context: context,
      builder: (ctx) => AlertDialog(
        backgroundColor: isDark ? const Color(0xFF0F172A) : Colors.white,
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(24)),
        title: Row(
          children: [
            Container(
              padding: const EdgeInsets.all(8),
              decoration: BoxDecoration(
                color: AppColors.emergencyRed.withValues(alpha: 0.15),
                shape: BoxShape.circle,
              ),
              child: const Icon(Icons.phone_in_talk_rounded, color: AppColors.emergencyRed, size: 22),
            ),
            const SizedBox(width: 10),
            const Expanded(
              child: Text(
                '108 Voice Emergency Helpline',
                style: TextStyle(fontSize: 16.5, fontWeight: FontWeight.w900),
              ),
            ),
          ],
        ),
        content: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            const Text(
              'Direct Toll-Free Voice Assistance & Automated Triage (Section 14)',
              style: TextStyle(fontSize: 12, fontWeight: FontWeight.w600, color: AppColors.textSecondaryLight),
            ),
            const SizedBox(height: 14),
            Container(
              padding: const EdgeInsets.all(12),
              decoration: BoxDecoration(
                color: isDark ? const Color(0xFF1E293B) : const Color(0xFFEFF6FF),
                borderRadius: BorderRadius.circular(14),
                border: Border.all(color: Colors.blue.withValues(alpha: 0.3)),
              ),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  const Row(
                    children: [
                      Icon(Icons.mic_rounded, color: Colors.blue, size: 16),
                      SizedBox(width: 6),
                      Text('Simulated Voice IVR Connected', style: TextStyle(fontWeight: FontWeight.w800, fontSize: 12, color: Colors.blue)),
                    ],
                  ),
                  const SizedBox(height: 6),
                  Text(
                    'GPS Location Confirmed: ${loc.latitude.toStringAsFixed(4)}, ${loc.longitude.toStringAsFixed(4)} (Accuracy: ${loc.accuracy?.toStringAsFixed(0) ?? "15"}m)',
                    style: const TextStyle(fontSize: 11),
                  ),
                ],
              ),
            ),
            const SizedBox(height: 14),
            const Text(
              'Tapping "Dispatch Voice Emergency" initiates immediate ambulance allocation and follows the exact backend workflow.',
              style: TextStyle(fontSize: 11.5),
            ),
          ],
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(ctx),
            child: const Text('CANCEL'),
          ),
          FilledButton.icon(
            onPressed: () async {
              Navigator.pop(ctx);
              await widget.emergencyController.submitEmergencyRequest(
                emergencyLocation: loc,
                requesterId: widget.authController?.currentUser?.id,
              );
              if (!mounted) return;
              ScaffoldMessenger.of(context).showSnackBar(
                const SnackBar(
                  content: Text('📞 108 Voice Emergency Request Dispatched! Searching for ambulance...'),
                  backgroundColor: AppColors.emergencyRed,
                ),
              );
            },
            icon: const Icon(Icons.send_rounded, size: 16),
            label: const Text('DISPATCH VOICE EMERGENCY'),
            style: FilledButton.styleFrom(
              backgroundColor: AppColors.emergencyRed,
              shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
            ),
          ),
        ],
      ),
    );
  }

  void _toggleThemeMode() {
    final current = appThemeModeNotifier.value;
    final next = current == ThemeMode.dark ? ThemeMode.light : ThemeMode.dark;
    appThemeModeNotifier.value = next;
    setState(() {
      _selectedMapStyle = next == ThemeMode.dark ? OpenFreeMapStyle.dark : OpenFreeMapStyle.bright;
    });
    ScaffoldMessenger.of(context).hideCurrentSnackBar();
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(
        duration: const Duration(seconds: 2),
        content: Text(
          next == ThemeMode.dark ? '🌙 Night mode enabled (Dark map & UI)' : '☀️ Day mode enabled (Bright map & UI)',
          style: const TextStyle(fontWeight: FontWeight.w700),
        ),
      ),
    );
  }

  Widget _buildThemeToggleButton({required bool isDesktop}) {
    return ValueListenableBuilder<ThemeMode>(
      valueListenable: appThemeModeNotifier,
      builder: (context, mode, _) {
        final isDark = mode == ThemeMode.dark;
        return Tooltip(
          message: isDark ? 'Switch to Day Mode (Light)' : 'Switch to Night Mode (Dark)',
          child: InkWell(
            onTap: _toggleThemeMode,
            borderRadius: BorderRadius.circular(20),
            child: Container(
              padding: EdgeInsets.symmetric(horizontal: isDesktop ? 12 : 10, vertical: isDesktop ? 8 : 6),
              decoration: BoxDecoration(
                color: isDark ? const Color(0xFF334155) : const Color(0xFFF1F5F9),
                borderRadius: BorderRadius.circular(20),
                border: Border.all(
                  color: isDark ? const Color(0xFF64748B) : const Color(0xFFCBD5E1),
                  width: 1.2,
                ),
              ),
              child: Row(
                mainAxisSize: MainAxisSize.min,
                children: [
                  Icon(
                    isDark ? Icons.nights_stay_rounded : Icons.wb_sunny_rounded,
                    size: isDesktop ? 18 : 16,
                    color: isDark ? Colors.amberAccent : Colors.orangeAccent.shade700,
                  ),
                  if (isDesktop) ...[
                    const SizedBox(width: 6),
                    Text(
                      isDark ? 'Night' : 'Day',
                      style: TextStyle(
                        fontSize: 12.5,
                        fontWeight: FontWeight.w800,
                        color: isDark ? Colors.white : Colors.black87,
                      ),
                    ),
                  ],
                ],
              ),
            ),
          ),
        );
      },
    );
  }

  /// Computes simulated street navigation waypoints and candidate alternative routes
  /// for realistic Google Maps route rendering (Module 5 & Module 6).
  MultiRouteCandidates? _calculateActiveMultiRoute({
    required EmergencyRequest? activeRequest,
    required bool isAmbulanceAssigned,
    required bool isNoAmbulanceAvailable,
    required LocationData? incidentLocation,
    required LocationData? ambulanceLocation,
    required NearbyHospital? assignedHospital,
  }) {
    if (incidentLocation == null || assignedHospital == null) return null;

    final hospLoc = LocationData(
      latitude: assignedHospital.latitude,
      longitude: assignedHospital.longitude,
      timestamp: DateTime.now(),
    );

    if (isNoAmbulanceAvailable) {
      // Scenario 4: Fast corridor to nearest trauma hospital for emergency self-transport
      return MapRouteGeometry.buildMultiRouteCandidates(
        from: incidentLocation,
        to: hospLoc,
      );
    }

    if (!isAmbulanceAssigned || activeRequest == null) {
      return null;
    }

    // Direct binding to Authoritative Dynamic Route from backend
    if (activeRequest.backendRoute != null && activeRequest.backendRoute!.length > 1) {
      final List<List<LocationData>> alts = activeRequest.backendAlternativeRoutes ?? const [];
      final List<String> labels = [];
      if (alts.isNotEmpty) {
        labels.add('Alternative Route (Graph Corridor)');
      }
      return MultiRouteCandidates(
        primaryRoute: activeRequest.backendRoute!,
        alternativeRoutes: alts,
        alternativeLabels: labels,
      );
    }

    if (ambulanceLocation == null) {
      return null;
    }

    final status = activeRequest.status;

    if (status == RequestStatus.patientOnboard ||
        status == RequestStatus.enRouteToHospital ||
        status == RequestStatus.arrivedAtHospital) {
      // Hospital leg: Ambulance actively navigating to emergency hospital
      return MapRouteGeometry.buildMultiRouteCandidates(
        from: ambulanceLocation,
        to: hospLoc,
      );
    }

    // Pickup & Drop: Multi-route candidates to incident (pickup), then to hospital (drop)
    final pickupLeg = MapRouteGeometry.buildMultiRouteCandidates(
      from: ambulanceLocation,
      to: incidentLocation,
    );
    final dropLeg = MapRouteGeometry.buildMultiRouteCandidates(
      from: incidentLocation,
      to: hospLoc,
    );

    return MapRouteGeometry.combineLegs(
      leg1: pickupLeg,
      leg2: dropLeg,
    );
  }

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final isDark = theme.brightness == Brightness.dark;
    final isDesktop = MediaQuery.of(context).size.width >= 1000;
    final EmergencyRequest? activeRequest = widget.emergencyController.activeRequest;
    final bool isNoAmbulanceAvailable = activeRequest != null && activeRequest.status == RequestStatus.noAmbulanceAvailable;
    final bool hasActiveRequest = (activeRequest != null && activeRequest.status.isActive) || isNoAmbulanceAvailable;
    final bool isAmbulanceAssigned = activeRequest != null &&
        activeRequest.status.isActive &&
        activeRequest.assignedAmbulanceId != null &&
        activeRequest.status != RequestStatus.searching &&
        activeRequest.status != RequestStatus.created;

    // Determine target location for pinpoint / tracking
    final LocationData? incidentLocation = activeRequest?.emergencyLocation ?? widget.locationController.emergencyLocation;
    final LocationData? ambulanceLocation = (hasActiveRequest && !isNoAmbulanceAvailable && _currentTelemetry != null)
        ? LocationData(
            latitude: _currentTelemetry!.latitude,
            longitude: _currentTelemetry!.longitude,
            timestamp: _currentTelemetry!.timestamp,
          )
        : null;

    final String ambulanceId = _currentTelemetry?.ambulanceId ?? activeRequest?.assignedAmbulanceId ?? 'Ambulance';

    // Emergency Network POIs: Hospitals & Standby Ambulances around current location
    final double centerLat = incidentLocation?.latitude ?? MapConstants.defaultLatitude;
    final double centerLng = incidentLocation?.longitude ?? MapConstants.defaultLongitude;
    final hospitals = NearbyEmergencyService.getHospitalsAround(centerLat, centerLng);
    final standbyAmbulances = NearbyEmergencyService.getStandbyAmbulancesAround(centerLat, centerLng);

    // Identify assigned hospital (using dynamic backend destination or nearest hospital)
    NearbyHospital? assignedHospital;
    if (activeRequest?.hospitalDestination != null && activeRequest!.hospitalDestination!.isNotEmpty) {
      assignedHospital = NearbyEmergencyService.findHospitalByIdOrName(activeRequest.hospitalDestination);
    } else if (hasActiveRequest) {
      assignedHospital = hospitals.isNotEmpty ? hospitals.first : NearbyEmergencyService.fixedHospitals.first;
    } else {
      assignedHospital = hospitals.isNotEmpty ? hospitals.first : NearbyEmergencyService.fixedHospitals.first;
    }

    // Visibility filtering:
    // When ambulance is assigned: hide all other standby ambulances & other hospitals. Focus strictly on assigned unit and hospital.
    // When no ambulance is available: show only the nearest hospital for self-transport.
    final List<NearbyAmbulance> visibleAmbulances = (isAmbulanceAssigned || isNoAmbulanceAvailable)
        ? const <NearbyAmbulance>[]
        : (_showAmbulances ? standbyAmbulances : const <NearbyAmbulance>[]);

    final List<NearbyHospital> visibleHospitals = (isAmbulanceAssigned || isNoAmbulanceAvailable)
        ? [assignedHospital]
        : (_showHospitals ? hospitals : const <NearbyHospital>[]);

    // Google Maps multi-route navigation polyline waypoints & candidate corridors
    final MultiRouteCandidates? activeMultiRoute = _calculateActiveMultiRoute(
      activeRequest: activeRequest,
      isAmbulanceAssigned: isAmbulanceAssigned,
      isNoAmbulanceAvailable: isNoAmbulanceAvailable,
      incidentLocation: incidentLocation,
      ambulanceLocation: ambulanceLocation,
      assignedHospital: assignedHospital,
    );

    return Scaffold(
      body: Stack(
        children: [
          // 1. FULL-SCREEN BACKGROUND: OpenFreeMap MapLibre GL JS Vector Map
          Positioned.fill(
            child: OpenFreeMapView(
              incidentLocation: incidentLocation ??
                  LocationData(
                    latitude: MapConstants.defaultLatitude,
                    longitude: MapConstants.defaultLongitude,
                    timestamp: DateTime.now(),
                  ),
              ambulanceLocation: ambulanceLocation,
              heading: _currentTelemetry?.headingDegrees,
              ambulanceId: ambulanceId,
              routeWaypoints: activeMultiRoute?.primaryRoute,
              alternativeRoutes: activeMultiRoute?.alternativeRoutes,
              alternativeLabels: activeMultiRoute?.alternativeLabels,
              style: _selectedMapStyle,
              isPickerMode: !_isPinLocked && !hasActiveRequest,
              showSearchRadar: activeRequest != null && activeRequest.status == RequestStatus.searching,
              recenterTrigger: _recenterCounter,
              nearbyHospitals: visibleHospitals,
              nearbyAmbulances: visibleAmbulances,
              onLocationPicked: (newLoc) {
                if (!_isPinLocked && !hasActiveRequest) {
                  widget.locationController.setManualEmergencyLocation(
                    latitude: newLoc.latitude,
                    longitude: newLoc.longitude,
                    address: 'Pickup Pin (${newLoc.latitude.toStringAsFixed(4)}° N, ${newLoc.longitude.toStringAsFixed(4)}° E)',
                  );
                  widget.emergencyController.refreshRecommendedHospital(newLoc);
                }
              },
            ),
          ),

          // 2. TOP FLOATING APP BAR (Widescreen Single-Row Navbar on Desktop)
          Positioned(
            top: 0,
            left: 0,
            right: 0,
            child: SafeArea(
              child: Center(
                child: ConstrainedBox(
                  constraints: BoxConstraints(maxWidth: isDesktop ? 1440 : 540),
                  child: Padding(
                    padding: EdgeInsets.symmetric(horizontal: isDesktop ? 20 : 14, vertical: isDesktop ? 10 : 8),
                    child: isDesktop
                        ? _buildDesktopTopNavBar(
                            context: context,
                            isDark: isDark,
                            hospitals: hospitals,
                            standbyAmbulances: standbyAmbulances,
                            isAmbulanceAssigned: isAmbulanceAssigned,
                            assignedAmbulanceId: ambulanceId,
                            assignedHospital: assignedHospital,
                          )
                        : _buildMobileTopBar(
                            context: context,
                            isDark: isDark,
                            hospitals: hospitals,
                            standbyAmbulances: standbyAmbulances,
                            isAmbulanceAssigned: isAmbulanceAssigned,
                            assignedAmbulanceId: ambulanceId,
                            assignedHospital: assignedHospital,
                          ),
                  ),
                ),
              ),
            ),
          ),

          // 2.5 TOP FLOATING IN-APP ALERT BANNER (Non-intrusive, zero overlap with bottom dock)
          if (_activeTopBannerMessage != null)
            Positioned(
              top: isDesktop ? 80 : 70,
              left: 0,
              right: 0,
              child: Center(
                child: ConstrainedBox(
                  constraints: const BoxConstraints(maxWidth: 580),
                  child: Padding(
                    padding: const EdgeInsets.symmetric(horizontal: 16),
                    child: Material(
                      elevation: 10,
                      borderRadius: BorderRadius.circular(16),
                      color: const Color(0xFF0F172A),
                      child: Container(
                        padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
                        decoration: BoxDecoration(
                          borderRadius: BorderRadius.circular(16),
                          border: Border.all(
                            color: _activeTopBannerMessage!.contains('cancelled') ||
                                    _activeTopBannerMessage!.contains('error')
                                ? AppColors.emergencyRed
                                : (_activeTopBannerMessage!.contains('Finding another')
                                    ? const Color(0xFFD97706)
                                    : const Color(0xFF38BDF8)),
                            width: 1.5,
                          ),
                        ),
                        child: Row(
                          children: [
                            Icon(
                              _activeTopBannerMessage!.contains('cancelled')
                                  ? Icons.cancel_outlined
                                  : (_activeTopBannerMessage!.contains('Finding another')
                                      ? Icons.sync_problem_rounded
                                      : Icons.notifications_active_rounded),
                              color: _activeTopBannerMessage!.contains('cancelled')
                                  ? AppColors.emergencyRed
                                  : (_activeTopBannerMessage!.contains('Finding another')
                                      ? const Color(0xFFD97706)
                                      : const Color(0xFF38BDF8)),
                              size: 20,
                            ),
                            const SizedBox(width: 10),
                            Expanded(
                              child: Text(
                                _activeTopBannerMessage!,
                                style: const TextStyle(
                                  color: Colors.white,
                                  fontWeight: FontWeight.w800,
                                  fontSize: 13,
                                ),
                              ),
                            ),
                            const SizedBox(width: 8),
                            InkWell(
                              onTap: () {
                                setState(() => _activeTopBannerMessage = null);
                              },
                              borderRadius: BorderRadius.circular(12),
                              child: const Padding(
                                padding: EdgeInsets.all(4),
                                child: Icon(Icons.close_rounded, color: Colors.white70, size: 18),
                              ),
                            ),
                          ],
                        ),
                      ),
                    ),
                  ),
                ),
              ),
            ),

          // 2.7 FLOATING ROUTE DECISION INTELLIGENCE PILL (Master Prompt Requirement D & E)
          if (hasActiveRequest && isAmbulanceAssigned && activeMultiRoute != null)
            Positioned(
              top: isDesktop ? 80 : 70,
              left: isDesktop ? 24 : 14,
              child: InkWell(
                onTap: () => _showRouteComparisonDialog(
                  context,
                  activeMultiRoute,
                ),
                borderRadius: BorderRadius.circular(20),
                child: Container(
                  padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 7),
                  decoration: BoxDecoration(
                    color: const Color(0xFF0F172A).withValues(alpha: 0.95),
                    borderRadius: BorderRadius.circular(20),
                    border: Border.all(color: const Color(0xFF38BDF8), width: 1.2),
                    boxShadow: const [
                      BoxShadow(color: Colors.black45, blurRadius: 8, offset: Offset(0, 3)),
                    ],
                  ),
                  child: Row(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      const Icon(Icons.alt_route_rounded, color: Color(0xFF38BDF8), size: 16),
                      const SizedBox(width: 6),
                      Text(
                        'Best Route Selected (${activeMultiRoute.primaryRoute.length > 2 ? "Fastest" : "Direct"}) • 2 Alternatives',
                        style: const TextStyle(
                          color: Colors.white,
                          fontSize: 11,
                          fontWeight: FontWeight.w800,
                        ),
                      ),
                      const SizedBox(width: 6),
                      const Icon(Icons.info_outline_rounded, color: Color(0xFF38BDF8), size: 14),
                    ],
                  ),
                ),
              ),
            ),

          // 3. RIGHT FLOATING ACTIONS (GPS Re-center & Emergency Call)
          Positioned(
            right: isDesktop ? 24 : 14,
            bottom: isDesktop ? 135 : (hasActiveRequest ? 215 : 295),
            child: Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                SizedBox(
                  width: isDesktop ? 54 : 46,
                  height: isDesktop ? 54 : 46,
                  child: FloatingActionButton(
                    heroTag: 'home_recenter_gps',
                    onPressed: () async {
                      OpenFreeMapView.suppressClicks();
                      await widget.locationController.snapToCurrentGps();
                      setState(() {
                        _isPinLocked = false;
                        _recenterCounter++;
                      });
                      if (context.mounted) {
                        ScaffoldMessenger.of(context).showSnackBar(
                          const SnackBar(content: Text('📍 Centered on your current GPS position')),
                        );
                      }
                    },
                    backgroundColor: Colors.white,
                    foregroundColor: AppColors.emergencyDarkRed,
                    elevation: 5,
                    tooltip: 'Snap to GPS Position',
                    child: Icon(Icons.my_location_rounded, size: isDesktop ? 26 : 22),
                  ),
                ),
                SizedBox(height: isDesktop ? 12 : 10),
                SizedBox(
                  width: isDesktop ? 54 : 46,
                  height: isDesktop ? 54 : 46,
                  child: FloatingActionButton(
                    heroTag: 'home_dial_108',
                    onPressed: () {
                      ScaffoldMessenger.of(context).showSnackBar(
                        const SnackBar(content: Text('Calling Direct Helpline: 108...')),
                      );
                    },
                    backgroundColor: AppColors.emergencyRed,
                    foregroundColor: Colors.white,
                    elevation: 5,
                    tooltip: 'Call 108 Helpline',
                    child: Icon(Icons.phone_in_talk_rounded, size: isDesktop ? 26 : 20),
                  ),
                ),
              ],
            ),
          ),

          // 4. BOTTOM FLOATING EMERGENCY PANEL / LIVE TRACKING SHEET
          // Desktop uses a full-width command cockpit dock; Mobile uses a clean stacked sheet
          Positioned(
            left: 0,
            right: 0,
            bottom: isDesktop ? 16 : 14,
            child: SafeArea(
              top: false,
              child: Center(
                child: ConstrainedBox(
                  constraints: BoxConstraints(maxWidth: isDesktop ? 1440 : 540),
                  child: Padding(
                    padding: EdgeInsets.symmetric(horizontal: isDesktop ? 20 : 14),
                    child: AnimatedSwitcher(
                      duration: const Duration(milliseconds: 300),
                      child: isNoAmbulanceAvailable
                          ? (isDesktop
                              ? _buildDesktopNoAmbulanceDock(context, activeRequest, assignedHospital, theme, isDark)
                              : _buildNoAmbulanceSheet(context, activeRequest, assignedHospital, theme, isDark))
                          : (hasActiveRequest
                              ? (isDesktop
                                  ? _buildDesktopActiveTrackingDock(context, activeRequest, assignedHospital, theme, isDark)
                                  : _buildActiveTrackingSheet(context, activeRequest, assignedHospital, theme, isDark, false))
                              : (isDesktop
                                  ? _buildDesktopIdleEmergencyDock(context, theme, isDark)
                                  : _buildIdleEmergencySheet(context, theme, isDark, false))),
                    ),
                  ),
                ),
              ),
            ),
          ),
        ],
      ),
    );
  }

  /// Desktop Top Navigation Bar (Single Row, Widescreen)
  Widget _buildDesktopTopNavBar({
    required BuildContext context,
    required bool isDark,
    required List<NearbyHospital> hospitals,
    required List<NearbyAmbulance> standbyAmbulances,
    bool isAmbulanceAssigned = false,
    String? assignedAmbulanceId,
    NearbyHospital? assignedHospital,
  }) {
    return Container(
      height: 58,
      padding: const EdgeInsets.symmetric(horizontal: 16),
      decoration: BoxDecoration(
        color: isDark ? const Color(0xFF0F172A).withValues(alpha: 0.96) : Colors.white.withValues(alpha: 0.96),
        borderRadius: BorderRadius.circular(24),
        border: Border.all(
          color: isDark ? Colors.white.withValues(alpha: 0.12) : Colors.black.withValues(alpha: 0.08),
        ),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withValues(alpha: 0.14),
            blurRadius: 18,
            offset: const Offset(0, 4),
          ),
        ],
      ),
      child: Row(
        children: [
          // Branding Icon & Title
          Container(
            padding: const EdgeInsets.all(7),
            decoration: BoxDecoration(
              color: AppColors.emergencyRed,
              borderRadius: BorderRadius.circular(10),
            ),
            child: const Icon(
              Icons.health_and_safety_rounded,
              color: Colors.white,
              size: 20,
            ),
          ),
          const SizedBox(width: 10),
          Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              const Text(
                AppConstants.appName,
                style: TextStyle(
                  fontSize: 17,
                  fontWeight: FontWeight.w900,
                  letterSpacing: -0.5,
                  color: AppColors.emergencyRed,
                ),
              ),
              Text(
                'Emergency Response System',
                style: TextStyle(
                  fontSize: 10.5,
                  fontWeight: FontWeight.w600,
                  color: isDark ? Colors.white60 : AppColors.textSecondaryLight,
                ),
              ),
            ],
          ),

          const SizedBox(width: 16),
          Container(width: 1, height: 28, color: isDark ? Colors.white12 : Colors.black12),
          const SizedBox(width: 12),

          // Middle Scrollable Section (Style Selector + POI chips)
          Expanded(
            child: SingleChildScrollView(
              scrollDirection: Axis.horizontal,
              physics: const BouncingScrollPhysics(),
              child: Row(
                mainAxisSize: MainAxisSize.min,
                children: [
                  MapStyleSelector(
                    currentStyle: _selectedMapStyle,
                    isEmbedded: true,
                    onStyleSelected: (style) {
                      setState(() => _selectedMapStyle = style);
                    },
                  ),
                  const SizedBox(width: 10),
                  if (isAmbulanceAssigned) ...[
                    Container(
                      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 7),
                      decoration: BoxDecoration(
                        color: const Color(0xFF16A34A).withValues(alpha: 0.15),
                        borderRadius: BorderRadius.circular(20),
                        border: Border.all(color: const Color(0xFF16A34A), width: 1.2),
                      ),
                      child: Row(
                        mainAxisSize: MainAxisSize.min,
                        children: [
                          const Text('🚑', style: TextStyle(fontSize: 13)),
                          const SizedBox(width: 6),
                          Text(
                            'Unit in Focus: ${assignedAmbulanceId ?? "Assigned"}',
                            style: const TextStyle(fontSize: 12, fontWeight: FontWeight.w900, color: Color(0xFF16A34A)),
                          ),
                        ],
                      ),
                    ),
                    const SizedBox(width: 8),
                    Container(
                      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 7),
                      decoration: BoxDecoration(
                        color: const Color(0xFF0284C7).withValues(alpha: 0.15),
                        borderRadius: BorderRadius.circular(20),
                        border: Border.all(color: const Color(0xFF0284C7), width: 1.2),
                      ),
                      child: Row(
                        mainAxisSize: MainAxisSize.min,
                        children: [
                          const Text('🏥', style: TextStyle(fontSize: 13)),
                          const SizedBox(width: 6),
                          ConstrainedBox(
                            constraints: const BoxConstraints(maxWidth: 180),
                            child: Text(
                              assignedHospital?.name ?? 'Assigned Hospital',
                              style: const TextStyle(fontSize: 12, fontWeight: FontWeight.w900, color: Color(0xFF0284C7)),
                              maxLines: 1,
                              overflow: TextOverflow.ellipsis,
                            ),
                          ),
                        ],
                      ),
                    ),
                  ] else ...[
                    _buildPoiFilterChip(
                      label: '🏥 Hospitals (${hospitals.length})',
                      isSelected: _showHospitals,
                      color: const Color(0xFF0284C7),
                      isDesktop: true,
                      onTap: () => setState(() => _showHospitals = !_showHospitals),
                    ),
                    const SizedBox(width: 8),
                    _buildPoiFilterChip(
                      label: '🚑 Ambulances (${standbyAmbulances.length})',
                      isSelected: _showAmbulances,
                      color: const Color(0xFF16A34A),
                      isDesktop: true,
                      onTap: () => setState(() => _showAmbulances = !_showAmbulances),
                    ),
                  ],
                ],
              ),
            ),
          ),

          const SizedBox(width: 8),

          // History Log (Section 13)
          _buildHistoryButton(isDesktop: true),

          const SizedBox(width: 8),

          // Authenticated Bystander Profile (Section 1)
          _buildAuthUserPill(isDesktop: true),

          const SizedBox(width: 8),

          // Night / Dark Mode Toggle
          _buildThemeToggleButton(isDesktop: true),
        ],
      ),
    );
  }

  /// Mobile Options & Controls Drawer Sheet
  void _showMobileMenuSheet(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (context) {
        return Material(
          color: isDark ? const Color(0xFF1E293B) : Colors.white,
          borderRadius: const BorderRadius.vertical(top: Radius.circular(24)),
          clipBehavior: Clip.antiAlias,
          child: SafeArea(
            top: false,
            child: Padding(
              padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 16),
              child: Column(
                mainAxisSize: MainAxisSize.min,
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Center(
                    child: Container(
                      width: 40,
                      height: 4,
                      decoration: BoxDecoration(
                        color: isDark ? Colors.white24 : Colors.black12,
                        borderRadius: BorderRadius.circular(2),
                      ),
                    ),
                  ),
                  const SizedBox(height: 16),
                  Row(
                    mainAxisAlignment: MainAxisAlignment.spaceBetween,
                    children: [
                      const Text(
                        'UyirKappan Controls',
                        style: TextStyle(fontSize: 18, fontWeight: FontWeight.w900),
                      ),
                      _buildThemeToggleButton(isDesktop: false),
                    ],
                  ),
                  const SizedBox(height: 12),
                  // Option 1: Bystander Profile & Auth
                  ListTile(
                    leading: Container(
                      padding: const EdgeInsets.all(8),
                      decoration: BoxDecoration(
                        color: const Color(0xFF0284C7).withValues(alpha: 0.15),
                        borderRadius: BorderRadius.circular(10),
                      ),
                      child: const Icon(Icons.account_circle_rounded, color: Color(0xFF0284C7), size: 20),
                    ),
                    title: const Text('Bystander User Profile', style: TextStyle(fontWeight: FontWeight.w800, fontSize: 14)),
                    subtitle: const Text('Manage credentials, login, and view JWT Bearer token', style: TextStyle(fontSize: 11)),
                    trailing: const Icon(Icons.chevron_right_rounded),
                    onTap: () {
                      Navigator.pop(context);
                      _showUserProfileModal(context);
                    },
                  ),
                  // Option 3: Request History
                  ListTile(
                    leading: Container(
                      padding: const EdgeInsets.all(8),
                      decoration: BoxDecoration(
                        color: const Color(0xFF16A34A).withValues(alpha: 0.15),
                        borderRadius: BorderRadius.circular(10),
                      ),
                      child: const Icon(Icons.history_rounded, color: Color(0xFF16A34A), size: 20),
                    ),
                    title: const Text('Emergency Request History', style: TextStyle(fontWeight: FontWeight.w800, fontSize: 14)),
                    subtitle: const Text('Inspect previously dispatched and completed emergency requests', style: TextStyle(fontSize: 11)),
                    trailing: const Icon(Icons.chevron_right_rounded),
                    onTap: () {
                      Navigator.pop(context);
                      _showRequestHistoryModal();
                    },
                  ),
                  const Divider(height: 20),
                  // Map Vector Style Selector
                  const Text('Map Vector Style', style: TextStyle(fontWeight: FontWeight.w800, fontSize: 13)),
                  const SizedBox(height: 8),
                  MapStyleSelector(
                    currentStyle: _selectedMapStyle,
                    onStyleSelected: (style) {
                      setState(() => _selectedMapStyle = style);
                      Navigator.pop(context);
                    },
                  ),
                  const SizedBox(height: 12),
                  // POI Network Filters
                  Row(
                    children: [
                      Expanded(
                        child: _buildPoiFilterChip(
                          label: '🏥 Hospitals (${NearbyEmergencyService.fixedHospitals.length})',
                          isSelected: _showHospitals,
                          color: const Color(0xFF0284C7),
                          isDesktop: false,
                          onTap: () => setState(() => _showHospitals = !_showHospitals),
                        ),
                      ),
                      const SizedBox(width: 8),
                      Expanded(
                        child: _buildPoiFilterChip(
                          label: '🚑 Standby (${NearbyEmergencyService.fixedAmbulances.length})',
                          isSelected: _showAmbulances,
                          color: const Color(0xFF16A34A),
                          isDesktop: false,
                          onTap: () => setState(() => _showAmbulances = !_showAmbulances),
                        ),
                      ),
                    ],
                  ),
                  const SizedBox(height: 10),
                ],
              ),
            ),
          ),
        );
      },
    );
  }

  /// Mobile Top Bar (Single-Row Floating Navigation Capsule)
  Widget _buildMobileTopBar({
    required BuildContext context,
    required bool isDark,
    required List<NearbyHospital> hospitals,
    required List<NearbyAmbulance> standbyAmbulances,
    bool isAmbulanceAssigned = false,
    String? assignedAmbulanceId,
    NearbyHospital? assignedHospital,
  }) {
    return Container(
      height: 52,
      padding: const EdgeInsets.symmetric(horizontal: 12),
      decoration: BoxDecoration(
        color: isDark ? const Color(0xFF0F172A).withValues(alpha: 0.95) : Colors.white.withValues(alpha: 0.95),
        borderRadius: BorderRadius.circular(20),
        border: Border.all(
          color: isDark ? Colors.white.withValues(alpha: 0.12) : Colors.black.withValues(alpha: 0.08),
        ),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withValues(alpha: 0.14),
            blurRadius: 16,
            offset: const Offset(0, 4),
          ),
        ],
      ),
      child: Row(
        children: [
          // Branding Icon
          Container(
            padding: const EdgeInsets.all(6),
            decoration: BoxDecoration(
              color: AppColors.emergencyRed,
              borderRadius: BorderRadius.circular(10),
            ),
            child: const Icon(
              Icons.health_and_safety_rounded,
              color: Colors.white,
              size: 18,
            ),
          ),
          const SizedBox(width: 7),
          const Flexible(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              mainAxisAlignment: MainAxisAlignment.center,
              mainAxisSize: MainAxisSize.min,
              children: [
                Text(
                  AppConstants.appName,
                  style: TextStyle(
                    fontSize: 14.5,
                    fontWeight: FontWeight.w900,
                    letterSpacing: -0.4,
                    color: AppColors.emergencyRed,
                  ),
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                ),
                Text(
                  '108 Emergency',
                  style: TextStyle(
                    fontSize: 9,
                    fontWeight: FontWeight.w700,
                    color: AppColors.textSecondaryLight,
                  ),
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                ),
              ],
            ),
          ),
          const SizedBox(width: 6),

          // Mobile Menu Button (Profile, History, Layers)
          IconButton(
            onPressed: () => _showMobileMenuSheet(context),
            icon: const Icon(Icons.more_vert_rounded, size: 19),
            padding: EdgeInsets.zero,
            constraints: const BoxConstraints(minWidth: 28, minHeight: 28),
            splashRadius: 18,
            tooltip: 'Settings & Layers',
          ),
        ],
      ),
    );
  }

  /// Desktop Widescreen Command Cockpit Dock for Idle State
  Widget _buildDesktopIdleEmergencyDock(
    BuildContext context,
    ThemeData theme,
    bool isDark,
  ) {
    final loc = widget.locationController.emergencyLocation;
    final selectedType = widget.emergencyController.selectedType;

    return Container(
      key: const ValueKey('desktop_idle_emergency_dock'),
      padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 14),
      decoration: BoxDecoration(
        color: isDark ? const Color(0xFF1E293B) : Colors.white,
        borderRadius: BorderRadius.circular(24),
        border: Border.all(
          color: isDark ? Colors.white.withValues(alpha: 0.1) : Colors.black.withValues(alpha: 0.08),
          width: 1,
        ),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withValues(alpha: 0.22),
            blurRadius: 28,
            offset: const Offset(0, 8),
          ),
        ],
      ),
      child: LayoutBuilder(
        builder: (context, constraints) {
          final isNarrow = constraints.maxWidth < 950;
          if (isNarrow) {
            return Column(
              mainAxisSize: MainAxisSize.min,
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                Row(
                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                  children: [
                    const Expanded(
                      child: Text(
                        'Emergency Medical Assistance',
                        style: TextStyle(fontSize: 14.5, fontWeight: FontWeight.w900),
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                      ),
                    ),
                    const SizedBox(width: 8),
                    InkWell(
                      onTap: _showVoiceAssistanceModal,
                      borderRadius: BorderRadius.circular(10),
                      child: Container(
                        padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                        decoration: BoxDecoration(
                          color: AppColors.emergencyLightRed,
                          borderRadius: BorderRadius.circular(10),
                          border: Border.all(color: AppColors.emergencyRed.withValues(alpha: 0.3)),
                        ),
                        child: const Row(
                          mainAxisSize: MainAxisSize.min,
                          children: [
                            Icon(Icons.phone_rounded, size: 12, color: AppColors.emergencyDarkRed),
                            SizedBox(width: 4),
                            Text('108 Helpline', style: TextStyle(fontSize: 11, fontWeight: FontWeight.w800, color: AppColors.emergencyDarkRed)),
                          ],
                        ),
                      ),
                    ),
                  ],
                ),
                const SizedBox(height: 8),
                Row(
                  children: [
                    Expanded(
                      flex: 3,
                      child: Container(
                        padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 7),
                        decoration: BoxDecoration(
                          color: isDark ? const Color(0xFF0F172A) : const Color(0xFFEFF6FF),
                          borderRadius: BorderRadius.circular(12),
                          border: Border.all(color: const Color(0xFF3B82F6).withValues(alpha: 0.4)),
                        ),
                        child: Row(
                          children: [
                            const Icon(Icons.location_on_rounded, color: AppColors.emergencyRed, size: 18),
                            const SizedBox(width: 6),
                            Expanded(
                              child: Text(
                                loc?.address ?? '${loc?.latitude.toStringAsFixed(4) ?? "13.0827"}° N, ${loc?.longitude.toStringAsFixed(4) ?? "80.2707"}° E',
                                style: const TextStyle(fontSize: 12, fontWeight: FontWeight.w700),
                                maxLines: 1,
                                overflow: TextOverflow.ellipsis,
                              ),
                            ),
                          ],
                        ),
                      ),
                    ),
                    const SizedBox(width: 8),
                    Expanded(
                      flex: 2,
                      child: SizedBox(
                        height: 38,
                        child: EmergencyButton(
                          label: 'DISPATCH',
                          subLabel: '108 SOS',
                          isLoading: widget.emergencyController.submissionState == SubmissionState.submitting || _isDispatching,
                          onPressed: _dispatchAmbulance,
                          isCompact: true,
                        ),
                      ),
                    ),
                  ],
                ),
              ],
            );
          }

          return Row(
            crossAxisAlignment: CrossAxisAlignment.center,
            children: [
              // Section 1: Location & Direct Helpline (Width: 380)
              SizedBox(
                width: 380,
            child: Column(
              mainAxisSize: MainAxisSize.min,
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(
                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                  children: [
                    const Expanded(
                      child: Text(
                        'Emergency Medical Assistance',
                        style: TextStyle(
                          fontSize: 15.5,
                          fontWeight: FontWeight.w900,
                          letterSpacing: -0.3,
                        ),
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                      ),
                    ),
                    const SizedBox(width: 8),
                    InkWell(
                      onTap: () {
                        _showVoiceAssistanceModal();
                      },
                      borderRadius: BorderRadius.circular(12),
                      child: Container(
                        padding: const EdgeInsets.symmetric(horizontal: 9, vertical: 5),
                        decoration: BoxDecoration(
                          color: AppColors.emergencyLightRed,
                          borderRadius: BorderRadius.circular(12),
                          border: Border.all(color: AppColors.emergencyRed.withValues(alpha: 0.3)),
                        ),
                        child: const Row(
                          mainAxisSize: MainAxisSize.min,
                          children: [
                            Icon(Icons.phone_rounded, size: 13, color: AppColors.emergencyDarkRed),
                            SizedBox(width: 4),
                            Text(
                              'Direct Emergency Helpline',
                              style: TextStyle(
                                fontSize: 10.5,
                                fontWeight: FontWeight.w800,
                                color: AppColors.emergencyDarkRed,
                              ),
                            ),
                          ],
                        ),
                      ),
                    ),
                  ],
                ),
                const SizedBox(height: 8),
                // Compact Location Card
                Container(
                  padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
                  decoration: BoxDecoration(
                    color: isDark ? const Color(0xFF0F172A) : const Color(0xFFEFF6FF),
                    borderRadius: BorderRadius.circular(14),
                    border: Border.all(
                      color: _isPinLocked ? (isDark ? Colors.white24 : const Color(0xFF94A3B8)) : const Color(0xFF3B82F6).withValues(alpha: 0.6),
                      width: 1.5,
                    ),
                  ),
                  child: Row(
                    children: [
                      Container(
                        padding: const EdgeInsets.all(7),
                        decoration: BoxDecoration(
                          color: (_isPinLocked ? Colors.blueGrey : AppColors.emergencyRed).withValues(alpha: 0.12),
                          shape: BoxShape.circle,
                        ),
                        child: Icon(
                          _isPinLocked
                              ? Icons.lock_rounded
                              : (loc?.isManualOverride == true ? Icons.edit_location_alt_rounded : Icons.location_on_rounded),
                          color: _isPinLocked ? (isDark ? Colors.white70 : const Color(0xFF475569)) : AppColors.emergencyRed,
                          size: 20,
                        ),
                      ),
                      const SizedBox(width: 10),
                      Expanded(
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          mainAxisSize: MainAxisSize.min,
                          children: [
                            Row(
                              children: [
                                Container(
                                  width: 7,
                                  height: 7,
                                  decoration: BoxDecoration(
                                    color: _isPinLocked
                                        ? const Color(0xFF64748B)
                                        : (loc?.isManualOverride == true ? Colors.amber : const Color(0xFF10B981)),
                                    shape: BoxShape.circle,
                                  ),
                                ),
                                const SizedBox(width: 5),
                                Text(
                                  _isPinLocked
                                      ? 'LOCATION LOCKED'
                                      : (loc?.isManualOverride == true ? 'MANUAL PINPOINT' : 'GPS POSITION (DETECTED)'),
                                  style: TextStyle(
                                    fontSize: 10,
                                    fontWeight: FontWeight.w900,
                                    letterSpacing: 0.5,
                                    color: _isPinLocked
                                        ? (isDark ? Colors.blueGrey.shade200 : const Color(0xFF475569))
                                        : (loc?.isManualOverride == true
                                            ? Colors.amber.shade700
                                            : (isDark ? Colors.blue.shade300 : const Color(0xFF1D4ED8))),
                                  ),
                                ),
                              ],
                            ),
                            const SizedBox(height: 2),
                            Text(
                              loc?.address ??
                                  (loc != null
                                      ? '${loc.latitude.toStringAsFixed(4)}° N, ${loc.longitude.toStringAsFixed(4)}° E'
                                      : '13.0827° N, 80.2707° E (Chennai Central Corridor)'),
                              style: const TextStyle(
                                fontSize: 13,
                                fontWeight: FontWeight.w800,
                              ),
                              maxLines: 1,
                              overflow: TextOverflow.ellipsis,
                            ),
                          ],
                        ),
                      ),
                      const SizedBox(width: 8),
                      FilledButton.tonal(
                        onPressed: _togglePinLock,
                        style: FilledButton.styleFrom(
                          backgroundColor: _isPinLocked
                              ? (isDark ? Colors.white.withValues(alpha: 0.12) : const Color(0xFFE2E8F0))
                              : (isDark ? Colors.white.withValues(alpha: 0.15) : const Color(0xFFDBEAFE)),
                          foregroundColor: _isPinLocked
                              ? (isDark ? Colors.white70 : const Color(0xFF334155))
                              : (isDark ? Colors.white : const Color(0xFF1E40AF)),
                          padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
                          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(8)),
                          minimumSize: const Size(82, 34),
                        ),
                        child: Row(
                          mainAxisSize: MainAxisSize.min,
                          children: [
                            Icon(_isPinLocked ? Icons.lock_open_rounded : Icons.lock_rounded, size: 14),
                            const SizedBox(width: 4),
                            Text(
                              _isPinLocked ? 'UNLOCK' : 'LOCK PIN',
                              style: const TextStyle(fontSize: 10.5, fontWeight: FontWeight.w900),
                            ),
                          ],
                        ),
                      ),
                    ],
                  ),
                ),
              ],
            ),
          ),

          // Vertical Divider
          Padding(
            padding: const EdgeInsets.symmetric(horizontal: 16),
            child: Container(
              width: 1,
              height: 75,
              color: isDark ? Colors.white12 : Colors.black12,
            ),
          ),

          // Section 2: Categories + Victims (Expanded)
          Expanded(
            child: Column(
              mainAxisSize: MainAxisSize.min,
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(
                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                  children: [
                    Flexible(
                      child: Text(
                        'Select Emergency Scenario:',
                        style: TextStyle(
                          fontSize: 12.5,
                          fontWeight: FontWeight.w700,
                          color: isDark ? Colors.white70 : AppColors.textSecondaryLight,
                        ),
                        overflow: TextOverflow.ellipsis,
                      ),
                    ),
                    const SizedBox(width: 8),
                    Row(
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        const Icon(Icons.personal_injury_rounded, size: 18, color: AppColors.emergencyRed),
                        const SizedBox(width: 4),
                        const Text(
                          'Victims:',
                          style: TextStyle(fontSize: 12.5, fontWeight: FontWeight.w800),
                        ),
                        const SizedBox(width: 6),
                        CounterStepper(
                          count: widget.emergencyController.victimCount,
                          min: AppConstants.minVictims,
                          max: AppConstants.maxVictims,
                          isCompact: true,
                          onIncrement: widget.emergencyController.incrementVictimCount,
                          onDecrement: widget.emergencyController.decrementVictimCount,
                        ),
                      ],
                    ),
                  ],
                ),
                const SizedBox(height: 8),
                SizedBox(
                  height: 44,
                  child: ListView.builder(
                    scrollDirection: Axis.horizontal,
                    itemCount: EmergencyType.values.length,
                    itemBuilder: (context, index) {
                      final type = EmergencyType.values[index];
                      final isSelected = type == selectedType;

                      return Padding(
                        padding: const EdgeInsets.only(right: 8),
                        child: InkWell(
                          onTap: () => widget.emergencyController.setEmergencyType(type),
                          borderRadius: BorderRadius.circular(18),
                          child: AnimatedContainer(
                            duration: const Duration(milliseconds: 180),
                            padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 8),
                            decoration: BoxDecoration(
                              color: isSelected
                                  ? AppColors.emergencyRed
                                  : (isDark ? const Color(0xFF0F172A) : Colors.grey.shade100),
                              borderRadius: BorderRadius.circular(18),
                              border: Border.all(
                                color: isSelected ? AppColors.emergencyRed : Colors.black.withValues(alpha: 0.12),
                                width: 1.3,
                              ),
                            ),
                            child: Row(
                              mainAxisSize: MainAxisSize.min,
                              children: [
                                Icon(
                                  type.icon,
                                  size: 18,
                                  color: isSelected ? Colors.white : AppColors.emergencyRed,
                                ),
                                const SizedBox(width: 6),
                                Text(
                                  type.displayName,
                                  style: TextStyle(
                                    fontSize: 13,
                                    fontWeight: isSelected ? FontWeight.w900 : FontWeight.w700,
                                    color: isSelected ? Colors.white : null,
                                  ),
                                ),
                              ],
                            ),
                          ),
                        ),
                      );
                    },
                  ),
                ),
              ],
            ),
          ),

          // Vertical Divider
          Padding(
            padding: const EdgeInsets.symmetric(horizontal: 16),
            child: Container(
              width: 1,
              height: 75,
              color: isDark ? Colors.white12 : Colors.black12,
            ),
          ),

          // Section 3: Request Ambulance Button (Width: 240)
          SizedBox(
            width: 240,
            child: EmergencyButton(
              label: 'REQUEST AMBULANCE',
              subLabel: 'TAP FOR IMMEDIATE LIVE DISPATCH',
              isLoading: widget.emergencyController.submissionState == SubmissionState.submitting || _isDispatching,
              onPressed: _dispatchAmbulance,
            ),
          ),
        ],
          );
        },
      ),
    );
  }

  /// Desktop Widescreen Command Cockpit Dock for Active Tracking State
  Widget _buildDesktopActiveTrackingDock(
    BuildContext context,
    EmergencyRequest request,
    NearbyHospital? assignedHospital,
    ThemeData theme,
    bool isDark,
  ) {
    final status = request.status;
    final isFallbackActive = request.fallbackCount > 0 && status == RequestStatus.searching;
    final etaMinutes = _currentTelemetry?.eta?.estimatedMinutes ?? request.currentETA ?? 5;
    final etaFormatted = 'ETA: $etaMinutes minutes';
    final ambulanceId = _currentTelemetry?.ambulanceId ?? request.assignedAmbulanceId ?? 'AMB-CH-042';

    return Container(
      key: const ValueKey('desktop_active_tracking_dock'),
      padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 12),
      decoration: BoxDecoration(
        color: isDark ? const Color(0xFF1E293B) : Colors.white,
        borderRadius: BorderRadius.circular(22),
        border: Border.all(
          color: isDark ? Colors.white.withValues(alpha: 0.12) : Colors.black.withValues(alpha: 0.08),
          width: 1.2,
        ),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withValues(alpha: 0.22),
            blurRadius: 28,
            offset: const Offset(0, 8),
          ),
        ],
      ),
      child: LayoutBuilder(
        builder: (context, constraints) {
          final isCompact = constraints.maxWidth < 980;

          if (isCompact) {
            // Adaptive 2-Row Layout for narrower screens: zero overlaps guaranteed
            return Column(
              mainAxisSize: MainAxisSize.min,
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                Row(
                  children: [
                    Container(
                      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
                      decoration: BoxDecoration(
                        color: AppColors.emergencyRed,
                        borderRadius: BorderRadius.circular(12),
                      ),
                      child: Row(
                        mainAxisSize: MainAxisSize.min,
                        children: [
                          const Icon(Icons.timer_rounded, color: Colors.white, size: 15),
                          const SizedBox(width: 5),
                          Text(
                            etaFormatted,
                            style: const TextStyle(
                              color: Colors.white,
                              fontSize: 12,
                              fontWeight: FontWeight.w900,
                              letterSpacing: 0.3,
                            ),
                          ),
                        ],
                      ),
                    ),
                    const SizedBox(width: 10),
                    Flexible(child: StatusBadge(status: status)),
                    if (isFallbackActive) ...[
                      const SizedBox(width: 8),
                      Container(
                        padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                        decoration: BoxDecoration(
                          color: AppColors.statusFallback.withValues(alpha: 0.15),
                          borderRadius: BorderRadius.circular(8),
                          border: Border.all(color: AppColors.statusFallback),
                        ),
                        child: Text(
                          'Fallback #${request.fallbackCount}',
                          style: const TextStyle(fontSize: 10.5, fontWeight: FontWeight.w800, color: AppColors.statusFallback),
                        ),
                      ),
                    ],
                    const Spacer(),
                    SizedBox(
                      height: 34,
                      child: FilledButton(
                        onPressed: request.status.canCancel ? _showCancelDialog : null,
                        style: FilledButton.styleFrom(
                          backgroundColor: request.status.canCancel
                              ? AppColors.emergencyRed.withValues(alpha: 0.15)
                              : Colors.grey.withValues(alpha: 0.1),
                          foregroundColor: request.status.canCancel ? AppColors.emergencyRed : Colors.grey,
                          elevation: 0,
                          side: BorderSide(
                            color: request.status.canCancel ? AppColors.emergencyRed : Colors.grey.withValues(alpha: 0.3),
                            width: 1.2,
                          ),
                          padding: const EdgeInsets.symmetric(horizontal: 12),
                          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
                        ),
                        child: Text(
                          request.status.canCancel ? 'CANCEL EMERGENCY' : 'EN ROUTE',
                          style: const TextStyle(fontWeight: FontWeight.w900, fontSize: 10.5),
                        ),
                      ),
                    ),
                  ],
                ),
                const SizedBox(height: 10),
                Row(
                  children: [
                    Container(
                      width: 32,
                      height: 32,
                      decoration: BoxDecoration(
                        color: AppColors.emergencyLightRed,
                        shape: BoxShape.circle,
                        border: Border.all(color: AppColors.emergencyRed.withValues(alpha: 0.3)),
                      ),
                      child: const Center(
                        child: Text('🚑', style: TextStyle(fontSize: 16)),
                      ),
                    ),
                    const SizedBox(width: 8),
                    Text(
                      ambulanceId,
                      style: const TextStyle(fontSize: 13, fontWeight: FontWeight.w900),
                    ),
                    const SizedBox(width: 6),
                    Text(
                      '• Driver: ${request.assignedDriverName ?? "Suresh Kumar"}',
                      style: const TextStyle(fontSize: 11, color: AppColors.textSecondaryLight, fontWeight: FontWeight.w600),
                    ),
                    const SizedBox(width: 12),
                    Expanded(
                      child: Container(
                        padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 5),
                        decoration: BoxDecoration(
                          color: const Color(0xFF0284C7).withValues(alpha: 0.12),
                          borderRadius: BorderRadius.circular(10),
                          border: Border.all(color: const Color(0xFF0284C7).withValues(alpha: 0.3)),
                        ),
                        child: Row(
                          mainAxisSize: MainAxisSize.min,
                          children: [
                            const Icon(Icons.local_hospital_rounded, size: 14, color: Color(0xFF0284C7)),
                            const SizedBox(width: 5),
                            Flexible(
                              child: Text(
                                assignedHospital?.name ?? request.hospitalDestination ?? 'General Hospital',
                                style: const TextStyle(fontSize: 11, fontWeight: FontWeight.w800, color: Color(0xFF0284C7)),
                                maxLines: 1,
                                overflow: TextOverflow.ellipsis,
                              ),
                            ),
                          ],
                        ),
                      ),
                    ),
                  ],
                ),
              ],
            );
          }

          // Widescreen Single-Tier Cockpit Dock (Zero Overlap & Proportional Flex)
          return Row(
            children: [
              // ETA Capsule
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 8),
                decoration: BoxDecoration(
                  color: AppColors.emergencyRed,
                  borderRadius: BorderRadius.circular(14),
                ),
                child: Row(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    const Icon(Icons.timer_rounded, color: Colors.white, size: 16),
                    const SizedBox(width: 6),
                    Text(
                      etaFormatted,
                      style: const TextStyle(
                        color: Colors.white,
                        fontSize: 13,
                        fontWeight: FontWeight.w900,
                        letterSpacing: 0.3,
                      ),
                    ),
                  ],
                ),
              ),
              const SizedBox(width: 12),

              // Status Badge (bounded with Flexible so it never overflows)
              Flexible(
                flex: 3,
                child: StatusBadge(status: status),
              ),

              if (isFallbackActive) ...[
                const SizedBox(width: 10),
                Container(
                  padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
                  decoration: BoxDecoration(
                    color: AppColors.statusFallback.withValues(alpha: 0.15),
                    borderRadius: BorderRadius.circular(10),
                    border: Border.all(color: AppColors.statusFallback),
                  ),
                  child: Row(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      const Icon(Icons.sync_problem_rounded, color: AppColors.statusFallback, size: 14),
                      const SizedBox(width: 5),
                      Text(
                        'Fallback #${request.fallbackCount}',
                        style: const TextStyle(fontSize: 11, fontWeight: FontWeight.w800, color: AppColors.statusFallback),
                      ),
                    ],
                  ),
                ),
              ],

              const SizedBox(width: 14),
              Container(
                width: 1,
                height: 36,
                color: isDark ? Colors.white12 : Colors.black12,
              ),
              const SizedBox(width: 14),

              // Ambulance Card
              Row(
                mainAxisSize: MainAxisSize.min,
                children: [
                  Container(
                    width: 36,
                    height: 36,
                    decoration: BoxDecoration(
                      color: AppColors.emergencyLightRed,
                      shape: BoxShape.circle,
                      border: Border.all(color: AppColors.emergencyRed.withValues(alpha: 0.3)),
                    ),
                    child: const Center(
                      child: Text('🚑', style: TextStyle(fontSize: 18)),
                    ),
                  ),
                  const SizedBox(width: 8),
                  Column(
                    mainAxisSize: MainAxisSize.min,
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        ambulanceId,
                        style: const TextStyle(fontSize: 13.5, fontWeight: FontWeight.w900),
                      ),
                      Text(
                        'Driver: ${request.assignedDriverName ?? "Suresh Kumar"}',
                        style: const TextStyle(fontSize: 10.5, color: AppColors.textSecondaryLight, fontWeight: FontWeight.w600),
                      ),
                    ],
                  ),
                ],
              ),

              const SizedBox(width: 14),

              // Destination Hospital Pill
              Flexible(
                flex: 3,
                child: Container(
                  padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
                  decoration: BoxDecoration(
                    color: const Color(0xFF0284C7).withValues(alpha: 0.12),
                    borderRadius: BorderRadius.circular(12),
                    border: Border.all(color: const Color(0xFF0284C7).withValues(alpha: 0.3)),
                  ),
                  child: Row(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      const Icon(Icons.local_hospital_rounded, size: 14, color: Color(0xFF0284C7)),
                      const SizedBox(width: 6),
                      Flexible(
                        child: Text(
                          assignedHospital?.name ?? request.hospitalDestination ?? 'General Hospital',
                          style: const TextStyle(fontSize: 11, fontWeight: FontWeight.w800, color: Color(0xFF0284C7)),
                          maxLines: 1,
                          overflow: TextOverflow.ellipsis,
                        ),
                      ),
                    ],
                  ),
                ),
              ),

              const SizedBox(width: 12),
              const Spacer(),

              // Cancel Emergency Button
              SizedBox(
                height: 40,
                child: FilledButton(
                  onPressed: request.status.canCancel ? _showCancelDialog : null,
                  style: FilledButton.styleFrom(
                    backgroundColor: request.status.canCancel
                        ? AppColors.emergencyRed.withValues(alpha: 0.15)
                        : Colors.grey.withValues(alpha: 0.1),
                    foregroundColor: request.status.canCancel ? AppColors.emergencyRed : Colors.grey,
                    elevation: 0,
                    side: BorderSide(
                      color: request.status.canCancel ? AppColors.emergencyRed : Colors.grey.withValues(alpha: 0.3),
                      width: 1.5,
                    ),
                    padding: const EdgeInsets.symmetric(horizontal: 16),
                    shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                  ),
                  child: Text(
                    request.status.canCancel ? 'CANCEL EMERGENCY' : 'EN ROUTE',
                    style: const TextStyle(fontWeight: FontWeight.w900, fontSize: 11),
                  ),
                ),
              ),
            ],
          );
        },
      ),
    );
  }

  /// Active Tracking Sheet: Renders live ETA, vehicle badge, driver profile, speed, and status timeline (Mobile)
  Widget _buildActiveTrackingSheet(
    BuildContext context,
    EmergencyRequest request,
    NearbyHospital? assignedHospital,
    ThemeData theme,
    bool isDark, [
    bool isDesktop = false,
  ]) {
    final status = request.status;
    final isFallbackActive = request.fallbackCount > 0 && status == RequestStatus.searching;
    final etaMinutes = _currentTelemetry?.eta?.estimatedMinutes ?? request.currentETA ?? 5;
    final ambulanceId = _currentTelemetry?.ambulanceId ?? request.assignedAmbulanceId ?? 'AMB-CH-042';

    return Container(
      key: const ValueKey('active_tracking_sheet'),
      padding: EdgeInsets.all(isDesktop ? 22 : 18),
      decoration: BoxDecoration(
        color: isDark ? const Color(0xFF1E293B) : Colors.white,
        borderRadius: BorderRadius.circular(24),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withValues(alpha: 0.2),
            blurRadius: 24,
            offset: const Offset(0, 6),
          ),
        ],
      ),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          // Cascading Fallback Alert Banner (Section 12)
          if (isFallbackActive) ...[
            Container(
              padding: const EdgeInsets.all(12),
              margin: const EdgeInsets.only(bottom: 12),
              decoration: BoxDecoration(
                color: AppColors.statusFallback.withValues(alpha: 0.15),
                borderRadius: BorderRadius.circular(14),
                border: Border.all(color: AppColors.statusFallback, width: 1.2),
              ),
              child: Row(
                children: [
                  const Icon(Icons.sync_problem_rounded, color: AppColors.statusFallback, size: 20),
                  const SizedBox(width: 10),
                  Expanded(
                    child: Text(
                      'Finding another available ambulance... (Attempt #${request.fallbackCount})',
                      style: const TextStyle(fontSize: 11, fontWeight: FontWeight.w700, color: AppColors.statusFallback),
                    ),
                  ),
                ],
              ),
            ),
          ],

          // ETA & Status Header Row (Bounded flex row with zero overflow)
          Row(
            children: [
              Container(
                padding: EdgeInsets.symmetric(horizontal: isDesktop ? 12 : 9, vertical: isDesktop ? 6 : 5),
                decoration: BoxDecoration(
                  color: AppColors.emergencyRed,
                  borderRadius: BorderRadius.circular(12),
                ),
                child: Row(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    Icon(Icons.timer_rounded, color: Colors.white, size: isDesktop ? 16 : 14),
                    const SizedBox(width: 4),
                    Text(
                      'ETA: $etaMinutes min',
                      style: TextStyle(
                        color: Colors.white,
                        fontSize: isDesktop ? 13 : 11.5,
                        fontWeight: FontWeight.w900,
                        letterSpacing: 0.3,
                      ),
                    ),
                  ],
                ),
              ),
              const SizedBox(width: 8),
              Expanded(
                child: StatusBadge(status: status),
              ),
              if (request.status.canCancel) ...[
                const SizedBox(width: 6),
                InkWell(
                  onTap: _showCancelDialog,
                  borderRadius: BorderRadius.circular(10),
                  child: Container(
                    padding: const EdgeInsets.symmetric(horizontal: 9, vertical: 5),
                    decoration: BoxDecoration(
                      color: Colors.red.withValues(alpha: 0.1),
                      borderRadius: BorderRadius.circular(10),
                      border: Border.all(color: Colors.red.withValues(alpha: 0.3)),
                    ),
                    child: const Text(
                      'CANCEL',
                      style: TextStyle(
                        color: Colors.redAccent,
                        fontSize: 10.5,
                        fontWeight: FontWeight.w900,
                      ),
                    ),
                  ),
                ),
              ],
            ],
          ),

          const SizedBox(height: 12),

          // Vehicle & Driver Details
          Row(
            children: [
              Container(
                width: isDesktop ? 52 : 44,
                height: isDesktop ? 52 : 44,
                decoration: BoxDecoration(
                  color: AppColors.emergencyLightRed,
                  shape: BoxShape.circle,
                  border: Border.all(color: AppColors.emergencyRed.withValues(alpha: 0.3), width: 2),
                ),
                child: Center(
                  child: Text('🚑', style: TextStyle(fontSize: isDesktop ? 26 : 22)),
                ),
              ),
              const SizedBox(width: 12),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      ambulanceId,
                      style: TextStyle(fontSize: isDesktop ? 17.5 : 16, fontWeight: FontWeight.w900, letterSpacing: 0.3),
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                    ),
                    Text(
                      'Driver: ${request.assignedDriverName ?? "Suresh Kumar"} • Unit in Focus',
                      style: TextStyle(fontSize: isDesktop ? 13 : 12, color: AppColors.textSecondaryLight, fontWeight: FontWeight.w500),
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                    ),
                  ],
                ),
              ),
              InkWell(
                onTap: () {
                  ScaffoldMessenger.of(context).showSnackBar(
                    const SnackBar(content: Text('Calling Driver: 108...')),
                  );
                },
                borderRadius: BorderRadius.circular(16),
                child: Container(
                  padding: EdgeInsets.symmetric(horizontal: isDesktop ? 14 : 12, vertical: isDesktop ? 9 : 8),
                  decoration: BoxDecoration(
                    color: AppColors.success,
                    borderRadius: BorderRadius.circular(16),
                  ),
                  child: Row(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      Icon(Icons.phone_in_talk_rounded, color: Colors.white, size: isDesktop ? 16 : 14),
                      const SizedBox(width: 4),
                      Text('CALL', style: TextStyle(color: Colors.white, fontSize: isDesktop ? 12 : 11, fontWeight: FontWeight.w900)),
                    ],
                  ),
                ),
              ),
            ],
          ),

          // Destination Hospital Card (Mobile)
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
            margin: const EdgeInsets.only(top: 10),
            decoration: BoxDecoration(
              color: const Color(0xFF0284C7).withValues(alpha: 0.1),
              borderRadius: BorderRadius.circular(12),
              border: Border.all(color: const Color(0xFF0284C7).withValues(alpha: 0.25)),
            ),
            child: Row(
              children: [
                const Icon(Icons.local_hospital_rounded, size: 16, color: Color(0xFF0284C7)),
                const SizedBox(width: 8),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      const Text(
                        'DESTINATION HOSPITAL',
                        style: TextStyle(fontSize: 9, fontWeight: FontWeight.w900, color: Color(0xFF0284C7), letterSpacing: 0.4),
                      ),
                      Text(
                        assignedHospital?.name ?? request.hospitalDestination ?? 'Rajiv Gandhi Govt General Hospital',
                        style: const TextStyle(fontSize: 12, fontWeight: FontWeight.w800),
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                      ),
                    ],
                  ),
                ),
                Container(
                  padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                  decoration: BoxDecoration(
                    color: const Color(0xFF0284C7),
                    borderRadius: BorderRadius.circular(6),
                  ),
                  child: const Text('ICU READY', style: TextStyle(color: Colors.white, fontSize: 9, fontWeight: FontWeight.w900)),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }

  /// Desktop Widescreen Command Cockpit Dock for Scenario 4 (No Ambulance Available)
  Widget _buildDesktopNoAmbulanceDock(
    BuildContext context,
    EmergencyRequest request,
    NearbyHospital? nearestHospital,
    ThemeData theme,
    bool isDark,
  ) {
    return Container(
      key: const ValueKey('desktop_no_ambulance_dock'),
      padding: const EdgeInsets.symmetric(horizontal: 22, vertical: 14),
      decoration: BoxDecoration(
        color: isDark ? const Color(0xFF1E293B) : Colors.white,
        borderRadius: BorderRadius.circular(24),
        border: Border.all(
          color: AppColors.emergencyRed,
          width: 2,
        ),
        boxShadow: [
          BoxShadow(
            color: AppColors.emergencyRed.withValues(alpha: 0.25),
            blurRadius: 28,
            offset: const Offset(0, 8),
          ),
        ],
      ),
      child: Row(
        children: [
          // Section 1: Alert Header + Explanation + Dismiss
          SizedBox(
            width: 330,
            child: Column(
              mainAxisSize: MainAxisSize.min,
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(
                  children: [
                    Container(
                      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 5),
                      decoration: BoxDecoration(
                        color: AppColors.emergencyRed,
                        borderRadius: BorderRadius.circular(10),
                      ),
                      child: const Row(
                        mainAxisSize: MainAxisSize.min,
                        children: [
                          Icon(Icons.warning_amber_rounded, color: Colors.white, size: 16),
                          SizedBox(width: 5),
                          Text(
                            'NO AMBULANCES AVAILABLE',
                            style: TextStyle(
                              color: Colors.white,
                              fontSize: 11.5,
                              fontWeight: FontWeight.w900,
                              letterSpacing: 0.5,
                            ),
                          ),
                        ],
                      ),
                    ),
                  ],
                ),
                const SizedBox(height: 6),
                const Text(
                  'All 40 network emergency units are currently deployed on active critical calls.',
                  style: TextStyle(fontSize: 12, fontWeight: FontWeight.w600),
                ),
                const SizedBox(height: 10),
                FilledButton.icon(
                  onPressed: () {
                    widget.emergencyController.resetForm();
                  },
                  icon: const Icon(Icons.refresh_rounded, size: 16, color: Colors.white),
                  label: const Text(
                    'DISMISS / RETRY SEARCH',
                    style: TextStyle(fontSize: 12, fontWeight: FontWeight.w900, color: Colors.white, letterSpacing: 0.4),
                  ),
                  style: FilledButton.styleFrom(
                    backgroundColor: AppColors.emergencyRed,
                    foregroundColor: Colors.white,
                    elevation: 3,
                    padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 10),
                    shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                  ),
                ),
              ],
            ),
          ),

          // Vertical Divider
          Padding(
            padding: const EdgeInsets.symmetric(horizontal: 16),
            child: Container(
              width: 1,
              height: 75,
              color: isDark ? Colors.white12 : Colors.black12,
            ),
          ),

          // Section 2: Nearest Casualty Emergency Center for Self-Transport
          Expanded(
            child: Container(
              padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
              decoration: BoxDecoration(
                color: isDark ? const Color(0xFF0F172A) : const Color(0xFFEFF6FF),
                borderRadius: BorderRadius.circular(16),
                border: Border.all(color: const Color(0xFF3B82F6).withValues(alpha: 0.35)),
              ),
              child: Row(
                children: [
                  Container(
                    padding: const EdgeInsets.all(10),
                    decoration: BoxDecoration(
                      color: const Color(0xFF3B82F6).withValues(alpha: 0.15),
                      shape: BoxShape.circle,
                    ),
                    child: const Icon(Icons.local_hospital_rounded, color: Color(0xFF2563EB), size: 26),
                  ),
                  const SizedBox(width: 12),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        Row(
                          children: [
                            Container(
                              padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                              decoration: BoxDecoration(
                                color: const Color(0xFF2563EB),
                                borderRadius: BorderRadius.circular(6),
                              ),
                              child: const Text('RECOMMENDED SELF-TRANSPORT', style: TextStyle(color: Colors.white, fontSize: 9.5, fontWeight: FontWeight.w900)),
                            ),
                            const SizedBox(width: 8),
                            Text(
                              '${nearestHospital?.distanceKm.toStringAsFixed(1) ?? '1.8'} km away',
                              style: const TextStyle(fontSize: 11, fontWeight: FontWeight.w800, color: Color(0xFF2563EB)),
                            ),
                          ],
                        ),
                        const SizedBox(height: 3),
                        Text(
                          nearestHospital?.name ?? 'Rajiv Gandhi Govt General Hospital (Casualty & Trauma)',
                          style: const TextStyle(fontSize: 13.5, fontWeight: FontWeight.w900),
                          maxLines: 1,
                          overflow: TextOverflow.ellipsis,
                        ),
                        Text(
                          '${nearestHospital?.emergencyBeds ?? 45} Casualty beds ready • Blue self-transport route highlighted on map',
                          style: TextStyle(fontSize: 11, color: isDark ? Colors.white60 : AppColors.textSecondaryLight),
                        ),
                      ],
                    ),
                  ),
                ],
              ),
            ),
          ),

          // Vertical Divider
          Padding(
            padding: const EdgeInsets.symmetric(horizontal: 16),
            child: Container(
              width: 1,
              height: 75,
              color: isDark ? Colors.white12 : Colors.black12,
            ),
          ),

          // Section 3: Call 108 / 112 Direct Helpline Button
          SizedBox(
            width: 220,
            child: FilledButton(
              onPressed: () {
                ScaffoldMessenger.of(context).showSnackBar(
                  const SnackBar(
                    duration: Duration(seconds: 4),
                    content: Text('📞 Connecting to 108 / 112 State Emergency Control Room...'),
                  ),
                );
              },
              style: FilledButton.styleFrom(
                backgroundColor: AppColors.emergencyRed,
                foregroundColor: Colors.white,
                padding: const EdgeInsets.symmetric(vertical: 16, horizontal: 16),
                shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
                elevation: 4,
              ),
              child: const Column(
                mainAxisSize: MainAxisSize.min,
                children: [
                  Row(
                    mainAxisAlignment: MainAxisAlignment.center,
                    children: [
                      Icon(Icons.phone_forwarded_rounded, size: 20),
                      SizedBox(width: 8),
                      Text('CALL 108 NOW', style: TextStyle(fontSize: 15, fontWeight: FontWeight.w900, letterSpacing: 0.5)),
                    ],
                  ),
                  SizedBox(height: 2),
                  Text('DIRECT DISPATCH HOTLINE', style: TextStyle(fontSize: 9.5, fontWeight: FontWeight.w700, color: Colors.white70)),
                ],
              ),
            ),
          ),
        ],
      ),
    );
  }

  /// Mobile Emergency Sheet for Scenario 4 (No Ambulance Available)
  Widget _buildNoAmbulanceSheet(
    BuildContext context,
    EmergencyRequest request,
    NearbyHospital? nearestHospital,
    ThemeData theme,
    bool isDark,
  ) {
    return Container(
      key: const ValueKey('mobile_no_ambulance_sheet'),
      padding: const EdgeInsets.all(18),
      decoration: BoxDecoration(
        color: isDark ? const Color(0xFF1E293B) : Colors.white,
        borderRadius: BorderRadius.circular(24),
        border: Border.all(color: AppColors.emergencyRed, width: 2),
        boxShadow: [
          BoxShadow(
            color: AppColors.emergencyRed.withValues(alpha: 0.25),
            blurRadius: 24,
            offset: const Offset(0, 6),
          ),
        ],
      ),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          // Alert Tag Row
          Row(
            children: [
              Expanded(
                child: Container(
                  padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 5),
                  decoration: BoxDecoration(
                    color: AppColors.emergencyRed,
                    borderRadius: BorderRadius.circular(10),
                  ),
                  child: const Row(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      Icon(Icons.warning_amber_rounded, color: Colors.white, size: 15),
                      SizedBox(width: 5),
                      Flexible(
                        child: Text(
                          'NO AMBULANCE AVAILABLE',
                          style: TextStyle(
                            color: Colors.white,
                            fontSize: 11,
                            fontWeight: FontWeight.w900,
                            letterSpacing: 0.4,
                          ),
                          maxLines: 1,
                          overflow: TextOverflow.ellipsis,
                        ),
                      ),
                    ],
                  ),
                ),
              ),
              const SizedBox(width: 8),
              FilledButton.icon(
                onPressed: () => widget.emergencyController.resetForm(),
                icon: const Icon(Icons.refresh_rounded, size: 14, color: Colors.white),
                label: const Text('RETRY', style: TextStyle(fontWeight: FontWeight.w900, fontSize: 11, color: Colors.white)),
                style: FilledButton.styleFrom(
                  backgroundColor: AppColors.emergencyRed,
                  foregroundColor: Colors.white,
                  padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
                  minimumSize: const Size(80, 32),
                  shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
                ),
              ),
            ],
          ),
          const SizedBox(height: 8),
          const Text(
            'All 40 network emergency ambulances in Chennai are currently engaged. Please call emergency services immediately or head to the nearest casualty center.',
            style: TextStyle(fontSize: 12, fontWeight: FontWeight.w600),
          ),
          const SizedBox(height: 12),

          // Direct Call Helpline Button
          SizedBox(
            width: double.infinity,
            child: FilledButton.icon(
              onPressed: () {
                ScaffoldMessenger.of(context).showSnackBar(
                  const SnackBar(
                    duration: Duration(seconds: 4),
                    content: Text('📞 Connecting to 108 Emergency Control Room...'),
                  ),
                );
              },
              icon: const Icon(Icons.phone_forwarded_rounded, size: 20),
              label: const Text('CALL 108 DIRECT HELPLINE', style: TextStyle(fontSize: 14, fontWeight: FontWeight.w900)),
              style: FilledButton.styleFrom(
                backgroundColor: AppColors.emergencyRed,
                padding: const EdgeInsets.symmetric(vertical: 14),
                shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14)),
              ),
            ),
          ),

          const SizedBox(height: 10),

          // Nearest Hospital Card
          Container(
            padding: const EdgeInsets.all(12),
            decoration: BoxDecoration(
              color: isDark ? const Color(0xFF0F172A) : const Color(0xFFEFF6FF),
              borderRadius: BorderRadius.circular(14),
              border: Border.all(color: const Color(0xFF3B82F6).withValues(alpha: 0.35)),
            ),
            child: Row(
              children: [
                const Icon(Icons.local_hospital_rounded, color: Color(0xFF2563EB), size: 24),
                const SizedBox(width: 10),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      Row(
                        children: [
                          const Text('NEAREST CASUALTY', style: TextStyle(fontSize: 9, fontWeight: FontWeight.w900, color: Color(0xFF2563EB))),
                          const SizedBox(width: 6),
                          Text(
                            '${nearestHospital?.distanceKm.toStringAsFixed(1) ?? '1.8'} km',
                            style: const TextStyle(fontSize: 10, fontWeight: FontWeight.w800, color: Color(0xFF2563EB)),
                          ),
                        ],
                      ),
                      const SizedBox(height: 2),
                      Text(
                        nearestHospital?.name ?? 'Rajiv Gandhi Govt General Hospital',
                        style: const TextStyle(fontSize: 12.5, fontWeight: FontWeight.w800),
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                      ),
                      const Text(
                        'Blue route highlighted on map for self-transport',
                        style: TextStyle(fontSize: 10, color: AppColors.textSecondaryLight),
                      ),
                    ],
                  ),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }

  /// Idle Emergency Sheet: Category selectors, victim stepper, and dominant SOS trigger button
  Widget _buildIdleEmergencySheet(
    BuildContext context,
    ThemeData theme,
    bool isDark, [
    bool isDesktop = false,
  ]) {
    final loc = widget.locationController.emergencyLocation;
    final selectedType = widget.emergencyController.selectedType;

    return Container(
      key: const ValueKey('idle_emergency_sheet'),
      padding: EdgeInsets.symmetric(horizontal: isDesktop ? 22 : 16, vertical: isDesktop ? 20 : 14),
      decoration: BoxDecoration(
        color: isDark ? const Color(0xFF1E293B) : Colors.white,
        borderRadius: BorderRadius.circular(24),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withValues(alpha: 0.2),
            blurRadius: 24,
            offset: const Offset(0, 6),
          ),
        ],
      ),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          // Header Row
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Expanded(
                child: Text(
                  'Emergency Medical Assistance',
                  style: TextStyle(
                    fontSize: isDesktop ? 19 : 15.5,
                    fontWeight: FontWeight.w900,
                    letterSpacing: -0.3,
                  ),
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                ),
              ),
              const SizedBox(width: 8),
              InkWell(
                onTap: () {
                  _showVoiceAssistanceModal();
                },
                borderRadius: BorderRadius.circular(12),
                child: Container(
                  padding: EdgeInsets.symmetric(horizontal: isDesktop ? 12 : 9, vertical: isDesktop ? 7 : 5),
                  decoration: BoxDecoration(
                    color: AppColors.emergencyLightRed,
                    borderRadius: BorderRadius.circular(12),
                    border: Border.all(color: AppColors.emergencyRed.withValues(alpha: 0.3)),
                  ),
                  child: Row(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      Icon(Icons.phone_rounded, size: isDesktop ? 16 : 13, color: AppColors.emergencyDarkRed),
                      const SizedBox(width: 4),
                      Text(
                        'Direct Emergency Helpline',
                        style: TextStyle(
                          fontSize: isDesktop ? 12 : 10.5,
                          fontWeight: FontWeight.w800,
                          color: AppColors.emergencyDarkRed,
                        ),
                      ),
                    ],
                  ),
                ),
              ),
            ],
          ),

          const SizedBox(height: 8),

          // High-Visibility Dedicated Current Incident Location Card (Opaque against Map Bleed)
          GestureDetector(
            behavior: HitTestBehavior.opaque,
            onTap: () {},
            child: Container(
              padding: EdgeInsets.symmetric(horizontal: isDesktop ? 16 : 12, vertical: isDesktop ? 14 : 9),
              decoration: BoxDecoration(
                color: isDark ? const Color(0xFF0F172A) : const Color(0xFFEFF6FF),
                borderRadius: BorderRadius.circular(16),
                border: Border.all(
                  color: _isPinLocked ? (isDark ? Colors.white24 : const Color(0xFF94A3B8)) : const Color(0xFF3B82F6).withValues(alpha: 0.6),
                  width: 1.3,
                ),
              ),
              child: Row(
                children: [
                  Container(
                    padding: EdgeInsets.all(isDesktop ? 12 : 8),
                    decoration: BoxDecoration(
                      color: (_isPinLocked ? Colors.blueGrey : AppColors.emergencyRed).withValues(alpha: 0.12),
                      shape: BoxShape.circle,
                    ),
                    child: Icon(
                      _isPinLocked
                          ? Icons.lock_rounded
                          : (loc?.isManualOverride == true ? Icons.edit_location_alt_rounded : Icons.location_on_rounded),
                      color: _isPinLocked ? (isDark ? Colors.white70 : const Color(0xFF475569)) : AppColors.emergencyRed,
                      size: isDesktop ? 28 : 22,
                    ),
                  ),
                  const SizedBox(width: 10),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Row(
                          children: [
                            Container(
                              width: 7,
                              height: 7,
                              decoration: BoxDecoration(
                                color: _isPinLocked
                                    ? const Color(0xFF64748B)
                                    : (widget.locationController.status == LocationFetchStatus.loading
                                        ? Colors.orange
                                        : (loc?.isManualOverride == true ? Colors.amber : const Color(0xFF10B981))),
                                shape: BoxShape.circle,
                              ),
                            ),
                            const SizedBox(width: 5),
                            Flexible(
                              child: Text(
                                _isPinLocked
                                    ? 'LOCATION LOCKED'
                                    : (widget.locationController.status == LocationFetchStatus.loading
                                        ? 'LOCATING YOU...'
                                        : (loc?.isManualOverride == true ? 'MANUAL PINPOINT' : 'GPS POSITION (DETECTED)')),
                                style: TextStyle(
                                  fontSize: isDesktop ? 11.5 : 9.5,
                                  fontWeight: FontWeight.w900,
                                  letterSpacing: 0.5,
                                  color: _isPinLocked
                                      ? (isDark ? Colors.blueGrey.shade200 : const Color(0xFF475569))
                                      : (widget.locationController.status == LocationFetchStatus.loading
                                          ? Colors.orange
                                          : (loc?.isManualOverride == true
                                              ? Colors.amber.shade700
                                              : (isDark ? Colors.blue.shade300 : const Color(0xFF1D4ED8)))),
                                ),
                                overflow: TextOverflow.ellipsis,
                              ),
                            ),
                          ],
                        ),
                        const SizedBox(height: 3),
                        Text(
                          loc?.address ??
                              (loc != null
                                  ? '${loc.latitude.toStringAsFixed(4)}° N, ${loc.longitude.toStringAsFixed(4)}° E'
                                  : '13.0827° N, 80.2707° E (Chennai Central Corridor)'),
                          style: TextStyle(
                            fontSize: isDesktop ? 15.5 : 13.5,
                            fontWeight: FontWeight.w800,
                          ),
                          maxLines: 1,
                          overflow: TextOverflow.ellipsis,
                        ),
                        const SizedBox(height: 2),
                        Row(
                          children: [
                            Expanded(
                              child: Text(
                                _isPinLocked
                                    ? 'Position locked • Tap [Unlock] to modify'
                                    : (widget.locationController.status == LocationFetchStatus.loading
                                        ? 'Acquiring GPS fix... Or tap map to pick incident location'
                                        : 'Tap map or drag pin to set pickup spot'),
                                style: TextStyle(
                                  fontSize: isDesktop ? 12 : 10.5,
                                  fontWeight: FontWeight.w600,
                                  color: AppColors.textSecondaryLight,
                                ),
                              ),
                            ),
                            if (widget.locationController.status == LocationFetchStatus.permissionDenied ||
                                widget.locationController.status == LocationFetchStatus.permissionDeniedForever ||
                                widget.locationController.status == LocationFetchStatus.serviceDisabled ||
                                widget.locationController.status == LocationFetchStatus.error)
                              InkWell(
                                onTap: () => widget.locationController.useDemoLocation(),
                                borderRadius: BorderRadius.circular(6),
                                child: Container(
                                  padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                                  decoration: BoxDecoration(
                                    color: Colors.blue.withValues(alpha: 0.15),
                                    borderRadius: BorderRadius.circular(6),
                                  ),
                                  child: const Text(
                                    'USE DEMO LOCATION',
                                    style: TextStyle(fontSize: 10, fontWeight: FontWeight.w800, color: Colors.blue),
                                  ),
                                ),
                              ),
                          ],
                        ),
                      ],
                    ),
                  ),
                  const SizedBox(width: 8),
                  // Lock Pin / Unlock Pin Toggle Button
                  FilledButton.tonal(
                    onPressed: _togglePinLock,
                    style: FilledButton.styleFrom(
                      backgroundColor: _isPinLocked
                          ? (isDark ? Colors.white.withValues(alpha: 0.12) : const Color(0xFFE2E8F0))
                          : (isDark ? Colors.white.withValues(alpha: 0.15) : const Color(0xFFDBEAFE)),
                      foregroundColor: _isPinLocked
                          ? (isDark ? Colors.white70 : const Color(0xFF334155))
                          : (isDark ? Colors.white : const Color(0xFF1E40AF)),
                      padding: EdgeInsets.symmetric(horizontal: isDesktop ? 14 : 8, vertical: isDesktop ? 10 : 6),
                      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
                      minimumSize: Size(isDesktop ? 96 : 74, isDesktop ? 44 : 34),
                    ),
                    child: Row(
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        Icon(_isPinLocked ? Icons.lock_open_rounded : Icons.lock_rounded, size: isDesktop ? 16 : 14),
                        const SizedBox(width: 4),
                        Text(
                          _isPinLocked ? 'UNLOCK' : 'LOCK PIN',
                          style: TextStyle(fontSize: isDesktop ? 12.5 : 10.5, fontWeight: FontWeight.w900),
                        ),
                      ],
                    ),
                  ),
                ],
              ),
            ),
          ),

          const SizedBox(height: 10),

          // Emergency Category Selection Pills (Horizontal Scroll)
          SizedBox(
            height: isDesktop ? 56 : 38,
            child: ListView.builder(
              scrollDirection: Axis.horizontal,
              itemCount: EmergencyType.values.length,
              itemBuilder: (context, index) {
                final type = EmergencyType.values[index];
                final isSelected = type == selectedType;

                return Padding(
                  padding: const EdgeInsets.only(right: 7),
                  child: InkWell(
                    onTap: () => widget.emergencyController.setEmergencyType(type),
                    borderRadius: BorderRadius.circular(20),
                    child: AnimatedContainer(
                      duration: const Duration(milliseconds: 180),
                      padding: EdgeInsets.symmetric(
                        horizontal: isDesktop ? 18 : 12,
                        vertical: isDesktop ? 12 : 7,
                      ),
                      decoration: BoxDecoration(
                        color: isSelected
                            ? AppColors.emergencyRed
                            : (isDark ? const Color(0xFF0F172A) : Colors.grey.shade100),
                        borderRadius: BorderRadius.circular(20),
                        border: Border.all(
                          color: isSelected ? AppColors.emergencyRed : Colors.black.withValues(alpha: 0.12),
                          width: 1.3,
                        ),
                      ),
                      child: Row(
                        mainAxisSize: MainAxisSize.min,
                        children: [
                          Icon(
                            type.icon,
                            size: isDesktop ? 24 : 17,
                            color: isSelected ? Colors.white : AppColors.emergencyRed,
                          ),
                          const SizedBox(width: 6),
                          Text(
                            type.displayName,
                            style: TextStyle(
                              fontSize: isDesktop ? 15 : 12.5,
                              fontWeight: isSelected ? FontWeight.w900 : FontWeight.w700,
                              color: isSelected ? Colors.white : null,
                            ),
                          ),
                        ],
                      ),
                    ),
                  ),
                );
              },
            ),
          ),

          const SizedBox(height: 8),

          // Victims Stepper Row
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Expanded(
                child: Row(
                  children: [
                    Icon(
                      Icons.personal_injury_rounded,
                      size: isDesktop ? 24 : 18,
                      color: AppColors.emergencyRed,
                    ),
                    const SizedBox(width: 6),
                    Flexible(
                      child: Text(
                        'Patients / Victims:',
                        style: TextStyle(
                          fontSize: isDesktop ? 15 : 12.5,
                          fontWeight: FontWeight.w800,
                        ),
                        overflow: TextOverflow.ellipsis,
                      ),
                    ),
                  ],
                ),
              ),
              const SizedBox(width: 8),
              CounterStepper(
                count: widget.emergencyController.victimCount,
                min: AppConstants.minVictims,
                max: AppConstants.maxVictims,
                isCompact: !isDesktop,
                onIncrement: widget.emergencyController.incrementVictimCount,
                onDecrement: widget.emergencyController.decrementVictimCount,
              ),
            ],
          ),

          const SizedBox(height: 10),

          // Primary Dominant SOS Emergency Trigger Button
          EmergencyButton(
            label: 'REQUEST AMBULANCE',
            subLabel: 'TAP FOR IMMEDIATE LIVE DISPATCH',
            isLoading: widget.emergencyController.submissionState == SubmissionState.submitting || _isDispatching,
            isCompact: !isDesktop,
            onPressed: _dispatchAmbulance,
          ),
        ],
      ),
    );
  }

  Widget _buildPoiFilterChip({
    required String label,
    required bool isSelected,
    required Color color,
    bool isDesktop = false,
    required VoidCallback onTap,
  }) {
    final isDark = Theme.of(context).brightness == Brightness.dark;

    return InkWell(
      onTap: onTap,
      borderRadius: BorderRadius.circular(20),
      child: AnimatedContainer(
        duration: const Duration(milliseconds: 180),
        padding: EdgeInsets.symmetric(
          horizontal: isDesktop ? 18 : 14,
          vertical: isDesktop ? 10 : 8,
        ),
        decoration: BoxDecoration(
          color: isSelected ? color : Colors.grey.withValues(alpha: 0.12),
          borderRadius: BorderRadius.circular(20),
          border: Border.all(
            color: isSelected ? color : Colors.grey.withValues(alpha: 0.3),
            width: 1.2,
          ),
        ),
        child: Text(
          label,
          style: TextStyle(
            fontSize: isDesktop ? 13.5 : 12.5,
            fontWeight: FontWeight.w800,
            color: isSelected ? Colors.white : (isDark ? Colors.white70 : Colors.black87),
          ),
        ),
      ),
    );
  }
}
