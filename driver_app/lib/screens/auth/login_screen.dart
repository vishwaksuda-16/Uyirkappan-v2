import 'dart:convert';
import 'package:flutter/material.dart';
import 'package:http/http.dart' as http;
import 'package:provider/provider.dart';
import '../../core/constants/app_colors.dart';
import '../../core/constants/app_constants.dart';
import '../../repositories/driver_repository.dart';
import '../../state/auth_state.dart';
import '../../state/driver_state.dart';

class LoginScreen extends StatefulWidget {
  const LoginScreen({super.key});

  @override
  State<LoginScreen> createState() => _LoginScreenState();
}

class _LoginScreenState extends State<LoginScreen> {
  final _formKey = GlobalKey<FormState>();
  final _driverIdController = TextEditingController(text: 'drv0001@uyirkappan.demo');
  final _passwordController = TextEditingController(text: 'password123');
  bool _obscurePassword = true;

  List<PredefinedDriverAccount> _allDrivers = [];
  PredefinedDriverAccount? _selectedDriver;

  @override
  void initState() {
    super.initState();
    _initDriverList();
  }

  void _initDriverList() {
    // 1. Generate full baseline of all 131 drivers from authoritative dataset
    final fallbackList = List.generate(131, (i) {
      final numStr = (i + 1).toString().padLeft(4, '0');
      final dId = 'DRV$numStr';
      final aId = 'AMB$numStr';
      return PredefinedDriverAccount(
        email: '${dId.toLowerCase()}@uyirkappan.demo',
        driverId: dId,
        ambulanceId: aId,
        providerId: 'FLEET',
        name: 'Fleet Driver $numStr',
        phone: '+91 98401 ${numStr.padLeft(5, '0')}',
        defaultPassword: 'password123',
      );
    });

    _allDrivers = fallbackList;
    _selectedDriver = fallbackList.first;

    // 2. Fetch live enriched driver list from backend GET /api/drivers/login-options
    WidgetsBinding.instance.addPostFrameCallback((_) async {
      try {
        final repo = context.read<DriverRepository>();
        final base = repo.config.apiBaseUrl;
        final res = await http.get(Uri.parse('$base/drivers/login-options')).timeout(const Duration(seconds: 4));
        if (res.statusCode == 200) {
          final data = jsonDecode(res.body);
          if (data['drivers'] is List) {
            final list = (data['drivers'] as List).map((d) {
              return PredefinedDriverAccount(
                email: d['email'] ?? '${d['driverId'].toString().toLowerCase()}@uyirkappan.demo',
                driverId: d['driverId'] ?? '',
                ambulanceId: d['ambulanceId'] ?? '',
                providerId: 'FLEET',
                name: d['name'] ?? 'Driver ${d['driverId']}',
                phone: d['phone'] ?? '+91 98401 00000',
                defaultPassword: d['defaultPassword'] ?? 'password123',
              );
            }).toList();
            if (mounted && list.isNotEmpty) {
              setState(() {
                _allDrivers = list;
                _selectedDriver = list.first;
                _driverIdController.text = list.first.email;
              });
            }
          }
        }
      } catch (_) {
        // Backend not ready yet or offline; fallback baseline is active
      }
    });
  }

  @override
  void dispose() {
    _driverIdController.dispose();
    _passwordController.dispose();
    super.dispose();
  }

  Future<void> _handleLogin() async {
    if (!_formKey.currentState!.validate()) return;

    final authState = context.read<AuthState>();
    final driverState = context.read<DriverState>();

    final success = await authState.login(
      _driverIdController.text.trim(),
      _passwordController.text.trim(),
    );

    if (success && mounted) {
      driverState.initializeForDriver(authState.currentDriver!);
      Navigator.pushReplacementNamed(context, '/dashboard');
    }
  }

