/**
 * Resource Form & Operational Validators
 */

export function validateResourceCounts({ generalBeds, icuBeds, ventilators }) {
  const errors = {};

  const check = (val, fieldName, max = 500) => {
    if (val === '' || val === null || val === undefined) {
      return `${fieldName} is required.`;
    }
    const num = Number(val);
    if (!Number.isInteger(num)) {
      return `${fieldName} must be a whole integer.`;
    }
    if (num < 0) {
      return `${fieldName} cannot be negative.`;
    }
    if (num > max) {
      return `${fieldName} exceeds maximum capacity limit (${max}).`;
    }
    return null;
  };

  const generalErr = check(generalBeds, 'General Beds');
  if (generalErr) errors.generalBeds = generalErr;

  const icuErr = check(icuBeds, 'ICU Beds');
  if (icuErr) errors.icuBeds = icuErr;

  const ventErr = check(ventilators, 'Ventilators');
  if (ventErr) errors.ventilators = ventErr;

  return {
    isValid: Object.keys(errors).length === 0,
    errors,
  };
}
