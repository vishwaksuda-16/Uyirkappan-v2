import 'package:flutter/material.dart';
import '../../../core/constants/app_constants.dart';
import '../../../core/theme/app_colors.dart';
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

  @override
  Widget build(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    final user = widget.authController.currentUser;
    final isAuthenticated = widget.authController.isAuthenticated;

    return Scaffold(
      backgroundColor: isDark ? const Color(0xFF0B0F19) : const Color(0xFFF8FAFC),
      appBar: AppBar(
        backgroundColor: isDark ? const Color(0xFF0F172A) : Colors.white,
        elevation: 0,
        title: const Text(
          'Bystander Login',
          style: TextStyle(
            fontSize: 18,
            fontWeight: FontWeight.w900,
            color: AppColors.emergencyRed,
          ),
        ),
        actions: isAuthenticated
            ? [
                TextButton.icon(
                  onPressed: () async {
                    await widget.authController.logout();
                    setState(() {
                      _statusMessage = 'Logged out successfully.';
                      _isSuccessMessage = true;
                    });
                  },
                  icon: const Icon(Icons.logout_rounded, size: 16, color: AppColors.emergencyRed),
                  label: const Text(
                    'Logout',
                    style: TextStyle(
                      color: AppColors.emergencyRed,
                      fontSize: 12,
                      fontWeight: FontWeight.w800,
                    ),
                  ),
                ),
              ]
            : null,
      ),
      body: Center(
        child: SingleChildScrollView(
          padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 24),
          child: ConstrainedBox(
            constraints: const BoxConstraints(maxWidth: 440),
            child: Column(
              mainAxisSize: MainAxisSize.min,
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                if (isAuthenticated && user != null) ...[
                  Container(
                    padding: const EdgeInsets.all(16),
                    decoration: BoxDecoration(
                      color: const Color(0xFF16A34A).withValues(alpha: 0.1),
                      borderRadius: BorderRadius.circular(18),
                      border: Border.all(color: const Color(0xFF16A34A), width: 1.5),
                    ),
                    child: Row(
                      children: [
                        const Icon(Icons.verified_user_rounded, color: Color(0xFF16A34A), size: 24),
                        const SizedBox(width: 10),
                        Expanded(
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Text(
                                user.name,
                                style: const TextStyle(fontSize: 15, fontWeight: FontWeight.w900),
                              ),
                              const SizedBox(height: 2),
                              Text(
                                user.email,
                                style: const TextStyle(fontSize: 12, color: AppColors.textSecondaryLight),
                              ),
                            ],
                          ),
                        ),
                      ],
                    ),
                  ),
                  const SizedBox(height: 20),
                ],

                Container(
                  padding: const EdgeInsets.all(22),
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
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Center(
                        child: Container(
                          padding: const EdgeInsets.all(14),
                          decoration: BoxDecoration(
                            color: AppColors.emergencyRed.withValues(alpha: 0.12),
                            borderRadius: BorderRadius.circular(18),
                          ),
                          child: const Icon(
                            Icons.health_and_safety_rounded,
                            size: 32,
                            color: AppColors.emergencyRed,
                          ),
                        ),
                      ),
                      const SizedBox(height: 16),
                      Center(
                        child: Text(
                          'Welcome to ${AppConstants.appName}',
                          textAlign: TextAlign.center,
                          style: TextStyle(
                            fontSize: 24,
                            fontWeight: FontWeight.w900,
                            color: isDark ? Colors.white : const Color(0xFF0F172A),
                          ),
                        ),
                      ),
                      const SizedBox(height: 8),
                      const Center(
                        child: Text(
                          'Sign in to continue or create a new bystander account.',
                          textAlign: TextAlign.center,
                          style: TextStyle(
                            fontSize: 13,
                            color: AppColors.textSecondaryLight,
                          ),
                        ),
                      ),
                      const SizedBox(height: 20),
                      TabBar(
                        controller: _tabController,
                        indicatorColor: AppColors.emergencyRed,
                        labelColor: AppColors.emergencyRed,
                        unselectedLabelColor: AppColors.textSecondaryLight,
                        labelStyle: const TextStyle(fontWeight: FontWeight.w800, fontSize: 13),
                        tabs: const [
                          Tab(text: 'Login'),
                          Tab(text: 'Create account'),
                        ],
                      ),
                      const SizedBox(height: 20),
                      SizedBox(
                        height: 330,
                        child: TabBarView(
                          controller: _tabController,
                          children: [
                            SingleChildScrollView(
                              child: Column(
                                crossAxisAlignment: CrossAxisAlignment.stretch,
                                children: [
                                  TextField(
                                    controller: _loginEmailController,
                                    decoration: InputDecoration(
                                      labelText: 'Email',
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
                                      foregroundColor: Colors.white,
                                      padding: const EdgeInsets.symmetric(vertical: 14),
                                      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14)),
                                    ),
                                    child: _isLoading
                                        ? const SizedBox(height: 18, width: 18, child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white))
                                        : const Text('Login', style: TextStyle(fontWeight: FontWeight.w800)),
                                  ),
                                  const SizedBox(height: 12),
                                  Center(
                                    child: TextButton(
                                      onPressed: _isLoading ? null : _handleDemoLogin,
                                      child: const Text('Use demo account'),
                                    ),
                                  ),
                                ],
                              ),
                            ),
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
                                      labelText: 'Email',
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
                                  const SizedBox(height: 14),
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
                                        Text('Bystander', style: TextStyle(fontSize: 12, color: Colors.blue, fontWeight: FontWeight.w700)),
                                      ],
                                    ),
                                  ),
                                  const SizedBox(height: 16),
                                  FilledButton(
                                    onPressed: _isLoading ? null : _handleRegister,
                                    style: FilledButton.styleFrom(
                                      backgroundColor: AppColors.emergencyRed,
                                      foregroundColor: Colors.white,
                                      padding: const EdgeInsets.symmetric(vertical: 14),
                                      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14)),
                                    ),
                                    child: _isLoading
                                        ? const SizedBox(height: 18, width: 18, child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white))
                                        : const Text('Create account', style: TextStyle(fontWeight: FontWeight.w800)),
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
              ],
            ),
          ),
        ),
      ),
    );
  }
}
