import {
  collection,
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

type MainTabDataContextType = {
  categories: CategoryRecord[];
  publishedPosts: PostRecord[];
  isLoadingCategories: boolean;
  isLoadingPosts: boolean;
  categoriesError: string;
  postsError: string;
};

const MainTabDataContext = createContext<MainTabDataContextType | undefined>(
  undefined,
);

export function MainTabDataProvider({ children }: { children: ReactNode }) {
  const { isConnected } = useNetworkStatus();
  const [categories, setCategories] = useState<CategoryRecord[]>([]);
  const [publishedPosts, setPublishedPosts] = useState<PostRecord[]>([]);
  const [isLoadingCategories, setIsLoadingCategories] = useState(true);
  const [isLoadingPosts, setIsLoadingPosts] = useState(true);
  const [categoriesError, setCategoriesError] = useState("");
  const [postsError, setPostsError] = useState("");

  useEffect(() => {
    setIsLoadingCategories(true);
    setIsLoadingPosts(true);

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
        const nextCategories = snapshot.docs.map((item) =>
          mapCategoryRecord(item.id, item.data() as DocumentData),
        );

        setCategories(nextCategories);
        setCategoriesError("");
        setIsLoadingCategories(false);
      },
      (snapshotError) => {
        setCategoriesError(
          getRequestErrorMessage({
            error: snapshotError,
            isConnected,
            onlineMessage: "Unable to load categories.",
          }),
        );
        setIsLoadingCategories(false);
      },
    );

    const unsubscribePosts = onSnapshot(
      postsQuery,
      (snapshot) => {
        const nextPosts = sortPostsByRecency(
          snapshot.docs
            .map((item) => mapPostRecord(item.id, item.data() as DocumentData))
            .filter((post) => post.status === "published" && !isPostTrashed(post)),
        );

        setPublishedPosts(nextPosts);
        setPostsError("");
        setIsLoadingPosts(false);
      },
      (snapshotError) => {
        setPostsError(
          getRequestErrorMessage({
            error: snapshotError,
            isConnected,
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
  }, [isConnected]);

  const value = useMemo<MainTabDataContextType>(
    () => ({
      categories,
      publishedPosts,
      isLoadingCategories,
      isLoadingPosts,
      categoriesError,
      postsError,
    }),
    [
      categories,
      publishedPosts,
      isLoadingCategories,
      isLoadingPosts,
      categoriesError,
      postsError,
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
