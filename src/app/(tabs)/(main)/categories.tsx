import { useRouter } from "expo-router";
import {
  collection,
  onSnapshot,
  orderBy,
  query,
  type DocumentData,
} from "firebase/firestore";
import { useEffect, useMemo, useState } from "react";
import {
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";

import { SkeletonBlock } from "@/components/skeleton-block";
import { FONT_SIZE, RADIUS, SHADOWS, SPACING, type ThemeColors } from "@/constants/theme";
import {
  CATEGORIES_COLLECTION,
  getPostCardThumbnailUrl,
  mapCategoryRecord,
  mapPostRecord,
  POSTS_COLLECTION,
  sortPostsByRecency,
  type CategoryRecord,
  type PostRecord,
} from "@/lib/content";
import { firestore } from "@/lib/firebase";
import { DEFAULT_OFFLINE_MESSAGE, getRequestErrorMessage } from "@/lib/network";
import { useNetworkStatus } from "@/providers/network-provider";
import { useAppTheme } from "@/providers/theme-provider";

const normalizeCategoryKey = (value: string) => value.trim().toLowerCase();
const CATEGORY_SKELETON_ITEMS = Array.from({ length: 4 }, (_, index) => index);
const CATEGORY_POST_SKELETON_ITEMS = Array.from({ length: 2 }, (_, index) => index);

export default function CategoriesScreen() {
  const { colors } = useAppTheme();
  const { isConnected } = useNetworkStatus();
  const router = useRouter();
  const styles = createStyles(colors);
  const [categories, setCategories] = useState<CategoryRecord[]>([]);
  const [posts, setPosts] = useState<PostRecord[]>([]);
  const [selectedCategory, setSelectedCategory] = useState("");
  const [isLoadingCategories, setIsLoadingCategories] = useState(true);
  const [isLoadingPosts, setIsLoadingPosts] = useState(true);
  const [error, setError] = useState("");
  const isOfflineState = !isConnected || error === DEFAULT_OFFLINE_MESSAGE;
  const showInlineError = Boolean(error) && !isOfflineState;

  useEffect(() => {
    const categoriesQuery = query(
      collection(firestore, CATEGORIES_COLLECTION),
      orderBy("name", "asc"),
    );
    const postsQuery = query(collection(firestore, POSTS_COLLECTION));

    const unsubscribeCategories = onSnapshot(
      categoriesQuery,
      (snapshot) => {
        const nextCategories = snapshot.docs.map((item) =>
          mapCategoryRecord(item.id, item.data() as DocumentData),
        );
        setCategories(nextCategories);
        setError("");
        setIsLoadingCategories(false);
      },
      (snapshotError) => {
        setIsLoadingCategories(false);
        setError(
          getRequestErrorMessage({
            error: snapshotError,
            isConnected,
            onlineMessage: "Unable to load categories.",
          }),
        );
      },
    );

    const unsubscribePosts = onSnapshot(
      postsQuery,
      (snapshot) => {
        const nextPosts = sortPostsByRecency(
          snapshot.docs
            .map((item) => mapPostRecord(item.id, item.data() as DocumentData))
            .filter((item) => item.status === "published"),
        );
        setPosts(nextPosts);
        setError("");
        setIsLoadingPosts(false);
      },
      (snapshotError) => {
        setIsLoadingPosts(false);
        setError(
          getRequestErrorMessage({
            error: snapshotError,
            isConnected,
            onlineMessage: "Unable to load posts.",
          }),
        );
      },
    );

    return () => {
      unsubscribeCategories();
      unsubscribePosts();
    };
  }, [isConnected]);

  useEffect(() => {
    if (
      selectedCategory &&
      !categories.some(
        (item) =>
          normalizeCategoryKey(item.slug) ===
          normalizeCategoryKey(selectedCategory),
      )
    ) {
      setSelectedCategory("");
    }
  }, [categories, selectedCategory]);

  const isLoading = isLoadingCategories || isLoadingPosts;

  const postCountsByCategory = useMemo(() => {
    const counts = new Map<string, number>();
    posts.forEach((post) => {
      const key = normalizeCategoryKey(post.category);
      counts.set(key, (counts.get(key) ?? 0) + 1);
    });
    return counts;
  }, [posts]);

  const selectedCategoryName = useMemo(() => {
    if (!selectedCategory) {
      return "";
    }

    const selected = categories.find(
      (item) =>
        normalizeCategoryKey(item.slug) === normalizeCategoryKey(selectedCategory),
    );
    return selected?.name ?? selectedCategory;
  }, [categories, selectedCategory]);

  const categoryPosts = useMemo(() => {
    if (!selectedCategory) {
      return [];
    }

    const key = normalizeCategoryKey(selectedCategory);
    return posts.filter((item) => normalizeCategoryKey(item.category) === key);
  }, [posts, selectedCategory]);

  const openPost = (postId: string) => {
    router.push({ pathname: "/post/[postId]", params: { postId } });
  };

  return (
    <View style={styles.screen}>
      <ScrollView contentContainerStyle={styles.container}>
        <Text style={styles.title}>Categories</Text>
        <Text style={styles.subtitle}>
          Category par tap karo aur uske saare published posts dekho.
        </Text>

        {showInlineError ? <Text style={styles.error}>{error}</Text> : null}

        {isLoading ? (
          <>
            <View style={styles.grid}>
              {CATEGORY_SKELETON_ITEMS.map((item) => (
                <View key={item} style={styles.categoryCard}>
                  <SkeletonBlock width="72%" height={20} borderRadius={RADIUS.sm} />
                  <SkeletonBlock width="52%" height={14} borderRadius={RADIUS.sm} />
                  <SkeletonBlock width={70} height={16} borderRadius={RADIUS.sm} />
                </View>
              ))}
            </View>

            <View style={styles.resultsWrap}>
              <SkeletonBlock width={164} height={24} borderRadius={RADIUS.sm} />
              <SkeletonBlock width={86} height={16} borderRadius={RADIUS.sm} />

              {CATEGORY_POST_SKELETON_ITEMS.map((item) => (
                <View key={item} style={styles.postCard}>
                  <SkeletonBlock width={108} height={84} borderRadius={RADIUS.md} />

                  <View style={styles.postContent}>
                    <SkeletonBlock width="86%" height={20} borderRadius={RADIUS.sm} />
                    <SkeletonBlock width="100%" height={16} borderRadius={RADIUS.sm} />
                    <SkeletonBlock width="70%" height={16} borderRadius={RADIUS.sm} />
                  </View>
                </View>
              ))}
            </View>
          </>
        ) : null}

        {!isLoading && !categories.length ? (
          <View style={styles.emptyWrap}>
            <Text style={styles.emptyText}>No categories found.</Text>
          </View>
        ) : null}

        {!!categories.length ? (
          <View style={styles.grid}>
            {categories.map((item) => {
              const categoryKey = normalizeCategoryKey(item.slug);
              const isActive =
                normalizeCategoryKey(selectedCategory) === categoryKey;
              const postCount = postCountsByCategory.get(categoryKey) ?? 0;

              return (
                <Pressable
                  key={item.id}
                  style={[
                    styles.categoryCard,
                    isActive ? styles.categoryCardActive : undefined,
                  ]}
                  onPress={() => setSelectedCategory(item.slug)}
                >
                  <Text
                    style={[
                      styles.categoryName,
                      isActive ? styles.categoryNameActive : undefined,
                    ]}
                    numberOfLines={2}
                  >
                    {item.name}
                  </Text>
                  <Text
                    style={[
                      styles.categorySlug,
                      isActive ? styles.categorySlugActive : undefined,
                    ]}
                    numberOfLines={1}
                  >
                    {item.slug}
                  </Text>
                  <Text
                    style={[
                      styles.categoryCount,
                      isActive ? styles.categoryCountActive : undefined,
                    ]}
                  >
                    {postCount} post{postCount === 1 ? "" : "s"}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        ) : null}

        {selectedCategory ? (
          <View style={styles.resultsWrap}>
            <Text style={styles.resultsTitle}>{selectedCategoryName} Posts</Text>
            <Text style={styles.resultsMeta}>
              {categoryPosts.length} post{categoryPosts.length === 1 ? "" : "s"}{" "}
              found
            </Text>

            {!categoryPosts.length ? (
              <View style={styles.emptyWrap}>
                <Text style={styles.emptyText}>
                  No published posts in this category yet.
                </Text>
              </View>
            ) : null}

            {categoryPosts.map((post) => {
              const thumbnailUrl = getPostCardThumbnailUrl(post);

              return (
                <Pressable
                  key={post.id}
                  style={({ pressed }) => [
                    styles.postCard,
                    pressed && styles.postCardPressed,
                  ]}
                  onPress={() => openPost(post.id)}
                >
                  {thumbnailUrl ? (
                    <Image
                      source={{ uri: thumbnailUrl }}
                      style={styles.thumbnail}
                      resizeMode="cover"
                    />
                  ) : (
                    <View style={styles.thumbnailPlaceholder} />
                  )}

                  <View style={styles.postContent}>
                    <Text style={styles.postTitle} numberOfLines={2} ellipsizeMode="tail">
                      {post.title}
                    </Text>
                    <Text
                      style={styles.postPreview}
                      numberOfLines={3}
                      ellipsizeMode="tail"
                    >
                      {post.content.trim() || "-"}
                    </Text>
                  </View>
                </Pressable>
              );
            })}
          </View>
        ) : (
          !isLoading && (
            <View style={styles.emptyWrap}>
              <Text style={styles.emptyText}>
                Select a category to view its posts.
              </Text>
            </View>
          )
        )}
      </ScrollView>
    </View>
  );
}

const createStyles = (colors: ThemeColors) => StyleSheet.create({
  screen: {
    flex: 1,
  },
  container: {
    flexGrow: 1,
    padding: SPACING.xl,
    gap: SPACING.sm,
    backgroundColor: colors.background,
  },
  title: {
    fontSize: FONT_SIZE.title,
    fontWeight: "700",
    color: colors.text,
  },
  subtitle: {
    fontSize: FONT_SIZE.body,
    color: colors.mutedText,
  },
  error: {
    color: colors.danger,
    fontSize: 13,
  },
  emptyWrap: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: RADIUS.md,
    padding: SPACING.md,
    backgroundColor: colors.surface,
  },
  emptyText: {
    color: colors.mutedText,
    fontSize: 13,
    textAlign: "center",
  },
  grid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: SPACING.sm,
  },
  categoryCard: {
    width: "48%",
    minHeight: 120,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: RADIUS.xs,
    backgroundColor: colors.surface,
    padding: SPACING.md,
    gap: SPACING.xs,
    justifyContent: "space-between",
    ...SHADOWS.sm,
  },
  categoryCardActive: {
    borderColor: colors.accentBorder,
    backgroundColor: colors.accentSoft,
  },
  categoryName: {
    color: colors.text,
    fontSize: 15,
    fontWeight: "700",
  },
  categoryNameActive: {
    color: colors.accent,
  },
  categorySlug: {
    color: colors.mutedText,
    fontSize: 12,
  },
  categorySlugActive: {
    color: colors.accent,
  },
  categoryCount: {
    color: colors.text,
    fontSize: 12,
    fontWeight: "600",
  },
  categoryCountActive: {
    color: colors.accent,
  },
  resultsWrap: {
    marginTop: SPACING.sm,
    gap: SPACING.sm,
  },
  resultsTitle: {
    color: colors.text,
    fontSize: 18,
    fontWeight: "700",
  },
  resultsMeta: {
    color: colors.mutedText,
    fontSize: 12,
  },
  postCard: {
    borderRadius: RADIUS.sm,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    padding: SPACING.md,
    gap: SPACING.md,
    flexDirection: "row",
    alignItems: "center",
    minHeight: 112,
    ...SHADOWS.sm,
  },
  postCardPressed: {
    opacity: 0.92,
  },
  thumbnail: {
    width: 108,
    height: 84,
    borderRadius: RADIUS.xs,
    backgroundColor: colors.surfaceSoft,
  },
  thumbnailPlaceholder: {
    width: 108,
    height: 84,
    borderRadius: RADIUS.md,
    backgroundColor: colors.surfaceSoft,
  },
  postContent: {
    flex: 1,
    justifyContent: "center",
    gap: SPACING.xs,
  },
  postTitle: {
    color: colors.text,
    fontSize: 16,
    fontWeight: "700",
    lineHeight: 21,
  },
  postPreview: {
    color: colors.mutedText,
    fontSize: FONT_SIZE.body,
    lineHeight: 19,
  },
});
