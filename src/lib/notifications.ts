import AsyncStorage from "@react-native-async-storage/async-storage";
import Constants from "expo-constants";
import * as Device from "expo-device";
import { requireOptionalNativeModule } from "expo-modules-core";
import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  query,
  serverTimestamp,
  setDoc,
  where,
  type DocumentData,
} from "firebase/firestore";
import { httpsCallable } from "firebase/functions";
import { Platform } from "react-native";

import { LIGHT_COLORS } from "@/constants/theme";
import { normalizeAccountStatus } from "@/lib/access";
import { firestore, functions } from "@/lib/firebase";
import {
  createCustomUserNotificationAsync,
  createCustomUserNotificationsAsync,
  createPostApprovedUserNotificationAsync,
  type UserNotificationAudience,
  type UserNotificationCategory,
} from "@/lib/user-notifications";

export const PUSH_TOKENS_COLLECTION = "pushTokens";
const USERS_COLLECTION = "users";

const EXPO_PUSH_API_URL = "https://exp.host/--/api/v2/push/send";
const PUSH_DISPATCH_FUNCTION_NAME = "dispatchPushNotifications";
const DEFAULT_ANDROID_CHANNEL_ID = "default";
const PUSH_TOKEN_STORAGE_KEY = "@devgeet/expoPushToken";
const PUSH_TOKEN_DOC_ID_STORAGE_KEY = "@devgeet/pushTokenDocId";
const PUSH_INSTALLATION_ID_STORAGE_KEY = "@devgeet/pushInstallationId";
const DEFAULT_POST_PUBLISH_BODY = "Tap to read it on DevGeet.";
const MAX_POST_PUBLISH_BODY_LENGTH = 180;
const DEVICE_PUSH_TOKEN_RETRY_DELAYS_MS = [750, 1500] as const;
const PUSH_TOKEN_DEACTIVATE_AFTER_DAYS = 30;
const PUSH_TOKEN_DELETE_AFTER_DAYS = 60;
const DAY_IN_MS = 24 * 60 * 60 * 1000;
const PUSH_TOKEN_DEACTIVATE_AGE_MS = PUSH_TOKEN_DEACTIVATE_AFTER_DAYS * DAY_IN_MS;
const PUSH_TOKEN_DELETE_AGE_MS = PUSH_TOKEN_DELETE_AFTER_DAYS * DAY_IN_MS;
const useLegacyClientPushDispatch = false;
const CUSTOM_NOTIFICATION_TYPE = "custom_notification";
const NOTIFICATION_DATA_TITLE_KEY = "notificationTitle";
const NOTIFICATION_DATA_BODY_KEY = "notificationBody";
type NotificationsModule = typeof import("expo-notifications");

type PushTokenRegistrationStatus =
  | "registered"
  | "permission-denied"
  | "physical-device-required"
  | "web-unsupported"
  | "module-unavailable"
  | "configuration-error"
  | "network-error"
  | "service-error";

type PushTokenRegistrationResult = {
  status: PushTokenRegistrationStatus;
  token: string | null;
  errorMessage?: string;
  debugMessage?: string;
};

type ExpoPushMessage = {
  to: string;
  title: string;
  body: string;
  data?: Record<string, string>;
  sound?: "default";
  channelId?: string;
  priority?: "high" | "default";
  richContent?: {
    image: string;
  };
};

type ExpoPushTicket = {
  status?: "ok" | "error";
  details?: {
    error?: string;
  };
};

export type CustomNotificationDispatchResult = {
  savedCount: number;
  pushRecipientCount: number;
  pushTokenCount: number;
};

type PushDispatchCallableRequest =
  | {
      action: "post-published";
      payload: {
        actorUid?: string;
        authorUid?: string;
        imageUrl?: string;
        postContent: string;
        postId: string;
        postTitle: string;
      };
    }
  | {
      action: "post-published-to-all";
      payload: {
        excludeUids?: string[];
        imageUrl?: string;
        postContent: string;
        postId: string;
        postTitle: string;
      };
    }
  | {
      action: "post-published-to-user";
      payload: {
        imageUrl?: string;
        postId: string;
        postTitle: string;
        uid: string;
      };
    }
  | {
      action: "custom-single";
      payload: {
        audience?: UserNotificationAudience;
        body: string;
        category?: UserNotificationCategory;
        data?: Record<string, string>;
        imageUrl?: string;
        sendPush?: boolean;
        title: string;
        uid: string;
      };
    }
  | {
      action: "custom-all";
      payload: {
        audience?: UserNotificationAudience;
        body: string;
        category?: UserNotificationCategory;
        data?: Record<string, string>;
        excludeUids?: string[];
        imageUrl?: string;
        sendPush?: boolean;
        title: string;
      };
    }
  | {
      action: "test-token";
      payload: {
        accountName?: string;
        platform?: string;
        token: string;
      };
    };

const callPushDispatchAsync = async <TResponse>(
  requestPayload: PushDispatchCallableRequest,
) => {
  const callable = httpsCallable<PushDispatchCallableRequest, TResponse>(
    functions,
    PUSH_DISPATCH_FUNCTION_NAME,
  );
  const response = await callable(requestPayload);
  return response.data;
};

let cachedNotificationsModule: NotificationsModule | null | undefined;
let hasWarnedNotificationsUnavailable = false;
let hasConfiguredNotificationHandler = false;
let cachedNativeNotificationsSupport: boolean | undefined;

const warnNotificationsUnavailable = (error: unknown) => {
  if (hasWarnedNotificationsUnavailable) {
    return;
  }

  hasWarnedNotificationsUnavailable = true;
  console.warn(
    "expo-notifications native module is unavailable in this runtime. Push notifications are disabled.",
    error,
  );
};

