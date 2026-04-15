export const USER_ROLES = ["user", "author", "admin"] as const;
export type UserRole = (typeof USER_ROLES)[number];

export const ACCOUNT_STATUSES = ["active", "deleted"] as const;
export type AccountStatus = (typeof ACCOUNT_STATUSES)[number];

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

export const getEffectiveUserRole = (role: string | null | undefined): UserRole =>
  normalizeUserRole(role);

export const canManagePosts = (role: UserRole) => role === "admin" || role === "author";

export const canModeratePosts = (role: UserRole) => role === "admin";

export const canManageUsers = (role: UserRole) => role === "admin";
