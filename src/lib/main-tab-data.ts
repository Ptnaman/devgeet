import LegacyAsyncStorage from "@react-native-async-storage/async-storage";
import {
  collection,
  getDocs,
  limit,
  orderBy,
  query,
  startAfter,
  where,
  type DocumentData,
  type QueryDocumentSnapshot,
} from "firebase/firestore";

import {
  decodeHtmlEntities,
  isPostTrashed,
  mapPostRecord,
  normalizePostContentText,
  POSTS_COLLECTION,
  sortPostsByRecency,
  type CategoryRecord,
  type PostRecord,
} from "@/lib/content";
import { firestore } from "@/lib/firebase";

type StorageLike = Pick<
  typeof LegacyAsyncStorage,
  "getItem" | "setItem" | "removeItem" | "multiGet" | "multiSet" | "multiRemove"
>;

export const MAIN_TAB_CATEGORIES_CACHE_KEY = "app:main-tab:categories:v1";
export const MAIN_TAB_PUBLISHED_POSTS_CACHE_KEY = "app:main-tab:published-posts:v1";
// Keep initial rendering light; more posts are fetched only after a user action.
export const PUBLISHED_POSTS_PAGE_SIZE = 9;
export const MAX_CACHED_PUBLISHED_POSTS = 200;

export type PublishedPostsQueryMode = "uploadDate" | "unordered";

const resolveStorage = (): StorageLike => {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const sqliteStorageModule = require("expo-sqlite/kv-store") as {
      default?: StorageLike;
    };

    if (sqliteStorageModule.default) {
      return sqliteStorageModule.default;
    }
  } catch {
    // Fallback for runtimes where ExpoSQLite native module is unavailable.
  }

  return LegacyAsyncStorage;
};

const AsyncStorage = resolveStorage();
const isUsingSqliteKvStore = AsyncStorage !== LegacyAsyncStorage;

const isCategoryRecord = (value: unknown): value is CategoryRecord => {
  if (typeof value !== "object" || value === null) {
    return false;
  }

  const item = value as Partial<CategoryRecord>;
  return (
    typeof item.id === "string" &&
    typeof item.name === "string" &&
    typeof item.slug === "string" &&
    typeof item.createDate === "string" &&
    typeof item.uploadDate === "string"
  );
};

const isPostRecord = (value: unknown): value is PostRecord => {
  if (typeof value !== "object" || value === null) {
    return false;
  }

  const item = value as Partial<PostRecord>;
  return (
    typeof item.id === "string" &&
    typeof item.title === "string" &&
    typeof item.content === "string" &&
    typeof item.status === "string" &&
    typeof item.category === "string"
  );
};

const readCachedArray = <T,>(
  rawValue: string | null,
  isItem: (value: unknown) => value is T,
) => {
  if (!rawValue) {
    return undefined;
  }

  try {
    const parsedValue = JSON.parse(rawValue) as unknown;
    if (!Array.isArray(parsedValue)) {
      return [] as T[];
    }

    return parsedValue.filter(isItem);
  } catch {
    return [] as T[];
  }
};

const normalizeCachedPost = (post: PostRecord): PostRecord => {
  const normalizedTitle = decodeHtmlEntities(post.title).trim();
  const rawContentHtml =
    typeof post.contentHtml === "string"
      ? post.contentHtml
      : "";
  const normalizedContentHtml = decodeHtmlEntities(rawContentHtml).trim();

  return {
    ...post,
    title: normalizedTitle || "Untitled",
    content: normalizePostContentText(normalizedContentHtml || post.content),
    contentHtml: normalizedContentHtml,
  };
};

export const dedupePostsById = (posts: PostRecord[]) => {
  const postsById = new Map<string, PostRecord>();

  posts.forEach((post) => {
    postsById.set(post.id, post);
  });

  return Array.from(postsById.values());
};

export const appendPublishedPostsPage = (currentPosts: PostRecord[], pagePosts: PostRecord[]) => {
  const seenIds = new Set(currentPosts.map((post) => post.id));
  const newPosts = pagePosts.filter((post) => {
    if (seenIds.has(post.id)) {
      return false;
    }
    seenIds.add(post.id);
    return true;
  });

  // Keep existing rows in place, including when the query falls back to ID order.
  return newPosts.length ? [...currentPosts, ...newPosts] : currentPosts;
};

const createPublishedPostsQuery = ({
  pageSize,
  afterDoc,
  mode,
}: {
  pageSize: number;
  afterDoc?: QueryDocumentSnapshot<DocumentData>;
  mode: PublishedPostsQueryMode;
}) =>
  mode === "uploadDate"
    ? afterDoc
      ? query(
          collection(firestore, POSTS_COLLECTION),
          where("status", "==", "published"),
          orderBy("uploadDate", "desc"),
          startAfter(afterDoc),
          limit(pageSize),
        )
      : query(
          collection(firestore, POSTS_COLLECTION),
          where("status", "==", "published"),
          orderBy("uploadDate", "desc"),
          limit(pageSize),
        )
    : afterDoc
      ? query(
          collection(firestore, POSTS_COLLECTION),
          where("status", "==", "published"),
          startAfter(afterDoc),
          limit(pageSize),
        )
      : query(
          collection(firestore, POSTS_COLLECTION),
          where("status", "==", "published"),
          limit(pageSize),
        );

