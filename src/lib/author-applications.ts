import { Timestamp, type DocumentData } from "firebase/firestore";

export const AUTHOR_APPLICATIONS_COLLECTION = "authorApplications";

export const AUTHOR_APPLICATION_STATUSES = [
  "pending",
  "approved",
  "rejected",
  "withdrawn",
] as const;
export type AuthorApplicationStatus = (typeof AUTHOR_APPLICATION_STATUSES)[number];

export type AuthorApplicationRecord = {
  uid: string;
  displayName: string;
  email: string;
  username: string;
  bio: string;
  reason: string;
  sampleTopicOrLink: string;
  status: AuthorApplicationStatus;
  requestedAt: string;
  reviewedAt: string;
  reviewedBy: string;
  reviewedByEmail: string;
  rejectionReason: string;
  updatedAt: string;
};

export const AUTHOR_APPLICATION_STATUS_LABELS: Record<AuthorApplicationStatus, string> = {
  pending: "Pending",
  approved: "Approved",
  rejected: "Rejected",
  withdrawn: "Withdrawn",
};

const readStringValue = (value: unknown) => (typeof value === "string" ? value.trim() : "");

const toDateString = (value: unknown) => {
  if (!value) {
    return "";
  }

  if (typeof value === "string") {
    return value;
  }

  if (value instanceof Date) {
    return value.toISOString();
  }

  if (value instanceof Timestamp) {
    return value.toDate().toISOString();
  }

  if (typeof value === "object" && value !== null && "toDate" in value) {
    const maybeTimestamp = value as { toDate?: () => Date };
    const date = maybeTimestamp.toDate?.();

    if (date instanceof Date) {
      return date.toISOString();
    }
  }

  return "";
};

export const normalizeAuthorApplicationStatus = (
  value: unknown,
): AuthorApplicationStatus => {
  const normalizedValue = readStringValue(value).toLowerCase();

  if (normalizedValue === "approved") {
    return "approved";
  }

  if (normalizedValue === "rejected") {
    return "rejected";
  }

  if (normalizedValue === "withdrawn") {
    return "withdrawn";
  }

  return "pending";
};

export const mapAuthorApplicationRecord = (
  id: string,
  data: DocumentData,
): AuthorApplicationRecord => ({
  uid: readStringValue(data?.uid) || id,
  displayName: readStringValue(data?.displayName) || "User",
  email: readStringValue(data?.email),
  username: readStringValue(data?.username),
  bio: readStringValue(data?.bio),
  reason: readStringValue(data?.reason),
  sampleTopicOrLink: readStringValue(data?.sampleTopicOrLink),
  status: normalizeAuthorApplicationStatus(data?.status),
  requestedAt: toDateString(data?.requestedAt),
  reviewedAt: toDateString(data?.reviewedAt),
  reviewedBy: readStringValue(data?.reviewedBy),
  reviewedByEmail: readStringValue(data?.reviewedByEmail),
  rejectionReason: readStringValue(data?.rejectionReason),
  updatedAt: toDateString(data?.updatedAt),
});
