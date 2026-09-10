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
  isPostTrashed,
  mapPostRecord,
  POSTS_COLLECTION,
  sortPostsByRecency,
} from "@/lib/content";
import { firestore } from "@/lib/firebase";

export type CategoryPostsQueryMode = "uploadDate" | "unordered";

const createCategoryPostsQuery = ({
  afterDoc,
  categorySlug,
  mode,
  pageSize,
}: {
  afterDoc?: QueryDocumentSnapshot<DocumentData>;
  categorySlug: string;
  mode: CategoryPostsQueryMode;
  pageSize: number;
}) =>
  mode === "uploadDate"
    ? afterDoc
      ? query(
          collection(firestore, POSTS_COLLECTION),
          where("category", "==", categorySlug),
          where("status", "==", "published"),
          orderBy("uploadDate", "desc"),
          startAfter(afterDoc),
          limit(pageSize),
        )
      : query(
          collection(firestore, POSTS_COLLECTION),
          where("category", "==", categorySlug),
          where("status", "==", "published"),
          orderBy("uploadDate", "desc"),
          limit(pageSize),
        )
    : afterDoc
      ? query(
          collection(firestore, POSTS_COLLECTION),
          where("category", "==", categorySlug),
          where("status", "==", "published"),
          startAfter(afterDoc),
          limit(pageSize),
        )
      : query(
          collection(firestore, POSTS_COLLECTION),
          where("category", "==", categorySlug),
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

const runCategoryPostsPageQueryAsync = async ({
  afterDoc,
  categorySlug,
  mode,
  pageSize,
}: {
  afterDoc?: QueryDocumentSnapshot<DocumentData>;
  categorySlug: string;
  mode: CategoryPostsQueryMode;
  pageSize: number;
}) => {
  const snapshot = await getDocs(
    createCategoryPostsQuery({
      afterDoc,
      categorySlug,
      mode,
      pageSize,
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

export const fetchCategoryPostsPageAsync = async ({
  afterDoc,
  categorySlug,
  pageSize,
  preferredMode,
}: {
  afterDoc?: QueryDocumentSnapshot<DocumentData>;
  categorySlug: string;
  pageSize: number;
  preferredMode: CategoryPostsQueryMode;
}) => {
  const runFallbackQueryAsync = async () => {
    const fallbackPage = await runCategoryPostsPageQueryAsync({
      afterDoc,
      categorySlug,
      mode: "unordered",
      pageSize,
    });

    return {
      ...fallbackPage,
      modeUsed: "unordered" as const,
    };
  };

  try {
    const primaryPage = await runCategoryPostsPageQueryAsync({
      afterDoc,
      categorySlug,
      mode: preferredMode,
      pageSize,
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