const readErrorCode = (error: unknown) =>
  typeof error === "object" &&
  error !== null &&
  "code" in error &&
  typeof (error as { code?: unknown }).code === "string"
    ? (error as { code: string }).code
    : "";

const readErrorMessage = (error: unknown) =>
  error instanceof Error && error.message ? error.message : "";

const isIndexOrSortFieldError = (error: unknown) => {
  const code = readErrorCode(error).toLowerCase();
  const message = readErrorMessage(error).toLowerCase();

  return (
    code.includes("failed-precondition") ||
    message.includes("requires an index") ||
    message.includes("create it here") ||
    message.includes("order by") ||
    message.includes("uploaddate")
  );
};

const runPublishedPostsPageQueryAsync = async ({
  pageSize,
  afterDoc,
  mode,
}: {
  pageSize: number;
  afterDoc?: QueryDocumentSnapshot<DocumentData>;
  mode: PublishedPostsQueryMode;
}) => {
  const snapshot = await getDocs(
    createPublishedPostsQuery({
      pageSize,
      afterDoc,
      mode,
    }),
  );

  const pagePosts = snapshot.docs
    .map((item) => mapPostRecord(item.id, item.data() as DocumentData))
    .filter((post) => post.status === "published" && !isPostTrashed(post));

  return {
    posts: sortPostsByRecency(pagePosts),
    lastDoc: snapshot.docs[snapshot.docs.length - 1],
    hasMore: snapshot.docs.length >= pageSize,
  };
};

export const fetchPublishedPostsPageAsync = async ({
  pageSize,
  afterDoc,
  preferredMode,
}: {
  pageSize: number;
  afterDoc?: QueryDocumentSnapshot<DocumentData>;
  preferredMode: PublishedPostsQueryMode;
}) => {
  const runFallbackQueryAsync = async () => {
    const fallbackPage = await runPublishedPostsPageQueryAsync({
      pageSize,
      afterDoc,
      mode: "unordered",
    });

    return {
      ...fallbackPage,
      modeUsed: "unordered" as const,
    };
  };

  try {
    const primaryPage = await runPublishedPostsPageQueryAsync({
      pageSize,
      afterDoc,
      mode: preferredMode,
    });

    return {
      ...primaryPage,
      modeUsed: preferredMode,
    };
  } catch (error) {
    if (preferredMode === "uploadDate" && isIndexOrSortFieldError(error)) {
      return runFallbackQueryAsync();
    }

    throw error;
  }
};

const readLegacyCacheValueAsync = async (key: string) => {
  if (!isUsingSqliteKvStore) {
    return null;
  }

  return LegacyAsyncStorage.getItem(key);
};

export const hydrateMainTabCacheAsync = async () => {
  const [cachedCategoriesValue, cachedPublishedPostsValue] = await Promise.all([
    AsyncStorage.getItem(MAIN_TAB_CATEGORIES_CACHE_KEY),
    AsyncStorage.getItem(MAIN_TAB_PUBLISHED_POSTS_CACHE_KEY),
  ]);

  let rawCategories = cachedCategoriesValue;
  let rawPublishedPosts = cachedPublishedPostsValue;

  if (isUsingSqliteKvStore && (!rawCategories || !rawPublishedPosts)) {
    const [legacyCategories, legacyPublishedPosts] = await Promise.all([
      readLegacyCacheValueAsync(MAIN_TAB_CATEGORIES_CACHE_KEY),
      readLegacyCacheValueAsync(MAIN_TAB_PUBLISHED_POSTS_CACHE_KEY),
    ]);

    if (!rawCategories && legacyCategories) {
      rawCategories = legacyCategories;
      void AsyncStorage.setItem(MAIN_TAB_CATEGORIES_CACHE_KEY, legacyCategories).catch(() => {});
    }

    if (!rawPublishedPosts && legacyPublishedPosts) {
      rawPublishedPosts = legacyPublishedPosts;
      void AsyncStorage.setItem(
        MAIN_TAB_PUBLISHED_POSTS_CACHE_KEY,
        legacyPublishedPosts,
      ).catch(() => {});
    }
  }

  const cachedCategories = readCachedArray(rawCategories, isCategoryRecord);
  const cachedPublishedPosts = readCachedArray(rawPublishedPosts, isPostRecord);

  return {
    categories: cachedCategories,
    publishedPosts: cachedPublishedPosts
      ? sortPostsByRecency(cachedPublishedPosts.map(normalizeCachedPost))
      : undefined,
  };
};

export const persistCategoriesCacheAsync = async (categories: CategoryRecord[]) => {
  await AsyncStorage.setItem(
    MAIN_TAB_CATEGORIES_CACHE_KEY,
    JSON.stringify(categories),
  );
};

export const persistPublishedPostsCacheAsync = async (posts: PostRecord[]) => {
  await AsyncStorage.setItem(
    MAIN_TAB_PUBLISHED_POSTS_CACHE_KEY,
    JSON.stringify(posts.slice(0, MAX_CACHED_PUBLISHED_POSTS)),
  );
};
