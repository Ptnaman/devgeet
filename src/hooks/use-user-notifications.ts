import { onSnapshot, type DocumentData } from "firebase/firestore";
import { useEffect, useMemo, useState } from "react";

import {
  enforceUserNotificationRetentionAsync,
  getUserNotificationsQuery,
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

    setIsLoading(true);

    const unsubscribe = onSnapshot(
      getUserNotificationsQuery(user.uid),
      (snapshot) => {
        const mappedNotifications = snapshot.docs.map((item) =>
          mapUserNotificationRecord(
            item.id,
            user.uid,
            item.data() as DocumentData,
          ),
        );
        const sortedNotifications = [...mappedNotifications].sort(
          (left, right) =>
            getNotificationSortTime(right.createdAt) -
            getNotificationSortTime(left.createdAt),
        );

        setAllNotifications(
          sortedNotifications,
        );
        void enforceUserNotificationRetentionAsync({
          uid: user.uid,
          notifications: sortedNotifications,
        }).catch(() => {
          // Ignore lifecycle sync issues while reading notifications.
        });
        setIsLoading(false);
      },
      () => {
        setAllNotifications([]);
        setIsLoading(false);
      },
    );

    return unsubscribe;
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
