/** Normalize phone to digits-only for DB uniqueness (e.g. 9999999999). */
export function normalizePhone(phone: string): string {
  return phone.replace(/\D/g, "");
}

export function isValidPhone(phone: string): boolean {
  const digits = normalizePhone(phone);
  return digits.length >= 7 && digits.length <= 15;
}
