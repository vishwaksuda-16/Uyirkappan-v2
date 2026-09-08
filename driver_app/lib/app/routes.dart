import 'package:flutter/material.dart';
import '../screens/auth/login_screen.dart';
import '../screens/dashboard/dashboard_screen.dart';
import '../screens/navigation/active_navigation_screen.dart';
import '../screens/profile/driver_profile_screen.dart';

class AppRoutes {
  AppRoutes._();

  static const String login = '/login';
  static const String dashboard = '/dashboard';
  static const String navigation = '/navigation';
  static const String profile = '/profile';

  static Map<String, WidgetBuilder> get routes => {
        login: (context) => const LoginScreen(),
        dashboard: (context) => const DashboardScreen(),
        navigation: (context) => const ActiveNavigationScreen(),
        profile: (context) => const DriverProfileScreen(),
      };
}
