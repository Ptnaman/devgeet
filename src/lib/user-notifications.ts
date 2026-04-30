import {
  Timestamp,
  collection,
  deleteDoc,
  doc,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
  type DocumentData,
} from "firebase/firestore";

import { firestore } from "@/lib/firebase";
import { formatRelativeTime } from "@/lib/relative-time";

const NOTIFICATIONS_COLLECTION = "notifications";
const NOTIFICATION_WRITE_CONCURRENCY = 25;
const CREATOR_NOTIFICATION_PATTERN = /\b(author|creator|approved|approval|published|draft|review)\b/i;
const AUTO_READ_AFTER_MS = 24 * 60 * 60 * 1000;
const DELETE_UNSEEN_AFTER_MS = 7 * 24 * 60 * 60 * 1000;

export type UserNotificationType = "post-approved" | "custom";
export type UserNotificationCategory = "general" | "creator";
export type UserNotificationAudience = "all" | "single";

export type UserNotificationRecord = {
  id: string;
  uid: string;
  type: UserNotificationType;
  category: UserNotificationCategory;
  audience: UserNotificationAudience | "";
  pushEnabled: boolean;
  isUserSeen: boolean;
  title: string;
  body: string;
  postId: string;
  imageUrl: string;
  isRead: boolean;
  createdAt: string;
  readAt: string;
  userSeenAt: string;
};

const readStringValue = (value: unknown) => (typeof value === "string" ? value.trim() : "");

const normalizeUserNotificationType = (value: unknown): UserNotificationType =>
  readStringValue(value) === "custom" ? "custom" : "post-approved";

const normalizeUserNotificationCategory = (
  value: unknown,
  type: UserNotificationType,
  title: string,
  body: string,
): UserNotificationCategory => {
  const normalizedValue = readStringValue(value).toLowerCase();
  if (normalizedValue === "creator") {
    return "creator";
  }

  if (type === "post-approved") {
    return "creator";
  }

  return CREATOR_NOTIFICATION_PATTERN.test(`${title} ${body}`) ? "creator" : "general";
};

const normalizeUserNotificationAudience = (value: unknown): UserNotificationAudience | "" => {
  const normalizedValue = readStringValue(value).toLowerCase();
  return normalizedValue === "all" || normalizedValue === "single" ? normalizedValue : "";
};

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

const getNotificationCollection = () => collection(firestore, NOTIFICATIONS_COLLECTION);

const getNotificationDoc = (notificationId: string) =>
  doc(firestore, NOTIFICATIONS_COLLECTION, notificationId);

export const getUserNotificationsQuery = (uid: string) =>
  query(
    getNotificationCollection(),
    where("uid", "==", uid.trim()),
  );

export const getRecentUserNotificationsQuery = (
  uid: string,
  _limitCount: number,
) =>
  query(
    getNotificationCollection(),
    where("uid", "==", uid.trim()),
  );

export const mapUserNotificationRecord = (
  id: string,
  uid: string,
  data: DocumentData,
): UserNotificationRecord => {
  const type = normalizeUserNotificationType(data.type);
  const title = readStringValue(data.title) || "Notification";
  const body = readStringValue(data.body);

  return {
    id,
    uid,
    type,
    category: normalizeUserNotificationCategory(data.category, type, title, body),
    audience: normalizeUserNotificationAudience(data.audience),
    pushEnabled: data.pushEnabled === true,
    isUserSeen: data.isUserSeen === true,
    title,
    body,
    postId: readStringValue(data.postId),
    imageUrl: readStringValue(data.imageUrl),
    isRead: data.isRead === true,
    createdAt: toDateString(data.createdAt),
    readAt: toDateString(data.readAt),
    userSeenAt: toDateString(data.userSeenAt),
  };
};

export const isCreatorUserNotification = (
  notification: Pick<UserNotificationRecord, "category">,
) => notification.category === "creator";

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

  const notificationRef = doc(getNotificationCollection());

  await setDoc(notificationRef, {
    uid: normalizedUid,
    type: "post-approved",
    category: "creator",
    title: "Congratulations",
    body: `Your post "${normalizedPostTitle}" has been approved and published.`,
    postId: normalizedPostId,
    imageUrl: readStringValue(imageUrl),
    isRead: false,
    isUserSeen: false,
    createdAt: serverTimestamp(),
    readAt: null,
    userSeenAt: null,
  });
};

