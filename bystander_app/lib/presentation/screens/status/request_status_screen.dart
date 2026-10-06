import 'dart:async';
import 'package:flutter/material.dart';
import '../../../core/theme/app_colors.dart';
import '../../../core/theme/app_text_styles.dart';
import '../../../core/utils/date_formatter.dart';
import '../../../core/utils/status_helper.dart';
import '../../../domain/entities/emergency_request.dart';
import '../../../domain/entities/request_status.dart';
import '../../../domain/entities/tracking_info.dart';
import '../../../domain/repositories/tracking_repository.dart';
import '../../../routing/route_paths.dart';
import '../../controllers/emergency_controller.dart';
import '../../widgets/gps_provenance_badge.dart';
import '../../widgets/stale_telemetry_banner.dart';
import '../../widgets/status_badge.dart';

/// Screen 5: Request Status Screen displaying real-time dispatch progress,
/// vehicle assignment, driver details, cascading fallback alerts, and tracking CTA.
class RequestStatusScreen extends StatefulWidget {
  final EmergencyController emergencyController;
  final TrackingRepository? trackingRepository;

  const RequestStatusScreen({
    super.key,
    required this.emergencyController,
    this.trackingRepository,
  });

  @override
  State<RequestStatusScreen> createState() => _RequestStatusScreenState();
}

class _RequestStatusScreenState extends State<RequestStatusScreen> {
  TrackingInfo? _currentTelemetry;
  StreamSubscription<TrackingInfo>? _trackingSub;

  @override
  void initState() {
    super.initState();
    _subscribeTracking();
  }

  @override
  void didUpdateWidget(RequestStatusScreen oldWidget) {
    super.didUpdateWidget(oldWidget);
    _subscribeTracking();
  }

  void _subscribeTracking() {
    final req = widget.emergencyController.activeRequest;
    if (req != null && req.status.isActive && widget.trackingRepository != null) {
      widget.trackingRepository!.getTrackingInfo(req.requestId).then((info) {
        if (mounted && info != null) {
          setState(() => _currentTelemetry = info);
        }
      });
      _trackingSub?.cancel();
      _trackingSub = widget.trackingRepository!
          .watchTrackingUpdates(req.requestId)
          .listen((info) {
        if (mounted) {
          setState(() => _currentTelemetry = info);
        }
      });
    } else {
      _trackingSub?.cancel();
      _trackingSub = null;
    }
  }

  @override
  void dispose() {
    _trackingSub?.cancel();
    super.dispose();
  }

