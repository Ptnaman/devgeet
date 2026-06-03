import { Timestamp, type DocumentData } from "firebase/firestore";

import { getEffectiveUserRole, type UserRole } from "@/lib/access";

export const POSTS_COLLECTION = "posts";
export const CATEGORIES_COLLECTION = "categories";
export const FAVORITES_COLLECTION = "favorites";

export type PostStatus = "draft" | "pending" | "published";

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
  contentHtml?: string;
  sourcePlatform?: string;
  sourceUrl?: string;
  featureImageUrl: string;
  youtubeVideoUrl: string;
  createDate: string;
  uploadDate: string;
  submittedAt: string;
  publishedAt: string;
  approvedAt: string;
  status: PostStatus;
  category: string;
  authorId: string;
  authorRole: UserRole;
  hasAuthorRole: boolean;
  authorUsername: string;
  authorDisplayName: string;
  authorPhotoURL: string;
  createdBy: string;
  createdByEmail: string;
  updatedBy: string;
  updatedByEmail: string;
  approvedBy: string;
  approvedByEmail: string;
  moderationNote: string;
  deletedAt: string;
  deletedBy: string;
  deletedByEmail: string;
};

export const normalizeSearchKeyword = (value: string) =>
  value
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();

export const buildPostSearchIndex = (
  post: Pick<
    PostRecord,
    | "title"
    | "content"
    | "slug"
    | "category"
    | "authorDisplayName"
    | "authorUsername"
    | "createdByEmail"
  >,
) =>
  normalizeSearchKeyword(
    [
      post.title,
      post.content,
      post.slug,
      post.category,
      post.authorDisplayName,
      post.authorUsername,
      post.createdByEmail,
    ]
      .filter(Boolean)
      .join(" "),
  );

export const matchesPostSearch = (
  post: Pick<
    PostRecord,
    | "title"
    | "content"
    | "slug"
    | "category"
    | "authorDisplayName"
    | "authorUsername"
    | "createdByEmail"
  >,
  searchTerm: string,
) => {
  const keyword = normalizeSearchKeyword(searchTerm);
  if (!keyword) {
    return true;
  }

  return buildPostSearchIndex(post).includes(keyword);
};

export const matchesCategorySearch = (
  category: Pick<CategoryRecord, "name" | "slug">,
  searchTerm: string,
) => {
  const keyword = normalizeSearchKeyword(searchTerm);
  if (!keyword) {
    return true;
  }

  return normalizeSearchKeyword([category.name, category.slug].filter(Boolean).join(" ")).includes(
    keyword,
  );
};

export const createSlug = (value: string) =>
  value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");

const HTML_NAMED_ENTITY_MAP: Record<string, string> = {
  amp: "&",
  apos: "'",
  bull: "\u2022",
  copy: "\u00A9",
  gt: ">",
  hellip: "...",
  laquo: "\u00AB",
  ldquo: "\u201C",
  lsquo: "\u2018",
  lt: "<",
  mdash: "\u2014",
  nbsp: " ",
  ndash: "\u2013",
  quot: '"',
  raquo: "\u00BB",
  rdquo: "\u201D",
  reg: "\u00AE",
  rsquo: "\u2019",
  trade: "\u2122",
};

const decodeHtmlEntityCodePoint = (value: number) => {
  if (!Number.isInteger(value) || value < 0 || value > 0x10ffff) {
    return "";
  }

  try {
    return String.fromCodePoint(value);
  } catch {
    return "";
  }
};

const HTML_TAG_PATTERN = /<\/?[a-z][^>]*>/i;

const decodeHtmlEntitiesOnce = (value: string) =>
  value
    .replace(/&#x([0-9a-f]+);?/gi, (match, hexValue: string) => {
      const parsedValue = Number.parseInt(hexValue, 16);
      const decoded = decodeHtmlEntityCodePoint(parsedValue);
      return decoded || match;
    })
    .replace(/&#([0-9]+);?/g, (match, decimalValue: string) => {
      const parsedValue = Number.parseInt(decimalValue, 10);
      const decoded = decodeHtmlEntityCodePoint(parsedValue);
      return decoded || match;
    })
    .replace(/&([a-z][a-z0-9]+);?/gi, (match, entityName: string) => {
      const decoded = HTML_NAMED_ENTITY_MAP[entityName.toLowerCase()];
      return decoded ?? match;
    });

export const decodeHtmlEntities = (value: string) => {
  let currentValue = value;

  for (let pass = 0; pass < 3; pass += 1) {
    const decodedValue = decodeHtmlEntitiesOnce(currentValue);
    if (decodedValue === currentValue) {
      break;
    }
    currentValue = decodedValue;
  }

  return currentValue;
};

