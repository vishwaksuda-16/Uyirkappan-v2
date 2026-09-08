import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import '../../../core/constants/app_constants.dart';
import '../../../core/theme/app_colors.dart';
import '../../../data/datasources/adaptive/adaptive_datasources.dart';
import '../../../routing/route_paths.dart';
import '../../controllers/auth_controller.dart';

/// Full-featured Authentication & User Management Screen.
/// Covers Section 1 of Module 1 Verification:
/// - Register: POST /api/auth/register with { name, phone, email, password, role: "BYSTANDER" }
/// - Login: POST /api/auth/login with { email: "bystander@uyirkappan.demo", password: "password123" }
/// - JWT Token storage, active user display, role display, and demo 1-tap testing.
class AuthScreen extends StatefulWidget {
  final AuthController authController;

  const AuthScreen({
    super.key,
    required this.authController,
  });

  @override
  State<AuthScreen> createState() => _AuthScreenState();
}

class _AuthScreenState extends State<AuthScreen> with SingleTickerProviderStateMixin {
  late TabController _tabController;

  // Login form controllers
  final _loginEmailController = TextEditingController(text: 'bystander@uyirkappan.demo');
  final _loginPasswordController = TextEditingController(text: 'password123');

  // Register form controllers
  final _regNameController = TextEditingController(text: 'Demo Bystander');
  final _regPhoneController = TextEditingController(text: '+91 98401 23456');
  final _regEmailController = TextEditingController(text: 'bystander@uyirkappan.demo');
  final _regPasswordController = TextEditingController(text: 'password123');
  bool _isLoading = false;
  bool _obscureLoginPassword = true;
  bool _obscureRegPassword = true;
  String? _statusMessage;
  bool _isSuccessMessage = true;

  @override
  void initState() {
    super.initState();
    _tabController = TabController(length: 2, vsync: this);
  }

  @override
  void dispose() {
    _tabController.dispose();
    _loginEmailController.dispose();
    _loginPasswordController.dispose();
    _regNameController.dispose();
    _regPhoneController.dispose();
    _regEmailController.dispose();
    _regPasswordController.dispose();
    super.dispose();
  }

  Future<void> _handleLogin() async {
    setState(() {
      _isLoading = true;
      _statusMessage = null;
    });

    final success = await widget.authController.login(
      email: _loginEmailController.text.trim(),
      password: _loginPasswordController.text,
    );

    if (!mounted) return;

    setState(() {
      _isLoading = false;
      _isSuccessMessage = success;
      _statusMessage = success
          ? '✅ Logged in successfully! JWT token received and saved.'
          : widget.authController.errorMessage ?? 'Login failed. Check credentials.';
    });
  }

  Future<void> _handleRegister() async {
    setState(() {
      _isLoading = true;
      _statusMessage = null;
    });

    final success = await widget.authController.register(
      name: _regNameController.text.trim(),
      phone: _regPhoneController.text.trim(),
      email: _regEmailController.text.trim(),
      password: _regPasswordController.text,
      role: 'BYSTANDER',
    );

    if (!mounted) return;

    setState(() {
      _isLoading = false;
      _isSuccessMessage = success;
      _statusMessage = success
          ? '✅ Registration complete! Account created with role BYSTANDER and JWT token saved.'
          : widget.authController.errorMessage ?? 'Registration failed.';
    });
  }

  Future<void> _handleDemoLogin() async {
    setState(() {
      _isLoading = true;
      _statusMessage = null;
    });

    final success = await widget.authController.loginDemo();

    if (!mounted) return;

    setState(() {
      _isLoading = false;
      _isSuccessMessage = success;
      _statusMessage = success
          ? '✅ 1-Tap Demo Bystander Verified! Ready for emergency dispatch.'
          : 'Demo login failed.';
    });
  }

  void _proceedToHome() {
    Navigator.pushReplacementNamed(context, RoutePaths.home);
  }

