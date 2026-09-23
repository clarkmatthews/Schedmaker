const COMPLETE_PHONE = /^\(\d{3}\) \d{3}-\d{4}$/;

export function formatPhoneInput(raw: string): string {
  let digits = raw.replace(/\D/g, "");
  if (digits.length === 11 && digits.startsWith("1")) digits = digits.slice(1);
  digits = digits.slice(0, 10);
  if (digits.length === 0) return "";
  if (digits.length < 4) return `(${digits}`;
  if (digits.length < 7) return `(${digits.slice(0, 3)}) ${digits.slice(3)}`;
  return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`;
}

export function displayPhone(raw: string | null | undefined): string {
  if (!raw) return "";
  const formatted = formatPhoneInput(raw);
  return COMPLETE_PHONE.test(formatted) ? formatted : raw;
}

export function readPhone(raw: string): { value: string | null; error: string | null } {
  const trimmed = raw.trim();
  if (!trimmed) return { value: null, error: null };
  const formatted = formatPhoneInput(trimmed);
  if (!COMPLETE_PHONE.test(formatted)) {
    return { value: null, error: "Enter a phone number as (555) 555-0100." };
  }
  return { value: formatted, error: null };
}

export function phoneToE164(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const formatted = formatPhoneInput(raw);
  if (!COMPLETE_PHONE.test(formatted)) return null;
  return `+1${formatted.replace(/\D/g, "")}`;
}