  void _selectPredefinedAccount(PredefinedDriverAccount account) {
    setState(() {
      _selectedDriver = account;
      _driverIdController.text = account.email;
      _passwordController.text = account.defaultPassword;
    });
  }

  @override
  Widget build(BuildContext context) {
    final authState = context.watch<AuthState>();

    return Scaffold(
      backgroundColor: AppColors.background,
      body: SafeArea(
        child: Center(
          child: SingleChildScrollView(
            padding: const EdgeInsets.symmetric(horizontal: 24, vertical: 32),
            child: Form(
              key: _formKey,
              child: Column(
                mainAxisAlignment: MainAxisAlignment.center,
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  // App Emblem & Brand
                  Center(
                    child: Container(
                      width: 80,
                      height: 80,
                      decoration: BoxDecoration(
                        color: AppColors.surfaceElevated,
                        shape: BoxShape.circle,
                        border: Border.all(color: AppColors.emergencyRed, width: 2.5),
                        boxShadow: [
                          BoxShadow(
                            color: AppColors.emergencyRed.withValues(alpha: 0.35),
                            blurRadius: 20,
                            spreadRadius: 2,
                          ),
                        ],
                      ),
                      child: const Icon(
                        Icons.emergency,
                        color: AppColors.emergencyRed,
                        size: 44,
                      ),
                    ),
                  ),
                  const SizedBox(height: 20),
                  const Text(
                    'UYIRKAPPAN',
                    textAlign: TextAlign.center,
                    style: TextStyle(
                      color: AppColors.textPrimary,
                      fontSize: 26,
                      fontWeight: FontWeight.w900,
                      letterSpacing: 2.5,
                    ),
                  ),
                  const SizedBox(height: 4),
                  const Text(
                    'AMBULANCE DRIVER PORTAL • MODULE 2',
                    textAlign: TextAlign.center,
                    style: TextStyle(
                      color: AppColors.textSecondary,
                      fontSize: 12,
                      fontWeight: FontWeight.w600,
                      letterSpacing: 1.2,
                    ),
                  ),
                  const SizedBox(height: 36),

                  // Error alert
                  if (authState.errorMessage != null) ...[
                    Container(
                      padding: const EdgeInsets.all(12),
                      decoration: BoxDecoration(
                        color: AppColors.emergencyRed.withValues(alpha: 0.15),
                        borderRadius: BorderRadius.circular(10),
                        border: Border.all(color: AppColors.emergencyRed),
                      ),
                      child: Row(
                        children: [
                          const Icon(Icons.error_outline, color: AppColors.emergencyRed),
                          const SizedBox(width: 8),
                          Expanded(
                            child: Text(
                              authState.errorMessage!,
                              style: const TextStyle(
                                color: AppColors.emergencyRed,
                                fontSize: 13,
                              ),
                            ),
                          ),
                        ],
                      ),
                    ),
                    const SizedBox(height: 16),
                  ],

                  // Driver ID or Email field
                  TextFormField(
                    controller: _driverIdController,
                    style: const TextStyle(
                      color: AppColors.textPrimary,
                      fontWeight: FontWeight.w600,
                    ),
                    decoration: const InputDecoration(
                      labelText: 'Email or Driver ID',
                      hintText: 'e.g. driver1@uyirkappan.demo',
                      prefixIcon: Icon(Icons.badge_outlined),
                    ),
                    validator: (v) =>
                        v == null || v.trim().isEmpty ? 'Email or Driver ID is required' : null,
                  ),
                  const SizedBox(height: 16),

                  // Password field
                  TextFormField(
                    controller: _passwordController,
                    obscureText: _obscurePassword,
                    style: const TextStyle(color: AppColors.textPrimary),
                    decoration: InputDecoration(
                      labelText: 'Password',
                      prefixIcon: const Icon(Icons.lock_outline),
                      suffixIcon: IconButton(
                        icon: Icon(
                          _obscurePassword ? Icons.visibility : Icons.visibility_off,
                          color: AppColors.textSecondary,
                        ),
                        onPressed: () =>
                            setState(() => _obscurePassword = !_obscurePassword),
                      ),
                    ),
                    validator: (v) =>
                        v == null || v.trim().isEmpty ? 'Password is required' : null,
                  ),
                  const SizedBox(height: 24),

                  // Login Button
                  SizedBox(
                    width: double.infinity,
                    height: 52,
                    child: ElevatedButton(
                      onPressed: authState.isLoading ? null : _handleLogin,
                      child: authState.isLoading
                          ? const SizedBox(
                              width: 24,
                              height: 24,
                              child: CircularProgressIndicator(
                                strokeWidth: 2.5,
                                color: Colors.white,
                              ),
                            )
                          : const Row(
                              mainAxisAlignment: MainAxisAlignment.center,
                              children: [
                                Icon(Icons.login, size: 20),
                                SizedBox(width: 8),
                                Text('AUTHENTICATE & ENTER SHIFT'),
                              ],
                            ),
                    ),
                  ),
                  const SizedBox(height: 24),

                  // Quick-Select Predefined Accounts (for simulation & evaluator convenience)
                  const Text(
                    'QUICK DEMO ACCOUNTS (FROM DOCUMENTATION)',
                    textAlign: TextAlign.center,
                    style: TextStyle(
                      color: AppColors.textMuted,
                      fontSize: 11,
                      fontWeight: FontWeight.w700,
                      letterSpacing: 1.0,
                    ),
                  ),
                  const SizedBox(height: 12),
                  Wrap(
                    spacing: 8,
                    runSpacing: 8,
                    alignment: WrapAlignment.center,
                    children: AppConstants.predefinedAccounts.map((acc) {
                      final isSelected = _driverIdController.text == acc.email ||
                          _driverIdController.text == acc.driverId;
                      return ActionChip(
                        avatar: Icon(
                          Icons.directions_car,
                          size: 16,
                          color: isSelected ? AppColors.tacticalCyan : AppColors.textSecondary,
                        ),
                        label: Text('${acc.email.split('@').first} (${acc.ambulanceId})'),
                        backgroundColor: isSelected
                            ? AppColors.tacticalCyan.withValues(alpha: 0.15)
                            : AppColors.surfaceElevated,
                        side: BorderSide(
                          color: isSelected ? AppColors.tacticalCyan : AppColors.cardBorder,
                        ),
                        labelStyle: TextStyle(
                          color: isSelected ? AppColors.tacticalCyan : AppColors.textPrimary,
                          fontWeight: isSelected ? FontWeight.w700 : FontWeight.w500,
                          fontSize: 12,
                        ),
                        onPressed: () => _selectPredefinedAccount(acc),
                      );
                    }).toList(),
                  ),
                  const SizedBox(height: 24),

                  // 131-Driver Dataset Selector (Phase 5 & 16)
                  Container(
                    padding: const EdgeInsets.all(14),
                    decoration: BoxDecoration(
                      color: AppColors.surfaceElevated,
                      borderRadius: BorderRadius.circular(12),
                      border: Border.all(color: AppColors.cardBorder),
                    ),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.stretch,
                      children: [
                        Row(
                          children: [
                            const Icon(Icons.dataset_outlined, size: 16, color: AppColors.tacticalCyan),
                            const SizedBox(width: 8),
                            const Text(
                              'DATASET FLEET SELECTOR (131 DRIVERS)',
                              style: TextStyle(
                                color: AppColors.tacticalCyan,
                                fontSize: 11,
                                fontWeight: FontWeight.w800,
                                letterSpacing: 0.8,
                              ),
                            ),
                            const Spacer(),
                            Container(
                              padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                              decoration: BoxDecoration(
                                color: AppColors.tacticalCyan.withValues(alpha: 0.15),
                                borderRadius: BorderRadius.circular(6),
                              ),
                              child: Text(
                                '${_allDrivers.length} Loaded',
                                style: const TextStyle(
                                  color: AppColors.tacticalCyan,
                                  fontSize: 10,
                                  fontWeight: FontWeight.w700,
                                ),
                              ),
                            ),
                          ],
                        ),
                        const SizedBox(height: 10),
                        InkWell(
                          onTap: () => _showDriverPickerModal(context),
                          borderRadius: BorderRadius.circular(8),
                          child: Container(
                            padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
                            decoration: BoxDecoration(
                              color: AppColors.background,
                              borderRadius: BorderRadius.circular(8),
                              border: Border.all(color: AppColors.cardBorder),
                            ),
                            child: Row(
                              children: [
                                const Icon(Icons.badge, color: AppColors.tacticalCyan, size: 20),
                                const SizedBox(width: 10),
                                Expanded(
                                  child: Column(
                                    crossAxisAlignment: CrossAxisAlignment.start,
                                    children: [
                                      Text(
                                        _selectedDriver != null
                                            ? '${_selectedDriver!.name} (${_selectedDriver!.driverId})'
                                            : 'Choose any driver...',
                                        style: const TextStyle(
                                          color: AppColors.textPrimary,
                                          fontWeight: FontWeight.w700,
                                          fontSize: 13,
                                        ),
                                      ),
                                      if (_selectedDriver != null)
                                        Text(
                                          'Assigned Ambulance: ${_selectedDriver!.ambulanceId}',
                                          style: const TextStyle(
                                            color: AppColors.textSecondary,
                                            fontSize: 11,
                                          ),
                                        ),
                                    ],
                                  ),
                                ),
                                const Icon(Icons.arrow_drop_down, color: AppColors.tacticalCyan),
                              ],
                            ),
                          ),
                        ),
                        const SizedBox(height: 10),
                        // Quick demo buttons for key test drivers
                        Wrap(
                          spacing: 6,
                          runSpacing: 6,
                          children: [
                            _buildQuickChip('D001', 0),
                            if (_allDrivers.length >= 50) _buildQuickChip('D050', 49),
                            if (_allDrivers.length >= 131) _buildQuickChip('D131', 130),
                          ],
                        ),
                      ],
                    ),
                  ),
                ],
              ),
            ),
          ),
        ),
      ),
    );
  }

  Widget _buildQuickChip(String label, int index) {
    if (index >= _allDrivers.length) return const SizedBox.shrink();
    final d = _allDrivers[index];
    final isSelected = _selectedDriver?.driverId == d.driverId;
    return ActionChip(
      avatar: Icon(
        Icons.person,
        size: 14,
        color: isSelected ? AppColors.tacticalCyan : AppColors.textSecondary,
      ),
      label: Text('$label (${d.ambulanceId})'),
      backgroundColor: isSelected
          ? AppColors.tacticalCyan.withValues(alpha: 0.15)
          : AppColors.background,
      side: BorderSide(
        color: isSelected ? AppColors.tacticalCyan : AppColors.cardBorder,
      ),
      labelStyle: TextStyle(
        color: isSelected ? AppColors.tacticalCyan : AppColors.textPrimary,
        fontWeight: isSelected ? FontWeight.w700 : FontWeight.w500,
        fontSize: 11,
      ),
      onPressed: () => _selectPredefinedAccount(d),
    );
  }

  void _showDriverPickerModal(BuildContext context) {
    showModalBottomSheet(
      context: context,
      backgroundColor: AppColors.surfaceElevated,
      isScrollControlled: true,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(16)),
      ),
      builder: (ctx) {
        String searchQuery = '';
        return StatefulBuilder(
          builder: (ctx, setModalState) {
            final filtered = _allDrivers.where((d) {
              if (searchQuery.isEmpty) return true;
              final q = searchQuery.toLowerCase();
              return d.name.toLowerCase().contains(q) ||
                  d.driverId.toLowerCase().contains(q) ||
                  d.ambulanceId.toLowerCase().contains(q) ||
                  d.email.toLowerCase().contains(q);
            }).toList();

            return DraggableScrollableSheet(
              initialChildSize: 0.75,
              minChildSize: 0.4,
              maxChildSize: 0.95,
              expand: false,
              builder: (ctx, scrollController) {
                return Padding(
                  padding: const EdgeInsets.all(16),
                  child: Column(
                    children: [
                      Container(
                        width: 40,
                        height: 4,
                        decoration: BoxDecoration(
                          color: AppColors.cardBorder,
                          borderRadius: BorderRadius.circular(2),
                        ),
                      ),
                      const SizedBox(height: 12),
                      Row(
                        children: [
                          const Icon(Icons.badge, color: AppColors.tacticalCyan, size: 20),
                          const SizedBox(width: 8),
                          const Text(
                            'SELECT FLEET DRIVER (131 TOTAL)',
                            style: TextStyle(
                              color: AppColors.textPrimary,
                              fontWeight: FontWeight.w800,
                              fontSize: 14,
                            ),
                          ),
                          const Spacer(),
                          Text(
                            '${filtered.length} found',
                            style: const TextStyle(color: AppColors.textMuted, fontSize: 12),
                          ),
                        ],
                      ),
                      const SizedBox(height: 12),
                      TextField(
                        style: const TextStyle(color: AppColors.textPrimary),
                        decoration: InputDecoration(
                          hintText: 'Search by Driver ID (e.g. DRV0050), Name, or Ambulance ID...',
                          hintStyle: const TextStyle(color: AppColors.textMuted, fontSize: 12),
                          prefixIcon: const Icon(Icons.search, color: AppColors.tacticalCyan),
                          filled: true,
                          fillColor: AppColors.background,
                          border: OutlineInputBorder(
                            borderRadius: BorderRadius.circular(8),
                            borderSide: const BorderSide(color: AppColors.cardBorder),
                          ),
                        ),
                        onChanged: (val) {
                          setModalState(() {
                            searchQuery = val.trim();
                          });
                        },
                      ),
                      const SizedBox(height: 12),
                      Expanded(
                        child: ListView.separated(
                          controller: scrollController,
                          itemCount: filtered.length,
                          separatorBuilder: (_, __) => const Divider(color: AppColors.cardBorder, height: 1),
                          itemBuilder: (ctx, i) {
                            final d = filtered[i];
                            final isSel = _selectedDriver?.driverId == d.driverId;
                            return ListTile(
                              leading: CircleAvatar(
                                backgroundColor: isSel
                                    ? AppColors.tacticalCyan
                                    : AppColors.surfaceElevated,
                                child: Text(
                                  d.driverId.replaceFirst('DRV', '').replaceFirst('0', ''),
                                  style: TextStyle(
                                    color: isSel ? Colors.black : AppColors.textPrimary,
                                    fontSize: 11,
                                    fontWeight: FontWeight.bold,
                                  ),
                                ),
                              ),
                              title: Text(
                                '${d.name} (${d.driverId})',
                                style: TextStyle(
                                  color: isSel ? AppColors.tacticalCyan : AppColors.textPrimary,
                                  fontWeight: FontWeight.w700,
                                  fontSize: 13,
                                ),
                              ),
                              subtitle: Text(
                                'Ambulance: ${d.ambulanceId} • ${d.email}',
                                style: const TextStyle(color: AppColors.textSecondary, fontSize: 11),
                              ),
                              trailing: isSel
                                  ? const Icon(Icons.check_circle, color: AppColors.tacticalCyan)
                                  : null,
                              onTap: () {
                                Navigator.pop(ctx);
                                _selectPredefinedAccount(d);
                              },
                            );
                          },
                        ),
                      ),
                    ],
                  ),
                );
              },
            );
          },
        );
      },
    );
  }
}
