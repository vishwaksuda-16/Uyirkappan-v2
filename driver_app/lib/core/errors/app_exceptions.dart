class AppException implements Exception {
  final String message;
  final String? code;

  const AppException(this.message, [this.code]);

  @override
  String toString() => message;
}

class AuthException extends AppException {
  const AuthException(super.message, [super.code]);
}

class UnauthorizedException extends AppException {
  const UnauthorizedException([String message = 'Driver unauthorized to perform this operation.'])
      : super(message, 'UNAUTHORIZED');
}

class InvalidStateTransitionException extends AppException {
  final String fromState;
  final String toState;

  InvalidStateTransitionException(this.fromState, this.toState)
      : super(
          'Invalid state transition: cannot move from $fromState to $toState.',
          'INVALID_STATE_TRANSITION',
        );
}

class NetworkException extends AppException {
  const NetworkException([String message = 'Network connection failed.'])
      : super(message, 'NETWORK_ERROR');
}

class ForbiddenException extends AppException {
  const ForbiddenException([String message = 'Access forbidden: operation not permitted for this ambulance/driver.'])
      : super(message, 'FORBIDDEN');
}

class NotFoundException extends AppException {
  const NotFoundException([String message = 'Requested resource not found.'])
      : super(message, 'NOT_FOUND');
}

class ConflictException extends AppException {
  const ConflictException([String message = 'State conflict: invalid transition or concurrent update.'])
      : super(message, 'CONFLICT');
}

class BadRequestException extends AppException {
  const BadRequestException([String message = 'Invalid request parameters.'])
      : super(message, 'BAD_REQUEST');
}

class AssignmentTimeoutException extends AppException {
  const AssignmentTimeoutException([String message = 'Assignment response window timed out.'])
      : super(message, 'ASSIGNMENT_TIMEOUT');
}
