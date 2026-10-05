import 'package:flutter/material.dart';
import '../../../core/constants/app_constants.dart';
import '../../../core/theme/app_colors.dart';
import '../../../routing/route_paths.dart';
import '../../controllers/auth_controller.dart';

/// Authentication screen for UyirKappan Bystander App.
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

  // Login form controllers — empty by default
  final _loginEmailController = TextEditingController();
  final _loginPasswordController = TextEditingController();

  // Register form controllers — empty by default
  final _regNameController = TextEditingController();
  final _regPhoneController = TextEditingController();
  final _regEmailController = TextEditingController();
  final _regPasswordController = TextEditingController();
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
    if (_loginEmailController.text.trim().isEmpty || _loginPasswordController.text.isEmpty) {
      setState(() {
        _isSuccessMessage = false;
        _statusMessage = 'Please enter your email and password.';
      });
      return;
    }

    setState(() {
      _isLoading = true;
      _statusMessage = null;
    });

    final success = await widget.authController.login(
      email: _loginEmailController.text.trim(),
      password: _loginPasswordController.text,
    );

    if (!mounted) return;

    if (success) {
      Navigator.pushReplacementNamed(context, RoutePaths.home);
    } else {
      setState(() {
        _isLoading = false;
        _isSuccessMessage = false;
        _statusMessage = widget.authController.errorMessage ?? 'Login failed. Please check your credentials.';
      });
    }
  }

  Future<void> _handleRegister() async {
    if (_regNameController.text.trim().isEmpty ||
        _regEmailController.text.trim().isEmpty ||
        _regPasswordController.text.isEmpty) {
      setState(() {
        _isSuccessMessage = false;
        _statusMessage = 'Please fill in all required fields.';
      });
      return;
    }

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

    if (success) {
      Navigator.pushReplacementNamed(context, RoutePaths.home);
    } else {
      setState(() {
        _isLoading = false;
        _isSuccessMessage = false;
        _statusMessage = widget.authController.errorMessage ?? 'Registration failed.';
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;

    return Scaffold(
      backgroundColor: isDark ? AppColors.backgroundDark : AppColors.backgroundLight,
      body: SafeArea(
        child: Center(
          child: SingleChildScrollView(
            padding: const EdgeInsets.symmetric(horizontal: 24, vertical: 32),
            child: ConstrainedBox(
              constraints: const BoxConstraints(maxWidth: 420),
              child: Column(
                mainAxisSize: MainAxisSize.min,
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  // App Logo & Branding
                  Center(
                    child: Container(
                      width: 72,
                      height: 72,
                      decoration: BoxDecoration(
                        color: AppColors.primary.withValues(alpha: 0.1),
                        shape: BoxShape.circle,
                      ),
                      child: const Icon(
                        Icons.health_and_safety_rounded,
                        size: 36,
                        color: AppColors.primary,
                      ),
                    ),
                  ),
                  const SizedBox(height: 20),
                  Text(
                    AppConstants.appName,
                    textAlign: TextAlign.center,
                    style: TextStyle(
                      fontSize: 28,
                      fontWeight: FontWeight.w800,
                      color: isDark ? Colors.white : AppColors.textPrimaryLight,
                      letterSpacing: -0.5,
                    ),
                  ),
                  const SizedBox(height: 4),
                  Text(
                    'Emergency Response Platform',
                    textAlign: TextAlign.center,
                    style: TextStyle(
                      fontSize: 14,
                      color: isDark ? AppColors.textSecondaryDark : AppColors.textSecondaryLight,
                    ),
                  ),
                  const SizedBox(height: 32),

                  // Auth Card
                  Container(
                    padding: const EdgeInsets.all(24),
                    decoration: BoxDecoration(
                      color: isDark ? AppColors.surfaceDark : Colors.white,
                      borderRadius: BorderRadius.circular(20),
                      border: Border.all(
                        color: isDark ? AppColors.cardBorderDark : AppColors.cardBorderLight,
                      ),
                    ),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.stretch,
                      children: [
                        // Tabs
                        Container(
                          decoration: BoxDecoration(
                            color: isDark ? AppColors.surfaceVariantDark : AppColors.surfaceVariantLight,
                            borderRadius: BorderRadius.circular(10),
                          ),
                          child: TabBar(
                            controller: _tabController,
                            indicator: BoxDecoration(
                              color: AppColors.primary,
                              borderRadius: BorderRadius.circular(10),
                            ),
                            indicatorSize: TabBarIndicatorSize.tab,
                            labelColor: Colors.white,
                            unselectedLabelColor: isDark ? AppColors.textSecondaryDark : AppColors.textSecondaryLight,
                            labelStyle: const TextStyle(fontWeight: FontWeight.w600, fontSize: 14),
                            dividerColor: Colors.transparent,
                            tabs: const [
                              Tab(text: 'Sign In'),
                              Tab(text: 'Register'),
                            ],
                          ),
                        ),
                        const SizedBox(height: 24),

                        // Tab Content
                        SizedBox(
                          height: 300,
                          child: TabBarView(
                            controller: _tabController,
                            children: [
                              // LOGIN TAB
                              SingleChildScrollView(
                                child: Column(
                                  crossAxisAlignment: CrossAxisAlignment.stretch,
                                  children: [
                                    TextField(
                                      controller: _loginEmailController,
                                      keyboardType: TextInputType.emailAddress,
                                      decoration: const InputDecoration(
                                        labelText: 'Email',
                                        hintText: 'Enter your email address',
                                        prefixIcon: Icon(Icons.email_outlined, size: 20),
                                      ),
                                    ),
                                    const SizedBox(height: 16),
                                    TextField(
                                      controller: _loginPasswordController,
                                      obscureText: _obscureLoginPassword,
                                      decoration: InputDecoration(
                                        labelText: 'Password',
                                        hintText: 'Enter your password',
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
                                      ),
                                      onSubmitted: (_) => _handleLogin(),
                                    ),
                                    const SizedBox(height: 24),
                                    FilledButton(
                                      onPressed: _isLoading ? null : _handleLogin,
                                      style: FilledButton.styleFrom(
                                        backgroundColor: AppColors.primary,
                                        foregroundColor: Colors.white,
                                        padding: const EdgeInsets.symmetric(vertical: 16),
                                        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                                      ),
                                      child: _isLoading
                                          ? const SizedBox(height: 20, width: 20, child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white))
                                          : const Text('Sign In', style: TextStyle(fontSize: 16, fontWeight: FontWeight.w600)),
                                    ),
                                  ],
                                ),
                              ),

                              // REGISTER TAB
                              SingleChildScrollView(
                                child: Column(
                                  crossAxisAlignment: CrossAxisAlignment.stretch,
                                  children: [
                                    TextField(
                                      controller: _regNameController,
                                      decoration: const InputDecoration(
                                        labelText: 'Full Name',
                                        hintText: 'Enter your full name',
                                        prefixIcon: Icon(Icons.person_outline, size: 20),
                                      ),
                                    ),
                                    const SizedBox(height: 12),
                                    TextField(
                                      controller: _regPhoneController,
                                      keyboardType: TextInputType.phone,
                                      decoration: const InputDecoration(
                                        labelText: 'Phone Number',
                                        hintText: 'Enter your phone number',
                                        prefixIcon: Icon(Icons.phone_outlined, size: 20),
                                      ),
                                    ),
                                    const SizedBox(height: 12),
                                    TextField(
                                      controller: _regEmailController,
                                      keyboardType: TextInputType.emailAddress,
                                      decoration: const InputDecoration(
                                        labelText: 'Email',
                                        hintText: 'Enter your email',
                                        prefixIcon: Icon(Icons.email_outlined, size: 20),
                                      ),
                                    ),
                                    const SizedBox(height: 12),
                                    TextField(
                                      controller: _regPasswordController,
                                      obscureText: _obscureRegPassword,
                                      decoration: InputDecoration(
                                        labelText: 'Password',
                                        hintText: 'Choose a password',
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
                                      ),
                                      onSubmitted: (_) => _handleRegister(),
                                    ),
                                    const SizedBox(height: 16),
                                    FilledButton(
                                      onPressed: _isLoading ? null : _handleRegister,
                                      style: FilledButton.styleFrom(
                                        backgroundColor: AppColors.primary,
                                        foregroundColor: Colors.white,
                                        padding: const EdgeInsets.symmetric(vertical: 16),
                                        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                                      ),
                                      child: _isLoading
                                          ? const SizedBox(height: 20, width: 20, child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white))
                                          : const Text('Create Account', style: TextStyle(fontSize: 16, fontWeight: FontWeight.w600)),
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

                  // Status message
                  if (_statusMessage != null) ...[
                    const SizedBox(height: 16),
                    Container(
                      padding: const EdgeInsets.all(14),
                      decoration: BoxDecoration(
                        color: _isSuccessMessage
                            ? AppColors.success.withValues(alpha: 0.1)
                            : AppColors.error.withValues(alpha: 0.1),
                        borderRadius: BorderRadius.circular(12),
                        border: Border.all(
                          color: _isSuccessMessage ? AppColors.success : AppColors.error,
                        ),
                      ),
                      child: Row(
                        children: [
                          Icon(
                            _isSuccessMessage ? Icons.check_circle_outline : Icons.error_outline,
                            size: 20,
                            color: _isSuccessMessage ? AppColors.success : AppColors.error,
                          ),
                          const SizedBox(width: 10),
                          Expanded(
                            child: Text(
                              _statusMessage!,
                              style: TextStyle(
                                fontSize: 13,
                                fontWeight: FontWeight.w500,
                                color: _isSuccessMessage ? AppColors.success : AppColors.error,
                              ),
                            ),
                          ),
                        ],
                      ),
                    ),
                  ],
                ],
              ),
            ),
          ),
        ),
      ),
    );
  }
}
