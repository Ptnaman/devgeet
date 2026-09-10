import AsyncStorage from "@react-native-async-storage/async-storage";

import type { PostRecord } from "@/lib/content";

const READING_HISTORY_KEY_PREFIX = "devgeet:reading-time:v1:";
const MIN_RECORDED_DURATION_MS = 1_000;
const MAX_SESSION_DURATION_MS = 30 * 60 * 1_000;

type ReadingTimeByPostId = Record<string, number>;

let pendingWrite = Promise.resolve();

const getStorageKey = (userId: string) =>
  `${READING_HISTORY_KEY_PREFIX}${userId || "guest"}`;

const parseReadingTimes = (value: string | null): ReadingTimeByPostId => {
  if (!value) return {};

  try {
    const parsed = JSON.parse(value) as unknown;
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return {};

    return Object.fromEntries(
      Object.entries(parsed).filter(
        (entry): entry is [string, number] =>
          Boolean(entry[0]) &&
          typeof entry[1] === "number" &&
          Number.isFinite(entry[1]) &&
          entry[1] > 0,
      ),
    );
  } catch {
    return {};
  }
};

export const recordPostReadingTimeAsync = async (
  userId: string,
  postId: string,
  durationMs: number,
) => {
  const safeDuration = Math.min(Math.round(durationMs), MAX_SESSION_DURATION_MS);
  if (!postId || safeDuration < MIN_RECORDED_DURATION_MS) return;

  pendingWrite = pendingWrite
    .catch(() => {})
    .then(async () => {
      const key = getStorageKey(userId);
      const readingTimes = parseReadingTimes(await AsyncStorage.getItem(key));
      readingTimes[postId] = (readingTimes[postId] ?? 0) + safeDuration;
      await AsyncStorage.setItem(key, JSON.stringify(readingTimes));
    });

  await pendingWrite;
};

export const getRecommendedPostsAsync = async (
  userId: string,
  posts: PostRecord[],
  limit: number,
) => {
  const readingTimes = parseReadingTimes(
    await AsyncStorage.getItem(getStorageKey(userId)),
  );

  return posts
    .map((post, index) => ({ post, index, duration: readingTimes[post.id] ?? 0 }))
    .sort((left, right) => right.duration - left.duration || left.index - right.index)
    .slice(0, limit)
    .map(({ post }) => post);
};