  @override
  Widget build(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    final user = widget.authController.currentUser;
    final token = widget.authController.token;
    final isAuthenticated = widget.authController.isAuthenticated;

    return Scaffold(
      backgroundColor: isDark ? const Color(0xFF0B0F19) : const Color(0xFFF8FAFC),
      appBar: AppBar(
        backgroundColor: isDark ? const Color(0xFF0F172A) : Colors.white,
        elevation: 0,
        title: Row(
          children: [
            Container(
              padding: const EdgeInsets.all(6),
              decoration: BoxDecoration(
                color: AppColors.emergencyRed,
                borderRadius: BorderRadius.circular(10),
              ),
              child: const Icon(Icons.health_and_safety_rounded, color: Colors.white, size: 20),
            ),
            const SizedBox(width: 10),
            const Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  AppConstants.appName,
                  style: TextStyle(fontSize: 16, fontWeight: FontWeight.w900, color: AppColors.emergencyRed),
                ),
                Text(
                  'User Authentication & Management',
                  style: TextStyle(fontSize: 10.5, fontWeight: FontWeight.w600, color: AppColors.textSecondaryLight),
                ),
              ],
            ),
          ],
        ),
        actions: [
          // Backend Mode indicator
          ValueListenableBuilder<bool>(
            valueListenable: useRemoteBackendNotifier,
            builder: (context, useRemote, _) {
              return Padding(
                padding: const EdgeInsets.only(right: 12),
                child: Center(
                  child: FilterChip(
                    label: Text(
                      useRemote ? '⚡ LIVE BACKEND' : '🧪 SIMULATION',
                      style: TextStyle(
                        fontSize: 10.5,
                        fontWeight: FontWeight.w900,
                        color: useRemote ? const Color(0xFF16A34A) : Colors.amber.shade800,
                      ),
                    ),
                    selected: useRemote,
                    onSelected: (val) {
                      useRemoteBackendNotifier.value = val;
                      ScaffoldMessenger.of(context).showSnackBar(
                        SnackBar(
                          duration: const Duration(seconds: 2),
                          content: Text(val ? '⚡ Switched to Live Emergency Network' : '🧪 Switched to Simulation Mode'),
                        ),
                      );
                    },
                    backgroundColor: useRemote ? const Color(0xFFDCFCE7) : Colors.amber.shade50,
                    selectedColor: const Color(0xFFDCFCE7),
                    side: BorderSide(
                      color: useRemote ? const Color(0xFF16A34A) : Colors.amber.shade700,
                    ),
                  ),
                ),
              );
            },
          ),
          IconButton(
            tooltip: 'Skip to Emergency Map',
            icon: const Icon(Icons.close_rounded),
            onPressed: _proceedToHome,
          ),
        ],
      ),
      body: Center(
        child: SingleChildScrollView(
          padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 24),
          child: ConstrainedBox(
            constraints: const BoxConstraints(maxWidth: 520),
            child: Column(
              mainAxisSize: MainAxisSize.min,
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                // Active User Card (if authenticated)
                if (isAuthenticated && user != null) ...[
                  Container(
                    padding: const EdgeInsets.all(18),
                    decoration: BoxDecoration(
                      color: const Color(0xFF16A34A).withValues(alpha: 0.1),
                      borderRadius: BorderRadius.circular(20),
                      border: Border.all(color: const Color(0xFF16A34A), width: 1.5),
                    ),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Row(
                          children: [
                            const Icon(Icons.verified_user_rounded, color: Color(0xFF16A34A), size: 24),
                            const SizedBox(width: 10),
                            Expanded(
                              child: Column(
                                crossAxisAlignment: CrossAxisAlignment.start,
                                children: [
                                  Text(
                                    user.name,
                                    style: const TextStyle(fontSize: 16, fontWeight: FontWeight.w900),
                                  ),
                                  Row(
                                    children: [
                                      Container(
                                        padding: const EdgeInsets.symmetric(horizontal: 7, vertical: 2),
                                        decoration: BoxDecoration(
                                          color: Colors.blue.withValues(alpha: 0.15),
                                          borderRadius: BorderRadius.circular(6),
                                        ),
                                        child: Text(
                                          'ROLE: ${user.role}',
                                          style: const TextStyle(fontSize: 10, fontWeight: FontWeight.w900, color: Colors.blue),
                                        ),
                                      ),
                                      const SizedBox(width: 8),
                                      Text(
                                        user.email,
                                        style: const TextStyle(fontSize: 12, color: AppColors.textSecondaryLight),
                                      ),
                                    ],
                                  ),
                                ],
                              ),
                            ),
                            TextButton.icon(
                              onPressed: () async {
                                await widget.authController.logout();
                                setState(() {
                                  _statusMessage = 'Logged out successfully.';
                                  _isSuccessMessage = true;
                                });
                              },
                              icon: const Icon(Icons.logout_rounded, size: 16, color: AppColors.emergencyRed),
                              label: const Text('LOGOUT', style: TextStyle(color: AppColors.emergencyRed, fontSize: 11, fontWeight: FontWeight.w800)),
                            ),
                          ],
                        ),
                        if (token != null) ...[
                          const SizedBox(height: 12),
                          const Divider(),
                          const SizedBox(height: 8),
                          Row(
                            children: [
                              const Icon(Icons.key_rounded, size: 14, color: AppColors.textSecondaryLight),
                              const SizedBox(width: 6),
                              const Text('Active JWT Bearer Token:', style: TextStyle(fontSize: 11, fontWeight: FontWeight.bold)),
                              const Spacer(),
                              InkWell(
                                onTap: () {
                                  Clipboard.setData(ClipboardData(text: token));
                                  ScaffoldMessenger.of(context).showSnackBar(
                                    const SnackBar(content: Text('JWT token copied to clipboard!')),
                                  );
                                },
                                child: const Row(
                                  children: [
                                    Icon(Icons.copy_rounded, size: 12, color: Colors.blue),
                                    SizedBox(width: 4),
                                    Text('COPY', style: TextStyle(fontSize: 10, fontWeight: FontWeight.bold, color: Colors.blue)),
                                  ],
                                ),
                              ),
                            ],
                          ),
                          const SizedBox(height: 4),
                          Container(
                            padding: const EdgeInsets.all(8),
                            decoration: BoxDecoration(
                              color: isDark ? Colors.black38 : Colors.white70,
                              borderRadius: BorderRadius.circular(8),
                            ),
                            child: Text(
                              token.length > 50 ? '${token.substring(0, 48)}...' : token,
                              style: const TextStyle(fontSize: 10.5, fontFamily: 'monospace'),
                            ),
                          ),
                        ],
                      ],
                    ),
                  ),
                  const SizedBox(height: 20),
                ],

                // 1-Tap Demo Bystander Login Card
                Container(
                  padding: const EdgeInsets.all(18),
                  decoration: BoxDecoration(
                    color: isDark ? const Color(0xFF1E293B) : Colors.white,
                    borderRadius: BorderRadius.circular(20),
                    boxShadow: [
                      BoxShadow(
                        color: Colors.black.withValues(alpha: 0.05),
                        blurRadius: 10,
                        offset: const Offset(0, 4),
                      ),
                    ],
                  ),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      const Row(
                        children: [
                          Icon(Icons.bolt_rounded, color: Colors.amber, size: 22),
                          SizedBox(width: 8),
                          Text(
                            'Quick Verification & Demo Access',
                            style: TextStyle(fontSize: 14, fontWeight: FontWeight.w800),
                          ),
                        ],
                      ),
                      const SizedBox(height: 6),
                      const Text(
                        'Test with verified demo credentials: bystander@uyirkappan.demo / password123 (Role: BYSTANDER)',
                        style: TextStyle(fontSize: 11.5, color: AppColors.textSecondaryLight),
                      ),
                      const SizedBox(height: 14),
                      SizedBox(
                        width: double.infinity,
                        child: FilledButton.icon(
                          onPressed: _isLoading ? null : _handleDemoLogin,
                          icon: const Icon(Icons.flash_on_rounded, size: 18),
                          label: const Text('1-TAP LOGIN AS DEMO BYSTANDER'),
                          style: FilledButton.styleFrom(
                            backgroundColor: const Color(0xFF16A34A),
                            foregroundColor: Colors.white,
                            padding: const EdgeInsets.symmetric(vertical: 14),
                            shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14)),
                          ),
                        ),
                      ),
                    ],
                  ),
                ),

                const SizedBox(height: 20),

                // Main Auth Card with Tabs (Login / Register)
                Container(
                  decoration: BoxDecoration(
                    color: isDark ? const Color(0xFF0F172A) : Colors.white,
                    borderRadius: BorderRadius.circular(24),
                    boxShadow: [
                      BoxShadow(
                        color: Colors.black.withValues(alpha: 0.08),
                        blurRadius: 16,
                        offset: const Offset(0, 6),
                      ),
                    ],
                  ),
                  child: Column(
                    children: [
                      TabBar(
                        controller: _tabController,
                        indicatorColor: AppColors.emergencyRed,
                        labelColor: AppColors.emergencyRed,
                        unselectedLabelColor: AppColors.textSecondaryLight,
                        labelStyle: const TextStyle(fontWeight: FontWeight.w800, fontSize: 13),
                        tabs: const [
                          Tab(text: 'POST /api/auth/login'),
                          Tab(text: 'POST /api/auth/register'),
                        ],
                      ),
                      Padding(
                        padding: const EdgeInsets.all(22),
                        child: SizedBox(
                          height: 330,
                          child: TabBarView(
                            controller: _tabController,
                            children: [
                              // LOGIN TAB
                              Column(
                                crossAxisAlignment: CrossAxisAlignment.stretch,
                                children: [
                                  TextField(
                                    controller: _loginEmailController,
                                    decoration: InputDecoration(
                                      labelText: 'Email Address',
                                      prefixIcon: const Icon(Icons.email_outlined, size: 20),
                                      border: OutlineInputBorder(borderRadius: BorderRadius.circular(12)),
                                    ),
                                  ),
                                  const SizedBox(height: 14),
                                  TextField(
                                    controller: _loginPasswordController,
                                    obscureText: _obscureLoginPassword,
                                    decoration: InputDecoration(
                                      labelText: 'Password',
                                      prefixIcon: const Icon(Icons.lock_outline, size: 20),
                                      suffixIcon: IconButton(
                                        icon: Icon(
                                          _obscureLoginPassword ? Icons.visibility_off_outlined : Icons.visibility_outlined,
                                          size: 20,
                                        ),
                                        onPressed: () {
                                          setState(() => _obscureLoginPassword = !_obscureLoginPassword);
                                        },
                                      ),
                                      border: OutlineInputBorder(borderRadius: BorderRadius.circular(12)),
                                    ),
                                  ),
                                  const SizedBox(height: 18),
                                  FilledButton(
                                    onPressed: _isLoading ? null : _handleLogin,
                                    style: FilledButton.styleFrom(
                                      backgroundColor: AppColors.emergencyRed,
                                      padding: const EdgeInsets.symmetric(vertical: 14),
                                      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14)),
                                    ),
                                    child: _isLoading
                                        ? const SizedBox(height: 18, width: 18, child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white))
                                        : const Text('LOGIN (POST /api/auth/login)', style: TextStyle(fontWeight: FontWeight.w800)),
                                  ),
                                  const Spacer(),
                                  const Text(
                                    'Endpoint: POST /api/auth/login\nPayload: { "email": "...", "password": "..." }\nReturns: JWT Bearer token + UserProfile',
                                    style: TextStyle(fontSize: 10.5, fontFamily: 'monospace', color: AppColors.textSecondaryLight),
                                  ),
                                ],
                              ),

                              // REGISTER TAB
                              SingleChildScrollView(
                                child: Column(
                                  crossAxisAlignment: CrossAxisAlignment.stretch,
                                  children: [
                                    TextField(
                                      controller: _regNameController,
                                      decoration: InputDecoration(
                                        labelText: 'Full Name',
                                        prefixIcon: const Icon(Icons.person_outline, size: 20),
                                        border: OutlineInputBorder(borderRadius: BorderRadius.circular(12)),
                                        isDense: true,
                                      ),
                                    ),
                                    const SizedBox(height: 10),
                                    TextField(
                                      controller: _regPhoneController,
                                      decoration: InputDecoration(
                                        labelText: 'Phone Number',
                                        prefixIcon: const Icon(Icons.phone_outlined, size: 20),
                                        border: OutlineInputBorder(borderRadius: BorderRadius.circular(12)),
                                        isDense: true,
                                      ),
                                    ),
                                    const SizedBox(height: 10),
                                    TextField(
                                      controller: _regEmailController,
                                      decoration: InputDecoration(
                                        labelText: 'Email Address',
                                        prefixIcon: const Icon(Icons.email_outlined, size: 20),
                                        border: OutlineInputBorder(borderRadius: BorderRadius.circular(12)),
                                        isDense: true,
                                      ),
                                    ),
                                    const SizedBox(height: 10),
                                    TextField(
                                      controller: _regPasswordController,
                                      obscureText: _obscureRegPassword,
                                      decoration: InputDecoration(
                                        labelText: 'Password',
                                        prefixIcon: const Icon(Icons.lock_outline, size: 20),
                                        suffixIcon: IconButton(
                                          icon: Icon(
                                            _obscureRegPassword ? Icons.visibility_off_outlined : Icons.visibility_outlined,
                                            size: 20,
                                          ),
                                          onPressed: () {
                                            setState(() => _obscureRegPassword = !_obscureRegPassword);
                                          },
                                        ),
                                        border: OutlineInputBorder(borderRadius: BorderRadius.circular(12)),
                                        isDense: true,
                                      ),
                                    ),
                                    const SizedBox(height: 10),
                                    Container(
                                      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
                                      decoration: BoxDecoration(
                                        color: Colors.blue.withValues(alpha: 0.1),
                                        borderRadius: BorderRadius.circular(8),
                                        border: Border.all(color: Colors.blue.withValues(alpha: 0.3)),
                                      ),
                                      child: const Row(
                                        children: [
                                          Icon(Icons.shield_outlined, size: 16, color: Colors.blue),
                                          SizedBox(width: 8),
                                          Text('Role: ', style: TextStyle(fontWeight: FontWeight.bold, fontSize: 12)),
                                          Text('BYSTANDER (Fixed per spec)', style: TextStyle(fontSize: 12, color: Colors.blue, fontWeight: FontWeight.w700)),
                                        ],
                                      ),
                                    ),
                                    const SizedBox(height: 14),
                                    FilledButton(
                                      onPressed: _isLoading ? null : _handleRegister,
                                      style: FilledButton.styleFrom(
                                        backgroundColor: AppColors.emergencyRed,
                                        padding: const EdgeInsets.symmetric(vertical: 14),
                                        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14)),
                                      ),
                                      child: _isLoading
                                          ? const SizedBox(height: 18, width: 18, child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white))
                                          : const Text('REGISTER (POST /api/auth/register)', style: TextStyle(fontWeight: FontWeight.w800)),
                                    ),
                                  ],
                                ),
                              ),
                            ],
                          ),
                        ),
                      ),
                    ],
                  ),
                ),

                // Status Message Feedback
                if (_statusMessage != null) ...[
                  const SizedBox(height: 16),
                  Container(
                    padding: const EdgeInsets.all(14),
                    decoration: BoxDecoration(
                      color: _isSuccessMessage
                          ? const Color(0xFF16A34A).withValues(alpha: 0.12)
                          : AppColors.emergencyRed.withValues(alpha: 0.12),
                      borderRadius: BorderRadius.circular(14),
                      border: Border.all(
                        color: _isSuccessMessage ? const Color(0xFF16A34A) : AppColors.emergencyRed,
                      ),
                    ),
                    child: Text(
                      _statusMessage!,
                      style: TextStyle(
                        fontSize: 12.5,
                        fontWeight: FontWeight.w700,
                        color: _isSuccessMessage ? const Color(0xFF16A34A) : AppColors.emergencyRed,
                      ),
                    ),
                  ),
                ],

                const SizedBox(height: 24),

                // Primary Next Action: Proceed to Home
                FilledButton.icon(
                  onPressed: _proceedToHome,
                  icon: const Icon(Icons.arrow_forward_rounded, size: 20),
                  label: const Text('CONTINUE TO EMERGENCY MAP & DISPATCH →', style: TextStyle(fontWeight: FontWeight.w900)),
                  style: FilledButton.styleFrom(
                    backgroundColor: AppColors.emergencyRed,
                    foregroundColor: Colors.white,
                    padding: const EdgeInsets.symmetric(vertical: 16),
                    shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
                    elevation: 4,
                  ),
                ),

                const SizedBox(height: 12),

                // Skip / Emergency Helpline
                OutlinedButton.icon(
                  onPressed: _proceedToHome,
                  icon: const Icon(Icons.phone_in_talk_rounded, size: 18, color: AppColors.emergencyRed),
                  label: const Text('DIRECT EMERGENCY WITHOUT LOGIN (CALL 108)', style: TextStyle(color: AppColors.emergencyRed, fontWeight: FontWeight.w800, fontSize: 12)),
                  style: OutlinedButton.styleFrom(
                    padding: const EdgeInsets.symmetric(vertical: 14),
                    side: const BorderSide(color: AppColors.emergencyRed),
                    shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14)),
                  ),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}
