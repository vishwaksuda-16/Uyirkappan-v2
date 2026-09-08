import { FallbackService } from "./fallback.service.js";

const fallbackService =
  new FallbackService();

const requestId = "REQ001";

console.log(
  "=== FALLBACK SERVICE TEST ==="
);

// Attempt 1
const attempt =
  fallbackService.recordAttempt(
    requestId,
    "A3"
  );

console.log(
  "\nAssignment attempt:"
);

console.log(attempt);

// A3 rejects
const response =
  fallbackService.recordResponse(
    requestId,
    "A3",
    "REJECTED",
    "Driver rejected assignment"
  );

console.log(
  "\nAfter rejection:"
);

console.log(response);

// Get excluded ambulances
const excluded =
  fallbackService.getExcludedAmbulances(
    requestId
  );

console.log(
  "\nExcluded ambulances:"
);

console.log(
  Array.from(excluded)
);

// Get attempt history
const attempts =
  fallbackService.getAttempts(
    requestId
  );

console.log(
  "\nAttempt history:"
);

console.log(attempts);

console.log(
  "\n=== Test completed ==="
);