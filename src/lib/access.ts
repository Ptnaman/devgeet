const DEFAULT_ADMIN_EMAILS = ["admin@gmail.com"];

const parseAdminEmails = (rawEmails: string | undefined) => {
  if (!rawEmails?.trim()) {
    return DEFAULT_ADMIN_EMAILS;
  }

  const parsed = rawEmails
    .split(",")
    .map((value) => value.trim().toLowerCase())
    .filter(Boolean);

  return parsed.length ? parsed : DEFAULT_ADMIN_EMAILS;
};

const ADMIN_EMAILS = parseAdminEmails(process.env.EXPO_PUBLIC_ADMIN_EMAILS);

export const isAdminEmail = (email: string | null | undefined) => {
  if (!email?.trim()) {
    return false;
  }

  return ADMIN_EMAILS.includes(email.trim().toLowerCase());
};