  void _showCancelDialog(BuildContext context) {
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
              if (mounted) setState(() => _currentTelemetry = null);
            },
            style: FilledButton.styleFrom(backgroundColor: AppColors.emergencyRed),
            child: const Text('CANCEL EMERGENCY'),
          ),
        ],
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);

    return PopScope(
      canPop: false,
      onPopInvokedWithResult: (didPop, result) {
        if (!didPop) {
          // If user presses system back, navigate to Home screen while maintaining active request in background
          Navigator.pushNamedAndRemoveUntil(context, RoutePaths.home, (r) => false);
        }
      },
      child: Scaffold(
        appBar: AppBar(
          title: const Text('Emergency Status'),
          leading: IconButton(
            icon: const Icon(Icons.home_rounded),
            tooltip: 'Return to Home Map',
            onPressed: () {
              Navigator.pushNamedAndRemoveUntil(context, RoutePaths.home, (r) => false);
            },
          ),
          actions: [
            IconButton(
              icon: const Icon(Icons.phone_rounded, color: AppColors.emergencyRed),
              tooltip: 'Emergency Call 108',
              onPressed: () {
                ScaffoldMessenger.of(context).showSnackBar(
                  const SnackBar(
                    content: Text('Calling direct helpline: 108...'),
                    duration: Duration(seconds: 2),
                  ),
                );
              },
            ),
          ],
        ),
        body: ListenableBuilder(
          listenable: widget.emergencyController,
          builder: (context, _) {
            final EmergencyRequest? request = widget.emergencyController.activeRequest;

            if (request == null) {
              return Center(
                child: Column(
                  mainAxisAlignment: MainAxisAlignment.center,
                  children: [
                    const Icon(Icons.info_outline_rounded, size: 48, color: AppColors.textSecondaryLight),
                    const SizedBox(height: 16),
                    const Text('No active emergency request found.', style: TextStyle(fontSize: 16)),
                    const SizedBox(height: 16),
                    ElevatedButton(
                      onPressed: () => Navigator.pushNamedAndRemoveUntil(context, RoutePaths.home, (r) => false),
                      style: ElevatedButton.styleFrom(
                        minimumSize: const Size(200, 48),
                      ),
                      child: const Text('RETURN TO HOME'),
                    ),
                  ],
                ),
              );
            }

            final status = request.status;
            final isFallbackActive = request.fallbackCount > 0 && status == RequestStatus.searching;
            final isAssignedOrEnRoute = status == RequestStatus.accepted ||
                status == RequestStatus.enRouteToPatient ||
                status == RequestStatus.arrivedAtPatient ||
                status == RequestStatus.patientOnboard ||
                status == RequestStatus.enRouteToHospital;

            final isStale = _currentTelemetry?.isStale ?? false;
            final isRealGps = _currentTelemetry?.isRealGps ?? false;

            return Center(
              child: ConstrainedBox(
                constraints: const BoxConstraints(maxWidth: 680),
                child: SingleChildScrollView(
                  padding: const EdgeInsets.all(20),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      // Request ID & Timestamp Header Card
                      Card(
                        child: Padding(
                          padding: const EdgeInsets.all(16),
                          child: Wrap(
                            alignment: WrapAlignment.spaceBetween,
                            runSpacing: 8,
                            crossAxisAlignment: WrapCrossAlignment.center,
                            children: [
                              Column(
                                crossAxisAlignment: CrossAxisAlignment.start,
                                children: [
                                  const Text('REQUEST ID', style: AppTextStyles.caption),
                                  const SizedBox(height: 2),
                                  Text(
                                    request.requestId,
                                    style: const TextStyle(
                                      fontSize: 16,
                                      fontWeight: FontWeight.w900,
                                      letterSpacing: 0.5,
                                      color: AppColors.emergencyDarkRed,
                                    ),
                                  ),
                                ],
                              ),
                              Column(
                                crossAxisAlignment: CrossAxisAlignment.start,
                                children: [
                                  const Text('INITIATED AT', style: AppTextStyles.caption),
                                  const SizedBox(height: 2),
                                  Text(
                                    DateFormatter.formatTime(request.createdAt),
                                    style: const TextStyle(fontSize: 13, fontWeight: FontWeight.w600),
                                  ),
                                ],
                              ),
                            ],
                          ),
                        ),
                      ),

                      const SizedBox(height: 16),

                      // Cascading Fallback Alert Banner (when cascading fallback has been triggered)
                      if (isFallbackActive) ...[
                        Container(
                          padding: const EdgeInsets.all(16),
                          decoration: BoxDecoration(
                            color: AppColors.statusFallback.withValues(alpha: 0.12),
                            borderRadius: BorderRadius.circular(16),
                            border: Border.all(color: AppColors.statusFallback, width: 1.5),
                          ),
                          child: Row(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              const Icon(Icons.sync_problem_rounded, color: AppColors.statusFallback, size: 24),
                              const SizedBox(width: 12),
                              Expanded(
                                child: Column(
                                  crossAxisAlignment: CrossAxisAlignment.start,
                                  children: [
                                    Text(
                                      'Your ambulance assignment is being updated. (Attempt #${request.fallbackCount + 1})',
                                      style: const TextStyle(
                                        fontSize: 15,
                                        fontWeight: FontWeight.w800,
                                        color: AppColors.statusFallback,
                                      ),
                                    ),
                                    const SizedBox(height: 4),
                                    const Text(
                                      'Initial unit could not proceed. Cascading fallback is automatically re-assigning the next nearest ambulance. Please stay where you are.',
                                      style: TextStyle(fontSize: 12, height: 1.3),
                                    ),
                                  ],
                                ),
                              ),
                            ],
                          ),
                        ),
                        const SizedBox(height: 16),
                      ],

                      // Stale Telemetry Non-Alarming Alert
                      if (isAssignedOrEnRoute && isStale) ...[
                        StaleTelemetryBanner(
                          secondsDelayed: _currentTelemetry!.secondsSinceUpdate,
                        ),
                      ],

                      // Primary Status Hero Card
                      Container(
                        width: double.infinity,
                        padding: const EdgeInsets.all(24),
                        decoration: BoxDecoration(
                          color: status.color.withValues(alpha: 0.08),
                          borderRadius: BorderRadius.circular(20),
                          border: Border.all(color: status.color.withValues(alpha: 0.3), width: 1.5),
                        ),
                        child: Column(
                          children: [
                            Container(
                              padding: const EdgeInsets.all(16),
                              decoration: BoxDecoration(
                                color: status.color.withValues(alpha: 0.15),
                                shape: BoxShape.circle,
                              ),
                              child: Icon(
                                StatusHelper.getStatusIcon(status),
                                size: 44,
                                color: status.color,
                              ),
                            ),
                            const SizedBox(height: 16),
                            StatusBadge(status: status, isLarge: true),
                            const SizedBox(height: 12),
                            Text(
                              status.userDescription,
                              textAlign: TextAlign.center,
                              style: TextStyle(
                                fontSize: 14,
                                color: theme.textTheme.bodyMedium?.color?.withValues(alpha: 0.85),
                                height: 1.4,
                              ),
                            ),
                            const SizedBox(height: 16),
                            LinearProgressIndicator(
                              value: StatusHelper.getProgressValue(status),
                              backgroundColor: status.color.withValues(alpha: 0.15),
                              color: status.color,
                              minHeight: 6,
                              borderRadius: BorderRadius.circular(4),
                            ),
                          ],
                        ),
                      ),

                      const SizedBox(height: 20),

                      // Assigned Ambulance & Driver Card (when vehicle is assigned)
                      if (isAssignedOrEnRoute && request.assignedAmbulanceId != null) ...[
                        Card(
                          child: Padding(
                            padding: const EdgeInsets.all(18),
                            child: Column(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                Wrap(
                                  alignment: WrapAlignment.spaceBetween,
                                  crossAxisAlignment: WrapCrossAlignment.center,
                                  spacing: 8,
                                  runSpacing: 6,
                                  children: [
                                    const Text('ASSIGNED EMERGENCY UNIT', style: AppTextStyles.caption),
                                    Wrap(
                                      spacing: 8,
                                      crossAxisAlignment: WrapCrossAlignment.center,
                                      children: [
                                        // Unit ID Badge
                                        Container(
                                          padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                                          decoration: BoxDecoration(
                                            color: AppColors.statusAssigned.withValues(alpha: 0.1),
                                            borderRadius: BorderRadius.circular(8),
                                          ),
                                          child: Text(
                                            request.assignedAmbulanceId!,
                                            style: const TextStyle(
                                              color: AppColors.statusAssigned,
                                              fontWeight: FontWeight.w800,
                                              fontSize: 12,
                                            ),
                                          ),
                                        ),
                                        // Provenance Badge
                                        GpsProvenanceBadge(
                                          isRealGps: isRealGps,
                                          isStale: isStale,
                                          secondsSinceUpdate: _currentTelemetry?.secondsSinceUpdate,
                                          isCompact: true,
                                        ),
                                      ],
                                    ),
                                  ],
                                ),
                                const SizedBox(height: 14),
                                Row(
                                  children: [
                                    const CircleAvatar(
                                      radius: 24,
                                      backgroundColor: AppColors.emergencyLightRed,
                                      child: Icon(Icons.person_rounded, color: AppColors.emergencyDarkRed, size: 26),
                                    ),
                                    const SizedBox(width: 14),
                                    Expanded(
                                      child: Column(
                                        crossAxisAlignment: CrossAxisAlignment.start,
                                        children: [
                                          Text(
                                            request.assignedDriverName ?? 'Ambulance First Responder',
                                            style: const TextStyle(fontSize: 15, fontWeight: FontWeight.w700),
                                          ),
                                          if (request.driverPhone != null) ...[
                                            const SizedBox(height: 2),
                                            Text(
                                              request.driverPhone!,
                                              style: const TextStyle(fontSize: 13, color: AppColors.textSecondaryLight),
                                            ),
                                          ],
                                        ],
                                      ),
                                    ),
                                    if (request.driverPhone != null)
                                      IconButton.filledTonal(
                                        icon: const Icon(Icons.call_rounded),
                                        tooltip: 'Call Driver',
                                        style: IconButton.styleFrom(
                                          minimumSize: const Size(48, 48),
                                        ),
                                        onPressed: () {
                                          ScaffoldMessenger.of(context).showSnackBar(
                                            SnackBar(
                                              content: Text('Calling Driver at ${request.driverPhone}...'),
                                            ),
                                          );
                                        },
                                      ),
                                  ],
                                ),
                                if (request.currentETA != null) ...[
                                  const SizedBox(height: 12),
                                  const Divider(height: 1),
                                  const SizedBox(height: 10),
                                  Row(
                                    children: [
                                      const Icon(Icons.timer_rounded, size: 16, color: AppColors.emergencyRed),
                                      const SizedBox(width: 6),
                                      Expanded(
                                        child: Text(
                                          'Estimated Arrival Time: ${request.currentETA} minutes',
                                          style: const TextStyle(
                                            fontSize: 13,
                                            fontWeight: FontWeight.w800,
                                            color: AppColors.emergencyRed,
                                          ),
                                        ),
                                      ),
                                    ],
                                  ),
                                ],
                              ],
                            ),
                          ),
                        ),
                        const SizedBox(height: 16),
                      ],

                      // Action Buttons: Open Tracking or No Ambulance Helpline
                      if (status == RequestStatus.noAmbulanceAvailable) ...[
                        Container(
                          width: double.infinity,
                          padding: const EdgeInsets.all(18),
                          decoration: BoxDecoration(
                            color: AppColors.emergencyLightRed,
                            borderRadius: BorderRadius.circular(16),
                            border: Border.all(color: AppColors.emergencyRed, width: 1.5),
                          ),
                          child: Column(
                            children: [
                              const Row(
                                mainAxisAlignment: MainAxisAlignment.center,
                                children: [
                                  Icon(Icons.phone_in_talk_rounded, color: AppColors.emergencyDarkRed, size: 22),
                                  SizedBox(width: 8),
                                  Flexible(
                                    child: Text(
                                      'CALL EMERGENCY HELPLINE DIRECTLY',
                                      textAlign: TextAlign.center,
                                      style: TextStyle(
                                        color: AppColors.emergencyDarkRed,
                                        fontWeight: FontWeight.w900,
                                        fontSize: 14,
                                      ),
                                    ),
                                  ),
                                ],
                              ),
                              const SizedBox(height: 8),
                              const Text(
                                'All local units are engaged. Central dispatch operator can coordinate mutual aid vehicles.',
                                textAlign: TextAlign.center,
                                style: TextStyle(fontSize: 12, color: AppColors.emergencyDarkRed),
                              ),
                              const SizedBox(height: 14),
                              SizedBox(
                                width: double.infinity,
                                height: 48,
                                child: ElevatedButton.icon(
                                  onPressed: () {
                                    ScaffoldMessenger.of(context).showSnackBar(
                                      const SnackBar(content: Text('Dialing 108 Emergency Helpline...')),
                                    );
                                  },
                                  icon: const Icon(Icons.call_rounded),
                                  label: const Text('DIAL 108 NOW'),
                                  style: ElevatedButton.styleFrom(backgroundColor: AppColors.emergencyRed),
                                ),
                              ),
                            ],
                          ),
                        ),
                        const SizedBox(height: 16),
                      ] else if (isAssignedOrEnRoute) ...[
                        SizedBox(
                          width: double.infinity,
                          height: 52,
                          child: ElevatedButton(
                            onPressed: () {
                              Navigator.pushNamed(context, RoutePaths.liveTracking);
                            },
                            style: ElevatedButton.styleFrom(
                              backgroundColor: AppColors.statusEnRoute,
                              foregroundColor: Colors.white,
                              shape: RoundedRectangleBorder(
                                borderRadius: BorderRadius.circular(16),
                              ),
                              elevation: 3,
                            ),
                            child: const Row(
                              mainAxisAlignment: MainAxisAlignment.center,
                              mainAxisSize: MainAxisSize.min,
                              children: [
                                Icon(Icons.map_rounded, size: 20),
                                SizedBox(width: 8),
                                Flexible(
                                  child: Text(
                                    'OPEN LIVE MAP TRACKING',
                                    textAlign: TextAlign.center,
                                    style: TextStyle(fontSize: 13, fontWeight: FontWeight.w900, letterSpacing: 0.4),
                                  ),
                                ),
                              ],
                            ),
                          ),
                        ),
                        const SizedBox(height: 16),
                      ],

                      // Incident Details Summary Card
                      Card(
                        child: Padding(
                          padding: const EdgeInsets.all(16),
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              const Text('INCIDENT SUMMARY', style: AppTextStyles.caption),
                              const SizedBox(height: 10),
                              Row(
                                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                                children: [
                                  const Text('Emergency Type:'),
                                  const SizedBox(width: 8),
                                  Flexible(
                                    child: Text(
                                      request.emergencyType.displayName,
                                      textAlign: TextAlign.end,
                                      style: const TextStyle(fontWeight: FontWeight.w700),
                                    ),
                                  ),
                                ],
                              ),
                              const SizedBox(height: 6),
                              Row(
                                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                                children: [
                                  const Text('Victims:'),
                                  Text(
                                    '${request.victimCount}',
                                    style: const TextStyle(fontWeight: FontWeight.w700),
                                  ),
                                ],
                              ),
                              if (request.hospitalDestination != null) ...[
                                const SizedBox(height: 6),
                                Wrap(
                                  alignment: WrapAlignment.spaceBetween,
                                  runSpacing: 4,
                                  children: [
                                    const Text('Destination Hospital:'),
                                    Text(
                                      request.hospitalDestination!,
                                      textAlign: TextAlign.end,
                                      style: const TextStyle(fontWeight: FontWeight.w700),
                                    ),
                                  ],
                                ),
                              ],
                            ],
                          ),
                        ),
                      ),

                      const SizedBox(height: 24),

                      // Bottom Controls: Cancel or Create New Request
                      if (status.isActive) ...[
                        OutlinedButton(
                          onPressed: status.canCancel ? () => _showCancelDialog(context) : null,
                          style: OutlinedButton.styleFrom(
                            minimumSize: const Size(double.infinity, 50),
                            side: const BorderSide(color: AppColors.emergencyRed),
                          ),
                          child: Row(
                            mainAxisAlignment: MainAxisAlignment.center,
                            children: [
                              const Icon(Icons.cancel_outlined, color: AppColors.emergencyRed),
                              const SizedBox(width: 8),
                              Flexible(
                                child: Text(
                                  status.canCancel ? 'CANCEL EMERGENCY REQUEST' : 'CANCEL UNAVAILABLE AT THIS STAGE',
                                  textAlign: TextAlign.center,
                                  style: const TextStyle(color: AppColors.emergencyRed, fontWeight: FontWeight.w800),
                                ),
                              ),
                            ],
                          ),
                        ),
                      ] else ...[
                        ElevatedButton(
                          onPressed: () {
                            widget.emergencyController.resetForm();
                            Navigator.pushNamedAndRemoveUntil(context, RoutePaths.home, (r) => false);
                          },
                          style: ElevatedButton.styleFrom(
                            minimumSize: const Size(double.infinity, 50),
                            backgroundColor: AppColors.emergencyRed,
                          ),
                          child: const Text('CREATE NEW REQUEST'),
                        ),
                      ],

                      const SizedBox(height: 20),
                    ],
                  ),
                ),
              ),
            );
          },
        ),
      ),
    );
  }
}
