import 'dart:async';
import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../../core/constants/app_colors.dart';
import '../../models/assignment.dart';
import '../../state/driver_state.dart';
import '../../state/navigation_state.dart';

class AssignmentReceivedScreen extends StatefulWidget {
  final Assignment assignment;

  const AssignmentReceivedScreen({super.key, required this.assignment});

  @override
  State<AssignmentReceivedScreen> createState() =>
      _AssignmentReceivedScreenState();
}

class _AssignmentReceivedScreenState extends State<AssignmentReceivedScreen>
    with SingleTickerProviderStateMixin {
  late int _remainingSeconds;
  Timer? _timer;
  bool _isResponding = false;
  String? _timeoutBanner;
  late AnimationController _pulseController;

  @override
  void initState() {
    super.initState();
    int remaining = widget.assignment.timeoutSeconds;
    if (widget.assignment.expiresAt != null) {
      final diff = widget.assignment.expiresAt!.difference(DateTime.now()).inSeconds;
      if (diff > 0) {
        remaining = diff;
      }
    }
    _remainingSeconds = remaining;
    _pulseController = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 800),
    )..repeat(reverse: true);

    _startCountdown();
  }

  void _startCountdown() {
    _timer = Timer.periodic(const Duration(seconds: 1), (timer) {
      if (!mounted) return;
      if (_remainingSeconds > 1) {
        setState(() {
          _remainingSeconds--;
        });
      } else {
        _timer?.cancel();
        setState(() {
          _remainingSeconds = 0;
          _timeoutBanner =
              'TIMEOUT: Response window expired. Fallback dispatch triggered.';
        });
        _handleTimeout();
      }
    });
  }

  Future<void> _handleTimeout() async {
    if (_isResponding) return;
    setState(() => _isResponding = true);
    final driverState = context.read<DriverState>();
    await driverState.timeoutAssignment();
    await Future.delayed(const Duration(milliseconds: 600));
    if (mounted) {
      Navigator.pop(context);
    }
  }

  Future<void> _handleAccept() async {
    if (_isResponding) return;
    _timer?.cancel();
    setState(() => _isResponding = true);

    final driverState = context.read<DriverState>();
    final navState = context.read<NavigationState>();

    try {
      final accepted = await driverState.acceptAssignment();
      if (!mounted) return;
      if (accepted) {
        // Transition directly to En Route to Patient
        await driverState.advanceToEnRouteToPatient();
        navState.startJourneyToPatient(widget.assignment);

        if (!mounted) return;
        Navigator.pushReplacementNamed(context, '/navigation');
        return;
      } else {
        final errorMsg = driverState.errorMessage ?? 'Assignment could not be accepted.';
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text('⚠️ $errorMsg'),
            backgroundColor: AppColors.emergencyRed,
          ),
        );
        Navigator.pop(context);
      }
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text('⚠️ Error accepting assignment: $e'),
            backgroundColor: AppColors.emergencyRed,
          ),
        );
        Navigator.pop(context);
      }
    } finally {
      if (mounted) {
        setState(() => _isResponding = false);
      }
    }
  }

  Future<void> _handleReject() async {
    if (_isResponding) return;
    _timer?.cancel();
    setState(() => _isResponding = true);

    final driverState = context.read<DriverState>();
    try {
      await driverState.rejectAssignment(reason: 'Driver declined manually');
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(
            content: Text('Assignment declined. Re-routing dispatch to next available unit.'),
            backgroundColor: AppColors.warningOrange,
          ),
        );
        Navigator.pop(context);
      }
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text('⚠️ Error rejecting assignment: $e'),
            backgroundColor: AppColors.emergencyRed,
          ),
        );
        Navigator.pop(context);
      }
    } finally {
      if (mounted) {
        setState(() => _isResponding = false);
      }
    }
  }

  @override
  void dispose() {
    _timer?.cancel();
    _pulseController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final assignment = widget.assignment;
    final emergency = assignment.emergency;
    final totalTimeout = assignment.timeoutSeconds > 0 ? assignment.timeoutSeconds : 60;
    final maxTimeout = _remainingSeconds > totalTimeout ? _remainingSeconds : totalTimeout;
    final progressFraction = (_remainingSeconds / (maxTimeout > 0 ? maxTimeout : 1)).clamp(0.0, 1.0);

    return PopScope(
      canPop: false, // Prevent dismissing without Accept or Reject
      child: Scaffold(
        backgroundColor: AppColors.background,
        body: SafeArea(
          child: Column(
            children: [
              // Top Urgent Alert Header with Pulsing Halo
              AnimatedBuilder(
                animation: _pulseController,
                builder: (context, child) {
                  return Container(
                    width: double.infinity,
                    padding: const EdgeInsets.symmetric(vertical: 20, horizontal: 16),
                    decoration: BoxDecoration(
                      color: AppColors.emergencyRed.withValues(
                        alpha: 0.15 + (_pulseController.value * 0.15),
                      ),
                      border: const Border(
                        bottom: BorderSide(color: AppColors.emergencyRed, width: 2),
                      ),
                    ),
                    child: Column(
                      children: [
                        const Row(
                          mainAxisAlignment: MainAxisAlignment.center,
                          children: [
                            Text(
                              '🚨 ',
                              style: TextStyle(fontSize: 22),
                            ),
                            Text(
                              'NEW EMERGENCY REQUEST',
                              style: TextStyle(
                                color: AppColors.emergencyRed,
                                fontSize: 18,
                                fontWeight: FontWeight.w900,
                                letterSpacing: 1.5,
                              ),
                            ),
                          ],
                        ),
                        const SizedBox(height: 6),
                        Text(
                          'Request ID: ${assignment.requestId}',
                          style: const TextStyle(
                            color: AppColors.textSecondary,
                            fontSize: 13,
                            fontWeight: FontWeight.w700,
                            letterSpacing: 1.0,
                          ),
                        ),
                      ],
                    ),
                  );
                },
              ),

              // Timeout Banner if triggered
              if (_timeoutBanner != null) ...[
                Container(
                  width: double.infinity,
                  color: AppColors.warningOrange.withValues(alpha: 0.2),
                  padding: const EdgeInsets.symmetric(vertical: 8, horizontal: 16),
                  child: Text(
                    _timeoutBanner!,
                    textAlign: TextAlign.center,
                    style: const TextStyle(
                      color: AppColors.warningOrange,
                      fontSize: 12,
                      fontWeight: FontWeight.w700,
                    ),
                  ),
                ),
              ],

              // Central Countdown Dial & Emergency Specs
              Expanded(
                child: SingleChildScrollView(
                  padding: const EdgeInsets.all(24),
                  child: Column(
                    children: [
                      // 10-Second Response Countdown Timer Widget
                      Stack(
                        alignment: Alignment.center,
                        children: [
                          SizedBox(
                            width: 120,
                            height: 120,
                            child: CircularProgressIndicator(
                              value: progressFraction,
                              strokeWidth: 8,
                              backgroundColor: AppColors.surfaceElevated,
                              valueColor: AlwaysStoppedAnimation<Color>(
                                _remainingSeconds > 3
                                    ? AppColors.tacticalCyan
                                    : AppColors.emergencyRed,
                              ),
                            ),
                          ),
                          Column(
                            mainAxisSize: MainAxisSize.min,
                            children: [
                              Text(
                                '$_remainingSeconds',
                                style: TextStyle(
                                  color: _remainingSeconds > 3
                                      ? AppColors.textPrimary
                                      : AppColors.emergencyRed,
                                  fontSize: 38,
                                  fontWeight: FontWeight.w900,
                                ),
                              ),
                              const Text(
                                'SECONDS',
                                style: TextStyle(
                                  color: AppColors.textMuted,
                                  fontSize: 10,
                                  fontWeight: FontWeight.w700,
                                  letterSpacing: 0.8,
                                ),
                              ),
                            ],
                          ),
                        ],
                      ),
                      const SizedBox(height: 8),
                      const Text(
                        'Respond before timeout to dispatch ambulance',
                        style: TextStyle(color: AppColors.textMuted, fontSize: 12),
                      ),
                      const SizedBox(height: 24),

                      // Emergency Information Card (Checklist Section 3 & 14 Specs)
                      Container(
                        padding: const EdgeInsets.all(18),
                        decoration: BoxDecoration(
                          color: AppColors.surface,
                          borderRadius: BorderRadius.circular(16),
                          border: Border.all(color: AppColors.cardBorder),
                        ),
                        child: Column(
                          children: [
                            _specRow(
                              icon: Icons.medical_services,
                              iconColor: AppColors.emergencyRed,
                              label: 'Emergency Type',
                              value: emergency.emergencyType,
                              isPrimary: true,
                            ),
                            const Divider(height: 20),
                            _specRow(
                              icon: Icons.people,
                              iconColor: AppColors.tacticalCyan,
                              label: 'Victim Count',
                              value: '${emergency.victimCount} ${emergency.victimCount == 1 ? "Person" : "Persons"}',
                            ),
                            const Divider(height: 20),
                            _specRow(
                              icon: Icons.location_on,
                              iconColor: AppColors.warningOrange,
                              label: 'Pickup Location & Coordinates',
                              value: '${emergency.pickupLocationName}\n(${emergency.pickupLocation.latitude.toStringAsFixed(4)}, ${emergency.pickupLocation.longitude.toStringAsFixed(4)})',
                            ),
                            const Divider(height: 20),
                            _specRow(
                              icon: Icons.timer,
                              iconColor: AppColors.statusAvailable,
                              label: 'Estimated Arrival (ETA)',
                              value: '${assignment.estimatedETA} minutes (${assignment.distanceKm} km)',
                            ),
                            const Divider(height: 20),
                            _specRow(
                              icon: Icons.alt_route,
                              iconColor: AppColors.tacticalCyan,
                              label: 'Dispatch Sequence',
                              value: assignment.attemptNumber > 1
                                  ? 'Attempt #${assignment.attemptNumber} (Fallback Reassigned to ${assignment.ambulanceId})'
                                  : 'Attempt #${assignment.attemptNumber} • Assigned to ${assignment.ambulanceId}',
                            ),
                            if (emergency.callerNotes != null) ...[
                              const Divider(height: 20),
                              _specRow(
                                icon: Icons.notes,
                                iconColor: AppColors.textSecondary,
                                label: 'Caller Notes',
                                value: emergency.callerNotes!,
                              ),
                            ],
                          ],
                        ),
                      ),
                    ],
                  ),
                ),
              ),

              // Bottom Action Bar: ACCEPT (Green) vs REJECT (Red)
              Container(
                padding: const EdgeInsets.all(20),
                decoration: const BoxDecoration(
                  color: AppColors.surface,
                  border: Border(top: BorderSide(color: AppColors.cardBorder)),
                ),
                child: Row(
                  children: [
                    // REJECT Button
                    Expanded(
                      flex: 1,
                      child: OutlinedButton(
                        style: OutlinedButton.styleFrom(
                          minimumSize: Size.zero,
                          tapTargetSize: MaterialTapTargetSize.shrinkWrap,
                          foregroundColor: AppColors.emergencyRed,
                          side: const BorderSide(color: AppColors.emergencyRed, width: 1.5),
                          padding: const EdgeInsets.symmetric(vertical: 16),
                        ),
                        onPressed: (_isResponding || _remainingSeconds == 0)
                            ? null
                            : _handleReject,
                        child: _isResponding
                            ? const Text(
                                'DECLINING...',
                                style: TextStyle(
                                  fontWeight: FontWeight.w800,
                                  letterSpacing: 0.8,
                                ),
                              )
                            : const Text(
                                'REJECT',
                                style: TextStyle(
                                  fontWeight: FontWeight.w800,
                                  letterSpacing: 1.0,
                                ),
                              ),
                      ),
                    ),
                    const SizedBox(width: 16),
                    // ACCEPT Button
                    Expanded(
                      flex: 2,
                      child: ElevatedButton(
                        style: ElevatedButton.styleFrom(
                          minimumSize: Size.zero,
                          tapTargetSize: MaterialTapTargetSize.shrinkWrap,
                          backgroundColor: AppColors.statusAvailable,
                          foregroundColor: Colors.white,
                          padding: const EdgeInsets.symmetric(vertical: 16),
                        ),
                        onPressed: (_isResponding || _remainingSeconds == 0)
                            ? null
                            : _handleAccept,
                        child: _isResponding && _remainingSeconds > 0
                            ? const Row(
                                mainAxisAlignment: MainAxisAlignment.center,
                                children: [
                                  SizedBox(
                                    width: 18,
                                    height: 18,
                                    child: CircularProgressIndicator(
                                      color: Colors.white,
                                      strokeWidth: 2.2,
                                    ),
                                  ),
                                  SizedBox(width: 10),
                                  Text(
                                    'PROCESSING...',
                                    style: TextStyle(
                                      fontWeight: FontWeight.w800,
                                      letterSpacing: 0.8,
                                    ),
                                  ),
                                ],
                              )
                            : const Row(
                                mainAxisAlignment: MainAxisAlignment.center,
                                children: [
                                  Icon(Icons.check_circle, size: 20),
                                  SizedBox(width: 8),
                                  Text(
                                    'ACCEPT ASSIGNMENT',
                                    style: TextStyle(
                                      fontWeight: FontWeight.w800,
                                      letterSpacing: 0.8,
                                    ),
                                  ),
                                ],
                              ),
                      ),
                    ),
                  ],
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }

  Widget _specRow({
    required IconData icon,
    required Color iconColor,
    required String label,
    required String value,
    bool isPrimary = false,
  }) {
    return Row(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Container(
          padding: const EdgeInsets.all(8),
          decoration: BoxDecoration(
            color: iconColor.withValues(alpha: 0.12),
            borderRadius: BorderRadius.circular(8),
          ),
          child: Icon(icon, color: iconColor, size: 20),
        ),
        const SizedBox(width: 14),
        Expanded(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(
                label,
                style: const TextStyle(
                  color: AppColors.textMuted,
                  fontSize: 11,
                  fontWeight: FontWeight.w600,
                  letterSpacing: 0.5,
                ),
              ),
              const SizedBox(height: 2),
              Text(
                value,
                style: TextStyle(
                  color: AppColors.textPrimary,
                  fontSize: isPrimary ? 16 : 14,
                  fontWeight: isPrimary ? FontWeight.w800 : FontWeight.w600,
                ),
              ),
            ],
          ),
        ),
      ],
    );
  }
}