export const hasNotificationsNativeSupport = () => {
  if (Platform.OS === "web") {
    return false;
  }

  if (cachedNativeNotificationsSupport !== undefined) {
    return cachedNativeNotificationsSupport;
  }

  cachedNativeNotificationsSupport = Boolean(
    requireOptionalNativeModule("ExpoPushTokenManager") &&
      requireOptionalNativeModule("ExpoNotificationsHandlerModule") &&
      requireOptionalNativeModule("ExpoNotificationsEmitter"),
  );

  if (!cachedNativeNotificationsSupport) {
    warnNotificationsUnavailable(
      new Error("Required expo-notifications native modules are not installed in this build."),
    );
  }

  return cachedNativeNotificationsSupport;
};

export const getOptionalNotificationsModule = (): NotificationsModule | null => {
  if (!hasNotificationsNativeSupport()) {
    cachedNotificationsModule = null;
    return null;
  }

  if (cachedNotificationsModule !== undefined) {
    return cachedNotificationsModule;
  }

  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    cachedNotificationsModule = require("expo-notifications") as NotificationsModule;
  } catch (error) {
    cachedNotificationsModule = null;
    warnNotificationsUnavailable(error);
  }

  return cachedNotificationsModule;
};

const readTrimmedString = (value: unknown) =>
  typeof value === "string" ? value.trim() : "";

type NotificationRequestContentShape = {
  body?: unknown;
  data?: unknown;
  title?: unknown;
};

type NotificationRequestShape = {
  content?: NotificationRequestContentShape;
  identifier?: unknown;
};

const getNotificationRequest = (payload: unknown): NotificationRequestShape | null => {
  if (!payload || typeof payload !== "object") {
    return null;
  }

  const normalizedPayload = payload as {
    notification?: {
      request?: NotificationRequestShape;
    };
    request?: NotificationRequestShape;
  };

  if (normalizedPayload.notification?.request) {
    return normalizedPayload.notification.request;
  }

  if (normalizedPayload.request) {
    return normalizedPayload.request;
  }

  return null;
};

const getNotificationRequestContent = (payload: unknown) => {
  const request = getNotificationRequest(payload);
  if (!request?.content || typeof request.content !== "object") {
    return null;
  }

  return request.content;
};

const readNotificationPayloadData = (payload: unknown) => {
  const content = getNotificationRequestContent(payload);
  if (!content?.data || typeof content.data !== "object") {
    return {} as Record<string, string>;
  }

  const result: Record<string, string> = {};

  Object.entries(content.data as Record<string, unknown>).forEach(([key, value]) => {
    const normalizedKey = readTrimmedString(key);
    const normalizedValue = readTrimmedString(value);
    if (normalizedKey && normalizedValue) {
      result[normalizedKey] = normalizedValue;
    }
  });

  return result;
};

export const getNotificationPayloadData = (payload: unknown) =>
  readNotificationPayloadData(payload);

export const getNotificationPayloadType = (payload: unknown) =>
  readTrimmedString(readNotificationPayloadData(payload).type).toLowerCase();

export const isCustomNotificationPayload = (payload: unknown) =>
  getNotificationPayloadType(payload) === CUSTOM_NOTIFICATION_TYPE;

export const getNotificationRequestId = (payload: unknown) =>
  readTrimmedString(getNotificationRequest(payload)?.identifier);

export const getNotificationTitle = (payload: unknown) => {
  const payloadData = readNotificationPayloadData(payload);
  const titleFromData = readTrimmedString(payloadData[NOTIFICATION_DATA_TITLE_KEY]);
  if (titleFromData) {
    return titleFromData;
  }

  return readTrimmedString(getNotificationRequestContent(payload)?.title);
};

export const getNotificationBody = (payload: unknown) => {
  const payloadData = readNotificationPayloadData(payload);
  const bodyFromData = readTrimmedString(payloadData[NOTIFICATION_DATA_BODY_KEY]);
  if (bodyFromData) {
    return bodyFromData;
  }

  return readTrimmedString(getNotificationRequestContent(payload)?.body);
};

export const ensureNotificationHandlerConfigured = () => {
  if (hasConfiguredNotificationHandler) {
    return true;
  }

  const notifications = getOptionalNotificationsModule();
  if (!notifications) {
    return false;
  }

  try {
    notifications.setNotificationHandler({
      handleNotification: async (notification) =>
        isCustomNotificationPayload(notification)
          ? {
              shouldShowBanner: false,
              shouldShowList: false,
              shouldPlaySound: false,
              shouldSetBadge: false,
            }
          : {
              shouldShowBanner: true,
              shouldShowList: true,
              shouldPlaySound: true,
              shouldSetBadge: false,
            },
    });
    hasConfiguredNotificationHandler = true;
    return true;
  } catch (error) {
    warnNotificationsUnavailable(error);
    return false;
  }
};

