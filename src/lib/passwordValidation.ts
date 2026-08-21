export interface PasswordRule {
  label: string;
  test: (pw: string) => boolean;
}

export const PASSWORD_RULES: PasswordRule[] = [
  { label: "At least 12 characters", test: (pw) => pw.length >= 12 },
  { label: "Uppercase letter", test: (pw) => /[A-Z]/.test(pw) },
  { label: "Lowercase letter", test: (pw) => /[a-z]/.test(pw) },
  { label: "Number", test: (pw) => /[0-9]/.test(pw) },
  { label: "Special character (!@#$...)", test: (pw) => /[^A-Za-z0-9]/.test(pw) },
  { label: "No whitespace at start/end", test: (pw) => pw === pw.trim() },
];

export function getPasswordErrors(pw: string, username?: string): string[] {
  const errors: string[] = [];
  for (const rule of PASSWORD_RULES) {
    if (!rule.test(pw)) errors.push(rule.label);
  }
  if (username && pw.toLowerCase() === username.toLowerCase()) {
    errors.push("Cannot be the same as username");
  }
  return errors;
}

export function isPasswordValid(pw: string, username?: string): boolean {
  return getPasswordErrors(pw, username).length === 0;
}
