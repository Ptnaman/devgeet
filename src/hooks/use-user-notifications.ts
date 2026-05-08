import { onSnapshot, type DocumentData } from "firebase/firestore";
import { useEffect, useMemo, useState } from "react";

import {
  enforceUserNotificationRetentionAsync,
  getRecentUserNotificationsQuery,
  isCreatorUserNotification,
  mapUserNotificationRecord,
  type UserNotificationCategory,
  type UserNotificationRecord,
} from "@/lib/user-notifications";
import { useAuth } from "@/providers/auth-provider";

type UseUserNotificationsOptions = {
  category?: UserNotificationCategory | "all";
};

const getNotificationSortTime = (value: string) => {
  const timestamp = Date.parse(value);
  return Number.isFinite(timestamp) ? timestamp : 0;
};

type SharedNotificationsState = {
  notifications: UserNotificationRecord[];
  isLoading: boolean;
};

type SharedNotificationsSubscriber = (state: SharedNotificationsState) => void;

type SharedNotificationsEntry = SharedNotificationsState & {
  subscribers: Set<SharedNotificationsSubscriber>;
  unsubscribe: (() => void) | null;
};

const sharedNotificationsByUid = new Map<string, SharedNotificationsEntry>();
const SHARED_NOTIFICATIONS_SNAPSHOT_LIMIT = 300;

const broadcastSharedNotifications = (uid: string) => {
  const entry = sharedNotificationsByUid.get(uid);
  if (!entry) {
    return;
  }

  const payload: SharedNotificationsState = {
    notifications: entry.notifications,
    isLoading: entry.isLoading,
  };

  entry.subscribers.forEach((subscriber) => {
    subscriber(payload);
  });
};

const ensureSharedNotificationsEntry = (uid: string) => {
  const normalizedUid = uid.trim();
  if (!normalizedUid) {
    return null;
  }

  const existingEntry = sharedNotificationsByUid.get(normalizedUid);
  if (existingEntry) {
    return existingEntry;
  }

  const nextEntry: SharedNotificationsEntry = {
    notifications: [],
    isLoading: true,
    subscribers: new Set<SharedNotificationsSubscriber>(),
    unsubscribe: null,
  };

  nextEntry.unsubscribe = onSnapshot(
    getRecentUserNotificationsQuery(normalizedUid, SHARED_NOTIFICATIONS_SNAPSHOT_LIMIT),
    (snapshot) => {
      const mappedNotifications = snapshot.docs.map((item) =>
        mapUserNotificationRecord(
          item.id,
          normalizedUid,
          item.data() as DocumentData,
        ),
      );
      const sortedNotifications = [...mappedNotifications].sort(
        (left, right) =>
          getNotificationSortTime(right.createdAt) -
          getNotificationSortTime(left.createdAt),
      );

      nextEntry.notifications = sortedNotifications;
      nextEntry.isLoading = false;
      void enforceUserNotificationRetentionAsync({
        uid: normalizedUid,
        notifications: sortedNotifications,
      }).catch(() => {
        // Ignore lifecycle cleanup failures while rendering notifications.
      });
      broadcastSharedNotifications(normalizedUid);
    },
    () => {
      nextEntry.notifications = [];
      nextEntry.isLoading = false;
      broadcastSharedNotifications(normalizedUid);
    },
  );

  sharedNotificationsByUid.set(normalizedUid, nextEntry);
  return nextEntry;
};

const releaseSharedNotificationsEntry = (uid: string, subscriber: SharedNotificationsSubscriber) => {
  const normalizedUid = uid.trim();
  if (!normalizedUid) {
    return;
  }

  const entry = sharedNotificationsByUid.get(normalizedUid);
  if (!entry) {
    return;
  }

  entry.subscribers.delete(subscriber);

  if (entry.subscribers.size > 0) {
    return;
  }

  entry.unsubscribe?.();
  sharedNotificationsByUid.delete(normalizedUid);
};

export function useUserNotifications({
  category = "all",
}: UseUserNotificationsOptions = {}) {
  const { user } = useAuth();
  const [allNotifications, setAllNotifications] = useState<UserNotificationRecord[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (!user?.uid) {
      setAllNotifications([]);
      setIsLoading(false);
      return;
    }
    const entry = ensureSharedNotificationsEntry(user.uid);
    if (!entry) {
      setAllNotifications([]);
      setIsLoading(false);
      return;
    }

    setAllNotifications(entry.notifications);
    setIsLoading(entry.isLoading);

    const subscriber: SharedNotificationsSubscriber = (state) => {
      setAllNotifications(state.notifications);
      setIsLoading(state.isLoading);
    };

    entry.subscribers.add(subscriber);

    return () => {
      releaseSharedNotificationsEntry(user.uid, subscriber);
    };
  }, [user?.uid]);

  const notifications = useMemo(() => {
    if (category === "all") {
      return allNotifications;
    }

    if (category === "creator") {
      return allNotifications.filter(isCreatorUserNotification);
    }

    return allNotifications;
  }, [allNotifications, category]);

  const unreadCount = useMemo(
    () => notifications.filter((item) => !item.isRead).length,
    [notifications],
  );

  return {
    notifications,
    unreadCount,
    isLoading,
  };
}
