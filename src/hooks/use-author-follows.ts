import { useCallback, useEffect, useMemo, useState } from "react";
import {
  collection,
  deleteDoc,
  doc,
  onSnapshot,
  query,
  serverTimestamp,
  setDoc,
  where,
  type DocumentData,
} from "firebase/firestore";

import {
  AUTHOR_FOLLOWS_COLLECTION,
  mapAuthorFollowRecord,
  type AuthorFollowRecord,
} from "@/lib/author-follows";
import { firestore } from "@/lib/firebase";
import { DEFAULT_OFFLINE_MESSAGE, getRequestErrorMessage } from "@/lib/network";
import { useAuth } from "@/providers/auth-provider";
import { useNetworkStatus } from "@/providers/network-provider";

type FollowableAuthor = {
  uid: string;
  displayName: string;
  username: string;
};

type AuthorFollowMutationResult = "followed" | "unfollowed";

const createAuthorFollowDocId = (uid: string, authorId: string) => `${uid}_${authorId}`;

const createOptimisticAuthorFollow = (
  uid: string,
  userEmail: string,
  author: FollowableAuthor,
): AuthorFollowRecord => {
  const timestamp = new Date().toISOString();

  return {
    id: createAuthorFollowDocId(uid, author.uid),
    uid,
    userEmail,
    authorId: author.uid,
    authorUsername: author.username,
    authorDisplayName: author.displayName,
    createDate: timestamp,
    uploadDate: timestamp,
  };
};

const toSortTime = (value: AuthorFollowRecord) => {
  const parsedUpload = Date.parse(value.uploadDate);
  if (!Number.isNaN(parsedUpload)) {
    return parsedUpload;
  }

  const parsedCreate = Date.parse(value.createDate);
  if (!Number.isNaN(parsedCreate)) {
    return parsedCreate;
  }

  return 0;
};

const authorFollowsCache = new Map<string, AuthorFollowRecord[]>();

export function useAuthorFollows() {
  const { user } = useAuth();
  const { isConnected, showToast } = useNetworkStatus();
  const [authorFollows, setAuthorFollows] = useState<AuthorFollowRecord[]>([]);
  const [isLoadingAuthorFollows, setIsLoadingAuthorFollows] = useState(true);
  const [authorFollowsError, setAuthorFollowsError] = useState("");

  useEffect(() => {
    if (!user?.uid) {
      setAuthorFollows([]);
      setIsLoadingAuthorFollows(false);
      setAuthorFollowsError("");
      return;
    }

    const cachedAuthorFollows = authorFollowsCache.get(user.uid) ?? [];
    const hasCachedAuthorFollows = authorFollowsCache.has(user.uid);

    setAuthorFollows(cachedAuthorFollows);
    setIsLoadingAuthorFollows(!hasCachedAuthorFollows);
    const authorFollowsQuery = query(
      collection(firestore, AUTHOR_FOLLOWS_COLLECTION),
      where("uid", "==", user.uid),
    );

    const unsubscribe = onSnapshot(
      authorFollowsQuery,
      (snapshot) => {
        const nextAuthorFollows = snapshot.docs
          .map((item) => mapAuthorFollowRecord(item.id, item.data() as DocumentData))
          .filter((item) => item.authorId)
          .sort((left, right) => toSortTime(right) - toSortTime(left));

        authorFollowsCache.set(user.uid, nextAuthorFollows);
        setAuthorFollows(nextAuthorFollows);
        setAuthorFollowsError("");
        setIsLoadingAuthorFollows(false);
      },
      (snapshotError) => {
        setAuthorFollows(authorFollowsCache.get(user.uid) ?? []);
        setAuthorFollowsError(
          getRequestErrorMessage({
            error: snapshotError,
            isConnected,
            onlineMessage: "Unable to sync followed authors right now.",
          }),
        );
        setIsLoadingAuthorFollows(false);
      },
    );

    return unsubscribe;
  }, [isConnected, user?.uid]);

  const followedAuthorIds = useMemo(
    () => new Set(authorFollows.map((item) => item.authorId)),
    [authorFollows],
  );

  const isFollowingAuthor = useCallback(
    (authorId: string) => followedAuthorIds.has(authorId),
    [followedAuthorIds],
  );

  const toggleAuthorFollow = useCallback(
    async (author: FollowableAuthor): Promise<AuthorFollowMutationResult> => {
      if (!user?.uid) {
        throw new Error("Please login to follow authors.");
      }

      if (!isConnected) {
        throw new Error(DEFAULT_OFFLINE_MESSAGE);
      }

      const normalizedAuthorId = author.uid.trim();
      const normalizedDisplayName =
        author.displayName.trim() || author.username.trim() || "Author";
      const normalizedUsername = author.username.trim();

      if (!normalizedAuthorId) {
        throw new Error("Author is not available.");
      }

      if (normalizedAuthorId === user.uid) {
        throw new Error("You cannot follow your own author profile.");
      }

      const authorFollowDocId = createAuthorFollowDocId(user.uid, normalizedAuthorId);
      const authorFollowRef = doc(firestore, AUTHOR_FOLLOWS_COLLECTION, authorFollowDocId);
      const currentlyFollowing = followedAuthorIds.has(normalizedAuthorId);
      let previousAuthorFollows: AuthorFollowRecord[] = [];

      if (currentlyFollowing) {
        setAuthorFollows((current) => {
          previousAuthorFollows = current;
          const nextAuthorFollows = current.filter((item) => item.authorId !== normalizedAuthorId);
          authorFollowsCache.set(user.uid, nextAuthorFollows);
          return nextAuthorFollows;
        });
        showToast("Author unfollowed");

        try {
          await deleteDoc(authorFollowRef);
          return "unfollowed";
        } catch (error) {
          authorFollowsCache.set(user.uid, previousAuthorFollows);
          setAuthorFollows(previousAuthorFollows);
          throw error;
        }
      }

      const optimisticAuthorFollow = createOptimisticAuthorFollow(user.uid, user.email ?? "", {
        uid: normalizedAuthorId,
        displayName: normalizedDisplayName,
        username: normalizedUsername,
      });

      setAuthorFollows((current) => {
        previousAuthorFollows = current;

        const nextAuthorFollows = [optimisticAuthorFollow, ...current.filter((item) => item.authorId !== normalizedAuthorId)].sort(
          (left, right) => toSortTime(right) - toSortTime(left),
        );
        authorFollowsCache.set(user.uid, nextAuthorFollows);
        return nextAuthorFollows;
      });
      showToast("Author followed");

      try {
        await setDoc(
          authorFollowRef,
          {
            id: authorFollowDocId,
            uid: user.uid,
            userEmail: user.email ?? "",
            authorId: normalizedAuthorId,
            authorUsername: normalizedUsername,
            authorDisplayName: normalizedDisplayName,
            createDate: serverTimestamp(),
            uploadDate: serverTimestamp(),
          },
          { merge: true },
        );

        return "followed";
      } catch (error) {
        authorFollowsCache.set(user.uid, previousAuthorFollows);
        setAuthorFollows(previousAuthorFollows);
        throw error;
      }
    },
    [followedAuthorIds, isConnected, showToast, user?.email, user?.uid],
  );

  return {
    authorFollows,
    followedAuthorIds,
    isFollowingAuthor,
    isLoadingAuthorFollows,
    authorFollowsError,
    toggleAuthorFollow,
  };
}
