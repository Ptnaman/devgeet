import {
  Timestamp,
  collection,
  doc,
  limit,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  writeBatch,
  type DocumentData,
} from "firebase/firestore";

import { firestore } from "@/lib/firebase";

const USERS_COLLECTION = "users";
const USER_NOTIFICATIONS_SUBCOLLECTION = "notifications";
const MAX_NOTIFICATION_BATCH_SIZE = 400;

export type UserNotificationType = "post-approved" | "custom";

export type UserNotificationRecord = {
  id: string;
  uid: string;
  type: UserNotificationType;
  title: string;
  body: string;
  postId: string;
  imageUrl: string;
  isRead: boolean;
  createdAt: string;
  readAt: string;
};

const readStringValue = (value: unknown) => (typeof value === "string" ? value.trim() : "");

const normalizeUserNotificationType = (value: unknown): UserNotificationType =>
  readStringValue(value) === "custom" ? "custom" : "post-approved";

const getUniqueUids = (uids: string[]) => [...new Set(uids.map((uid) => uid.trim()).filter(Boolean))];

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

const getNotificationCollection = (uid: string) =>
  collection(firestore, USERS_COLLECTION, uid, USER_NOTIFICATIONS_SUBCOLLECTION);

export const getUserNotificationsQuery = (uid: string) =>
  query(getNotificationCollection(uid), orderBy("createdAt", "desc"));

export const getRecentUserNotificationsQuery = (
  uid: string,
  limitCount: number,
) =>
  query(
    getNotificationCollection(uid),
    orderBy("createdAt", "desc"),
    limit(limitCount),
  );

export const mapUserNotificationRecord = (
  id: string,
  uid: string,
  data: DocumentData,
): UserNotificationRecord => ({
  id,
  uid,
  type: normalizeUserNotificationType(data.type),
  title: readStringValue(data.title) || "Notification",
  body: readStringValue(data.body),
  postId: readStringValue(data.postId),
  imageUrl: readStringValue(data.imageUrl),
  isRead: data.isRead === true,
  createdAt: toDateString(data.createdAt),
  readAt: toDateString(data.readAt),
});

export const createPostApprovedUserNotificationAsync = async ({
  uid,
  postId,
  postTitle,
  imageUrl,
}: {
  uid: string;
  postId: string;
  postTitle: string;
  imageUrl?: string;
}) => {
  const normalizedUid = uid.trim();
  const normalizedPostId = postId.trim();
  const normalizedPostTitle = postTitle.trim() || "Your post";

  if (!normalizedUid || !normalizedPostId) {
    return;
  }

  const notificationRef = doc(getNotificationCollection(normalizedUid));

  await setDoc(notificationRef, {
    uid: normalizedUid,
    type: "post-approved",
    title: "Congratulations",
    body: `Your post "${normalizedPostTitle}" has been approved and published.`,
    postId: normalizedPostId,
    imageUrl: readStringValue(imageUrl),
    isRead: false,
    createdAt: serverTimestamp(),
    readAt: null,
  });
};

export const createCustomUserNotificationAsync = async ({
  uid,
  title,
  body,
  imageUrl,
}: {
  uid: string;
  title: string;
  body: string;
  imageUrl?: string;
}) => {
  const normalizedUid = uid.trim();
  const normalizedTitle = title.trim() || "DevGeet";
  const normalizedBody = body.trim();

  if (!normalizedUid || !normalizedBody) {
    return false;
  }

  const notificationRef = doc(getNotificationCollection(normalizedUid));

  await setDoc(notificationRef, {
    uid: normalizedUid,
    type: "custom",
    title: normalizedTitle,
    body: normalizedBody,
    postId: "",
    imageUrl: readStringValue(imageUrl),
    isRead: false,
    createdAt: serverTimestamp(),
    readAt: null,
  });

  return true;
};