export const createCustomUserNotificationAsync = async ({
  uid,
  title,
  body,
  imageUrl,
  category = "general",
  audience = "single",
  pushEnabled = false,
}: {
  uid: string;
  title: string;
  body: string;
  imageUrl?: string;
  category?: UserNotificationCategory;
  audience?: UserNotificationAudience;
  pushEnabled?: boolean;
}) => {
  const normalizedUid = uid.trim();
  const normalizedTitle = title.trim() || "DevGeet";
  const normalizedBody = body.trim();

  if (!normalizedUid || !normalizedBody) {
    return false;
  }

  const notificationRef = doc(getNotificationCollection());

  await setDoc(notificationRef, {
    uid: normalizedUid,
    type: "custom",
    category,
    audience,
    pushEnabled: pushEnabled === true,
    title: normalizedTitle,
    body: normalizedBody,
    postId: "",
    imageUrl: readStringValue(imageUrl),
    isRead: false,
    isUserSeen: false,
    createdAt: serverTimestamp(),
    readAt: null,
    userSeenAt: null,
  });

  return true;
};

export const createCustomUserNotificationsAsync = async ({
  uids,
  title,
  body,
  imageUrl,
  category = "general",
  audience = "all",
  pushEnabled = false,
}: {
  uids: string[];
  title: string;
  body: string;
  imageUrl?: string;
  category?: UserNotificationCategory;
  audience?: UserNotificationAudience;
  pushEnabled?: boolean;
}) => {
  const uniqueUids = getUniqueUids(uids);
  const normalizedTitle = title.trim() || "DevGeet";
  const normalizedBody = body.trim();

  if (!uniqueUids.length || !normalizedBody) {
    return 0;
  }

  let savedCount = 0;

  for (let index = 0; index < uniqueUids.length; index += NOTIFICATION_WRITE_CONCURRENCY) {
    const chunkUids = uniqueUids.slice(index, index + NOTIFICATION_WRITE_CONCURRENCY);
    const results = await Promise.allSettled(
      chunkUids.map((uid) =>
        setDoc(doc(getNotificationCollection()), {
          uid,
          type: "custom",
          category,
          audience,
          pushEnabled: pushEnabled === true,
          title: normalizedTitle,
          body: normalizedBody,
          postId: "",
          imageUrl: readStringValue(imageUrl),
          isRead: false,
          isUserSeen: false,
          createdAt: serverTimestamp(),
          readAt: null,
          userSeenAt: null,
        }),
      ),
    );

    savedCount += results.filter((result) => result.status === "fulfilled").length;
  }

  return savedCount;
};

export const markUserNotificationsAsReadAsync = async ({
  uid,
  notificationIds,
  seenByUser = true,
}: {
  uid: string;
  notificationIds: string[];
  seenByUser?: boolean;
}) => {
  const normalizedUid = uid.trim();
  const uniqueIds = [...new Set(notificationIds.map((id) => id.trim()).filter(Boolean))];

  if (!normalizedUid || !uniqueIds.length) {
    return;
  }

  await Promise.all(
    uniqueIds.map((notificationId) =>
      updateDoc(getNotificationDoc(notificationId), {
        isRead: true,
        readAt: serverTimestamp(),
        ...(seenByUser
          ? {
              isUserSeen: true,
              userSeenAt: serverTimestamp(),
            }
          : {}),
      }),
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

  for (let index = 0; index < uniqueIds.length; index += NOTIFICATION_WRITE_CONCURRENCY) {
    const chunkIds = uniqueIds.slice(index, index + NOTIFICATION_WRITE_CONCURRENCY);
    await Promise.allSettled(
      chunkIds.map((notificationId) => deleteDoc(getNotificationDoc(notificationId))),
    );
  }
};

const toTimestamp = (value: string) => {
  const parsedValue = Date.parse(value);
  return Number.isFinite(parsedValue) ? parsedValue : 0;
};

export const enforceUserNotificationRetentionAsync = async ({
  uid,
  notifications,
}: {
  uid: string;
  notifications: UserNotificationRecord[];
}) => {
  const normalizedUid = uid.trim();
  if (!normalizedUid || !notifications.length) {
    return;
  }

  const now = Date.now();
  const idsToDelete: string[] = [];
  const idsToAutoRead: string[] = [];

  notifications.forEach((notification) => {
    const createdAtTime = toTimestamp(notification.createdAt);
    if (!createdAtTime || notification.uid !== normalizedUid) {
      return;
    }

    const ageMs = now - createdAtTime;

    if (!notification.isUserSeen && ageMs >= DELETE_UNSEEN_AFTER_MS) {
      idsToDelete.push(notification.id);
      return;
    }

    if (!notification.isRead && ageMs >= AUTO_READ_AFTER_MS) {
      idsToAutoRead.push(notification.id);
    }
  });

  if (idsToDelete.length) {
    await deleteUserNotificationsAsync({
      uid: normalizedUid,
      notificationIds: idsToDelete,
    });
  }

  if (idsToAutoRead.length) {
    await markUserNotificationsAsReadAsync({
      uid: normalizedUid,
      notificationIds: idsToAutoRead,
      seenByUser: false,
    });
  }
};

export const formatUserNotificationRelativeTime = formatRelativeTime;
