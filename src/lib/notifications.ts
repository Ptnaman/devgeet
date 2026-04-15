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
import { Platform } from "react-native";

import { LIGHT_COLORS } from "@/constants/theme";
import { normalizeAccountStatus } from "@/lib/access";
import { firestore } from "@/lib/firebase";
import {
  createCustomUserNotificationAsync,
  createCustomUserNotificationsAsync,
  createPostApprovedUserNotificationAsync,
} from "@/lib/user-notifications";

export const PUSH_TOKENS_COLLECTION = "pushTokens";
const USERS_COLLECTION = "users";

const EXPO_PUSH_API_URL = "https://exp.host/--/api/v2/push/send";
const DEFAULT_ANDROID_CHANNEL_ID = "default";
const PUSH_TOKEN_STORAGE_KEY = "@devgeet/expoPushToken";
const DEFAULT_POST_PUBLISH_BODY = "Tap to read it on DevGeet.";
const MAX_POST_PUBLISH_BODY_LENGTH = 180;
const EXPO_PUSH_TOKEN_RETRY_DELAYS_MS = [750, 1500] as const;
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
      handleNotification: async () => ({
        shouldShowBanner: true,
        shouldShowList: true,
        shouldPlaySound: true,
        shouldSetBadge: false,
      }),
    });
    hasConfiguredNotificationHandler = true;
    return true;
  } catch (error) {
    warnNotificationsUnavailable(error);
    return false;
  }
};

const getPushTokenDocId = (token: string) => encodeURIComponent(token);

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

const getExpoTokenFetchStatusCode = (message: string) => {
  const matchedStatus = message.match(/\breceived:\s*(\d{3})\b/i);
  return matchedStatus ? Number.parseInt(matchedStatus[1] ?? "", 10) : NaN;
};

const getExpoTokenFetchRequestId = (message: string) => {
  const matchedRequestId = message.match(/"requestId":"([^"]+)"/);
  return matchedRequestId?.[1]?.trim() || "";
};

const getPushRegistrationRequestIdSuffix = (message: string) => {
  const requestId = getExpoTokenFetchRequestId(message);
  return requestId ? ` Request ID: ${requestId}.` : "";
};

const isRetryableExpoPushTokenError = (error: unknown) => {
  const errorCode = getErrorCode(error);
  if (errorCode === "ERR_NOTIFICATIONS_NETWORK_ERROR") {
    return true;
  }

  if (errorCode !== "ERR_NOTIFICATIONS_SERVER_ERROR") {
    return false;
  }

  const statusCode = getExpoTokenFetchStatusCode(getErrorMessage(error));
  return Number.isNaN(statusCode) || statusCode >= 500;
};

const createPushRegistrationFailureResult = ({
  error,
  projectId,
}: {
  error: unknown;
  projectId: string;
}): PushTokenRegistrationResult => {
  const debugMessage = getErrorMessage(error);
  const errorCode = getErrorCode(error);
  const requestIdSuffix = getPushRegistrationRequestIdSuffix(debugMessage);

  if (errorCode === "ERR_NOTIFICATIONS_NETWORK_ERROR") {
    return {
      status: "network-error",
      token: null,
      errorMessage:
        "Couldn't reach Expo's push notification service. Check the device connection and try again.",
      debugMessage,
    };
  }

  if (
    errorCode === "ERR_NOTIFICATIONS_NO_EXPERIENCE_ID" ||
    errorCode === "ERR_NOTIFICATIONS_NO_APPLICATION_ID"
  ) {
    return {
      status: "configuration-error",
      token: null,
      errorMessage:
        "Push notification configuration is incomplete. Verify the Expo project ID and native app identifiers, then rebuild the app.",
      debugMessage,
    };
  }

  const statusCode = getExpoTokenFetchStatusCode(debugMessage);
  if (!Number.isNaN(statusCode) && statusCode >= 400 && statusCode < 500) {
    return {
      status: "configuration-error",
      token: null,
      errorMessage: `Expo rejected push token registration. Verify that EAS project ${projectId} is linked to this app and rebuild if native IDs changed.${requestIdSuffix}`,
      debugMessage,
    };
  }

  return {
    status: "service-error",
    token: null,
    errorMessage:
      Platform.OS === "android"
        ? `Expo push token registration failed on the server. This usually means Android FCM V1 credentials are missing or outdated for EAS project ${projectId}, or Expo had a temporary backend failure. Verify the credentials, then rebuild the app if they changed.${requestIdSuffix}`
        : Platform.OS === "ios"
          ? `Expo push token registration failed on the server. Verify the APNs credentials for EAS project ${projectId}, then rebuild the app if they changed.${requestIdSuffix}`
          : `Expo push token registration failed on the server.${requestIdSuffix}`,
    debugMessage,
  };
};

const getExpoProjectId = () => {
  const easProjectId = Constants.easConfig?.projectId;
  if (typeof easProjectId === "string" && easProjectId.trim()) {
    return easProjectId.trim();
  }

  const extraProjectId = Constants.expoConfig?.extra?.eas?.projectId;
  return typeof extraProjectId === "string" && extraProjectId.trim()
    ? extraProjectId.trim()
    : "";
};

const cachePushTokenAsync = async (token: string) => {
  await AsyncStorage.setItem(PUSH_TOKEN_STORAGE_KEY, token);
};

