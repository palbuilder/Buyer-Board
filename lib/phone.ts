function onlyDigits(value: string) {
  return value.replace(/\D/g, "");
}

export function normalizeUsPhoneNumber(value: string) {
  const digits = onlyDigits(value);

  if (digits.length === 10) {
    return `+1${digits}`;
  }

  if (digits.length === 11 && digits.startsWith("1")) {
    return `+${digits}`;
  }

  if (value.trim().startsWith("+") && digits.length >= 11) {
    return `+${digits}`;
  }

  return null;
}

export function formatUsPhoneInput(value: string) {
  const digits = onlyDigits(value).slice(0, 10);

  if (digits.length <= 3) {
    return digits;
  }

  if (digits.length <= 6) {
    return `${digits.slice(0, 3)}-${digits.slice(3)}`;
  }

  return `${digits.slice(0, 3)}-${digits.slice(3, 6)}-${digits.slice(6)}`;
}

export function formatStoredUsPhoneNumber(value: string) {
  const digits = onlyDigits(value);
  const nationalDigits = digits.length === 11 && digits.startsWith("1") ? digits.slice(1) : digits;
  return formatUsPhoneInput(nationalDigits);
}
