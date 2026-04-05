const DEFAULT_ADMIN_EMAILS = ["admin@gmail.com"];

const parseAdminEmails = (rawEmails: string | undefined, fallbackEmails = DEFAULT_ADMIN_EMAILS) => {
  if (!rawEmails?.trim()) {
    return fallbackEmails;
  }

  const parsed = rawEmails
    .split(",")
    .map((value) => value.trim().toLowerCase())
    .filter(Boolean);

  return parsed.length ? parsed : fallbackEmails;
};

const ADMIN_EMAILS = parseAdminEmails(process.env.EXPO_PUBLIC_ADMIN_EMAILS);
const OWNER_EMAILS = parseAdminEmails(
  process.env.EXPO_PUBLIC_OWNER_EMAILS,
  ADMIN_EMAILS.slice(0, 1)
);

export const USER_ROLES = ["user", "author", "admin"] as const;
export type UserRole = (typeof USER_ROLES)[number];

export const ACCOUNT_STATUSES = ["active", "deleted"] as const;
export type AccountStatus = (typeof ACCOUNT_STATUSES)[number];

export const isAdminEmail = (email: string | null | undefined) => {
  if (!email?.trim()) {
    return false;
  }

  return ADMIN_EMAILS.includes(email.trim().toLowerCase());
};

export const isOwnerEmail = (email: string | null | undefined) => {
  if (!email?.trim()) {
    return false;
  }

  return OWNER_EMAILS.includes(email.trim().toLowerCase());
};

export const normalizeUserRole = (value: string | null | undefined): UserRole => {
  const normalizedValue = value?.trim().toLowerCase();

  if (normalizedValue === "admin") {
    return "admin";
  }

  if (normalizedValue === "author") {
    return "author";
  }

  return "user";
};

export const normalizeAccountStatus = (
  value: string | null | undefined
): AccountStatus => (value?.trim().toLowerCase() === "deleted" ? "deleted" : "active");

export const getEffectiveUserRole = (
  role: string | null | undefined,
  email: string | null | undefined
): UserRole => {
  if (isOwnerEmail(email) || isAdminEmail(email)) {
    return "admin";
  }

  return normalizeUserRole(role);
};

export const canManagePosts = (role: UserRole) => role === "admin" || role === "author";

export const canManageUsers = (role: UserRole, email: string | null | undefined) =>
  role === "admin" && isOwnerEmail(email);
