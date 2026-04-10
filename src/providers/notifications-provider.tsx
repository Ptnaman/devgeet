import { useEffect, useRef, type ReactNode } from "react";
import { useRouter } from "expo-router";
import { Platform } from "react-native";

import {
  clearCachedPushTokenAsync,
  deletePushTokenAsync,
  ensureNotificationHandlerConfigured,
  getCachedPushTokenAsync,
  getNotificationPostId,
  getOptionalNotificationsModule,
  registerForPushNotificationsAsync,
  syncPushTokenAsync,
} from "@/lib/notifications";
import { useAuth } from "@/providers/auth-provider";

const getErrorCode = (error: unknown) =>
  typeof error === "object" &&
  error !== null &&
  "code" in error &&
  typeof (error as { code?: unknown }).code === "string"
    ? ((error as { code: string }).code || "").trim()
    : "";

export function NotificationsProvider({
  children,
}: {
  children: ReactNode;
}) {
  const router = useRouter();
  const { user, isBootstrapping } = useAuth();
  const lastHandledNotificationRef = useRef("");

  useEffect(() => {
    if (Platform.OS === "web") {
      return;
    }

    const notifications = getOptionalNotificationsModule();
    if (!notifications) {
      return;
    }

    ensureNotificationHandlerConfigured();

    let active = true;

    const openNotificationTarget = (response: unknown) => {
      if (!response) {
        return;
      }

      const requestId =
        typeof response === "object" && response !== null
          ? (
              response as {
                notification?: {
                  request?: {
                    identifier?: unknown;
                  };
                };
              }
            ).notification?.request?.identifier
          : "";

      if (typeof requestId !== "string" || !requestId) {
        return;
      }

      if (lastHandledNotificationRef.current === requestId) {
        return;
      }

      lastHandledNotificationRef.current = requestId;

      const postId = getNotificationPostId(response);
      if (!postId) {
        return;
      }

      router.push({
        pathname: "/post/[postId]",
        params: { postId },
      });
    };

    const subscription =
      notifications.addNotificationResponseReceivedListener(
        openNotificationTarget,
      );

    void notifications.getLastNotificationResponseAsync()
      .then((response) => {
        if (active) {
          openNotificationTarget(response);
        }
      })
      .catch(() => {
        // Ignore boot-time notification lookup failures.
      });

    return () => {
      active = false;
      subscription.remove();
    };
  }, [router]);

  useEffect(() => {
    if (Platform.OS === "web" || isBootstrapping) {
      return;
    }

    let active = true;

    const syncDeviceRegistration = async () => {
      const cachedToken = await getCachedPushTokenAsync().catch(() => "");

      if (!user) {
        if (cachedToken) {
          try {
            await deletePushTokenAsync(cachedToken);
          } catch {
            // Ignore token cleanup failures during logout.
          }
        }

        await clearCachedPushTokenAsync().catch(() => {
          // Ignore local cache cleanup failures.
        });
        return;
      }

      let tokenToSync = cachedToken;

      try {
        const registration = await registerForPushNotificationsAsync();
        if (!active) {
          return;
        }

        if (registration.status === "registered" && registration.token) {
          tokenToSync = registration.token;
        } else if (
          registration.status === "configuration-error" ||
          ((registration.status === "network-error" ||
            registration.status === "service-error") &&
            !tokenToSync)
        ) {
          console.warn(
            "Unable to register Expo push notifications.",
            registration.errorMessage ?? registration.debugMessage ?? registration.status,
          );
        }
      } catch (error) {
        console.warn("Unable to register Expo push notifications.", error);
      }

      if (!tokenToSync || !active) {
        return;
      }

      try {
        await syncPushTokenAsync({
          uid: user.uid,
          token: tokenToSync,
        });
      } catch (error) {
        if (getErrorCode(error) === "permission-denied") {
          console.warn(
            "Unable to sync Expo push token to Firestore. Firestore rules are blocking writes to the pushTokens collection.",
          );
          return;
        }

        console.warn("Unable to sync Expo push token to Firestore.", error);
      }
    };

    void syncDeviceRegistration();

    return () => {
      active = false;
    };
  }, [isBootstrapping, user]);

  return children;
}
