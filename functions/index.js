const admin = require("firebase-admin");
const logger = require("firebase-functions/logger");
const { HttpsError, onCall, onRequest } = require("firebase-functions/v2/https");
const { onSchedule } = require("firebase-functions/v2/scheduler");

if (!admin.apps.length) {
  admin.initializeApp();
}

const firestore = admin.firestore();

const REGION = "us-central1";
const USERS_COLLECTION = "users";
const PUSH_TOKENS_COLLECTION = "pushTokens";
const NOTIFICATIONS_COLLECTION = "notifications";
const PUSH_RECEIPTS_COLLECTION = "pushReceipts";
const POSTS_COLLECTION = "posts";
const CATEGORIES_COLLECTION = "categories";
const DEFAULT_ANDROID_CHANNEL_ID = "default";
const DEFAULT_POST_PUBLISH_BODY = "Tap to read it on DevGeet.";
const MAX_POST_PUBLISH_BODY_LENGTH = 180;
const FCM_SEND_CHUNK_SIZE = 500;
const NOTIFICATION_WRITE_CHUNK_SIZE = 300;
const DAY_IN_MS = 24 * 60 * 60 * 1000;
const PUSH_RECEIPT_DOC_TTL_DAYS = 7;
const WORDPRESS_SYNC_ACTOR_ID = "wordpress-sync";
const WORDPRESS_SYNC_SECRET_ENV_KEYS = ["WORDPRESS_SYNC_SECRET", "WP_SYNC_SECRET"];
const WORDPRESS_SITE_URL_ENV_KEYS = ["WORDPRESS_SITE_URL", "WORDPRESS_URL", "WP_SITE_URL"];
const DEFAULT_WORDPRESS_SITE_URL = "https://devgeet.com";
const WORDPRESS_REST_MAX_PER_PAGE = 100;
const WORDPRESS_REST_TIMEOUT_MS = 15000;
const WORDPRESS_IMPORT_PREVIEW_ERROR_LIMIT = 15;
const WORDPRESS_AUTO_IMPORT_SCHEDULE = "every 6 hours";
const WORDPRESS_AUTO_IMPORT_TIME_ZONE = "Asia/Kolkata";

const normalizeRole = (value) => {
  const normalized = readStringValue(value).toLowerCase();
  return normalized === "admin" || normalized === "author" ? normalized : "user";
};

const normalizeAccountStatus = (value) => {
  const normalized = readStringValue(value).toLowerCase();
  return normalized === "deleted" ? "deleted" : "active";
};

const readStringValue = (value) => (typeof value === "string" ? value.trim() : "");
const readOptionalStringMap = (value) => {
  if (!value || typeof value !== "object") {
    return {};
  }

  const entries = Object.entries(value);
  const result = {};

  entries.forEach(([key, rawValue]) => {
    const normalizedKey = readStringValue(key);
    const normalizedValue = readStringValue(rawValue);
    if (normalizedKey && normalizedValue) {
      result[normalizedKey] = normalizedValue;
    }
  });

  return result;
};

const chunkItems = (items, size) => {
  const chunks = [];

  for (let index = 0; index < items.length; index += size) {
    chunks.push(items.slice(index, index + size));
  }

  return chunks;
};

const getUniqueStrings = (values) =>
  [...new Set(values.map((value) => readStringValue(value)).filter(Boolean))];

const truncateText = (value, limit) => {
  if (value.length <= limit) {
    return value;
  }

  return `${value.slice(0, Math.max(0, limit - 3)).trimEnd()}...`;
};

const getPostPublishNotificationBody = (content) => {
  const lines = readStringValue(content)
    .split(/\r?\n+/)
    .map((line) => line.replace(/\s+/g, " ").trim())
    .filter(Boolean);

  if (!lines.length) {
    return DEFAULT_POST_PUBLISH_BODY;
  }

  return truncateText(lines.slice(0, 2).join("\n"), MAX_POST_PUBLISH_BODY_LENGTH);
};

const getNotificationImageUrl = (imageUrl) => {
  const normalized = readStringValue(imageUrl);
  return /^https?:\/\/\S+$/i.test(normalized) ? normalized : "";
};

const getAndroidNotificationChannelId = (platform) =>
  readStringValue(platform).toLowerCase() === "android"
    ? DEFAULT_ANDROID_CHANNEL_ID
    : undefined;

const readPushTokenData = (data) => ({
  uid: readStringValue(data.uid),
  token: readStringValue(data.token),
  isActive: data.isActive !== false,
  platform: readStringValue(data.platform),
  provider: readStringValue(data.provider),
});

const getPushProvider = ({ provider, platform }) => {
  const normalizedProvider = readStringValue(provider).toLowerCase();
  if (normalizedProvider === "fcm" || normalizedProvider === "apns") {
    return normalizedProvider;
  }

  const normalizedPlatform = readStringValue(platform).toLowerCase();
  if (normalizedPlatform === "android") {
    return "fcm";
  }
  if (normalizedPlatform === "ios") {
    return "apns";
  }

  return "unknown";
};

const isLikelyExpoPushToken = (token) => {
  const normalizedToken = readStringValue(token);
  return (
    normalizedToken.startsWith("ExponentPushToken[") ||
    normalizedToken.startsWith("ExpoPushToken[")
  );
};

const getFcmEligibleTokens = (tokens) =>
  tokens.filter((item) => {
    const provider = getPushProvider(item);
    return provider === "fcm" && !isLikelyExpoPushToken(item.token);
  });

const getUniquePushTokenRecords = (tokens) => {
  const uniqueTokens = new Map();

  tokens.forEach((item) => {
    if (item.token && !uniqueTokens.has(item.token)) {
      uniqueTokens.set(item.token, item);
    }
  });

  return [...uniqueTokens.values()];
};

const getPushRecipientCount = (tokens) =>
  new Set(tokens.map((item) => item.uid).filter(Boolean)).size;

const getLegacyPushTokenDocId = (token) => encodeURIComponent(token);

const isDeletedAccountStatus = (value) => normalizeAccountStatus(value) === "deleted";

const getActiveUserUidsAsync = async ({ excludeUids = [] } = {}) => {
  const excluded = new Set(getUniqueStrings(excludeUids));
  const usersSnapshot = await firestore.collection(USERS_COLLECTION).get();

  return usersSnapshot.docs
    .map((item) => ({
      uid: item.id,
      accountStatus: readStringValue(item.data()?.accountStatus),
    }))
    .filter(
      (item) =>
        !isDeletedAccountStatus(item.accountStatus) &&
        !excluded.has(item.uid),
    )
    .map((item) => item.uid);
};

const isExistingActiveUserAsync = async (uid) => {
  const normalizedUid = readStringValue(uid);
  if (!normalizedUid) {
    return false;
  }

  const userSnapshot = await firestore
    .collection(USERS_COLLECTION)
    .doc(normalizedUid)
    .get();

  return (
    userSnapshot.exists &&
    !isDeletedAccountStatus(userSnapshot.data()?.accountStatus)
  );
};

const getActivePushTokensForUserAsync = async (uid) => {
  const normalizedUid = readStringValue(uid);
  if (!normalizedUid) {
    return [];
  }

  const userSnapshot = await firestore.collection(USERS_COLLECTION).doc(normalizedUid).get();
  if (userSnapshot.exists && isDeletedAccountStatus(userSnapshot.data()?.accountStatus)) {
    return [];
  }

  const snapshot = await firestore
    .collection(PUSH_TOKENS_COLLECTION)
    .where("uid", "==", normalizedUid)
    .get();

  return getUniquePushTokenRecords(
    snapshot.docs
      .map((item) => ({
        docId: item.id,
        ...readPushTokenData(item.data()),
      }))
      .filter((item) => item.isActive && item.token),
  );
};

