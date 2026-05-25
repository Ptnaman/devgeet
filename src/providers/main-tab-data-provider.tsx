import LegacyAsyncStorage from "@react-native-async-storage/async-storage";
import {
  collection,
  getDocs,
  onSnapshot,
  orderBy,
  query,
  where,
  type DocumentData,
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
  isPostTrashed,
  mapCategoryRecord,
  mapPostRecord,
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
  isRefreshing: boolean;
  categoriesError: string;
  postsError: string;
  refreshMainTabDataAsync: () => Promise<void>;
};

const MainTabDataContext = createContext<MainTabDataContextType | undefined>(
  undefined,
);
const MAIN_TAB_CATEGORIES_CACHE_KEY = "app:main-tab:categories:v1";
const MAIN_TAB_PUBLISHED_POSTS_CACHE_KEY = "app:main-tab:published-posts:v1";

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

export function MainTabDataProvider({ children }: { children: ReactNode }) {
  const { isConnected } = useNetworkStatus();
  const isConnectedRef = useRef(isConnected);
  const hasReceivedCategoriesSnapshotRef = useRef(false);
  const hasReceivedPostsSnapshotRef = useRef(false);
  const [categories, setCategories] = useState<CategoryRecord[]>([]);
  const [publishedPosts, setPublishedPosts] = useState<PostRecord[]>([]);
  const [isLoadingCategories, setIsLoadingCategories] = useState(true);
  const [isLoadingPosts, setIsLoadingPosts] = useState(true);
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
        if (cachedPublishedPosts && !hasReceivedPostsSnapshotRef.current) {
          setPublishedPosts(sortPostsByRecency(cachedPublishedPosts));
          setIsLoadingPosts(false);
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
    const postsQuery = query(
      collection(firestore, POSTS_COLLECTION),
      where("status", "==", "published"),
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

    const unsubscribePosts = onSnapshot(
      postsQuery,
      (snapshot) => {
        hasReceivedPostsSnapshotRef.current = true;

        const nextPosts = sortPostsByRecency(
          snapshot.docs
            .map((item) => mapPostRecord(item.id, item.data() as DocumentData))
            .filter((post) => post.status === "published" && !isPostTrashed(post)),
        );

        setPublishedPosts(nextPosts);
        setPostsError("");
        setIsLoadingPosts(false);
        void AsyncStorage.setItem(
          MAIN_TAB_PUBLISHED_POSTS_CACHE_KEY,
          JSON.stringify(nextPosts),
        ).catch(() => {});
      },
      (snapshotError) => {
        setPostsError(
          getRequestErrorMessage({
            error: snapshotError,
            isConnected: isConnectedRef.current,
            onlineMessage: "Unable to load posts right now.",
          }),
        );
        setIsLoadingPosts(false);
      },
    );

    return () => {
      unsubscribeCategories();
      unsubscribePosts();
    };
  }, []);

  const refreshMainTabDataAsync = useCallback(async () => {
    setIsRefreshing(true);

    const categoriesQuery = query(
      collection(firestore, CATEGORIES_COLLECTION),
      orderBy("name", "asc"),
    );
    const postsQuery = query(
      collection(firestore, POSTS_COLLECTION),
      where("status", "==", "published"),
    );

    const [categoriesResult, postsResult] = await Promise.allSettled([
      getDocs(categoriesQuery),
      getDocs(postsQuery),
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
      hasReceivedPostsSnapshotRef.current = true;
      const nextPosts = sortPostsByRecency(
        postsResult.value.docs
          .map((item) => mapPostRecord(item.id, item.data() as DocumentData))
          .filter((post) => post.status === "published" && !isPostTrashed(post)),
      );

      setPublishedPosts(nextPosts);
      setPostsError("");
      setIsLoadingPosts(false);
      void AsyncStorage.setItem(
        MAIN_TAB_PUBLISHED_POSTS_CACHE_KEY,
        JSON.stringify(nextPosts),
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
  }, []);

  const value = useMemo<MainTabDataContextType>(
    () => ({
      categories,
      publishedPosts,
      isLoadingCategories,
      isLoadingPosts,
      isRefreshing,
      categoriesError,
      postsError,
      refreshMainTabDataAsync,
    }),
    [
      categories,
      publishedPosts,
      isLoadingCategories,
      isLoadingPosts,
      isRefreshing,
      categoriesError,
      postsError,
      refreshMainTabDataAsync,
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
