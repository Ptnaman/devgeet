import { onSnapshot, type DocumentData } from "firebase/firestore";
import { useEffect, useMemo, useState } from "react";

import {
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
        setAllNotifications(
          snapshot.docs.map((item) =>
            mapUserNotificationRecord(
              item.id,
              user.uid,
              item.data() as DocumentData,
            ),
          ),
        );
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
