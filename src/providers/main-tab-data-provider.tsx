import {
  collection,
  getDocs,
  onSnapshot,
  orderBy,
  query,
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
  mapCategoryRecord,
  type CategoryRecord,
  type PostRecord,
} from "@/lib/content";
import { firestore } from "@/lib/firebase";
import {
  appendPublishedPostsPage,
  fetchPublishedPostsPageAsync,
  hydrateMainTabCacheAsync,
  persistCategoriesCacheAsync,
  persistPublishedPostsCacheAsync,
  PUBLISHED_POSTS_PAGE_SIZE,
  type PublishedPostsQueryMode,
} from "@/lib/main-tab-data";
import { getRequestErrorMessage } from "@/lib/network";
import { withMinimumRefreshDurationAsync } from "@/lib/refresh-feedback";
import { useNetworkStatus } from "@/providers/network-provider";

type MainTabRefreshResult = {
  categoriesUpdated: boolean;
  postsUpdated: boolean;
};

type MainTabDataContextType = {
  categories: CategoryRecord[];
  publishedPosts: PostRecord[];
  isLoadingCategories: boolean;
  isLoadingPosts: boolean;
  isLoadingMorePosts: boolean;
  hasMorePublishedPosts: boolean;
  isRefreshing: boolean;
  lastCategoriesUpdatedAt: number | null;
  lastPublishedPostsUpdatedAt: number | null;
  categoriesError: string;
  postsError: string;
  refreshMainTabDataAsync: () => Promise<MainTabRefreshResult>;
  loadMorePublishedPostsAsync: () => Promise<void>;
};

const MainTabDataContext = createContext<MainTabDataContextType | undefined>(
  undefined,
);

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
  const [lastCategoriesUpdatedAt, setLastCategoriesUpdatedAt] = useState<number | null>(null);
  const [lastPublishedPostsUpdatedAt, setLastPublishedPostsUpdatedAt] = useState<number | null>(
    null,
  );
  const [categoriesError, setCategoriesError] = useState("");
  const [postsError, setPostsError] = useState("");

  useEffect(() => {
    let isActive = true;

    const hydrateCachedMainTabData = async () => {
      try {
        const {
          categories: cachedCategories,
          publishedPosts: cachedPublishedPosts,
        } = await hydrateMainTabCacheAsync();
        if (!isActive) {
          return;
        }

        if (cachedCategories && !hasReceivedCategoriesSnapshotRef.current) {
          setCategories(cachedCategories);
          setIsLoadingCategories(false);
        }

        if (cachedPublishedPosts && !hasHydratedCachedPostsRef.current) {
          setPublishedPosts(cachedPublishedPosts.slice(0, PUBLISHED_POSTS_PAGE_SIZE));
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
        const refreshedAt = Date.now();

        setCategories(nextCategories);
        setLastCategoriesUpdatedAt(refreshedAt);
        setCategoriesError("");
        setIsLoadingCategories(false);
        void persistCategoriesCacheAsync(nextCategories).catch(() => {});
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
      const refreshedAt = Date.now();
      publishedPostsQueryModeRef.current = page.modeUsed;
      latestPublishedPostCursorRef.current = page.lastDoc ?? null;
      setPublishedPosts(page.posts);
      void persistPublishedPostsCacheAsync(page.posts).catch(() => {});
      setHasMorePublishedPosts(page.hasMore);
      setLastPublishedPostsUpdatedAt(refreshedAt);
      setPostsError("");
      hasHydratedCachedPostsRef.current = true;
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
        const nextPosts = appendPublishedPostsPage(currentPosts, page.posts);
        void persistPublishedPostsCacheAsync(nextPosts).catch(() => {});
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
    if (isRefreshing || isLoadingMorePosts || isFetchingPublishedPostsRef.current) {
      return {
        categoriesUpdated: false,
        postsUpdated: false,
      };
    }

    setIsRefreshing(true);
    try {
      return await withMinimumRefreshDurationAsync(async () => {
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

        let categoriesUpdated = false;
        let postsUpdated = false;

        if (categoriesResult.status === "fulfilled") {
          hasReceivedCategoriesSnapshotRef.current = true;
          const nextCategories = categoriesResult.value.docs.map((item) =>
            mapCategoryRecord(item.id, item.data() as DocumentData),
          );
          const refreshedAt = Date.now();

          setCategories(nextCategories);
          setLastCategoriesUpdatedAt(refreshedAt);
          setCategoriesError("");
          setIsLoadingCategories(false);
          categoriesUpdated = true;
          void persistCategoriesCacheAsync(nextCategories).catch(() => {});
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
          const refreshedAt = Date.now();

          setPublishedPosts(postsResult.value.posts);
          void persistPublishedPostsCacheAsync(postsResult.value.posts).catch(() => {});
          setHasMorePublishedPosts(postsResult.value.hasMore);
          setLastPublishedPostsUpdatedAt(refreshedAt);
          setPostsError("");
          setIsLoadingPosts(false);
          postsUpdated = true;
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

        return {
          categoriesUpdated,
          postsUpdated,
        };
      });
    } finally {
      setIsRefreshing(false);
    }
  }, [isLoadingMorePosts, isRefreshing, refreshConnection]);

  const value = useMemo<MainTabDataContextType>(
    () => ({
      categories,
      publishedPosts,
      isLoadingCategories,
      isLoadingPosts,
      isLoadingMorePosts,
      hasMorePublishedPosts,
      isRefreshing,
      lastCategoriesUpdatedAt,
      lastPublishedPostsUpdatedAt,
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
      lastCategoriesUpdatedAt,
      lastPublishedPostsUpdatedAt,
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
