import AsyncStorage from "@react-native-async-storage/async-storage";

import { sortPostsByRecency, type PostRecord } from "@/lib/content";

const CATEGORY_POSTS_CACHE_KEY_PREFIX = "app:category-posts:v1:";
const MAX_CACHED_CATEGORY_POSTS = 40;

const getCategoryPostsCacheKey = (categorySlug: string) =>
  `${CATEGORY_POSTS_CACHE_KEY_PREFIX}${categorySlug}`;

const isPostRecord = (value: unknown): value is PostRecord => {
  if (typeof value !== "object" || value === null) {
    return false;
  }

  const item = value as Partial<PostRecord>;
  return (
    typeof item.id === "string" &&
    typeof item.title === "string" &&
    typeof item.content === "string" &&
    typeof item.status === "string" &&
    typeof item.category === "string"
  );
};

export const hydrateCategoryPostsCacheAsync = async (categorySlug: string) => {
  if (!categorySlug) {
    return [] as PostRecord[];
  }

  try {
    const rawValue = await AsyncStorage.getItem(getCategoryPostsCacheKey(categorySlug));
    if (!rawValue) {
      return [] as PostRecord[];
    }

    const parsedValue = JSON.parse(rawValue) as unknown;
    if (!Array.isArray(parsedValue)) {
      return [] as PostRecord[];
    }

    return sortPostsByRecency(parsedValue.filter(isPostRecord));
  } catch {
    return [] as PostRecord[];
  }
};

export const persistCategoryPostsCacheAsync = async (
  categorySlug: string,
  posts: PostRecord[],
) => {
  if (!categorySlug) {
    return;
  }

  await AsyncStorage.setItem(
    getCategoryPostsCacheKey(categorySlug),
    JSON.stringify(posts.slice(0, MAX_CACHED_CATEGORY_POSTS)),
  );
};
