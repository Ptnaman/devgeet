import LegacyAsyncStorage from "@react-native-async-storage/async-storage";
import {
  collection,
  getDocs,
  limit,
  onSnapshot,
  orderBy,
  startAfter,
  query,
  where,
  type DocumentData,
  type QueryDocumentSnapshot,
} from "firebase/firestore";
import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useCallback,
  useRef,
  useState,
  type ReactNode,
} from "react";

import {
  CATEGORIES_COLLECTION,
  decodeHtmlEntities,
  isPostTrashed,
  mapCategoryRecord,
  mapPostRecord,
  normalizePostContentText,
  POSTS_COLLECTION,
  sortPostsByRecency,
  type CategoryRecord,
  type PostRecord,
} from "@/lib/content";
import { firestore } from "@/lib/firebase";
import { getRequestErrorMessage } from "@/lib/network";
import { useNetworkStatus } from "@/providers/network-provider";

type StorageLike = Pick<
  typeof LegacyAsyncStorage,
  "getItem" | "setItem" | "removeItem" | "multiGet" | "multiSet" | "multiRemove"
>;

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

type MainTabDataContextType = {
  categories: CategoryRecord[];
  publishedPosts: PostRecord[];
  isLoadingCategories: boolean;
  isLoadingPosts: boolean;
  isLoadingMorePosts: boolean;
  hasMorePublishedPosts: boolean;
  isRefreshing: boolean;
  categoriesError: string;
  postsError: string;
  refreshMainTabDataAsync: () => Promise<void>;
  loadMorePublishedPostsAsync: () => Promise<void>;
};

const MainTabDataContext = createContext<MainTabDataContextType | undefined>(
  undefined,
);
const MAIN_TAB_CATEGORIES_CACHE_KEY = "app:main-tab:categories:v1";
const MAIN_TAB_PUBLISHED_POSTS_CACHE_KEY = "app:main-tab:published-posts:v1";
const PUBLISHED_POSTS_PAGE_SIZE = 15;
const MAX_CACHED_PUBLISHED_POSTS = 200;
type PublishedPostsQueryMode = "uploadDate" | "unordered";

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

const dedupePostsById = (posts: PostRecord[]) => {
  const postsById = new Map<string, PostRecord>();

  posts.forEach((post) => {
    postsById.set(post.id, post);
  });

  return Array.from(postsById.values());
};

const mergePublishedPosts = ({
  primaryPosts,
  fallbackPosts,
  pageSize,
}: {
  primaryPosts: PostRecord[];
  fallbackPosts: PostRecord[];
  pageSize: number;
}) =>
  sortPostsByRecency(
    dedupePostsById([...primaryPosts, ...fallbackPosts]),
  ).slice(0, pageSize);

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

