import { useCallback, useEffect, useState } from "react";
import {
  arrayUnion,
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

import { firestore } from "@/lib/firebase";
import { createSlug } from "@/lib/content";
import { DEFAULT_OFFLINE_MESSAGE, getRequestErrorMessage } from "@/lib/network";
import { useAuth } from "@/providers/auth-provider";
import { useNetworkStatus } from "@/providers/network-provider";

export const BOOKMARK_COLLECTIONS_COLLECTION = "bookmarkCollections";

export type BookmarkCollectionRecord = {
  id: string;
  name: string;
  postIds: string[];
};

const mapCollection = (id: string, data: DocumentData): BookmarkCollectionRecord => ({
  id,
  name: typeof data.name === "string" ? data.name.trim() : "",
  postIds: Array.isArray(data.postIds)
    ? data.postIds.filter((value): value is string => typeof value === "string" && Boolean(value))
    : [],
});

export function useBookmarkCollections() {
  const { user } = useAuth();
  const { isConnected } = useNetworkStatus();
  const [collections, setCollections] = useState<BookmarkCollectionRecord[]>([]);
  const [isLoadingCollections, setIsLoadingCollections] = useState(true);
  const [collectionsError, setCollectionsError] = useState("");

  useEffect(() => {
    if (!user?.uid) {
      setCollections([]);
      setIsLoadingCollections(false);
      setCollectionsError("");
      return;
    }

    setIsLoadingCollections(true);
    return onSnapshot(
      query(
        collection(firestore, BOOKMARK_COLLECTIONS_COLLECTION),
        where("uid", "==", user.uid),
      ),
      (snapshot) => {
        setCollections(
          snapshot.docs
            .map((item) => mapCollection(item.id, item.data()))
            .filter((item) => item.name)
            .sort((left, right) => left.name.localeCompare(right.name)),
        );
        setCollectionsError("");
        setIsLoadingCollections(false);
      },
      (error) => {
        setCollectionsError(getRequestErrorMessage({
          error,
          isConnected,
          onlineMessage: "Unable to load bookmark collections.",
        }));
        setIsLoadingCollections(false);
      },
    );
  }, [isConnected, user?.uid]);

  const addPostToCollection = useCallback(async (collectionId: string, postId: string) => {
    if (!user?.uid) throw new Error("Please login to save bookmarks.");
    if (!isConnected) throw new Error(DEFAULT_OFFLINE_MESSAGE);

    await setDoc(doc(firestore, BOOKMARK_COLLECTIONS_COLLECTION, collectionId), {
      uid: user.uid,
      postIds: arrayUnion(postId),
      uploadDate: serverTimestamp(),
    }, { merge: true });
  }, [isConnected, user?.uid]);

  const createCollection = useCallback(async (nameValue: string, postId?: string) => {
    if (!user?.uid) throw new Error("Please login to save bookmarks.");
    if (!isConnected) throw new Error(DEFAULT_OFFLINE_MESSAGE);
    const name = nameValue.trim();
    if (!name) throw new Error("Enter a collection name.");

    const baseSlug = createSlug(name) || "collection";
    const collectionId = `${user.uid}_${baseSlug}_${Date.now().toString(36)}`;
    await setDoc(doc(firestore, BOOKMARK_COLLECTIONS_COLLECTION, collectionId), {
      id: collectionId,
      uid: user.uid,
      name,
      postIds: postId ? [postId] : [],
      createDate: serverTimestamp(),
      uploadDate: serverTimestamp(),
    });
    return collectionId;
  }, [isConnected, user?.uid]);

  const renameCollection = useCallback(async (collectionId: string, nameValue: string) => {
    if (!user?.uid) throw new Error("Please login to manage collections.");
    if (!isConnected) throw new Error(DEFAULT_OFFLINE_MESSAGE);
    const name = nameValue.trim();
    if (!name) throw new Error("Enter a collection name.");

    await setDoc(doc(firestore, BOOKMARK_COLLECTIONS_COLLECTION, collectionId), {
      name,
      uploadDate: serverTimestamp(),
    }, { merge: true });
  }, [isConnected, user?.uid]);

  const deleteCollection = useCallback(async (collectionId: string) => {
    if (!user?.uid) throw new Error("Please login to manage collections.");
    if (!isConnected) throw new Error(DEFAULT_OFFLINE_MESSAGE);
    await deleteDoc(doc(firestore, BOOKMARK_COLLECTIONS_COLLECTION, collectionId));
  }, [isConnected, user?.uid]);

  return {
    collections,
    isLoadingCollections,
    collectionsError,
    addPostToCollection,
    createCollection,
    renameCollection,
    deleteCollection,
  };
}
