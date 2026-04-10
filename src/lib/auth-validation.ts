export const PASSWORD_MIN_LENGTH = 6;
export const EMAIL_VALIDATION_MESSAGE = "Enter a valid email address.";
export const USERNAME_VALIDATION_MESSAGE =
  "Username must be 3-20 chars and can use letters, numbers, dot, underscore, hyphen.";
export const PASSWORD_VALIDATION_MESSAGE = `Password must be at least ${PASSWORD_MIN_LENGTH} characters.`;

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const USERNAME_PATTERN = /^[a-zA-Z0-9._-]{3,20}$/;

export const normalizeEmailAddress = (value: string) => value.trim().toLowerCase();
export const normalizeUsernameValue = (value: string) => value.trim().toLowerCase();

export const sanitizeUsername = (value: string) =>
  normalizeUsernameValue(value).replace(/[^a-z0-9._-]/g, "").slice(0, 20);

export const isValidEmailAddress = (value: string) =>
  EMAIL_PATTERN.test(normalizeEmailAddress(value));

export const isValidUsername = (value: string) =>
  USERNAME_PATTERN.test(value.trim());

export const validateUsername = (username: string) => {
  if (!isValidUsername(username)) {
    throw new Error(USERNAME_VALIDATION_MESSAGE);
  }
};