export const normalizePostContentText = (value: string) => {
  if (!value.trim()) {
    return "";
  }

  const decoded = decodeHtmlEntities(value)
    .replace(/\u00a0/g, " ")
    .replace(/\u200B/g, "");

  return decoded
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, " ")
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, " ")
    .replace(/<\s*br\s*\/?\s*>/gi, "\n")
    .replace(/<\s*\/\s*(p|div|h[1-6]|li|ul|ol|blockquote|section|article|tr)\s*>/gi, "\n")
    .replace(/<\s*li[^>]*>/gi, "\u2022 ")
    .replace(/<\s*\/\s*td\s*>/gi, " ")
    .replace(/<\s*td[^>]*>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/\r\n?/g, "\n")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n[ \t]+/g, "\n")
    .replace(/[ \t]{2,}/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
};

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
  typeof value === "string"
    ? value.trim().toLowerCase() === "published"
      ? "published"
      : value.trim().toLowerCase() === "pending"
        ? "pending"
        : "draft"
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

export const mapPostRecord = (id: string, data: DocumentData): PostRecord => {
  const rawAuthorRole = typeof data.authorRole === "string" ? data.authorRole.trim() : "";
  const rawTitle = typeof data.title === "string" ? data.title : "";
  const rawContentText = typeof data.content === "string" ? data.content : "";
  const rawContentHtml = typeof data.contentHtml === "string" ? data.contentHtml : "";
  const rawContentSource = rawContentHtml || rawContentText;
  const decodedContentHtml = decodeHtmlEntities(rawContentHtml || rawContentText).trim();
  const normalizedContentHtml = HTML_TAG_PATTERN.test(decodedContentHtml)
    ? decodedContentHtml
    : "";
  const normalizedTitle = decodeHtmlEntities(rawTitle).trim();

  return {
    id,
    slug: typeof data.slug === "string" ? data.slug : "",
    title: normalizedTitle || "Untitled",
    content: normalizePostContentText(rawContentSource),
    contentHtml: normalizedContentHtml,
    featureImageUrl: normalizeHttpUrl(data.featureImageUrl),
    youtubeVideoUrl: normalizeHttpUrl(data.youtubeVideoUrl),
    createDate: toDateString(data.createDate),
    uploadDate: toDateString(data.uploadDate),
    submittedAt: toDateString(data.submittedAt),
    publishedAt: toDateString(data.publishedAt),
    approvedAt: toDateString(data.approvedAt),
    status: parseStatus(data.status),
    category: typeof data.category === "string" && data.category ? data.category : "general",
    authorId:
      typeof data.authorId === "string" && data.authorId
        ? data.authorId
        : typeof data.createdBy === "string"
          ? data.createdBy
          : "",
    authorRole: getEffectiveUserRole(rawAuthorRole),
    hasAuthorRole: Boolean(rawAuthorRole),
    authorUsername: typeof data.authorUsername === "string" ? data.authorUsername : "",
    authorDisplayName:
      typeof data.authorDisplayName === "string" && data.authorDisplayName
        ? data.authorDisplayName
        : typeof data.createdByEmail === "string" && data.createdByEmail
          ? data.createdByEmail
          : "User",
    authorPhotoURL: normalizeHttpUrl(data.authorPhotoURL),
    createdBy: typeof data.createdBy === "string" ? data.createdBy : "",
    createdByEmail: typeof data.createdByEmail === "string" ? data.createdByEmail : "",
    updatedBy: typeof data.updatedBy === "string" ? data.updatedBy : "",
    updatedByEmail: typeof data.updatedByEmail === "string" ? data.updatedByEmail : "",
    approvedBy: typeof data.approvedBy === "string" ? data.approvedBy : "",
    approvedByEmail: typeof data.approvedByEmail === "string" ? data.approvedByEmail : "",
    moderationNote: typeof data.moderationNote === "string" ? data.moderationNote : "",
    deletedAt: toDateString(data.deletedAt),
    deletedBy: typeof data.deletedBy === "string" ? data.deletedBy : "",
    deletedByEmail: typeof data.deletedByEmail === "string" ? data.deletedByEmail : "",
    sourcePlatform: typeof data.sourcePlatform === "string" ? data.sourcePlatform : "",
    sourceUrl: normalizeHttpUrl(data.sourceUrl),
  };
};

export const isPostTrashed = (post: Pick<PostRecord, "deletedAt">) => Boolean(post.deletedAt);

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

const toSortableTime = (value: string) => {
  if (!value) {
    return 0;
  }

  const parsed = new Date(value).getTime();
  return Number.isFinite(parsed) ? parsed : 0;
};

export const sortPostsByRecency = (posts: PostRecord[]) =>
  [...posts].sort((left, right) => {
    const leftTime = toSortableTime(left.publishedAt || left.uploadDate || left.createDate);
    const rightTime = toSortableTime(right.publishedAt || right.uploadDate || right.createDate);
    return rightTime - leftTime;
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

export const getPreviewText = (value: string, maxLength = 18) => {
  const normalizedSource = /[<&]/.test(value) ? normalizePostContentText(value) : value;
  const normalized = normalizedSource.replace(/\s+/g, " ").trim();
  if (!normalized) {
    return "-";
  }

  if (normalized.length <= maxLength) {
    return normalized;
  }

  return `${normalized.slice(0, maxLength)}...`;
};

export const getContentPreviewLines = (value: string, maxLines = 2) => {
  const normalizedSource = /[<&]/.test(value) ? normalizePostContentText(value) : value;
  const normalizedLines = normalizedSource
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

  if (!normalizedLines.length) {
    return "-";
  }

  return normalizedLines.slice(0, maxLines).join("\n");
};