const getPushTokenDocId = (token: string) => encodeURIComponent(token);
const createPushInstallationId = () =>
  `install_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;
const getPushInstallationDocId = ({
  uid,
  installationId,
}: {
  uid: string;
  installationId: string;
}) => encodeURIComponent(`${uid}:${installationId}`);

const waitAsync = (durationMs: number) =>
  new Promise<void>((resolve) => {
    setTimeout(resolve, durationMs);
  });

const getErrorCode = (error: unknown) =>
  typeof error === "object" &&
  error !== null &&
  "code" in error &&
  typeof (error as { code?: unknown }).code === "string"
    ? ((error as { code: string }).code || "").trim()
    : "";

const getErrorMessage = (error: unknown) =>
  error instanceof Error
    ? error.message.trim()
    : typeof error === "string"
      ? error.trim()
      : "";

const getPushTokenProvider = (platform: string) =>
  platform.trim().toLowerCase() === "android"
    ? "fcm"
    : platform.trim().toLowerCase() === "ios"
      ? "apns"
      : "unknown";

const isRetryableDevicePushTokenError = (error: unknown) => {
  const errorCode = getErrorCode(error);
  if (errorCode === "ERR_NOTIFICATIONS_NETWORK_ERROR") {
    return true;
  }

  if (errorCode === "ERR_NOTIFICATIONS_SERVER_ERROR") {
    return true;
  }

  const errorMessage = getErrorMessage(error).toLowerCase();
  if (!errorMessage) {
    return false;
  }

  return (
    errorMessage.includes("timed out") ||
    errorMessage.includes("timeout") ||
    errorMessage.includes("temporar") ||
    errorMessage.includes("network")
  );
};

const createPushRegistrationFailureResult = ({
  error,
}: {
  error: unknown;
}): PushTokenRegistrationResult => {
  const debugMessage = getErrorMessage(error);
  const errorCode = getErrorCode(error);

  if (errorCode === "ERR_NOTIFICATIONS_NETWORK_ERROR") {
    return {
      status: "network-error",
      token: null,
      errorMessage:
        "Couldn't reach the push notification service. Check the device connection and try again.",
      debugMessage,
    };
  }

  if (
    errorCode === "ERR_NOTIFICATIONS_NO_EXPERIENCE_ID" ||
    errorCode === "ERR_NOTIFICATIONS_NO_APPLICATION_ID" ||
    errorCode === "ERR_NOTIFICATIONS_UNAVAILABLE"
  ) {
    return {
      status: "configuration-error",
      token: null,
      errorMessage:
        Platform.OS === "android"
          ? "Push notification configuration is incomplete. Verify Firebase/FCM app configuration and rebuild the app."
          : Platform.OS === "ios"
            ? "Push notification configuration is incomplete. Verify APNs entitlements/capabilities and rebuild the app."
            : "Push notification configuration is incomplete.",
      debugMessage,
    };
  }

  return {
    status: "service-error",
    token: null,
    errorMessage:
      Platform.OS === "android"
        ? "Failed to register Android device token for FCM. Verify Firebase configuration and retry."
        : Platform.OS === "ios"
          ? "Failed to register iOS device token for APNs. Verify APNs setup and retry."
          : "Push token registration failed.",
    debugMessage,
  };
};

const cachePushTokenAsync = async (token: string) => {
  await AsyncStorage.setItem(PUSH_TOKEN_STORAGE_KEY, token);
};
const cachePushTokenDocIdAsync = async (docId: string) => {
  await AsyncStorage.setItem(PUSH_TOKEN_DOC_ID_STORAGE_KEY, docId);
};
const getCachedPushTokenDocIdAsync = async () =>
  (await AsyncStorage.getItem(PUSH_TOKEN_DOC_ID_STORAGE_KEY))?.trim() || "";
const getCachedPushInstallationIdAsync = async () =>
  (await AsyncStorage.getItem(PUSH_INSTALLATION_ID_STORAGE_KEY))?.trim() || "";
const getOrCreatePushInstallationIdAsync = async () => {
  const cachedInstallationId =
    (await AsyncStorage.getItem(PUSH_INSTALLATION_ID_STORAGE_KEY))?.trim() || "";

  if (cachedInstallationId) {
    return cachedInstallationId;
  }

  const nextInstallationId = createPushInstallationId();
  await AsyncStorage.setItem(PUSH_INSTALLATION_ID_STORAGE_KEY, nextInstallationId);
  return nextInstallationId;
};

const chunkMessages = <T,>(items: T[], size: number) => {
  const chunks: T[][] = [];

  for (let index = 0; index < items.length; index += size) {
    chunks.push(items.slice(index, index + size));
  }

  return chunks;
};

const readStringValue = (value: unknown) => (typeof value === "string" ? value.trim() : "");
const readTimestampMillis = (value: unknown) => {
  if (!value) {
    return NaN;
  }

  if (value instanceof Date) {
    return value.getTime();
  }

  if (typeof value !== "object") {
    return NaN;
  }

  const normalizedValue = value as {
    nanoseconds?: unknown;
    seconds?: unknown;
    toMillis?: unknown;
  };

  if (typeof normalizedValue.toMillis === "function") {
    const millis = (normalizedValue.toMillis as () => number)();
    return Number.isFinite(millis) ? millis : NaN;
  }

  if (typeof normalizedValue.seconds === "number") {
    const nanos =
      typeof normalizedValue.nanoseconds === "number" ? normalizedValue.nanoseconds : 0;
    return normalizedValue.seconds * 1000 + Math.floor(nanos / 1_000_000);
  }

  return NaN;
};
const readPushTokenLastSeenAtMillis = (data: DocumentData) => {
  const updatedAtMillis = readTimestampMillis(data.updatedAt);
  const lastAuthenticatedAtMillis = readTimestampMillis(data.lastAuthenticatedAt);

  if (Number.isFinite(updatedAtMillis) && Number.isFinite(lastAuthenticatedAtMillis)) {
    return Math.max(updatedAtMillis, lastAuthenticatedAtMillis);
  }
  if (Number.isFinite(updatedAtMillis)) {
    return updatedAtMillis;
  }
  if (Number.isFinite(lastAuthenticatedAtMillis)) {
    return lastAuthenticatedAtMillis;
  }
  return NaN;
};

const getUniqueStrings = (values: string[]) =>
  [...new Set(values.map((value) => value.trim()).filter(Boolean))];

const truncateText = (value: string, limit: number) => {
  if (value.length <= limit) {
    return value;
  }

  return `${value.slice(0, Math.max(0, limit - 3)).trimEnd()}...`;
};

const getPostPublishNotificationBody = (content: string) => {
  const lines = content
    .split(/\r?\n+/)
    .map((line) => line.replace(/\s+/g, " ").trim())
    .filter(Boolean);

  if (!lines.length) {
    return DEFAULT_POST_PUBLISH_BODY;
  }

  return truncateText(lines.slice(0, 2).join("\n"), MAX_POST_PUBLISH_BODY_LENGTH);
};

const getNotificationImageUrl = (imageUrl: string) => {
  const normalizedImageUrl = readStringValue(imageUrl);

  if (!/^https?:\/\/\S+$/i.test(normalizedImageUrl)) {
    return "";
  }

  return normalizedImageUrl;
};

const getAndroidNotificationChannelId = (platform?: string) =>
  platform?.trim().toLowerCase() === "android" ? DEFAULT_ANDROID_CHANNEL_ID : undefined;

const buildPostPublishedPushMessage = ({
  token,
  postId,
  postTitle,
  postContent,
  imageUrl,
  platform,
}: {
  token: string;
  postId: string;
  postTitle: string;
  postContent: string;
  imageUrl?: string;
  platform?: string;
}): ExpoPushMessage => {
  const normalizedImageUrl = getNotificationImageUrl(imageUrl ?? "");

  return {
    to: token,
    title: postTitle.trim() || "New Post Published",
    body: getPostPublishNotificationBody(postContent),
    sound: "default",
    priority: "high",
    channelId: getAndroidNotificationChannelId(platform),
    richContent: normalizedImageUrl
      ? {
          image: normalizedImageUrl,
        }
      : undefined,
    data: {
      type: "post_published",
      postId: postId.trim(),
    },
  };
};

const buildPostApprovedForAuthorPushMessage = ({
  token,
  postId,
  postTitle,
  imageUrl,
  platform,
}: {
  token: string;
  postId: string;
  postTitle: string;
  imageUrl?: string;
  platform?: string;
}): ExpoPushMessage => {
  const normalizedTitle = postTitle.trim() || "Your post";
  const normalizedImageUrl = getNotificationImageUrl(imageUrl ?? "");

  return {
    to: token,
    title: "Your Post Is Approved",
    body: `"${normalizedTitle}" has been approved and published on DevGeet.`,
    sound: "default",
    priority: "high",
    channelId: getAndroidNotificationChannelId(platform),
    richContent: normalizedImageUrl
      ? {
          image: normalizedImageUrl,
        }
      : undefined,
    data: {
      type: "post_published",
      postId: postId.trim(),
    },
  };
};

const buildCustomPushMessage = ({
  token,
  title,
  body,
  imageUrl,
  data,
  platform,
}: {
  token: string;
  title: string;
  body: string;
  imageUrl?: string;
  data?: Record<string, string>;
  platform?: string;
}): ExpoPushMessage => {
  const normalizedImageUrl = getNotificationImageUrl(imageUrl ?? "");

  return {
    to: token,
    title: title.trim() || "DevGeet",
    body: body.trim(),
    sound: "default",
    priority: "high",
    channelId: getAndroidNotificationChannelId(platform),
    richContent: normalizedImageUrl
      ? {
          image: normalizedImageUrl,
        }
      : undefined,
    data: {
      ...(data ?? {}),
      type: "custom_notification",
    },
  };
};

const readPushTokenData = (data: DocumentData) => ({
  uid: readStringValue(data.uid),
  token: readStringValue(data.token),
  isActive: data.isActive !== false,
  platform: readStringValue(data.platform),
});
const getUniquePushTokenRecords = <
  T extends {
    token: string;
  },
>(
  tokens: T[],
) => {
  const tokensByValue = new Map<string, T>();

  tokens.forEach((item) => {
    if (!tokensByValue.has(item.token)) {
      tokensByValue.set(item.token, item);
    }
  });

  return [...tokensByValue.values()];
};
const pruneStalePushTokenDocsForUserAsync = async ({
  uid,
  keepDocId,
}: {
  uid: string;
  keepDocId: string;
}) => {
  const normalizedUid = uid.trim();
  if (!normalizedUid) {
    return;
  }

  const now = Date.now();
  const deactivateThresholdMillis = now - PUSH_TOKEN_DEACTIVATE_AGE_MS;
  const deleteThresholdMillis = now - PUSH_TOKEN_DELETE_AGE_MS;
  const userTokenSnapshot = await getDocs(
    query(
      collection(firestore, PUSH_TOKENS_COLLECTION),
      where("uid", "==", normalizedUid),
    ),
  );
  const staleDocOperations: Promise<unknown>[] = [];

  userTokenSnapshot.docs.forEach((item) => {
    if (item.id === keepDocId) {
      return;
    }

    const data = item.data() as DocumentData;
    const lastSeenAtMillis = readPushTokenLastSeenAtMillis(data);
    if (!Number.isFinite(lastSeenAtMillis)) {
      return;
    }

    if (lastSeenAtMillis <= deleteThresholdMillis) {
      staleDocOperations.push(deleteDoc(item.ref));
      return;
    }

    const isActive = data.isActive !== false;
    if (isActive && lastSeenAtMillis <= deactivateThresholdMillis) {
      staleDocOperations.push(
        setDoc(
          item.ref,
          {
            isActive: false,
            deactivatedAt: serverTimestamp(),
          },
          { merge: true },
        ),
      );
    }
  });

  if (!staleDocOperations.length) {
    return;
  }

  await Promise.allSettled(staleDocOperations);
};

const getPushRecipientCount = (tokens: { uid: string }[]) =>
  new Set(tokens.map((item) => item.uid).filter(Boolean)).size;

const isDeletedAccountStatus = (value: unknown) =>
  normalizeAccountStatus(readStringValue(value)) === "deleted";

const isExistingActiveUserAsync = async (uid: string) => {
  const normalizedUid = uid.trim();

  if (!normalizedUid) {
    return false;
  }

  const userSnapshot = await getDoc(doc(firestore, USERS_COLLECTION, normalizedUid));
  return userSnapshot.exists() && !isDeletedAccountStatus((userSnapshot.data() as DocumentData)?.accountStatus);
};

export const configureNotificationsAsync = async () => {
  if (Platform.OS !== "android") {
    return;
  }

  const notifications = getOptionalNotificationsModule();
  if (!notifications) {
    return;
  }

  await notifications.setNotificationChannelAsync(DEFAULT_ANDROID_CHANNEL_ID, {
    name: "Default",
    importance: notifications.AndroidImportance.MAX,
    vibrationPattern: [0, 250, 250, 250],
    lightColor: LIGHT_COLORS.background,
  });
};

export const getCachedPushTokenAsync = async () =>
  (await AsyncStorage.getItem(PUSH_TOKEN_STORAGE_KEY))?.trim() || "";

export const clearCachedPushTokenAsync = async () => {
  await Promise.allSettled([
    AsyncStorage.removeItem(PUSH_TOKEN_STORAGE_KEY),
    AsyncStorage.removeItem(PUSH_TOKEN_DOC_ID_STORAGE_KEY),
  ]);
};

export const getNotificationPostId = (response: unknown) => {
  return readTrimmedString(getNotificationPayloadData(response).postId);
};

export const registerForPushNotificationsAsync =
  async (): Promise<PushTokenRegistrationResult> => {
    if (Platform.OS === "web") {
      return { status: "web-unsupported", token: null };
    }

    const notifications = getOptionalNotificationsModule();
    if (!notifications) {
      return { status: "module-unavailable", token: null };
    }

    if (!Device.isDevice) {
      return { status: "physical-device-required", token: null };
    }

    ensureNotificationHandlerConfigured();
    await configureNotificationsAsync();

    const existingPermissions = await notifications.getPermissionsAsync();
    let finalStatus = existingPermissions.status;

    if (finalStatus !== "granted") {
      const requestedPermissions = await notifications.requestPermissionsAsync();
      finalStatus = requestedPermissions.status;
    }

    if (finalStatus !== "granted") {
      return { status: "permission-denied", token: null };
    }

    let registrationError: unknown = null;

    for (const [attemptIndex, delayMs] of [0, ...DEVICE_PUSH_TOKEN_RETRY_DELAYS_MS].entries()) {
      if (delayMs > 0) {
        await waitAsync(delayMs);
      }

      try {
        const devicePushToken = await notifications.getDevicePushTokenAsync();
        const token = readStringValue(devicePushToken.data);

        if (!token) {
          throw new Error("Empty native push token received.");
        }

        await cachePushTokenAsync(token);

        return {
          status: "registered",
          token,
        };
      } catch (error) {
        registrationError = error;
        const isLastAttempt = attemptIndex === DEVICE_PUSH_TOKEN_RETRY_DELAYS_MS.length;

        if (!isRetryableDevicePushTokenError(error) || isLastAttempt) {
          break;
        }
      }
    }

    return createPushRegistrationFailureResult({
      error:
        registrationError ??
        new Error("Unable to register the device for push notifications."),
    });
  };

export const syncPushTokenAsync = async ({
  uid,
  token,
  previousToken,
}: {
  uid: string;
  token: string;
  previousToken?: string;
}) => {
  const normalizedUid = uid.trim();
  const normalizedToken = token.trim();
  const normalizedPreviousToken = previousToken?.trim() || "";

  if (!normalizedUid || !normalizedToken) {
    return;
  }

  const previouslyCachedDocId = await getCachedPushTokenDocIdAsync();
  const installationId = await getOrCreatePushInstallationIdAsync();
  const pushTokenDocId = getPushInstallationDocId({
    uid: normalizedUid,
    installationId,
  });
  const pushTokenRef = doc(
    firestore,
    PUSH_TOKENS_COLLECTION,
    pushTokenDocId,
  );

  await Promise.all([
    cachePushTokenAsync(normalizedToken),
    cachePushTokenDocIdAsync(pushTokenDocId),
  ]);

  await setDoc(
    pushTokenRef,
    {
      uid: normalizedUid,
      token: normalizedToken,
      installationId,
      isActive: true,
      platform: Platform.OS,
      provider: getPushTokenProvider(Platform.OS),
      appOwnership: Constants.appOwnership ?? null,
      deviceName: Device.deviceName?.trim() || null,
      deviceBrand: Device.brand ?? null,
      lastAuthenticatedAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    },
    { merge: true },
  );

  const legacyTokenDocIds = new Set<string>([getPushTokenDocId(normalizedToken)]);
  if (normalizedPreviousToken && normalizedPreviousToken !== normalizedToken) {
    legacyTokenDocIds.add(getPushTokenDocId(normalizedPreviousToken));
  }
  if (previouslyCachedDocId) {
    legacyTokenDocIds.add(previouslyCachedDocId);
  }

  await Promise.allSettled(
    [...legacyTokenDocIds]
      .filter((legacyDocId) => legacyDocId && legacyDocId !== pushTokenDocId)
      .map((legacyDocId) =>
        deleteDoc(doc(firestore, PUSH_TOKENS_COLLECTION, legacyDocId)),
      ),
  );

  const userTokenSnapshot = await getDocs(
    query(
      collection(firestore, PUSH_TOKENS_COLLECTION),
      where("uid", "==", normalizedUid),
    ),
  );
  const duplicateDocIds = userTokenSnapshot.docs
    .map((item) => ({
      docId: item.id,
      ...readPushTokenData(item.data() as DocumentData),
    }))
    .filter(
      (item) =>
        item.docId !== pushTokenDocId &&
        (item.token === normalizedToken ||
          (normalizedPreviousToken && item.token === normalizedPreviousToken)),
    )
    .map((item) => item.docId);

  if (duplicateDocIds.length) {
    await Promise.allSettled(
      [...new Set(duplicateDocIds)].map((docId) =>
        deleteDoc(doc(firestore, PUSH_TOKENS_COLLECTION, docId)),
      ),
    );
  }

  await pruneStalePushTokenDocsForUserAsync({
    uid: normalizedUid,
    keepDocId: pushTokenDocId,
  }).catch(() => {
    // Ignore stale-doc cleanup failures to avoid blocking sign-in token sync.
  });
};

export const deletePushTokenAsync = async (
  tokenOrPayload: string | { token: string; uid?: string },
) => {
  const normalizedToken =
    typeof tokenOrPayload === "string"
      ? tokenOrPayload.trim()
      : tokenOrPayload.token.trim();
  const normalizedUid =
    typeof tokenOrPayload === "string"
      ? ""
      : (tokenOrPayload.uid ?? "").trim();

  const cachedDocId = await getCachedPushTokenDocIdAsync();
  const cachedInstallationId = await getCachedPushInstallationIdAsync();
  if (!normalizedToken && !cachedDocId && !normalizedUid) {
    return;
  }

  const docIdsToDelete = new Set<string>();
  if (normalizedToken) {
    docIdsToDelete.add(getPushTokenDocId(normalizedToken));
  }
  if (cachedDocId) {
    docIdsToDelete.add(cachedDocId);
  }
  if (normalizedUid && cachedInstallationId) {
    docIdsToDelete.add(
      getPushInstallationDocId({
        uid: normalizedUid,
        installationId: cachedInstallationId,
      }),
    );
  }
  if (normalizedUid) {
    const userTokenSnapshot = await getDocs(
      query(
        collection(firestore, PUSH_TOKENS_COLLECTION),
        where("uid", "==", normalizedUid),
      ),
    );

    userTokenSnapshot.docs.forEach((item) => {
      const pushTokenData = readPushTokenData(item.data() as DocumentData);
      if (!normalizedToken || pushTokenData.token === normalizedToken) {
        docIdsToDelete.add(item.id);
      }
    });
  }

  await Promise.allSettled(
    [...docIdsToDelete]
      .filter(Boolean)
      .map((docId) => deleteDoc(doc(firestore, PUSH_TOKENS_COLLECTION, docId))),
  );

  await clearCachedPushTokenAsync();
};

const getActivePushTokensForUserAsync = async (uid: string) => {
  const normalizedUid = uid.trim();
  if (!normalizedUid) {
    return [];
  }

  const userSnapshot = await getDoc(doc(firestore, USERS_COLLECTION, normalizedUid));
  if (userSnapshot.exists() && isDeletedAccountStatus((userSnapshot.data() as DocumentData)?.accountStatus)) {
    return [];
  }

  const snapshot = await getDocs(
    query(
      collection(firestore, PUSH_TOKENS_COLLECTION),
      where("uid", "==", normalizedUid),
    ),
  );

  return getUniquePushTokenRecords(
    snapshot.docs
      .map((item) => ({
        docId: item.id,
        ...readPushTokenData(item.data() as DocumentData),
      }))
      .filter((item) => item.isActive && item.token),
  );
};

const getActiveUsersAndPushTokensAsync = async ({
  excludeUids = [],
}: {
  excludeUids?: string[];
} = {}) => {
  const normalizedExcludedUids = new Set(
    excludeUids.map((uid) => uid.trim()).filter(Boolean),
  );

  const [usersSnapshot, pushTokensSnapshot] = await Promise.all([
    getDocs(collection(firestore, USERS_COLLECTION)),
    getDocs(collection(firestore, PUSH_TOKENS_COLLECTION)),
  ]);

  const activeUserUids = usersSnapshot.docs
    .map((item) => ({
      uid: item.id,
      accountStatus: readStringValue((item.data() as DocumentData)?.accountStatus),
    }))
    .filter(
      (item) => !isDeletedAccountStatus(item.accountStatus) && !normalizedExcludedUids.has(item.uid),
    )
    .map((item) => item.uid);
  const activeUserUidSet = new Set(activeUserUids);
  const tokens = getUniquePushTokenRecords(
    pushTokensSnapshot.docs
      .map((item) => ({
        docId: item.id,
        ...readPushTokenData(item.data() as DocumentData),
      }))
      .filter(
        (item) =>
          item.isActive &&
          item.uid &&
          item.token &&
          activeUserUidSet.has(item.uid),
      ),
  );

  return {
    activeUserUids,
    tokens,
  };
};

const getActivePushTokensForAllActiveUsersAsync = async ({
  excludeUids = [],
}: {
  excludeUids?: string[];
} = {}) => {
  const { tokens } = await getActiveUsersAndPushTokensAsync({ excludeUids });
  return tokens;
};

const deletePushTokenDocsByTokenAsync = async (token: string) => {
  const normalizedToken = token.trim();
  if (!normalizedToken) {
    return;
  }

  const docIdsToDelete = new Set<string>([getPushTokenDocId(normalizedToken)]);

  try {
    const tokenSnapshot = await getDocs(
      query(
        collection(firestore, PUSH_TOKENS_COLLECTION),
        where("token", "==", normalizedToken),
      ),
    );

    tokenSnapshot.docs.forEach((item) => {
      docIdsToDelete.add(item.id);
    });
  } catch {
    // Ignore query failures when token-lookup reads are restricted for this client.
  }

  await Promise.allSettled(
    [...docIdsToDelete]
      .filter(Boolean)
      .map((docId) => deleteDoc(doc(firestore, PUSH_TOKENS_COLLECTION, docId))),
  );
};

const sendExpoPushMessagesAsync = async (messages: ExpoPushMessage[]) => {
  if (!messages.length) {
    return;
  }

  const invalidTokens = new Set<string>();
  const ticketErrors = new Set<string>();
  const messageChunks = chunkMessages(messages, 100);

  for (const chunk of messageChunks) {
    const response = await fetch(EXPO_PUSH_API_URL, {
      method: "POST",
      headers: {
        Accept: "application/json",
        "Accept-Encoding": "gzip, deflate",
        "Content-Type": "application/json",
      },
      body: JSON.stringify(chunk),
    });

    if (!response.ok) {
      throw new Error(`Expo push API responded with status ${response.status}.`);
    }

    const payload = (await response.json()) as {
      data?: ExpoPushTicket | ExpoPushTicket[];
    };
    const tickets = Array.isArray(payload.data)
      ? payload.data
      : payload.data
        ? [payload.data]
        : [];

    tickets.forEach((ticket, index) => {
      if (ticket.status !== "error") {
        return;
      }

      const errorCode = readStringValue(ticket.details?.error);
      if (errorCode === "DeviceNotRegistered") {
        const invalidToken = readStringValue(chunk[index]?.to ?? "");
        if (invalidToken) {
          invalidTokens.add(invalidToken);
        }
        return;
      }

      ticketErrors.add(errorCode || "UnknownError");
    });
  }

  if (invalidTokens.size) {
    await Promise.allSettled(
      [...invalidTokens].map((token) => deletePushTokenDocsByTokenAsync(token)),
    );
  }

  if (ticketErrors.size) {
    throw new Error(
      `Expo push delivery failed for ${ticketErrors.size} error type(s): ${[...ticketErrors].join(", ")}.`,
    );
  }
};

export const sendPostPublishedNotificationToUserAsync = async ({
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
  const normalizedPostTitle = postTitle.trim();

  if (!normalizedUid || !normalizedPostId) {
    return false;
  }

  if (!useLegacyClientPushDispatch) {
    return callPushDispatchAsync<boolean>({
      action: "post-published-to-user",
      payload: {
        uid: normalizedUid,
        postId: normalizedPostId,
        postTitle: normalizedPostTitle,
        imageUrl,
      },
    });
  }

  const tokens = await getActivePushTokensForUserAsync(uid);

  if (!tokens.length) {
    return false;
  }

  await sendExpoPushMessagesAsync(
    tokens.map((item) =>
      buildPostApprovedForAuthorPushMessage({
        token: item.token,
        postId,
        postTitle,
        imageUrl,
        platform: item.platform,
      }),
    ),
  );

  return true;
};

export const sendPostPublishedNotificationToAllActiveUsersAsync = async ({
  postId,
  postTitle,
  postContent,
  imageUrl,
  excludeUids = [],
}: {
  postId: string;
  postTitle: string;
  postContent: string;
  imageUrl?: string;
  excludeUids?: string[];
}) => {
  const normalizedPostId = postId.trim();
  const normalizedPostTitle = postTitle.trim();
  const normalizedPostContent = postContent.trim();
  const normalizedExcludeUids = getUniqueStrings(excludeUids);

  if (!normalizedPostId || !normalizedPostTitle || !normalizedPostContent) {
    return false;
  }

  if (!useLegacyClientPushDispatch) {
    return callPushDispatchAsync<boolean>({
      action: "post-published-to-all",
      payload: {
        postId: normalizedPostId,
        postTitle: normalizedPostTitle,
        postContent: normalizedPostContent,
        imageUrl,
        excludeUids: normalizedExcludeUids,
      },
    });
  }

  const tokens = await getActivePushTokensForAllActiveUsersAsync({ excludeUids });

  if (!tokens.length) {
    return false;
  }

  await sendExpoPushMessagesAsync(
    tokens.map((item) =>
      buildPostPublishedPushMessage({
        token: item.token,
        postId,
        postTitle,
        postContent,
        imageUrl,
        platform: item.platform,
      }),
    ),
  );

  return true;
};

export const sendCustomPushNotificationToUserAsync = async ({
  uid,
  title,
  body,
  imageUrl,
  data,
  category = "general",
  sendPush = true,
  audience = "single",
}: {
  uid: string;
  title: string;
  body: string;
  imageUrl?: string;
  data?: Record<string, string>;
  category?: UserNotificationCategory;
  sendPush?: boolean;
  audience?: UserNotificationAudience;
}): Promise<CustomNotificationDispatchResult> => {
  const normalizedUid = uid.trim();
  const normalizedTitle = title.trim();
  const normalizedBody = body.trim();

  if (!normalizedUid || !normalizedTitle || !normalizedBody) {
    return {
      savedCount: 0,
      pushRecipientCount: 0,
      pushTokenCount: 0,
    };
  }

  if (!useLegacyClientPushDispatch) {
    return callPushDispatchAsync<CustomNotificationDispatchResult>({
      action: "custom-single",
      payload: {
        uid: normalizedUid,
        title: normalizedTitle,
        body: normalizedBody,
        imageUrl,
        data,
        category,
        sendPush,
        audience,
      },
    });
  }

  if (!(await isExistingActiveUserAsync(normalizedUid))) {
    return {
      savedCount: 0,
      pushRecipientCount: 0,
      pushTokenCount: 0,
    };
  }

  const tokens = sendPush ? await getActivePushTokensForUserAsync(normalizedUid) : [];

  if (sendPush && tokens.length) {
    await sendExpoPushMessagesAsync(
      tokens.map((item) =>
        buildCustomPushMessage({
          token: item.token,
          title: normalizedTitle,
          body: normalizedBody,
          imageUrl,
          data,
          platform: item.platform,
        }),
      ),
    );
  }

  const didSaveNotification = await createCustomUserNotificationAsync({
    uid: normalizedUid,
    title: normalizedTitle,
    body: normalizedBody,
    imageUrl,
    category,
    audience,
    pushEnabled: sendPush,
  });

  return {
    savedCount: didSaveNotification ? 1 : 0,
    pushRecipientCount: getPushRecipientCount(tokens),
    pushTokenCount: tokens.length,
  };
};

export const sendCustomPushNotificationToAllActiveUsersAsync = async ({
  title,
  body,
  imageUrl,
  data,
  excludeUids = [],
  category = "general",
  sendPush = true,
  audience = "all",
}: {
  title: string;
  body: string;
  imageUrl?: string;
  data?: Record<string, string>;
  excludeUids?: string[];
  category?: UserNotificationCategory;
  sendPush?: boolean;
  audience?: UserNotificationAudience;
}): Promise<CustomNotificationDispatchResult> => {
  const normalizedTitle = title.trim();
  const normalizedBody = body.trim();
  const normalizedExcludedUids = new Set(
    excludeUids.map((uid) => uid.trim()).filter(Boolean),
  );

  if (!normalizedTitle || !normalizedBody) {
    return {
      savedCount: 0,
      pushRecipientCount: 0,
      pushTokenCount: 0,
    };
  }

  if (!useLegacyClientPushDispatch) {
    return callPushDispatchAsync<CustomNotificationDispatchResult>({
      action: "custom-all",
      payload: {
        title: normalizedTitle,
        body: normalizedBody,
        imageUrl,
        data,
        excludeUids: [...normalizedExcludedUids],
        category,
        sendPush,
        audience,
      },
    });
  }

  const { activeUserUids, tokens } = sendPush
    ? await getActiveUsersAndPushTokensAsync({
        excludeUids,
      })
    : {
        activeUserUids: (
          await getDocs(collection(firestore, USERS_COLLECTION))
        ).docs
          .map((item) => ({
            uid: item.id,
            accountStatus: readStringValue((item.data() as DocumentData)?.accountStatus),
          }))
          .filter(
            (item) =>
              !isDeletedAccountStatus(item.accountStatus) &&
              !normalizedExcludedUids.has(item.uid),
          )
          .map((item) => item.uid),
        tokens: [],
      };

  if (!activeUserUids.length) {
    return {
      savedCount: 0,
      pushRecipientCount: 0,
      pushTokenCount: 0,
    };
  }

  if (sendPush && tokens.length) {
    await sendExpoPushMessagesAsync(
      tokens.map((item) =>
        buildCustomPushMessage({
          token: item.token,
          title: normalizedTitle,
          body: normalizedBody,
          imageUrl,
          data,
          platform: item.platform,
        }),
      ),
    );
  }

  const savedCount = await createCustomUserNotificationsAsync({
    uids: getUniqueStrings(activeUserUids),
    title: normalizedTitle,
    body: normalizedBody,
    imageUrl,
    category,
    audience,
    pushEnabled: sendPush,
  });

  return {
    savedCount,
    pushRecipientCount: getPushRecipientCount(tokens),
    pushTokenCount: tokens.length,
  };
};

export const notifyPostPublishedAsync = async ({
  authorUid,
  actorUid,
  postId,
  postTitle,
  postContent,
  imageUrl,
}: {
  authorUid?: string;
  actorUid?: string;
  postId: string;
  postTitle: string;
  postContent: string;
  imageUrl?: string;
}) => {
  const normalizedAuthorUid = authorUid?.trim() || "";
  const normalizedActorUid = actorUid?.trim() || "";

  if (!postId.trim() || !postTitle.trim() || !postContent.trim()) {
    return false;
  }

  if (!useLegacyClientPushDispatch) {
    return callPushDispatchAsync<boolean>({
      action: "post-published",
      payload: {
        authorUid: normalizedAuthorUid,
        actorUid: normalizedActorUid,
        postId: postId.trim(),
        postTitle: postTitle.trim(),
        postContent: postContent.trim(),
        imageUrl,
      },
    });
  }

  const shouldNotifyAuthor =
    normalizedAuthorUid && normalizedAuthorUid !== normalizedActorUid;
  const tasks: Promise<boolean>[] = [
    sendPostPublishedNotificationToAllActiveUsersAsync({
      postId,
      postTitle,
      postContent,
      imageUrl,
      excludeUids: shouldNotifyAuthor ? [normalizedAuthorUid] : [],
    }),
  ];

  if (shouldNotifyAuthor) {
    tasks.push(
      sendPostPublishedNotificationToUserAsync({
        uid: normalizedAuthorUid,
        postId,
        postTitle,
        imageUrl,
      }),
    );
    tasks.push(
      createPostApprovedUserNotificationAsync({
        uid: normalizedAuthorUid,
        postId,
        postTitle,
        imageUrl,
      }).then(() => true),
    );
  }

  const results = await Promise.allSettled(tasks);
  const failedResult = results.find((result) => result.status === "rejected");

  if (failedResult?.status === "rejected") {
    throw failedResult.reason;
  }

  return results.some(
    (result) => result.status === "fulfilled" && result.value,
  );
};

export const sendTestPushNotificationAsync = async ({
  token,
  accountName,
  platform,
}: {
  token: string;
  accountName?: string;
  platform?: string;
}) => {
  const normalizedToken = token.trim();

  if (!normalizedToken) {
    return false;
  }

  if (!useLegacyClientPushDispatch) {
    return callPushDispatchAsync<boolean>({
      action: "test-token",
      payload: {
        token: normalizedToken,
        accountName,
        platform,
      },
    });
  }

  const normalizedAccountName = accountName?.trim() || "your account";

  await sendExpoPushMessagesAsync([
    {
      to: normalizedToken,
      title: "DevGeet Test Notification",
      body: `Push notifications are working for ${normalizedAccountName}.`,
      sound: "default",
      priority: "high",
      channelId: getAndroidNotificationChannelId(platform),
      data: {
        type: "test_push",
      },
    },
  ]);

  return true;
};