const fetchPublishedPostsPageAsync = async ({
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

    if (preferredMode === "uploadDate" && !afterDoc && !primaryPage.posts.length) {
      const fallbackPage = await runFallbackQueryAsync();

      if (fallbackPage.posts.length) {
        return fallbackPage;
      }
    }

    if (
      preferredMode === "uploadDate" &&
      !afterDoc &&
      primaryPage.posts.length > 0 &&
      primaryPage.posts.length < pageSize
    ) {
      const fallbackPage = await runFallbackQueryAsync();

      if (fallbackPage.posts.length) {
        return {
          posts: mergePublishedPosts({
            primaryPosts: primaryPage.posts,
            fallbackPosts: fallbackPage.posts,
            pageSize,
          }),
          lastDoc: primaryPage.lastDoc ?? fallbackPage.lastDoc,
          hasMore: primaryPage.hasMore || fallbackPage.hasMore,
          modeUsed: preferredMode,
        };
      }
    }

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

export function MainTabDataProvider({ children }: { children: ReactNode }) {
  const { isConnected, refreshConnection } = useNetworkStatus();
  const isConnectedRef = useRef(isConnected);
  const previousConnectionStateRef = useRef(isConnected);
  const hasReceivedCategoriesSnapshotRef = useRef(false);
  const hasHydratedCachedPostsRef = useRef(false);
  const latestPublishedPostCursorRef = useRef<QueryDocumentSnapshot<DocumentData> | null>(null);
  const publishedPostsQueryModeRef = useRef<PublishedPostsQueryMode>("uploadDate");
  const isFetchingPublishedPostsRef = useRef(false);
  const [categories, setCategories] = useState<CategoryRecord[]>([]);
  const [publishedPosts, setPublishedPosts] = useState<PostRecord[]>([]);
  const [isLoadingCategories, setIsLoadingCategories] = useState(true);
  const [isLoadingPosts, setIsLoadingPosts] = useState(true);
  const [isLoadingMorePosts, setIsLoadingMorePosts] = useState(false);
  const [hasMorePublishedPosts, setHasMorePublishedPosts] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [categoriesError, setCategoriesError] = useState("");
  const [postsError, setPostsError] = useState("");

  useEffect(() => {
    let isActive = true;

    const hydrateCachedMainTabData = async () => {
      try {
        const [cachedCategoriesFromSqlite, cachedPublishedPostsFromSqlite] = await Promise.all([
          AsyncStorage.getItem(MAIN_TAB_CATEGORIES_CACHE_KEY),
          AsyncStorage.getItem(MAIN_TAB_PUBLISHED_POSTS_CACHE_KEY),
        ]);
        let rawCategories = cachedCategoriesFromSqlite;
        let rawPublishedPosts = cachedPublishedPostsFromSqlite;

        if (isUsingSqliteKvStore && (!rawCategories || !rawPublishedPosts)) {
          const [legacyCategories, legacyPublishedPosts] = await Promise.all([
            LegacyAsyncStorage.getItem(MAIN_TAB_CATEGORIES_CACHE_KEY),
            LegacyAsyncStorage.getItem(MAIN_TAB_PUBLISHED_POSTS_CACHE_KEY),
          ]);

          if (!rawCategories && legacyCategories) {
            rawCategories = legacyCategories;
            void AsyncStorage.setItem(
              MAIN_TAB_CATEGORIES_CACHE_KEY,
              legacyCategories,
            ).catch(() => {});
          }

          if (!rawPublishedPosts && legacyPublishedPosts) {
            rawPublishedPosts = legacyPublishedPosts;
            void AsyncStorage.setItem(
              MAIN_TAB_PUBLISHED_POSTS_CACHE_KEY,
              legacyPublishedPosts,
            ).catch(() => {});
          }
        }

        if (!isActive) {
          return;
        }

        const cachedCategories = readCachedArray(rawCategories, isCategoryRecord);
        if (cachedCategories && !hasReceivedCategoriesSnapshotRef.current) {
          setCategories(cachedCategories);
          setIsLoadingCategories(false);
        }

        const cachedPublishedPosts = readCachedArray(rawPublishedPosts, isPostRecord);
        if (cachedPublishedPosts && !hasHydratedCachedPostsRef.current) {
          const normalizedPosts = sortPostsByRecency(cachedPublishedPosts.map(normalizeCachedPost));
          setPublishedPosts(
            normalizedPosts,
          );
          setHasMorePublishedPosts(cachedPublishedPosts.length >= PUBLISHED_POSTS_PAGE_SIZE);
          setIsLoadingPosts(false);
          hasHydratedCachedPostsRef.current = true;
        }
      } catch {
        // Ignore cache hydration failures and continue with Firestore listeners.
      }
    };

    void hydrateCachedMainTabData();

    return () => {
      isActive = false;
    };
  }, []);

  useEffect(() => {
    isConnectedRef.current = isConnected;
  }, [isConnected]);

  useEffect(() => {
    const categoriesQuery = query(
      collection(firestore, CATEGORIES_COLLECTION),
      orderBy("name", "asc"),
    );
    const unsubscribeCategories = onSnapshot(
      categoriesQuery,
      (snapshot) => {
        hasReceivedCategoriesSnapshotRef.current = true;

        const nextCategories = snapshot.docs.map((item) =>
          mapCategoryRecord(item.id, item.data() as DocumentData),
        );

        setCategories(nextCategories);
        setCategoriesError("");
        setIsLoadingCategories(false);
        void AsyncStorage.setItem(
          MAIN_TAB_CATEGORIES_CACHE_KEY,
          JSON.stringify(nextCategories),
        ).catch(() => {});
      },
      (snapshotError) => {
        setCategoriesError(
          getRequestErrorMessage({
            error: snapshotError,
            isConnected: isConnectedRef.current,
            onlineMessage: "Unable to load categories.",
          }),
        );
        setIsLoadingCategories(false);
      },
    );
    return () => {
      unsubscribeCategories();
    };
  }, []);

  const replacePublishedPostsAsync = useCallback(async () => {
    if (isFetchingPublishedPostsRef.current) {
      return;
    }

    try {
      isFetchingPublishedPostsRef.current = true;
      setIsLoadingPosts(true);

      const page = await fetchPublishedPostsPageAsync({
        pageSize: PUBLISHED_POSTS_PAGE_SIZE,
        preferredMode: publishedPostsQueryModeRef.current,
      });
      publishedPostsQueryModeRef.current = page.modeUsed;
      latestPublishedPostCursorRef.current = page.lastDoc ?? null;
      setPublishedPosts(page.posts);
      setHasMorePublishedPosts(page.hasMore);
      setPostsError("");
      hasHydratedCachedPostsRef.current = true;
      void AsyncStorage.setItem(
        MAIN_TAB_PUBLISHED_POSTS_CACHE_KEY,
        JSON.stringify(page.posts.slice(0, MAX_CACHED_PUBLISHED_POSTS)),
      ).catch(() => {});
    } catch (error) {
      setPostsError(
        getRequestErrorMessage({
          error,
          isConnected: isConnectedRef.current,
          onlineMessage: "Unable to load posts right now.",
        }),
      );
    } finally {
      setIsLoadingPosts(false);
      isFetchingPublishedPostsRef.current = false;
    }
  }, []);

  const loadMorePublishedPostsAsync = useCallback(async () => {
    if (
      isFetchingPublishedPostsRef.current ||
      isLoadingPosts ||
      isLoadingMorePosts ||
      !hasMorePublishedPosts ||
      !latestPublishedPostCursorRef.current
    ) {
      return;
    }

    try {
      isFetchingPublishedPostsRef.current = true;
      setIsLoadingMorePosts(true);

      const page = await fetchPublishedPostsPageAsync({
        pageSize: PUBLISHED_POSTS_PAGE_SIZE,
        afterDoc: latestPublishedPostCursorRef.current,
        preferredMode: publishedPostsQueryModeRef.current,
      });
      publishedPostsQueryModeRef.current = page.modeUsed;
      latestPublishedPostCursorRef.current = page.lastDoc ?? latestPublishedPostCursorRef.current;
      setPublishedPosts((currentPosts) => {
        const nextPosts = sortPostsByRecency(
          dedupePostsById([...currentPosts, ...page.posts]),
        );
        void AsyncStorage.setItem(
          MAIN_TAB_PUBLISHED_POSTS_CACHE_KEY,
          JSON.stringify(nextPosts.slice(0, MAX_CACHED_PUBLISHED_POSTS)),
        ).catch(() => {});
        return nextPosts;
      });
      setHasMorePublishedPosts(page.hasMore);
      setPostsError("");
    } catch (error) {
      setPostsError(
        getRequestErrorMessage({
          error,
          isConnected: isConnectedRef.current,
          onlineMessage: "Unable to load more posts right now.",
        }),
      );
    } finally {
      setIsLoadingMorePosts(false);
      isFetchingPublishedPostsRef.current = false;
    }
  }, [hasMorePublishedPosts, isLoadingMorePosts, isLoadingPosts]);

  useEffect(() => {
    void replacePublishedPostsAsync();
  }, [replacePublishedPostsAsync]);

  useEffect(() => {
    const wasConnected = previousConnectionStateRef.current;
    previousConnectionStateRef.current = isConnected;

    if (wasConnected || !isConnected) {
      return;
    }

    if (isFetchingPublishedPostsRef.current || isLoadingPosts || isRefreshing) {
      return;
    }

    if (!publishedPosts.length || Boolean(postsError)) {
      void replacePublishedPostsAsync();
    }
  }, [
    isConnected,
    isLoadingPosts,
    isRefreshing,
    postsError,
    publishedPosts.length,
    replacePublishedPostsAsync,
  ]);

  const refreshMainTabDataAsync = useCallback(async () => {
    setIsRefreshing(true);
    try {
      const latestConnectionState = await refreshConnection();
      isConnectedRef.current = latestConnectionState;
    } catch {
      // Ignore network status probe failures and continue Firestore refresh attempt.
    }

    const categoriesQuery = query(
      collection(firestore, CATEGORIES_COLLECTION),
      orderBy("name", "asc"),
    );
    const [categoriesResult, postsResult] = await Promise.allSettled([
      getDocs(categoriesQuery),
      fetchPublishedPostsPageAsync({
        pageSize: PUBLISHED_POSTS_PAGE_SIZE,
        preferredMode: publishedPostsQueryModeRef.current,
      }),
    ]);

    if (categoriesResult.status === "fulfilled") {
      hasReceivedCategoriesSnapshotRef.current = true;
      const nextCategories = categoriesResult.value.docs.map((item) =>
        mapCategoryRecord(item.id, item.data() as DocumentData),
      );

      setCategories(nextCategories);
      setCategoriesError("");
      setIsLoadingCategories(false);
      void AsyncStorage.setItem(
        MAIN_TAB_CATEGORIES_CACHE_KEY,
        JSON.stringify(nextCategories),
      ).catch(() => {});
    } else {
      setCategoriesError(
        getRequestErrorMessage({
          error: categoriesResult.reason,
          isConnected: isConnectedRef.current,
          onlineMessage: "Unable to refresh categories.",
        }),
      );
      setIsLoadingCategories(false);
    }

    if (postsResult.status === "fulfilled") {
      hasHydratedCachedPostsRef.current = true;
      publishedPostsQueryModeRef.current = postsResult.value.modeUsed;
      latestPublishedPostCursorRef.current = postsResult.value.lastDoc;
      setPublishedPosts(postsResult.value.posts);
      setHasMorePublishedPosts(postsResult.value.hasMore);
      setPostsError("");
      setIsLoadingPosts(false);
      void AsyncStorage.setItem(
        MAIN_TAB_PUBLISHED_POSTS_CACHE_KEY,
        JSON.stringify(postsResult.value.posts.slice(0, MAX_CACHED_PUBLISHED_POSTS)),
      ).catch(() => {});
    } else {
      setPostsError(
        getRequestErrorMessage({
          error: postsResult.reason,
          isConnected: isConnectedRef.current,
          onlineMessage: "Unable to refresh posts right now.",
        }),
      );
      setIsLoadingPosts(false);
    }

    setIsRefreshing(false);
  }, [refreshConnection]);

  const value = useMemo<MainTabDataContextType>(
    () => ({
      categories,
      publishedPosts,
      isLoadingCategories,
      isLoadingPosts,
      isLoadingMorePosts,
      hasMorePublishedPosts,
      isRefreshing,
      categoriesError,
      postsError,
      refreshMainTabDataAsync,
      loadMorePublishedPostsAsync,
    }),
    [
      categories,
      publishedPosts,
      isLoadingCategories,
      isLoadingPosts,
      isLoadingMorePosts,
      hasMorePublishedPosts,
      isRefreshing,
      categoriesError,
      postsError,
      refreshMainTabDataAsync,
      loadMorePublishedPostsAsync,
    ],
  );

  return (
    <MainTabDataContext.Provider value={value}>
      {children}
    </MainTabDataContext.Provider>
  );
}

export function useMainTabData() {
  const context = useContext(MainTabDataContext);

  if (!context) {
    throw new Error("useMainTabData must be used inside MainTabDataProvider.");
  }

  return context;
}
