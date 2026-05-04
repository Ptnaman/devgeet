import { useEffect, useRef, type ReactNode } from "react";
import { useRouter } from "expo-router";
import { Platform } from "react-native";

import {
  clearCachedPushTokenAsync,
  deletePushTokenAsync,
  ensureNotificationHandlerConfigured,
  getCachedPushTokenAsync,
  getNotificationBody,
  getNotificationPostId,
  getNotificationRequestId,
  getNotificationTitle,
  getOptionalNotificationsModule,
  isCustomNotificationPayload,
  registerForPushNotificationsAsync,
  syncPushTokenAsync,
} from "@/lib/notifications";
import { useAuth } from "@/providers/auth-provider";
import { useNetworkStatus } from "@/providers/network-provider";

const MAX_CUSTOM_TOAST_MESSAGE_LENGTH = 180;

const getErrorCode = (error: unknown) =>
  typeof error === "object" &&
  error !== null &&
  "code" in error &&
  typeof (error as { code?: unknown }).code === "string"
    ? ((error as { code: string }).code || "").trim()
    : "";

const truncateText = (value: string, limit: number) => {
  if (value.length <= limit) {
    return value;
  }

  return `${value.slice(0, Math.max(0, limit - 3)).trimEnd()}...`;
};

export function NotificationsProvider({
  children,
}: {
  children: ReactNode;
}) {
  const router = useRouter();
  const { user, profile, hasProfileDocument, isBootstrapping } = useAuth();
  const { showToast } = useNetworkStatus();
  const lastHandledNotificationRef = useRef("");
  const lastCustomNotificationToastRef = useRef("");
  const lastSyncedTokenRef = useRef("");

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

    const showCustomForegroundNotification = (notification: unknown) => {
      if (!isCustomNotificationPayload(notification)) {
        return;
      }

      const requestId = getNotificationRequestId(notification);
      if (
        requestId &&
        requestId === lastCustomNotificationToastRef.current
      ) {
        return;
      }

      const title = getNotificationTitle(notification);
      const body = getNotificationBody(notification);
      const message = title && body ? `${title}: ${body}` : title || body;

      if (!message) {
        return;
      }

      if (requestId) {
        lastCustomNotificationToastRef.current = requestId;
      }

      showToast(
        truncateText(message, MAX_CUSTOM_TOAST_MESSAGE_LENGTH),
      );
    };

    const openNotificationTarget = (response: unknown) => {
      if (!response) {
        return;
      }

      const requestId = getNotificationRequestId(response);
      if (!requestId) {
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
    const foregroundSubscription =
      notifications.addNotificationReceivedListener(
        showCustomForegroundNotification,
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
      foregroundSubscription.remove();
    };
  }, [router, showToast]);

  useEffect(() => {
    if (
      Platform.OS === "web" ||
      isBootstrapping ||
      (user !== null && (!hasProfileDocument || profile?.accountStatus === "deleted"))
    ) {
      return;
    }

    let active = true;

    const syncDeviceRegistration = async () => {
      const cachedToken = await getCachedPushTokenAsync().catch(() => "");

      if (!user) {
        lastSyncedTokenRef.current = "";

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
        } else if (registration.status === "permission-denied") {
          if (cachedToken) {
            try {
              await deletePushTokenAsync({
                token: cachedToken,
                uid: user.uid,
              });
            } catch {
              // Ignore token cleanup failures when permissions are revoked.
            }
          }

          lastSyncedTokenRef.current = "";
          await clearCachedPushTokenAsync().catch(() => {
            // Ignore local cache cleanup failures.
          });
          return;
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
          previousToken: cachedToken,
        });
        lastSyncedTokenRef.current = tokenToSync;
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

    const notifications = getOptionalNotificationsModule();
    const tokenSubscription =
      user && notifications
        ? notifications.addPushTokenListener((pushToken) => {
            const nextToken = pushToken.data.trim();
            if (!nextToken || !active) {
              return;
            }

            const previousToken = lastSyncedTokenRef.current;
            if (previousToken === nextToken) {
              return;
            }

            lastSyncedTokenRef.current = nextToken;

            void syncPushTokenAsync({
              uid: user.uid,
              token: nextToken,
              previousToken,
            }).catch((error) => {
              console.warn("Unable to sync refreshed Expo push token.", error);
            });
          })
        : null;

    void syncDeviceRegistration();

    return () => {
      active = false;
      tokenSubscription?.remove();
    };
  }, [hasProfileDocument, isBootstrapping, profile?.accountStatus, user]);

  return children;
}
