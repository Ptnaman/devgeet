import { useCallback, useEffect, useMemo, useState } from "react";
import {
  collection,
  deleteDoc,
  doc,
  onSnapshot,
  query,
  serverTimestamp,
  setDoc,
  writeBatch,
  where,
  type DocumentData,
} from "firebase/firestore";

import {
  FAVORITES_COLLECTION,
  mapFavoriteRecord,
  type FavoriteRecord,
  type PostRecord,
} from "@/lib/content";
import { firestore } from "@/lib/firebase";
import { DEFAULT_OFFLINE_MESSAGE, getRequestErrorMessage } from "@/lib/network";
import { useAuth } from "@/providers/auth-provider";
import { useNetworkStatus } from "@/providers/network-provider";

type FavoriteMutationResult = "added" | "removed";

const createFavoriteDocId = (uid: string, postId: string) => `${uid}_${postId}`;
const createOptimisticFavorite = (uid: string, postId: string): FavoriteRecord => {
  const timestamp = new Date().toISOString();

  return {
    id: createFavoriteDocId(uid, postId),
    uid,
    postId,
    createDate: timestamp,
    uploadDate: timestamp,
  };
};

const toSortTime = (value: FavoriteRecord) => {
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

export function useFavorites() {
  const { user } = useAuth();
  const { isConnected, showToast } = useNetworkStatus();
  const [favorites, setFavorites] = useState<FavoriteRecord[]>([]);
  const [isLoadingFavorites, setIsLoadingFavorites] = useState(true);
  const [favoritesError, setFavoritesError] = useState("");

  useEffect(() => {
    if (!user?.uid) {
      setFavorites([]);
      setIsLoadingFavorites(false);
      setFavoritesError("");
      return;
    }

    setIsLoadingFavorites(true);
    const favoritesQuery = query(
      collection(firestore, FAVORITES_COLLECTION),
      where("uid", "==", user.uid),
    );

    const unsubscribe = onSnapshot(
      favoritesQuery,
      (snapshot) => {
        const nextFavorites = snapshot.docs
          .map((item) => mapFavoriteRecord(item.id, item.data() as DocumentData))
          .filter((item) => item.postId)
          .sort((a, b) => toSortTime(b) - toSortTime(a));

        setFavorites(nextFavorites);
        setFavoritesError("");
        setIsLoadingFavorites(false);
      },
      (snapshotError) => {
        setFavorites([]);
        setFavoritesError(
          getRequestErrorMessage({
            error: snapshotError,
            isConnected,
            onlineMessage: "Unable to sync favorites right now.",
          }),
        );
        setIsLoadingFavorites(false);
      },
    );

    return unsubscribe;
  }, [isConnected, user?.uid]);

  const favoritePostIds = useMemo(
    () => new Set(favorites.map((item) => item.postId)),
    [favorites],
  );

  const isFavorite = useCallback(
    (postId: string) => favoritePostIds.has(postId),
    [favoritePostIds],
  );

  const toggleFavorite = useCallback(
    async (
      post: Pick<PostRecord, "id" | "title" | "slug">,
    ): Promise<FavoriteMutationResult> => {
      if (!user?.uid) {
        throw new Error("Please login to manage favorites.");
      }

      if (!isConnected) {
        throw new Error(DEFAULT_OFFLINE_MESSAGE);
      }

      const favoriteDocId = createFavoriteDocId(user.uid, post.id);
      const favoriteRef = doc(firestore, FAVORITES_COLLECTION, favoriteDocId);
      const currentlyFavorite = favoritePostIds.has(post.id);
      let previousFavorites: FavoriteRecord[] = [];

      if (currentlyFavorite) {
        setFavorites((current) => {
          previousFavorites = current;
          return current.filter((item) => item.postId !== post.id);
        });
        showToast("Removed from favorites");

        try {
          await deleteDoc(favoriteRef);
          return "removed";
        } catch (error) {
          setFavorites(previousFavorites);
          throw error;
        }
      }

      const optimisticFavorite = createOptimisticFavorite(user.uid, post.id);
      setFavorites((current) => {
        previousFavorites = current;

        return [optimisticFavorite, ...current.filter((item) => item.postId !== post.id)].sort(
          (left, right) => toSortTime(right) - toSortTime(left),
        );
      });
      showToast("Added to favorites");

      try {
        await setDoc(
          favoriteRef,
          {
            id: favoriteDocId,
            uid: user.uid,
            userEmail: user.email ?? "",
            postId: post.id,
            postTitle: post.title,
            postSlug: post.slug,
            createDate: serverTimestamp(),
            uploadDate: serverTimestamp(),
          },
          { merge: true },
        );

        return "added";
      } catch (error) {
        setFavorites(previousFavorites);
        throw error;
      }
    },
    [favoritePostIds, isConnected, showToast, user?.email, user?.uid],
  );

  const clearFavorites = useCallback(async (): Promise<number> => {
    if (!user?.uid) {
      throw new Error("Please login to manage favorites.");
    }

    if (!isConnected) {
      throw new Error(DEFAULT_OFFLINE_MESSAGE);
    }

    if (!favorites.length) {
      return 0;
    }

    const previousFavorites = favorites;
    setFavorites([]);
    showToast("Cleared favorites");

    try {
      const batch = writeBatch(firestore);

      for (const favorite of previousFavorites) {
        batch.delete(doc(firestore, FAVORITES_COLLECTION, favorite.id));
      }

      await batch.commit();
      return previousFavorites.length;
    } catch (error) {
      setFavorites(previousFavorites);
      throw error;
    }
  }, [favorites, isConnected, showToast, user?.uid]);

  return {
    favorites,
    favoritePostIds,
    isFavorite,
    isLoadingFavorites,
    favoritesError,
    clearFavorites,
    toggleFavorite,
  };
}
