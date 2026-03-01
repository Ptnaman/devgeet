import { Timestamp, type DocumentData } from "firebase/firestore";

export const POSTS_COLLECTION = "posts";
export const CATEGORIES_COLLECTION = "categories";

export type PostStatus = "draft" | "published";

export type CategoryRecord = {
  id: string;
  name: string;
  slug: string;
  createDate: string;
  uploadDate: string;
};

export type PostRecord = {
  id: string;
  slug: string;
  title: string;
  content: string;
  createDate: string;
  uploadDate: string;
  status: PostStatus;
  category: string;
};

export const createSlug = (value: string) =>
  value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");

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

const parseStatus = (value: unknown): PostStatus =>
  typeof value === "string" && value.toLowerCase() === "published"
    ? "published"
    : "draft";

export const mapCategoryRecord = (id: string, data: DocumentData): CategoryRecord => ({
  id,
  name: typeof data.name === "string" ? data.name : "Unnamed Category",
  slug: typeof data.slug === "string" && data.slug ? data.slug : id,
  createDate: toDateString(data.createDate),
  uploadDate: toDateString(data.uploadDate),
});

export const mapPostRecord = (id: string, data: DocumentData): PostRecord => ({
  id,
  slug: typeof data.slug === "string" ? data.slug : "",
  title: typeof data.title === "string" ? data.title : "Untitled",
  content: typeof data.content === "string" ? data.content : "",
  createDate: toDateString(data.createDate),
  uploadDate: toDateString(data.uploadDate),
  status: parseStatus(data.status),
  category: typeof data.category === "string" && data.category ? data.category : "general",
});

export const formatDate = (value: string) => {
  if (!value) {
    return "-";
  }

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return value;
  }

  return parsed.toLocaleDateString(undefined, {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
};
