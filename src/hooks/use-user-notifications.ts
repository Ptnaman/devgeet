import { onSnapshot, type DocumentData } from "firebase/firestore";
import { useEffect, useMemo, useState } from "react";

import {
  getUserNotificationsQuery,
  mapUserNotificationRecord,
  type UserNotificationRecord,
} from "@/lib/user-notifications";
import { useAuth } from "@/providers/auth-provider";

export function useUserNotifications() {
  const { user } = useAuth();
  const [notifications, setNotifications] = useState<UserNotificationRecord[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (!user?.uid) {
      setNotifications([]);
      setIsLoading(false);
      return;
    }

    setIsLoading(true);

    const unsubscribe = onSnapshot(
      getUserNotificationsQuery(user.uid),
      (snapshot) => {
        setNotifications(
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
        setNotifications([]);
        setIsLoading(false);
      },
    );

    return unsubscribe;
  }, [user?.uid]);

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
