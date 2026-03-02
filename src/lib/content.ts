import { Timestamp, type DocumentData } from "firebase/firestore";

export const POSTS_COLLECTION = "posts";
export const CATEGORIES_COLLECTION = "categories";
export const FAVORITES_COLLECTION = "favorites";

export type PostStatus = "draft" | "published";

export type CategoryRecord = {
  id: string;
  name: string;
  slug: string;
  createDate: string;
  uploadDate: string;
};

export type FavoriteRecord = {
  id: string;
  uid: string;
  postId: string;
  createDate: string;
  uploadDate: string;
};

export type PostRecord = {
  id: string;
  slug: string;
  title: string;
  content: string;
  featureImageUrl: string;
  youtubeVideoUrl: string;
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

const normalizeHttpUrl = (value: unknown) => {
  if (typeof value !== "string") {
    return "";
  }

  const normalized = value.trim();
  if (!normalized) {
    return "";
  }

  if (typeof URL !== "function") {
    return /^https?:\/\/\S+$/i.test(normalized) ? normalized : "";
  }

  try {
    const parsed = new URL(normalized);
    if (parsed.protocol === "http:" || parsed.protocol === "https:") {
      return parsed.toString();
    }
  } catch {
    return "";
  }

  return "";
};

const YOUTUBE_ID_PATTERN = /^[a-zA-Z0-9_-]{11}$/;

export const getYouTubeVideoId = (value: string) => {
  const normalized = value.trim();
  if (!normalized) {
    return "";
  }

  if (typeof URL !== "function") {
    const fallbackMatch = normalized.match(
      /(?:youtube\.com\/(?:watch\?v=|embed\/|shorts\/|live\/)|youtu\.be\/)([a-zA-Z0-9_-]{11})/,
    );
    return fallbackMatch?.[1] ?? "";
  }

  try {
    const parsed = new URL(normalized);
    const host = parsed.hostname.replace(/^www\./, "").toLowerCase();

    if (host === "youtu.be") {
      const maybeId = parsed.pathname.split("/").filter(Boolean)[0] ?? "";
      return YOUTUBE_ID_PATTERN.test(maybeId) ? maybeId : "";
    }

    if (
      host === "youtube.com" ||
      host === "m.youtube.com" ||
      host === "music.youtube.com" ||
      host === "youtube-nocookie.com"
    ) {
      if (parsed.pathname === "/watch") {
        const maybeId = parsed.searchParams.get("v") ?? "";
        return YOUTUBE_ID_PATTERN.test(maybeId) ? maybeId : "";
      }

      const pathSegments = parsed.pathname.split("/").filter(Boolean);
      const maybeEmbeddedId =
        (pathSegments[0] === "embed" ||
          pathSegments[0] === "shorts" ||
          pathSegments[0] === "live") &&
        pathSegments[1]
          ? pathSegments[1]
          : "";

      return YOUTUBE_ID_PATTERN.test(maybeEmbeddedId) ? maybeEmbeddedId : "";
    }
  } catch {
    return "";
  }

  return "";
};

export const isValidOptionalHttpUrl = (value: string) =>
  !value.trim() || Boolean(normalizeHttpUrl(value));

export const mapCategoryRecord = (id: string, data: DocumentData): CategoryRecord => ({
  id,
  name: typeof data.name === "string" ? data.name : "Unnamed Category",
  slug: typeof data.slug === "string" && data.slug ? data.slug : id,
  createDate: toDateString(data.createDate),
  uploadDate: toDateString(data.uploadDate),
});

export const mapFavoriteRecord = (id: string, data: DocumentData): FavoriteRecord => ({
  id,
  uid: typeof data.uid === "string" ? data.uid : "",
  postId: typeof data.postId === "string" ? data.postId : "",
  createDate: toDateString(data.createDate),
  uploadDate: toDateString(data.uploadDate),
});

export const mapPostRecord = (id: string, data: DocumentData): PostRecord => ({
  id,
  slug: typeof data.slug === "string" ? data.slug : "",
  title: typeof data.title === "string" ? data.title : "Untitled",
  content: typeof data.content === "string" ? data.content : "",
  featureImageUrl: normalizeHttpUrl(data.featureImageUrl),
  youtubeVideoUrl: normalizeHttpUrl(data.youtubeVideoUrl),
  createDate: toDateString(data.createDate),
  uploadDate: toDateString(data.uploadDate),
  status: parseStatus(data.status),
  category: typeof data.category === "string" && data.category ? data.category : "general",
});

export const getYouTubeThumbnailUrl = (youtubeVideoUrl: string) => {
  const videoId = getYouTubeVideoId(youtubeVideoUrl);
  if (!videoId) {
    return "";
  }
  return `https://img.youtube.com/vi/${videoId}/hqdefault.jpg`;
};

export const getPostCardThumbnailUrl = (
  post: Pick<PostRecord, "featureImageUrl" | "youtubeVideoUrl">,
) => {
  if (post.featureImageUrl) {
    return post.featureImageUrl;
  }

  return getYouTubeThumbnailUrl(post.youtubeVideoUrl);
};

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

export const getPreviewText = (value: string, maxLength = 18) => {
  const normalized = value.replace(/\s+/g, " ").trim();
  if (!normalized) {
    return "-";
  }

  if (normalized.length <= maxLength) {
    return normalized;
  }

  return `${normalized.slice(0, maxLength)}...`;
};