export const createCustomUserNotificationsAsync = async ({
  uids,
  title,
  body,
  imageUrl,
}: {
  uids: string[];
  title: string;
  body: string;
  imageUrl?: string;
}) => {
  const uniqueUids = getUniqueUids(uids);
  const normalizedTitle = title.trim() || "DevGeet";
  const normalizedBody = body.trim();

  if (!uniqueUids.length || !normalizedBody) {
    return 0;
  }

  for (let index = 0; index < uniqueUids.length; index += MAX_NOTIFICATION_BATCH_SIZE) {
    const batch = writeBatch(firestore);
    const batchUids = uniqueUids.slice(index, index + MAX_NOTIFICATION_BATCH_SIZE);

    batchUids.forEach((uid) => {
      batch.set(doc(getNotificationCollection(uid)), {
        uid,
        type: "custom",
        title: normalizedTitle,
        body: normalizedBody,
        postId: "",
        imageUrl: readStringValue(imageUrl),
        isRead: false,
        createdAt: serverTimestamp(),
        readAt: null,
      });
    });

    await batch.commit();
  }

  return uniqueUids.length;
};

export const markUserNotificationsAsReadAsync = async ({
  uid,
  notificationIds,
}: {
  uid: string;
  notificationIds: string[];
}) => {
  const normalizedUid = uid.trim();
  const uniqueIds = [...new Set(notificationIds.map((id) => id.trim()).filter(Boolean))];

  if (!normalizedUid || !uniqueIds.length) {
    return;
  }

  await Promise.all(
    uniqueIds.map((notificationId) =>
      updateDoc(
        doc(
          firestore,
          USERS_COLLECTION,
          normalizedUid,
          USER_NOTIFICATIONS_SUBCOLLECTION,
          notificationId,
        ),
        {
          isRead: true,
          readAt: serverTimestamp(),
        },
      ),
    ),
  );
};

export const deleteUserNotificationsAsync = async ({
  uid,
  notificationIds,
}: {
  uid: string;
  notificationIds: string[];
}) => {
  const normalizedUid = uid.trim();
  const uniqueIds = [...new Set(notificationIds.map((id) => id.trim()).filter(Boolean))];

  if (!normalizedUid || !uniqueIds.length) {
    return;
  }

  for (let index = 0; index < uniqueIds.length; index += MAX_NOTIFICATION_BATCH_SIZE) {
    const batch = writeBatch(firestore);
    const batchIds = uniqueIds.slice(index, index + MAX_NOTIFICATION_BATCH_SIZE);

    batchIds.forEach((notificationId) => {
      batch.delete(
        doc(
          firestore,
          USERS_COLLECTION,
          normalizedUid,
          USER_NOTIFICATIONS_SUBCOLLECTION,
          notificationId,
        ),
      );
    });

    await batch.commit();
  }
};

export const formatUserNotificationRelativeTime = (value: string) => {
  if (!value) {
    return "";
  }

  const timestamp = Date.parse(value);
  if (Number.isNaN(timestamp)) {
    return value;
  }

  const diffMs = Date.now() - timestamp;
  const normalizedDiffMs = Math.max(diffMs, 0);
  const minuteMs = 60 * 1000;
  const hourMs = 60 * minuteMs;
  const dayMs = 24 * hourMs;
  const weekMs = 7 * dayMs;
  const monthMs = 30 * dayMs;
  const yearMs = 365 * dayMs;

  if (normalizedDiffMs < minuteMs) {
    return "Just now";
  }

  if (normalizedDiffMs < hourMs) {
    const minutes = Math.floor(normalizedDiffMs / minuteMs);
    return `${minutes} minute${minutes === 1 ? "" : "s"} ago`;
  }

  if (normalizedDiffMs < dayMs) {
    const hours = Math.floor(normalizedDiffMs / hourMs);
    return `${hours} hour${hours === 1 ? "" : "s"} ago`;
  }

  if (normalizedDiffMs < weekMs) {
    const days = Math.floor(normalizedDiffMs / dayMs);
    return `${days} day${days === 1 ? "" : "s"} ago`;
  }

  if (normalizedDiffMs < monthMs) {
    const weeks = Math.floor(normalizedDiffMs / weekMs);
    return `${weeks} week${weeks === 1 ? "" : "s"} ago`;
  }

  if (normalizedDiffMs < yearMs) {
    const months = Math.floor(normalizedDiffMs / monthMs);
    return `${months} month${months === 1 ? "" : "s"} ago`;
  }

  const years = Math.floor(normalizedDiffMs / yearMs);
  return `${years} year${years === 1 ? "" : "s"} ago`;
};