const chunkMessages = <T,>(items: T[], size: number) => {
  const chunks: T[][] = [];

  for (let index = 0; index < items.length; index += size) {
    chunks.push(items.slice(index, index + size));
  }

  return chunks;
};

const readStringValue = (value: unknown) => (typeof value === "string" ? value.trim() : "");

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
  await AsyncStorage.removeItem(PUSH_TOKEN_STORAGE_KEY);
};

export const getNotificationPostId = (response: unknown) => {
  const data =
    typeof response === "object" && response !== null
      ? (
          response as {
            notification?: {
              request?: {
                content?: {
                  data?: unknown;
                };
              };
            };
          }
        ).notification?.request?.content?.data
      : null;

  if (!data || typeof data !== "object") {
    return "";
  }

  const postId = (data as Record<string, unknown>).postId;
  return typeof postId === "string" && postId.trim() ? postId.trim() : "";
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

    const projectId = getExpoProjectId();
    if (!projectId) {
      return {
        status: "configuration-error",
        token: null,
        errorMessage:
          "Expo project ID is missing from app configuration. Add extra.eas.projectId and rebuild the app.",
      };
    }

    let registrationError: unknown = null;

    for (const [attemptIndex, delayMs] of [0, ...EXPO_PUSH_TOKEN_RETRY_DELAYS_MS].entries()) {
      if (delayMs > 0) {
        await waitAsync(delayMs);
      }

      try {
        const expoPushToken = await notifications.getExpoPushTokenAsync({ projectId });
        const token = expoPushToken.data.trim();

        await cachePushTokenAsync(token);

        return {
          status: "registered",
          token,
        };
      } catch (error) {
        registrationError = error;
        const isLastAttempt = attemptIndex === EXPO_PUSH_TOKEN_RETRY_DELAYS_MS.length;

        if (!isRetryableExpoPushTokenError(error) || isLastAttempt) {
          break;
        }
      }
    }

    return createPushRegistrationFailureResult({
      error:
        registrationError ??
        new Error("Unable to register the device with Expo push notifications."),
      projectId,
    });
  };

export const syncPushTokenAsync = async ({
  uid,
  token,
}: {
  uid: string;
  token: string;
}) => {
  const normalizedUid = uid.trim();
  const normalizedToken = token.trim();

  if (!normalizedUid || !normalizedToken) {
    return;
  }

  const pushTokenRef = doc(
    firestore,
    PUSH_TOKENS_COLLECTION,
    getPushTokenDocId(normalizedToken),
  );

  await cachePushTokenAsync(normalizedToken);

  await setDoc(
    pushTokenRef,
    {
      uid: normalizedUid,
      token: normalizedToken,
      isActive: true,
      platform: Platform.OS,
      appOwnership: Constants.appOwnership ?? null,
      deviceName: Device.deviceName?.trim() || null,
      deviceBrand: Device.brand ?? null,
      lastAuthenticatedAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    },
    { merge: true },
  );
};

export const deletePushTokenAsync = async (token: string) => {
  const normalizedToken = token.trim();

  if (!normalizedToken) {
    return;
  }

  await deleteDoc(
    doc(firestore, PUSH_TOKENS_COLLECTION, getPushTokenDocId(normalizedToken)),
  );
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

  return snapshot.docs
    .map((item) => ({
      docId: item.id,
      ...readPushTokenData(item.data() as DocumentData),
    }))
     .filter((item) => item.isActive && item.token);
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
  const tokens = pushTokensSnapshot.docs
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

const sendExpoPushMessagesAsync = async (messages: ExpoPushMessage[]) => {
  if (!messages.length) {
    return;
  }

  const invalidTokenDocIds = new Set<string>();
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
        invalidTokenDocIds.add(getPushTokenDocId(chunk[index]?.to ?? ""));
        return;
      }

      ticketErrors.add(errorCode || "UnknownError");
    });
  }

  if (invalidTokenDocIds.size) {
    await Promise.allSettled(
      [...invalidTokenDocIds].map((docId) =>
        deleteDoc(doc(firestore, PUSH_TOKENS_COLLECTION, docId)),
      ),
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
}: {
  uid: string;
  title: string;
  body: string;
  imageUrl?: string;
  data?: Record<string, string>;
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

  if (!(await isExistingActiveUserAsync(normalizedUid))) {
    return {
      savedCount: 0,
      pushRecipientCount: 0,
      pushTokenCount: 0,
    };
  }

  const tokens = await getActivePushTokensForUserAsync(normalizedUid);

  if (tokens.length) {
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
}: {
  title: string;
  body: string;
  imageUrl?: string;
  data?: Record<string, string>;
  excludeUids?: string[];
}): Promise<CustomNotificationDispatchResult> => {
  const normalizedTitle = title.trim();
  const normalizedBody = body.trim();

  if (!normalizedTitle || !normalizedBody) {
    return {
      savedCount: 0,
      pushRecipientCount: 0,
      pushTokenCount: 0,
    };
  }

  const { activeUserUids, tokens } = await getActiveUsersAndPushTokensAsync({
    excludeUids,
  });

  if (!activeUserUids.length) {
    return {
      savedCount: 0,
      pushRecipientCount: 0,
      pushTokenCount: 0,
    };
  }

  if (tokens.length) {
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