const getActiveUsersAndPushTokensAsync = async ({ excludeUids = [] } = {}) => {
  const excluded = new Set(getUniqueStrings(excludeUids));

  const [usersSnapshot, pushTokensSnapshot] = await Promise.all([
    firestore.collection(USERS_COLLECTION).get(),
    firestore.collection(PUSH_TOKENS_COLLECTION).get(),
  ]);

  const activeUserUids = usersSnapshot.docs
    .map((item) => ({
      uid: item.id,
      accountStatus: readStringValue(item.data()?.accountStatus),
    }))
    .filter(
      (item) =>
        !isDeletedAccountStatus(item.accountStatus) &&
        !excluded.has(item.uid),
    )
    .map((item) => item.uid);
  const activeUserUidSet = new Set(activeUserUids);

  const tokens = getUniquePushTokenRecords(
    pushTokensSnapshot.docs
      .map((item) => ({
        docId: item.id,
        ...readPushTokenData(item.data()),
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

const deleteDocsByIdsAsync = async (collectionName, docIds) => {
  const uniqueDocIds = [...new Set(docIds.map((value) => readStringValue(value)).filter(Boolean))];

  for (const chunk of chunkItems(uniqueDocIds, NOTIFICATION_WRITE_CHUNK_SIZE)) {
    const batch = firestore.batch();
    chunk.forEach((docId) => {
      batch.delete(firestore.collection(collectionName).doc(docId));
    });
    await batch.commit();
  }
};

const deletePushTokenDocsByTokenAsync = async (token) => {
  const normalizedToken = readStringValue(token);
  if (!normalizedToken) {
    return;
  }

  const docIdsToDelete = new Set([getLegacyPushTokenDocId(normalizedToken)]);
  const snapshot = await firestore
    .collection(PUSH_TOKENS_COLLECTION)
    .where("token", "==", normalizedToken)
    .get();
  snapshot.docs.forEach((item) => {
    docIdsToDelete.add(item.id);
  });

  await deleteDocsByIdsAsync(PUSH_TOKENS_COLLECTION, [...docIdsToDelete]);
};

const getCallerProfileAsync = async (request) => {
  if (!request.auth?.uid) {
    throw new HttpsError("unauthenticated", "Authentication is required.");
  }

  const callerUid = readStringValue(request.auth.uid);
  const callerSnapshot = await firestore
    .collection(USERS_COLLECTION)
    .doc(callerUid)
    .get();

  if (!callerSnapshot.exists) {
    throw new HttpsError("permission-denied", "User profile not found.");
  }

  const callerData = callerSnapshot.data() || {};
  const accountStatus = normalizeAccountStatus(callerData.accountStatus);

  if (accountStatus === "deleted") {
    throw new HttpsError("permission-denied", "Deleted accounts cannot send notifications.");
  }

  return {
    uid: callerUid,
    role: normalizeRole(callerData.role),
  };
};

const assertRole = (callerProfile, allowedRoles) => {
  if (!allowedRoles.includes(callerProfile.role)) {
    throw new HttpsError(
      "permission-denied",
      "You do not have permission to send this notification.",
    );
  }
};

const getQueryCountAsync = async (queryRef) => {
  if (queryRef && typeof queryRef.count === "function") {
    const aggregateSnapshot = await queryRef.count().get();
    const aggregateData = aggregateSnapshot?.data?.();
    const countValue = Number(aggregateData?.count);

    if (Number.isFinite(countValue) && countValue >= 0) {
      return countValue;
    }
  }

  const fallbackSnapshot = await queryRef.get();
  return fallbackSnapshot.size;
};

const getFirebaseFeatureStatsAsync = async () => {
  const usersRef = firestore.collection(USERS_COLLECTION);
  const postsRef = firestore.collection(POSTS_COLLECTION);
  const categoriesRef = firestore.collection(CATEGORIES_COLLECTION);
  const notificationsRef = firestore.collection(NOTIFICATIONS_COLLECTION);
  const pushTokensRef = firestore.collection(PUSH_TOKENS_COLLECTION);

  const [
    usersTotal,
    deletedUsers,
    postsTotal,
    publishedPosts,
    pendingPosts,
    draftPosts,
    categoriesTotal,
    notificationsTotal,
    pushTokensTotal,
    activePushTokens,
  ] = await Promise.all([
    getQueryCountAsync(usersRef),
    getQueryCountAsync(usersRef.where("accountStatus", "==", "deleted")),
    getQueryCountAsync(postsRef),
    getQueryCountAsync(postsRef.where("status", "==", "published")),
    getQueryCountAsync(postsRef.where("status", "==", "pending")),
    getQueryCountAsync(postsRef.where("status", "==", "draft")),
    getQueryCountAsync(categoriesRef),
    getQueryCountAsync(notificationsRef),
    getQueryCountAsync(pushTokensRef),
    getQueryCountAsync(pushTokensRef.where("isActive", "==", true)),
  ]);

  return {
    users: {
      total: usersTotal,
      active: Math.max(0, usersTotal - deletedUsers),
      deleted: deletedUsers,
    },
    posts: {
      total: postsTotal,
      published: publishedPosts,
      pending: pendingPosts,
      draft: draftPosts,
    },
    categories: {
      total: categoriesTotal,
    },
    notifications: {
      total: notificationsTotal,
    },
    pushTokens: {
      total: pushTokensTotal,
      active: activePushTokens,
      inactive: Math.max(0, pushTokensTotal - activePushTokens),
    },
  };
};

const buildPostPublishedPushMessage = ({
  token,
  postId,
  postTitle,
  postContent,
  imageUrl,
  platform,
}) => {
  const normalizedImageUrl = getNotificationImageUrl(imageUrl);
  const notificationTitle = readStringValue(postTitle) || "New Post Published";
  const notificationBody = getPostPublishNotificationBody(postContent);

  return {
    token: readStringValue(token),
    notification: {
      title: notificationTitle,
      body: notificationBody,
      ...(normalizedImageUrl ? { imageUrl: normalizedImageUrl } : {}),
    },
    data: {
      type: "post_published",
      postId: readStringValue(postId),
      notificationTitle,
      notificationBody,
      ...(normalizedImageUrl ? { imageUrl: normalizedImageUrl } : {}),
    },
    android: {
      priority: "high",
      notification: {
        channelId: getAndroidNotificationChannelId(platform),
        sound: "default",
        ...(normalizedImageUrl ? { imageUrl: normalizedImageUrl } : {}),
      },
    },
  };
};

const buildPostApprovedForAuthorPushMessage = ({
  token,
  postId,
  postTitle,
  imageUrl,
  platform,
}) => {
  const normalizedTitle = readStringValue(postTitle) || "Your post";
  const normalizedImageUrl = getNotificationImageUrl(imageUrl);
  const notificationTitle = "Your Post Is Approved";
  const notificationBody = `"${normalizedTitle}" has been approved and published on DevGeet.`;

  return {
    token: readStringValue(token),
    notification: {
      title: notificationTitle,
      body: notificationBody,
      ...(normalizedImageUrl ? { imageUrl: normalizedImageUrl } : {}),
    },
    data: {
      type: "post_published",
      postId: readStringValue(postId),
      notificationTitle,
      notificationBody,
      ...(normalizedImageUrl ? { imageUrl: normalizedImageUrl } : {}),
    },
    android: {
      priority: "high",
      notification: {
        channelId: getAndroidNotificationChannelId(platform),
        sound: "default",
        ...(normalizedImageUrl ? { imageUrl: normalizedImageUrl } : {}),
      },
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
}) => {
  const normalizedImageUrl = getNotificationImageUrl(imageUrl);
  const notificationTitle = readStringValue(title) || "DevGeet";
  const notificationBody = readStringValue(body);

  return {
    token: readStringValue(token),
    notification: {
      title: notificationTitle,
      body: notificationBody,
      ...(normalizedImageUrl ? { imageUrl: normalizedImageUrl } : {}),
    },
    data: {
      ...readOptionalStringMap(data),
      type: "custom_notification",
      notificationTitle,
      notificationBody,
      ...(normalizedImageUrl ? { imageUrl: normalizedImageUrl } : {}),
    },
    android: {
      priority: "high",
      notification: {
        channelId: getAndroidNotificationChannelId(platform),
        sound: "default",
        ...(normalizedImageUrl ? { imageUrl: normalizedImageUrl } : {}),
      },
    },
  };
};

const createTestPushMessage = ({ token, accountName, platform }) => ({
  token: readStringValue(token),
  notification: {
    title: "DevGeet Test Notification",
    body: `Push notifications are working for ${readStringValue(accountName) || "your account"}.`,
  },
  data: {
    type: "test_push",
  },
  android: {
    priority: "high",
    notification: {
      channelId: getAndroidNotificationChannelId(platform),
      sound: "default",
    },
  },
});

const createPushReceiptDocId = (messageId) => {
  const normalizedMessageId = readStringValue(messageId);
  if (normalizedMessageId) {
    return encodeURIComponent(normalizedMessageId);
  }

  return `fcm_error_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;
};

const writePushReceiptsAsync = async (receiptEntries) => {
  if (!receiptEntries.length) {
    return;
  }

  const now = admin.firestore.FieldValue.serverTimestamp();

  for (const chunk of chunkItems(receiptEntries, NOTIFICATION_WRITE_CHUNK_SIZE)) {
    const batch = firestore.batch();
    chunk.forEach((entry) => {
      const receiptId = readStringValue(entry.receiptId);
      if (!receiptId) {
        return;
      }

      batch.set(
        firestore.collection(PUSH_RECEIPTS_COLLECTION).doc(createPushReceiptDocId(receiptId)),
        {
          receiptId,
          token: readStringValue(entry.token),
          status: readStringValue(entry.status) || "error",
          createdAt: now,
          updatedAt: now,
          checkedAt: now,
          detailsError: readStringValue(entry.detailsError),
          detailsMessage: readStringValue(entry.detailsMessage),
        },
        { merge: true },
      );
    });
    await batch.commit();
  }
};

const sendFcmPushMessagesAsync = async (messages) => {
  const normalizedMessages = messages.filter((item) => readStringValue(item.token));
  if (!normalizedMessages.length) {
    return;
  }

  const invalidTokens = new Set();
  const sendErrors = new Set();
  const receiptEntries = [];

  for (const chunk of chunkItems(normalizedMessages, FCM_SEND_CHUNK_SIZE)) {
    let batchResponse;
    try {
      batchResponse = await admin.messaging().sendEach(chunk);
    } catch (error) {
      throw new HttpsError(
        "unavailable",
        `Unable to reach Firebase Cloud Messaging service. ${
          error instanceof Error ? error.message : "Unknown push transport error."
        }`,
      );
    }

    batchResponse.responses.forEach((response, index) => {
      const token = readStringValue(chunk[index]?.token);
      if (response.success) {
        receiptEntries.push({
          receiptId: readStringValue(response.messageId),
          token,
          status: "ok",
          detailsError: "",
          detailsMessage: "",
        });
        return;
      }

      const errorCode = readStringValue(response.error?.code);
      const errorMessage = readStringValue(response.error?.message);

      receiptEntries.push({
        receiptId: readStringValue(response.messageId),
        token,
        status: "error",
        detailsError: errorCode,
        detailsMessage: errorMessage,
      });

      if (
        token &&
        (errorCode === "messaging/registration-token-not-registered" ||
          errorCode === "messaging/invalid-registration-token")
      ) {
        invalidTokens.add(token);
      }

      sendErrors.add(errorCode || errorMessage || "UnknownError");
    });
  }

  if (invalidTokens.size) {
    await Promise.allSettled(
      [...invalidTokens].map((token) => deletePushTokenDocsByTokenAsync(token)),
    );
  }

  await writePushReceiptsAsync(receiptEntries);

  if (sendErrors.size) {
    throw new HttpsError(
      "aborted",
      `FCM push delivery failed for ${sendErrors.size} error type(s): ${[...sendErrors].join(", ")}.`,
    );
  }
};

const createCustomUserNotificationAsync = async ({
  uid,
  title,
  body,
  imageUrl,
  category = "general",
  audience = "single",
  pushEnabled = false,
}) => {
  const normalizedUid = readStringValue(uid);
  const normalizedTitle = readStringValue(title) || "DevGeet";
  const normalizedBody = readStringValue(body);

  if (!normalizedUid || !normalizedBody) {
    return false;
  }

  await firestore.collection(NOTIFICATIONS_COLLECTION).doc().set({
    uid: normalizedUid,
    type: "custom",
    category: category === "creator" ? "creator" : "general",
    audience: audience === "all" ? "all" : "single",
    pushEnabled: pushEnabled === true,
    title: normalizedTitle,
    body: normalizedBody,
    postId: "",
    imageUrl: getNotificationImageUrl(imageUrl),
    isRead: false,
    isUserSeen: false,
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
    readAt: null,
    userSeenAt: null,
  });

  return true;
};

const createCustomUserNotificationsAsync = async ({
  uids,
  title,
  body,
  imageUrl,
  category = "general",
  audience = "all",
  pushEnabled = false,
}) => {
  const uniqueUids = getUniqueStrings(uids);
  const normalizedTitle = readStringValue(title) || "DevGeet";
  const normalizedBody = readStringValue(body);

  if (!uniqueUids.length || !normalizedBody) {
    return 0;
  }

  let savedCount = 0;

  for (const chunk of chunkItems(uniqueUids, NOTIFICATION_WRITE_CHUNK_SIZE)) {
    const batch = firestore.batch();

    chunk.forEach((uid) => {
      const docRef = firestore.collection(NOTIFICATIONS_COLLECTION).doc();
      batch.set(docRef, {
        uid,
        type: "custom",
        category: category === "creator" ? "creator" : "general",
        audience: audience === "single" ? "single" : "all",
        pushEnabled: pushEnabled === true,
        title: normalizedTitle,
        body: normalizedBody,
        postId: "",
        imageUrl: getNotificationImageUrl(imageUrl),
        isRead: false,
        isUserSeen: false,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
        readAt: null,
        userSeenAt: null,
      });
    });

    await batch.commit();
    savedCount += chunk.length;
  }

  return savedCount;
};

const createPostApprovedUserNotificationAsync = async ({
  uid,
  postId,
  postTitle,
  imageUrl,
}) => {
  const normalizedUid = readStringValue(uid);
  const normalizedPostId = readStringValue(postId);
  const normalizedPostTitle = readStringValue(postTitle) || "Your post";

  if (!normalizedUid || !normalizedPostId) {
    return;
  }

  await firestore.collection(NOTIFICATIONS_COLLECTION).doc().set({
    uid: normalizedUid,
    type: "post-approved",
    category: "creator",
    title: "Congratulations",
    body: `Your post "${normalizedPostTitle}" has been approved and published.`,
    postId: normalizedPostId,
    imageUrl: getNotificationImageUrl(imageUrl),
    isRead: false,
    isUserSeen: false,
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
    readAt: null,
    userSeenAt: null,
  });
};

const sendPostPublishedNotificationToUserAsync = async ({
  uid,
  postId,
  postTitle,
  imageUrl,
}) => {
  const tokens = getFcmEligibleTokens(await getActivePushTokensForUserAsync(uid));
  if (!tokens.length) {
    return false;
  }

  await sendFcmPushMessagesAsync(
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

const sendPostPublishedNotificationToAllActiveUsersAsync = async ({
  postId,
  postTitle,
  postContent,
  imageUrl,
  excludeUids = [],
}) => {
  const { tokens: rawTokens } = await getActiveUsersAndPushTokensAsync({
    excludeUids,
  });
  const tokens = getFcmEligibleTokens(rawTokens);

  if (!tokens.length) {
    return false;
  }

  await sendFcmPushMessagesAsync(
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

const sendCustomPushNotificationToUserAsync = async ({
  uid,
  title,
  body,
  imageUrl,
  data,
  category = "general",
  sendPush = true,
  audience = "single",
}) => {
  const normalizedUid = readStringValue(uid);
  const normalizedTitle = readStringValue(title);
  const normalizedBody = readStringValue(body);

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

  const tokens = sendPush
    ? getFcmEligibleTokens(await getActivePushTokensForUserAsync(normalizedUid))
    : [];

  if (sendPush && tokens.length) {
    await sendFcmPushMessagesAsync(
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

const sendCustomPushNotificationToAllActiveUsersAsync = async ({
  title,
  body,
  imageUrl,
  data,
  excludeUids = [],
  category = "general",
  sendPush = true,
  audience = "all",
}) => {
  const normalizedTitle = readStringValue(title);
  const normalizedBody = readStringValue(body);

  if (!normalizedTitle || !normalizedBody) {
    return {
      savedCount: 0,
      pushRecipientCount: 0,
      pushTokenCount: 0,
    };
  }

  const normalizedExcludeUids = getUniqueStrings(excludeUids);
  const activeUserUids = await getActiveUserUidsAsync({
    excludeUids: normalizedExcludeUids,
  });

  if (!activeUserUids.length) {
    return {
      savedCount: 0,
      pushRecipientCount: 0,
      pushTokenCount: 0,
    };
  }

  const tokens = sendPush
    ? (
        await getActiveUsersAndPushTokensAsync({
          excludeUids: normalizedExcludeUids,
        })
      ).tokens
    : [];
  const fcmTokens = getFcmEligibleTokens(tokens);

  if (sendPush && fcmTokens.length) {
    await sendFcmPushMessagesAsync(
      fcmTokens.map((item) =>
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
    uids: activeUserUids,
    title: normalizedTitle,
    body: normalizedBody,
    imageUrl,
    category,
    audience,
    pushEnabled: sendPush,
  });

  return {
    savedCount,
    pushRecipientCount: getPushRecipientCount(fcmTokens),
    pushTokenCount: fcmTokens.length,
  };
};

const notifyPostPublishedAsync = async ({
  authorUid,
  actorUid,
  postId,
  postTitle,
  postContent,
  imageUrl,
}) => {
  const normalizedAuthorUid = readStringValue(authorUid);
  const normalizedActorUid = readStringValue(actorUid);
  const shouldNotifyAuthor =
    normalizedAuthorUid && normalizedAuthorUid !== normalizedActorUid;

  const tasks = [
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

  return results.some((result) => result.status === "fulfilled" && result.value);
};

const sendTestPushNotificationAsync = async ({
  token,
  accountName,
  platform,
}) => {
  const normalizedToken = readStringValue(token);
  if (!normalizedToken) {
    return false;
  }
  if (isLikelyExpoPushToken(normalizedToken)) {
    throw new HttpsError(
      "invalid-argument",
      "Expo push tokens are not supported after FCM migration. Use a native FCM token.",
    );
  }

  await sendFcmPushMessagesAsync([
    createTestPushMessage({
      token: normalizedToken,
      accountName,
      platform,
    }),
  ]);

  return true;
};

const readSafeArray = (value) =>
  Array.isArray(value) ? value : [];

const readObjectValue = (value) =>
  value && typeof value === "object" && !Array.isArray(value) ? value : {};

const toBooleanValue = (value) => {
  if (typeof value === "boolean") {
    return value;
  }

  const normalized = readStringValue(value).toLowerCase();
  return normalized === "true" || normalized === "1" || normalized === "yes";
};

const createSlug = (value) =>
  readStringValue(value)
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");

const normalizeHttpUrl = (value) => {
  const normalized = readStringValue(value);
  if (!normalized) {
    return "";
  }

  try {
    const parsed = new URL(normalized);
    if (parsed.protocol === "http:" || parsed.protocol === "https:") {
      return parsed.toString();
    }
  } catch {
    return "";
  }

  return "";
};

const stripHtmlToText = (value) => {
  const normalized = readStringValue(value);
  if (!normalized) {
    return "";
  }

  return normalized
    .replace(/<\s*br\s*\/?>/gi, "\n")
    .replace(/<\/\s*p\s*>/gi, "\n")
    .replace(/<[^>]*>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/\s+/g, " ")
    .trim();
};

const parseDateValue = (value) => {
  if (!value) {
    return null;
  }

  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return value;
  }

  if (typeof value === "number" && Number.isFinite(value)) {
    const parsed = new Date(value);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
  }

  const normalized = readStringValue(value);
  if (!normalized) {
    return null;
  }

  const numericValue = Number(normalized);
  if (Number.isFinite(numericValue) && numericValue > 0 && /^\d+$/.test(normalized)) {
    const parsedFromEpoch =
      normalized.length <= 10
        ? new Date(numericValue * 1000)
        : new Date(numericValue);
    return Number.isNaN(parsedFromEpoch.getTime()) ? null : parsedFromEpoch;
  }

  const parsed = new Date(normalized);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
};

const normalizeWordpressPostStatus = (value) => {
  const normalized = readStringValue(value).toLowerCase();

  if (normalized === "publish" || normalized === "published") {
    return "published";
  }

  if (
    normalized === "pending" ||
    normalized === "pending-review" ||
    normalized === "future"
  ) {
    return "pending";
  }

  return "draft";
};

const normalizeWordpressOperation = (value, fallbackStatusValue) => {
  const normalized = readStringValue(value).toLowerCase();

  if (
    normalized === "delete" ||
    normalized === "deleted" ||
    normalized === "trash" ||
    normalized === "remove"
  ) {
    return "delete";
  }

  if (
    normalized === "upsert" ||
    normalized === "create" ||
    normalized === "update" ||
    normalized === "publish" ||
    normalized === "sync"
  ) {
    return "upsert";
  }

  const fallbackStatus = readStringValue(fallbackStatusValue).toLowerCase();
  if (fallbackStatus === "trash" || fallbackStatus === "deleted") {
    return "delete";
  }

  return "upsert";
};

const resolveWordpressSyncSecret = () =>
  WORDPRESS_SYNC_SECRET_ENV_KEYS.map((key) => readStringValue(process.env[key])).find(Boolean) ??
  "";

const readIdValue = (value) => {
  const normalized = readStringValue(value);
  if (normalized) {
    return normalized;
  }

  const numericId = Number(value);
  return Number.isFinite(numericId) && numericId > 0 ? numericId.toString() : "";
};

const normalizeWordpressSiteUrl = (value) => {
  const normalizedValue = readStringValue(value);
  if (!normalizedValue) {
    return "";
  }

  const withProtocol = normalizedValue.includes("://")
    ? normalizedValue
    : `https://${normalizedValue}`;

  try {
    const parsed = new URL(withProtocol);
    const normalizedPathname =
      parsed.pathname === "/" ? "" : parsed.pathname.replace(/\/+$/, "");
    return `${parsed.origin}${normalizedPathname}`;
  } catch {
    return "";
  }
};

const resolveWordpressSiteUrl = (requestedSiteUrl) => {
  const normalizedRequestUrl = normalizeWordpressSiteUrl(requestedSiteUrl);
  if (normalizedRequestUrl) {
    return normalizedRequestUrl;
  }

  const configuredSiteUrl =
    WORDPRESS_SITE_URL_ENV_KEYS.map((key) => readStringValue(process.env[key])).find(Boolean) ??
    DEFAULT_WORDPRESS_SITE_URL;

  return normalizeWordpressSiteUrl(configuredSiteUrl);
};

const readWordpressRenderedField = (value) => {
  const fieldObject = readObjectValue(value);
  return readStringValue(fieldObject.rendered ?? fieldObject.raw ?? value);
};

const readFirstWordpressRenderedField = (values) => {
  for (const value of readSafeArray(values)) {
    const normalized = readWordpressRenderedField(value);
    if (normalized) {
      return normalized;
    }
  }

  return "";
};

const readWordpressPostContentHtml = (payload) => {
  const postPayload = readObjectValue(payload);
  return readFirstWordpressRenderedField([
    postPayload.contentHtml,
    postPayload.contentRendered,
    postPayload.contentRaw,
    postPayload.htmlContent,
    postPayload.postContentHtml,
    postPayload.postContentRendered,
    postPayload.postContentRaw,
    postPayload.postContent,
    postPayload.post_content,
    postPayload.content,
  ]);
};

const readWordpressPostExcerptText = (payload) => {
  const postPayload = readObjectValue(payload);
  const excerptHtml = readFirstWordpressRenderedField([
    postPayload.excerptHtml,
    postPayload.excerptRendered,
    postPayload.postExcerptHtml,
    postPayload.postExcerpt,
    postPayload.post_excerpt,
    postPayload.excerpt,
  ]);
  const explicitExcerptText = readStringValue(
    postPayload.excerptText ?? postPayload.postExcerptText,
  );
  return explicitExcerptText || stripHtmlToText(excerptHtml);
};

const fetchWordpressCollectionPageAsync = async ({
  siteUrl,
  endpoint,
  page,
  queryParams = {},
}) => {
  const requestUrl = new URL(`/wp-json/wp/v2/${endpoint}`, `${siteUrl}/`);
  requestUrl.searchParams.set("per_page", WORDPRESS_REST_MAX_PER_PAGE.toString());
  requestUrl.searchParams.set("page", page.toString());

  Object.entries(queryParams).forEach(([key, rawValue]) => {
    const normalizedValue = readStringValue(rawValue);
    if (normalizedValue) {
      requestUrl.searchParams.set(key, normalizedValue);
    }
  });

  let response;
  try {
    response = await fetch(requestUrl.toString(), {
      method: "GET",
      headers: {
        Accept: "application/json",
      },
      signal: AbortSignal.timeout(WORDPRESS_REST_TIMEOUT_MS),
    });
  } catch (error) {
    throw new HttpsError(
      "unavailable",
      `Unable to reach WordPress site (${siteUrl}). ${
        error instanceof Error ? error.message : "Unknown network error."
      }`,
    );
  }

  if (!response.ok) {
    const errorBody = await response.text().catch(() => "");
    const errorMessage =
      `WordPress API request failed for ${endpoint} (page ${page}) with status ${response.status}.` +
      (errorBody ? ` ${errorBody.slice(0, 220)}` : "");
    throw new HttpsError(response.status >= 500 ? "unavailable" : "invalid-argument", errorMessage);
  }

  const items = await response.json();
  if (!Array.isArray(items)) {
    throw new HttpsError(
      "data-loss",
      `WordPress API returned an invalid response for ${endpoint} (page ${page}).`,
    );
  }

  const totalPagesHeader = Number.parseInt(
    readStringValue(response.headers.get("x-wp-totalpages")),
    10,
  );
  const totalPages =
    Number.isFinite(totalPagesHeader) && totalPagesHeader > 0 ? totalPagesHeader : 1;

  return {
    items,
    totalPages,
  };
};

const fetchAllWordpressCollectionAsync = async ({
  siteUrl,
  endpoint,
  queryParams = {},
}) => {
  const allItems = [];
  let currentPage = 1;
  let totalPages = 1;

  while (currentPage <= totalPages) {
    const pageResult = await fetchWordpressCollectionPageAsync({
      siteUrl,
      endpoint,
      page: currentPage,
      queryParams,
    });

    totalPages = pageResult.totalPages;
    allItems.push(...pageResult.items);
    currentPage += 1;
  }

  return allItems;
};

const getWordpressEmbeddedAuthor = (postPayload) => {
  const embedded = readObjectValue(postPayload._embedded);
  const authors = readSafeArray(embedded.author);
  return readObjectValue(authors[0]);
};

const getWordpressFeaturedImageUrl = (postPayload) => {
  const embedded = readObjectValue(postPayload._embedded);
  const featuredMediaList = readSafeArray(embedded["wp:featuredmedia"]);
  const featuredMedia = readObjectValue(featuredMediaList[0]);
  return normalizeHttpUrl(
    featuredMedia.source_url ??
      featuredMedia.link ??
      featuredMedia.guid?.rendered,
  );
};

const mapWordpressCategoryPayloadForSync = (categoryPayload) => ({
  id: readIdValue(categoryPayload.id),
  sourceCategoryId: readIdValue(categoryPayload.id),
  slug: readStringValue(categoryPayload.slug),
  name: readWordpressRenderedField(categoryPayload.name),
  createDate: readStringValue(categoryPayload.date),
  uploadDate: readStringValue(categoryPayload.modified),
});

const mapWordpressPostPayloadForSync = ({ postPayload, categoriesById }) => {
  const contentHtml = readWordpressPostContentHtml(postPayload);
  const excerptText = readWordpressPostExcerptText(postPayload);
  const normalizedCategoryIds = readSafeArray(postPayload.categories)
    .map((item) => readIdValue(item))
    .filter(Boolean);
  const categories = normalizedCategoryIds
    .map((categoryId) => categoriesById.get(categoryId))
    .filter(Boolean);
  const embeddedAuthor = getWordpressEmbeddedAuthor(postPayload);

  return {
    id: readIdValue(postPayload.id),
    slug: readStringValue(postPayload.slug),
    title: readWordpressRenderedField(postPayload.title),
    contentHtml,
    contentText: stripHtmlToText(contentHtml),
    excerpt: excerptText,
    status: readStringValue(postPayload.status),
    date: readStringValue(postPayload.date_gmt ?? postPayload.date),
    modified: readStringValue(postPayload.modified_gmt ?? postPayload.modified),
    publishedAt: readStringValue(postPayload.date_gmt ?? postPayload.date),
    featureImageUrl: getWordpressFeaturedImageUrl(postPayload),
    authorId: readIdValue(postPayload.author),
    authorDisplayName: readStringValue(
      embeddedAuthor.name ?? embeddedAuthor.slug ?? postPayload.authorName,
    ),
    authorUsername: readStringValue(
      embeddedAuthor.slug ?? embeddedAuthor.name ?? postPayload.authorUsername,
    ),
    categories,
    primaryCategory: categories[0] ?? null,
  };
};

const getWordpressPostId = (payload) => {
  const normalizedPostId = readStringValue(
    payload.postId ?? payload.id ?? payload.wpPostId ?? payload.wordpressPostId,
  );

  if (normalizedPostId) {
    return normalizedPostId;
  }

  const fallbackNumericPostId = Number(payload.postId ?? payload.id ?? payload.wpPostId);
  return Number.isFinite(fallbackNumericPostId) && fallbackNumericPostId > 0
    ? fallbackNumericPostId.toString()
    : "";
};

const getWordpressCategorySnapshot = (payload) => {
  const categories = readSafeArray(payload.categories);
  const primaryCategory = readObjectValue(
    payload.primaryCategory ??
      payload.category ??
      payload.categoryData ??
      (categories.length ? categories[0] : {}),
  );

  const categoryName =
    readStringValue(
      payload.categoryName ??
        primaryCategory.name ??
        primaryCategory.label ??
        primaryCategory.title,
    ) || "General";
  const categorySlugFromPayload = readStringValue(
    payload.categorySlug ??
      primaryCategory.slug ??
      primaryCategory.categorySlug ??
      primaryCategory.id,
  );
  const categorySlug = createSlug(categorySlugFromPayload || categoryName) || "general";

  return {
    categoryName,
    categorySlug,
  };
};

const getWordpressAuthorSnapshot = (payload) => {
  const authorData = readObjectValue(payload.author);
  const authorId =
    readStringValue(
      payload.authorId ??
        payload.authorUid ??
        authorData.uid ??
        authorData.id ??
        authorData.userId,
    ) || WORDPRESS_SYNC_ACTOR_ID;

  const authorUsername = readStringValue(
    payload.authorUsername ??
      authorData.username ??
      authorData.slug ??
      authorData.userLogin,
  );
  const authorDisplayName =
    readStringValue(
      payload.authorDisplayName ??
        payload.authorName ??
        authorData.displayName ??
        authorData.name ??
        authorUsername,
    ) || "WordPress Author";
  const authorEmail = readStringValue(
    payload.authorEmail ?? authorData.email ?? authorData.userEmail,
  );
  const authorPhotoURL = normalizeHttpUrl(
    payload.authorPhotoURL ?? payload.authorAvatarUrl ?? authorData.photoURL ?? authorData.avatarUrl,
  );
  const normalizedRole = readStringValue(payload.authorRole ?? authorData.role).toLowerCase();
  const authorRole = normalizedRole === "admin" ? "admin" : "author";

  return {
    authorId,
    authorUsername,
    authorDisplayName,
    authorEmail,
    authorPhotoURL,
    authorRole,
  };
};

const getDateFromCandidates = (values) => {
  for (const value of values) {
    const parsed = parseDateValue(value);
    if (parsed) {
      return parsed;
    }
  }

  return null;
};

const upsertWordpressCategoryAsync = async (payload) => {
  const categoryPayload = readObjectValue(payload);
  const inferredSnapshot = getWordpressCategorySnapshot(categoryPayload);
  const sourceCategoryId = readStringValue(
    categoryPayload.sourceCategoryId ??
      categoryPayload.id ??
      categoryPayload.categoryId ??
      categoryPayload.termId,
  );
  const providedSlug = createSlug(
    readStringValue(
      categoryPayload.slug ?? categoryPayload.categorySlug ?? categoryPayload.id ?? categoryPayload.termId,
    ),
  );
  const categorySlug = providedSlug || inferredSnapshot.categorySlug || "general";
  const categoryName = readStringValue(
    categoryPayload.name ?? categoryPayload.categoryName ?? inferredSnapshot.categoryName,
  ) || "General";
  const now = admin.firestore.FieldValue.serverTimestamp();
  const parsedCreateDate = getDateFromCandidates([
    categoryPayload.createDate,
    categoryPayload.createdAt,
    categoryPayload.dateCreated,
  ]);
  const parsedUploadDate = getDateFromCandidates([
    categoryPayload.uploadDate,
    categoryPayload.updatedAt,
    categoryPayload.modifiedAt,
  ]);

  await firestore.collection(CATEGORIES_COLLECTION).doc(categorySlug).set(
    {
      id: categorySlug,
      name: categoryName,
      slug: categorySlug,
      createDate: parsedCreateDate ?? now,
      uploadDate: parsedUploadDate ?? now,
      createdBy: WORDPRESS_SYNC_ACTOR_ID,
      createdByEmail: "",
      sourceCategoryId,
    },
    { merge: true },
  );

  return {
    entityType: "category",
    operation: "upsert",
    id: categorySlug,
    slug: categorySlug,
    name: categoryName,
  };
};

const deleteWordpressCategoryAsync = async (payload) => {
  const categoryPayload = readObjectValue(payload);
  const sourceCategoryId = readStringValue(
    categoryPayload.id ??
      categoryPayload.categoryId ??
      categoryPayload.sourceCategoryId ??
      categoryPayload.termId ??
      categoryPayload.slug ??
      categoryPayload.categorySlug,
  );
  const sourceCategorySlug = createSlug(
    readStringValue(
      categoryPayload.slug ??
        categoryPayload.categorySlug ??
        categoryPayload.name,
    ),
  );
  const candidateDocIds = new Set([
    sourceCategorySlug,
    createSlug(sourceCategoryId),
  ].filter(Boolean));

  if (candidateDocIds.size) {
    await deleteDocsByIdsAsync(CATEGORIES_COLLECTION, [...candidateDocIds]);
  }

  if (sourceCategoryId) {
    const snapshot = await firestore
      .collection(CATEGORIES_COLLECTION)
      .where("sourceCategoryId", "==", sourceCategoryId)
      .get();

    if (!snapshot.empty) {
      await deleteDocsByIdsAsync(
        CATEGORIES_COLLECTION,
        snapshot.docs.map((item) => item.id),
      );
    }
  }

  return {
    entityType: "category",
    operation: "delete",
    id: sourceCategorySlug || sourceCategoryId || "unknown",
  };
};

const upsertWordpressPostAsync = async (payload) => {
  const postPayload = readObjectValue(payload);
  const postId = getWordpressPostId(postPayload);
  if (!postId) {
    throw new HttpsError("invalid-argument", "WordPress sync payload is missing a post id.");
  }

  const now = admin.firestore.FieldValue.serverTimestamp();
  const title = readWordpressRenderedField(postPayload.title) || "Untitled";
  const slug = createSlug(readStringValue(postPayload.slug) || title) || postId;
  const rawStatus = readStringValue(
    postPayload.status ?? postPayload.wpStatus ?? postPayload.postStatus,
  );
  const status = normalizeWordpressPostStatus(rawStatus);
  const contentHtml = readWordpressPostContentHtml(postPayload);
  const explicitContentText = readStringValue(
    postPayload.contentText ??
      postPayload.contentPlainText ??
      postPayload.plainContent ??
      postPayload.postContentText,
  );
  const contentText = explicitContentText || stripHtmlToText(contentHtml);
  const excerpt = readWordpressPostExcerptText(postPayload);
  const normalizedContent = contentText || excerpt || "";
  const categorySnapshot = getWordpressCategorySnapshot(postPayload);
  const authorSnapshot = getWordpressAuthorSnapshot(postPayload);
  const featureImageUrl = normalizeHttpUrl(
    postPayload.featureImageUrl ??
      postPayload.featuredImageUrl ??
      postPayload.thumbnailUrl ??
      postPayload.imageUrl,
  );
  const youtubeVideoUrl = normalizeHttpUrl(postPayload.youtubeVideoUrl ?? postPayload.videoUrl);
  const parsedCreateDate = getDateFromCandidates([
    postPayload.createDate,
    postPayload.createdAt,
    postPayload.dateGmt,
    postPayload.date,
  ]);
  const parsedUpdateDate = getDateFromCandidates([
    postPayload.uploadDate,
    postPayload.updatedAt,
    postPayload.modifiedGmt,
    postPayload.modified,
  ]);
  const parsedPublishedDate = getDateFromCandidates([
    postPayload.publishedAt,
    postPayload.datePublished,
    postPayload.dateGmt,
    postPayload.date,
  ]);
  const moderationNote = readStringValue(postPayload.moderationNote);
  const baseTimestamps = {
    createDate: parsedCreateDate ?? now,
    uploadDate: parsedUpdateDate ?? now,
  };
  const moderationFields =
    status === "published"
      ? {
          submittedAt: parsedCreateDate ?? parsedPublishedDate ?? now,
          publishedAt: parsedPublishedDate ?? now,
          approvedAt: parsedPublishedDate ?? now,
          approvedBy: WORDPRESS_SYNC_ACTOR_ID,
          approvedByEmail: "",
        }
      : status === "pending"
        ? {
            submittedAt: parsedCreateDate ?? parsedUpdateDate ?? now,
            publishedAt: null,
            approvedAt: null,
            approvedBy: null,
            approvedByEmail: null,
          }
        : {
            submittedAt: null,
            publishedAt: null,
            approvedAt: null,
            approvedBy: null,
            approvedByEmail: null,
          };

  await upsertWordpressCategoryAsync({
    slug: categorySnapshot.categorySlug,
    name: categorySnapshot.categoryName,
    createDate: parsedCreateDate,
    uploadDate: parsedUpdateDate,
  });

  await firestore.collection(POSTS_COLLECTION).doc(postId).set(
    {
      id: postId,
      slug,
      title,
      content: normalizedContent,
      contentHtml,
      featureImageUrl,
      youtubeVideoUrl,
      category: categorySnapshot.categorySlug,
      status,
      authorId: authorSnapshot.authorId,
      authorRole: authorSnapshot.authorRole,
      authorUsername: authorSnapshot.authorUsername,
      authorDisplayName: authorSnapshot.authorDisplayName,
      authorPhotoURL: authorSnapshot.authorPhotoURL,
      createdBy: authorSnapshot.authorId,
      createdByEmail: authorSnapshot.authorEmail,
      updatedBy: WORDPRESS_SYNC_ACTOR_ID,
      updatedByEmail: "",
      moderationNote,
      deletedAt: null,
      deletedBy: null,
      deletedByEmail: null,
      ...baseTimestamps,
      ...moderationFields,
    },
    { merge: true },
  );

  return {
    entityType: "post",
    operation: "upsert",
    id: postId,
    slug,
    status,
    category: categorySnapshot.categorySlug,
  };
};

const deleteWordpressPostAsync = async (payload) => {
  const postPayload = readObjectValue(payload);
  const postId = getWordpressPostId(postPayload);
  if (!postId) {
    throw new HttpsError("invalid-argument", "WordPress delete payload is missing a post id.");
  }

  const hardDelete = toBooleanValue(
    postPayload.hardDelete ?? postPayload.isHardDelete ?? postPayload.forceDelete,
  );

  if (hardDelete) {
    await firestore.collection(POSTS_COLLECTION).doc(postId).delete();
  } else {
    const now = admin.firestore.FieldValue.serverTimestamp();
    await firestore.collection(POSTS_COLLECTION).doc(postId).set(
      {
        id: postId,
        status: "draft",
        uploadDate: now,
        deletedAt: now,
        deletedBy: WORDPRESS_SYNC_ACTOR_ID,
        deletedByEmail: "",
        updatedBy: WORDPRESS_SYNC_ACTOR_ID,
        updatedByEmail: "",
        publishedAt: null,
        approvedAt: null,
        approvedBy: null,
        approvedByEmail: null,
      },
      { merge: true },
    );
  }

  return {
    entityType: "post",
    operation: hardDelete ? "hard-delete" : "soft-delete",
    id: postId,
  };
};

const importWordpressSiteContentAsync = async ({ siteUrl }) => {
  const resolvedSiteUrl = resolveWordpressSiteUrl(siteUrl);
  if (!resolvedSiteUrl) {
    throw new HttpsError("invalid-argument", "Invalid WordPress site URL.");
  }

  const [wordpressCategories, wordpressPosts] = await Promise.all([
    fetchAllWordpressCollectionAsync({
      siteUrl: resolvedSiteUrl,
      endpoint: "categories",
      queryParams: {
        hide_empty: "false",
        orderby: "name",
        order: "asc",
      },
    }),
    fetchAllWordpressCollectionAsync({
      siteUrl: resolvedSiteUrl,
      endpoint: "posts",
      queryParams: {
        status: "publish",
        _embed: "author,wp:featuredmedia",
        orderby: "date",
        order: "desc",
      },
    }),
  ]);

  const categoriesById = new Map();
  const categorySummary = {
    fetched: wordpressCategories.length,
    synced: 0,
    failed: 0,
  };
  const postSummary = {
    fetched: wordpressPosts.length,
    synced: 0,
    failed: 0,
  };
  const errorPreview = [];

  for (const rawCategory of wordpressCategories) {
    const categoryPayload = mapWordpressCategoryPayloadForSync(
      readObjectValue(rawCategory),
    );
    const sourceCategoryId = readStringValue(categoryPayload.id);
    const sourceCategoryName = readStringValue(categoryPayload.name) || "Unnamed Category";

    try {
      const result = await upsertWordpressCategoryAsync(categoryPayload);
      const categoryId = sourceCategoryId || readStringValue(result.id);
      if (categoryId) {
        categoriesById.set(categoryId, {
          id: categoryId,
          slug: readStringValue(result.slug),
          name: readStringValue(result.name) || sourceCategoryName,
        });
      }

      categorySummary.synced += 1;
    } catch (error) {
      categorySummary.failed += 1;
      if (errorPreview.length < WORDPRESS_IMPORT_PREVIEW_ERROR_LIMIT) {
        errorPreview.push({
          entityType: "category",
          id: sourceCategoryId || "unknown",
          message: error instanceof Error ? error.message : "Unknown category sync error.",
        });
      }
    }
  }

  for (const rawPost of wordpressPosts) {
    const postPayload = readObjectValue(rawPost);
    const mappedPostPayload = mapWordpressPostPayloadForSync({
      postPayload,
      categoriesById,
    });
    const postId = readStringValue(mappedPostPayload.id);

    try {
      await upsertWordpressPostAsync(mappedPostPayload);
      postSummary.synced += 1;
    } catch (error) {
      postSummary.failed += 1;
      if (errorPreview.length < WORDPRESS_IMPORT_PREVIEW_ERROR_LIMIT) {
        errorPreview.push({
          entityType: "post",
          id: postId || "unknown",
          message: error instanceof Error ? error.message : "Unknown post sync error.",
        });
      }
    }
  }

  return {
    siteUrl: resolvedSiteUrl,
    categories: categorySummary,
    posts: postSummary,
    errors: errorPreview,
  };
};

const getHttpStatusFromHttpsErrorCode = (code) => {
  switch (readStringValue(code)) {
    case "cancelled":
      return 499;
    case "unknown":
      return 500;
    case "invalid-argument":
      return 400;
    case "deadline-exceeded":
      return 504;
    case "not-found":
      return 404;
    case "already-exists":
      return 409;
    case "permission-denied":
      return 403;
    case "resource-exhausted":
      return 429;
    case "failed-precondition":
      return 400;
    case "aborted":
      return 409;
    case "out-of-range":
      return 400;
    case "unimplemented":
      return 501;
    case "internal":
      return 500;
    case "unavailable":
      return 503;
    case "data-loss":
      return 500;
    case "unauthenticated":
      return 401;
    default:
      return 500;
  }
};

exports.dispatchPushNotifications = onCall(
  {
    region: REGION,
    memory: "512MiB",
    timeoutSeconds: 120,
  },
  async (request) => {
    const callerProfile = await getCallerProfileAsync(request);
    const requestData = request.data && typeof request.data === "object" ? request.data : {};
    const action = readStringValue(requestData.action);
    const payload =
      requestData.payload && typeof requestData.payload === "object"
        ? requestData.payload
        : {};

    if (!action) {
      throw new HttpsError("invalid-argument", "Missing notification action.");
    }

    if (action === "custom-single") {
      assertRole(callerProfile, ["admin"]);
      return sendCustomPushNotificationToUserAsync({
        uid: readStringValue(payload.uid),
        title: readStringValue(payload.title),
        body: readStringValue(payload.body),
        imageUrl: readStringValue(payload.imageUrl),
        data: readOptionalStringMap(payload.data),
        category: readStringValue(payload.category) === "creator" ? "creator" : "general",
        sendPush: payload.sendPush !== false,
        audience: readStringValue(payload.audience) === "all" ? "all" : "single",
      });
    }

    if (action === "custom-all") {
      assertRole(callerProfile, ["admin"]);
      return sendCustomPushNotificationToAllActiveUsersAsync({
        title: readStringValue(payload.title),
        body: readStringValue(payload.body),
        imageUrl: readStringValue(payload.imageUrl),
        data: readOptionalStringMap(payload.data),
        excludeUids: getUniqueStrings(readSafeArray(payload.excludeUids)),
        category: readStringValue(payload.category) === "creator" ? "creator" : "general",
        sendPush: payload.sendPush !== false,
        audience: readStringValue(payload.audience) === "single" ? "single" : "all",
      });
    }

    if (action === "post-published") {
      assertRole(callerProfile, ["author", "admin"]);
      return notifyPostPublishedAsync({
        authorUid: readStringValue(payload.authorUid),
        actorUid: callerProfile.uid,
        postId: readStringValue(payload.postId),
        postTitle: readStringValue(payload.postTitle),
        postContent: readStringValue(payload.postContent),
        imageUrl: readStringValue(payload.imageUrl),
      });
    }

    if (action === "post-published-to-all") {
      assertRole(callerProfile, ["author", "admin"]);
      return sendPostPublishedNotificationToAllActiveUsersAsync({
        postId: readStringValue(payload.postId),
        postTitle: readStringValue(payload.postTitle),
        postContent: readStringValue(payload.postContent),
        imageUrl: readStringValue(payload.imageUrl),
        excludeUids: getUniqueStrings(readSafeArray(payload.excludeUids)),
      });
    }

    if (action === "post-published-to-user") {
      assertRole(callerProfile, ["author", "admin"]);
      return sendPostPublishedNotificationToUserAsync({
        uid: readStringValue(payload.uid),
        postId: readStringValue(payload.postId),
        postTitle: readStringValue(payload.postTitle),
        imageUrl: readStringValue(payload.imageUrl),
      });
    }

    if (action === "test-token") {
      assertRole(callerProfile, ["admin"]);
      return sendTestPushNotificationAsync({
        token: readStringValue(payload.token),
        accountName: readStringValue(payload.accountName),
        platform: readStringValue(payload.platform),
      });
    }

    throw new HttpsError("invalid-argument", `Unsupported notification action: ${action}`);
  },
);

exports.getFirebaseFeatureOverview = onCall(
  {
    region: REGION,
    memory: "256MiB",
    timeoutSeconds: 90,
  },
  async (request) => {
    const callerProfile = await getCallerProfileAsync(request);
    assertRole(callerProfile, ["admin"]);

    const stats = await getFirebaseFeatureStatsAsync();
    const wordpressSyncSecret = resolveWordpressSyncSecret();
    const resolvedWordpressSiteUrl = resolveWordpressSiteUrl("");

    return {
      ok: true,
      generatedAt: new Date().toISOString(),
      requestedBy: callerProfile.uid,
      features: {
        pushNotifications: true,
        wordpressWebhookSync: true,
        wordpressBulkImport: true,
        wordpressScheduledPullSync: true,
        scheduledMaintenanceJobs: true,
        analyticsOverviewCallable: true,
      },
      functionGroups: {
        callable: [
          "dispatchPushNotifications",
          "getFirebaseFeatureOverview",
        ],
        http: [
          "syncWordpressContent",
          "importWordpressContent",
        ],
        scheduled: [
          "syncWordpressContentFromSite",
          "processPendingPushReceipts",
          "cleanupPushReceiptLogs",
        ],
      },
      configuration: {
        hasWordpressSyncSecret: Boolean(wordpressSyncSecret),
        wordpressSiteUrl: resolvedWordpressSiteUrl || null,
      },
      stats,
    };
  },
);

exports.syncWordpressContent = onRequest(
  {
    region: REGION,
    memory: "512MiB",
    timeoutSeconds: 120,
  },
  async (req, res) => {
    if (req.method !== "POST") {
      res.status(405).json({
        ok: false,
        error: "Method not allowed. Use POST.",
      });
      return;
    }

    const configuredSecret = resolveWordpressSyncSecret();
    if (!configuredSecret) {
      logger.error(
        "WordPress sync secret missing. Set WORDPRESS_SYNC_SECRET (or WP_SYNC_SECRET) in Functions environment.",
      );
      res.status(500).json({
        ok: false,
        error: "WordPress sync secret is not configured in Functions environment.",
      });
      return;
    }

    const receivedSecret = readStringValue(req.get("x-sync-secret"));
    if (!receivedSecret || receivedSecret !== configuredSecret) {
      res.status(401).json({
        ok: false,
        error: "Unauthorized sync request.",
      });
      return;
    }

    let requestBody = readObjectValue(req.body);

    if (!Object.keys(requestBody).length && typeof req.body === "string") {
      try {
        requestBody = readObjectValue(JSON.parse(req.body));
      } catch {
        res.status(400).json({
          ok: false,
          error: "Invalid JSON payload.",
        });
        return;
      }
    }

    if (!Object.keys(requestBody).length) {
      res.status(400).json({
        ok: false,
        error: "Missing sync payload body.",
      });
      return;
    }

    const nestedPayload = readObjectValue(requestBody.payload);
    const payload = Object.keys(nestedPayload).length ? nestedPayload : requestBody;
    const entityType =
      readStringValue(requestBody.entityType ?? payload.entityType).toLowerCase() || "post";
    const rawStatus = readStringValue(
      payload.status ?? payload.wpStatus ?? payload.postStatus,
    );
    const operation = normalizeWordpressOperation(
      requestBody.operation ?? payload.operation ?? payload.event,
      rawStatus,
    );

    try {
      let result;

      if (entityType === "post") {
        result =
          operation === "delete"
            ? await deleteWordpressPostAsync(payload)
            : await upsertWordpressPostAsync(payload);
      } else if (entityType === "category") {
        result =
          operation === "delete"
            ? await deleteWordpressCategoryAsync(payload)
            : await upsertWordpressCategoryAsync(payload);
      } else {
        throw new HttpsError(
          "invalid-argument",
          `Unsupported entityType: ${entityType}. Expected "post" or "category".`,
        );
      }

      logger.info("WordPress content sync completed.", {
        entityType: result.entityType,
        operation: result.operation,
        id: result.id,
      });

      res.status(200).json({
        ok: true,
        result,
      });
    } catch (error) {
      const statusCode =
        error instanceof HttpsError
          ? getHttpStatusFromHttpsErrorCode(error.code)
          : 500;
      const message =
        error instanceof HttpsError
          ? error.message
          : error instanceof Error
            ? error.message
            : "Unknown WordPress sync error.";

      logger.error("WordPress content sync failed.", {
        entityType,
        operation,
        errorCode: error instanceof HttpsError ? error.code : "internal",
        message,
      });

      res.status(statusCode).json({
        ok: false,
        error: message,
      });
    }
  },
);

exports.importWordpressContent = onRequest(
  {
    region: REGION,
    memory: "512MiB",
    timeoutSeconds: 540,
  },
  async (req, res) => {
    if (req.method !== "POST") {
      res.status(405).json({
        ok: false,
        error: "Method not allowed. Use POST.",
      });
      return;
    }

    const configuredSecret = resolveWordpressSyncSecret();
    if (!configuredSecret) {
      logger.error(
        "WordPress sync secret missing. Set WORDPRESS_SYNC_SECRET (or WP_SYNC_SECRET) in Functions environment.",
      );
      res.status(500).json({
        ok: false,
        error: "WordPress sync secret is not configured in Functions environment.",
      });
      return;
    }

    const receivedSecret = readStringValue(req.get("x-sync-secret"));
    if (!receivedSecret || receivedSecret !== configuredSecret) {
      res.status(401).json({
        ok: false,
        error: "Unauthorized import request.",
      });
      return;
    }

    let requestBody = readObjectValue(req.body);
    if (!Object.keys(requestBody).length && typeof req.body === "string") {
      try {
        requestBody = readObjectValue(JSON.parse(req.body));
      } catch {
        res.status(400).json({
          ok: false,
          error: "Invalid JSON payload.",
        });
        return;
      }
    }

    const requestedSiteUrl = readStringValue(
      requestBody.siteUrl ?? requestBody.wordpressSiteUrl ?? requestBody.url,
    );

    try {
      const result = await importWordpressSiteContentAsync({
        siteUrl: requestedSiteUrl,
      });

      logger.info("WordPress bulk import completed.", {
        siteUrl: result.siteUrl,
        categoriesFetched: result.categories.fetched,
        categoriesSynced: result.categories.synced,
        postsFetched: result.posts.fetched,
        postsSynced: result.posts.synced,
      });

      res.status(200).json({
        ok: true,
        result,
      });
    } catch (error) {
      const statusCode =
        error instanceof HttpsError
          ? getHttpStatusFromHttpsErrorCode(error.code)
          : 500;
      const message =
        error instanceof HttpsError
          ? error.message
          : error instanceof Error
            ? error.message
            : "Unknown WordPress import error.";

      logger.error("WordPress bulk import failed.", {
        siteUrl: requestedSiteUrl || resolveWordpressSiteUrl(""),
        errorCode: error instanceof HttpsError ? error.code : "internal",
        message,
      });

      res.status(statusCode).json({
        ok: false,
        error: message,
      });
    }
  },
);

exports.syncWordpressContentFromSite = onSchedule(
  {
    region: REGION,
    schedule: WORDPRESS_AUTO_IMPORT_SCHEDULE,
    timeZone: WORDPRESS_AUTO_IMPORT_TIME_ZONE,
    timeoutSeconds: 540,
    memory: "512MiB",
  },
  async () => {
    const result = await importWordpressSiteContentAsync({
      siteUrl: "",
    });

    logger.info("WordPress scheduled pull sync completed.", {
      siteUrl: result.siteUrl,
      categoriesFetched: result.categories.fetched,
      categoriesSynced: result.categories.synced,
      postsFetched: result.posts.fetched,
      postsSynced: result.posts.synced,
      categoriesFailed: result.categories.failed,
      postsFailed: result.posts.failed,
      previewErrors: result.errors.length,
    });
  },
);

exports.processPendingPushReceipts = onSchedule(
  {
    region: REGION,
    schedule: "every 15 minutes",
    timeoutSeconds: 540,
    memory: "512MiB",
  },
  async () => {
    const pendingSnapshot = await firestore
      .collection(PUSH_RECEIPTS_COLLECTION)
      .where("status", "==", "pending")
      .limit(900)
      .get();

    if (pendingSnapshot.empty) {
      logger.info("No pending push receipts to process.");
      return;
    }

    const now = admin.firestore.FieldValue.serverTimestamp();

    for (const chunk of chunkItems(
      pendingSnapshot.docs,
      NOTIFICATION_WRITE_CHUNK_SIZE,
    )) {
      const batch = firestore.batch();
      chunk.forEach((item) => {
        batch.set(
          item.ref,
          {
            status: "expired",
            updatedAt: now,
            checkedAt: now,
            detailsError: "LegacyPendingReceipt",
            detailsMessage:
              "Pending Expo receipts are no longer processed after FCM migration.",
          },
          { merge: true },
        );
      });
      await batch.commit();
    }

    logger.info("Marked legacy pending push receipts as expired.", {
      pendingCount: pendingSnapshot.size,
    });
  },
);

exports.cleanupPushReceiptLogs = onSchedule(
  {
    region: REGION,
    schedule: "every day 03:00",
    timeoutSeconds: 540,
    memory: "512MiB",
  },
  async () => {
    const cutoff = Date.now() - PUSH_RECEIPT_DOC_TTL_DAYS * DAY_IN_MS;
    const cutoffTimestamp = admin.firestore.Timestamp.fromMillis(cutoff);
    let totalDeleted = 0;

    while (true) {
      const snapshot = await firestore
        .collection(PUSH_RECEIPTS_COLLECTION)
        .where("createdAt", "<=", cutoffTimestamp)
        .limit(400)
        .get();

      if (snapshot.empty) {
        break;
      }

      const batch = firestore.batch();
      snapshot.docs.forEach((item) => {
        batch.delete(item.ref);
      });
      await batch.commit();
      totalDeleted += snapshot.size;

      if (snapshot.size < 400) {
        break;
      }
    }

    logger.info("Cleaned up old push receipt logs.", {
      totalDeleted,
      retentionDays: PUSH_RECEIPT_DOC_TTL_DAYS,
    });
  },
);
