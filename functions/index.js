const admin = require("firebase-admin");
const logger = require("firebase-functions/logger");
const { HttpsError, onCall } = require("firebase-functions/v2/https");
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
const DEFAULT_ANDROID_CHANNEL_ID = "default";
const DEFAULT_POST_PUBLISH_BODY = "Tap to read it on DevGeet.";
const MAX_POST_PUBLISH_BODY_LENGTH = 180;
const FCM_SEND_CHUNK_SIZE = 500;
const NOTIFICATION_WRITE_CHUNK_SIZE = 300;
const DAY_IN_MS = 24 * 60 * 60 * 1000;
const PUSH_RECEIPT_DOC_TTL_DAYS = 7;

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
