import { Timestamp, type DocumentData } from "firebase/firestore";

export const AUTHOR_FOLLOWS_COLLECTION = "authorFollows";

export type AuthorFollowRecord = {
  id: string;
  uid: string;
  userEmail: string;
  authorId: string;
  authorUsername: string;
  authorDisplayName: string;
  createDate: string;
  uploadDate: string;
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

export const mapAuthorFollowRecord = (
  id: string,
  data: DocumentData,
): AuthorFollowRecord => ({
  id,
  uid: readStringValue(data?.uid),
  userEmail: readStringValue(data?.userEmail),
  authorId: readStringValue(data?.authorId),
  authorUsername: readStringValue(data?.authorUsername),
  authorDisplayName: readStringValue(data?.authorDisplayName),
  createDate: toDateString(data?.createDate),
  uploadDate: toDateString(data?.uploadDate),
});
