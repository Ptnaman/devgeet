import { Stack, useLocalSearchParams, useRouter } from "expo-router";
import {
  collection,
  onSnapshot,
  query,
  where,
  type DocumentData,
} from "firebase/firestore";
import { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";

import { FONT_SIZE, RADIUS, SHADOWS, SPACING, type ThemeColors } from "@/constants/theme";
import {
  createSlug,
  getPostCardThumbnailUrl,
  isPostTrashed,
  mapPostRecord,
  POSTS_COLLECTION,
  sortPostsByRecency,
  type PostRecord,
} from "@/lib/content";
import { firestore } from "@/lib/firebase";
import { DEFAULT_OFFLINE_MESSAGE, getRequestErrorMessage } from "@/lib/network";
import { useNetworkStatus } from "@/providers/network-provider";
import { useAppTheme } from "@/providers/theme-provider";

const resolveCategorySlug = (value: string | string[] | undefined) =>
  typeof value === "string" ? createSlug(value) : "";

const formatCategoryLabel = (value: string) => {
  if (!value) {
    return "Category";
  }

  return value
    .split(/[\s-]+/)
    .filter(Boolean)
    .map((word) => `${word.charAt(0).toUpperCase()}${word.slice(1)}`)
    .join(" ");
};

export default function CategoryPostsScreen() {
  const { colors } = useAppTheme();
  const { isConnected } = useNetworkStatus();
  const router = useRouter();
  const styles = createStyles(colors);
  const { categorySlug: categorySlugParam } = useLocalSearchParams<{ categorySlug?: string }>();
  const categorySlug = resolveCategorySlug(categorySlugParam);
  const [posts, setPosts] = useState<PostRecord[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    setIsLoading(true);

    if (!categorySlug) {
      setPosts([]);
      setError("Category not found.");
      setIsLoading(false);
      return;
    }

    const postsQuery = query(
      collection(firestore, POSTS_COLLECTION),
      where("category", "==", categorySlug),
      where("status", "==", "published"),
    );

    const unsubscribe = onSnapshot(
      postsQuery,
      (snapshot) => {
        const nextPosts = sortPostsByRecency(
          snapshot.docs
            .map((item) => mapPostRecord(item.id, item.data() as DocumentData))
            .filter((item) => item.status === "published" && !isPostTrashed(item)),
        );
        setPosts(nextPosts);
        setError("");
        setIsLoading(false);
      },
      (snapshotError) => {
        setPosts([]);
        setError(
          getRequestErrorMessage({
            error: snapshotError,
            isConnected,
            onlineMessage: "Unable to load category posts.",
          }),
        );
        setIsLoading(false);
      },
    );

    return unsubscribe;
  }, [categorySlug, isConnected]);

  const categoryLabel = useMemo(() => formatCategoryLabel(categorySlug), [categorySlug]);
  const isOfflineState = !isConnected || error === DEFAULT_OFFLINE_MESSAGE;
  const showInlineError = Boolean(error) && !isOfflineState;
  const subtitle = useMemo(
    () =>
      isLoading
        ? "Posts loading..."
        : `${posts.length} published post${posts.length === 1 ? "" : "s"} found.`,
    [isLoading, posts.length],
  );

  const openPost = (postId: string) => {
    router.push({
      pathname: "/post/[postId]",
      params: {
        postId,
        swipeSource: "category",
        swipeCategorySlug: categorySlug,
      },
    });
  };

  return (
    <View style={styles.screen}>
      <Stack.Screen options={{ title: categoryLabel }} />

      <ScrollView contentContainerStyle={styles.container} showsVerticalScrollIndicator={false}>
        <View style={styles.heroCard}>
          <Text style={styles.eyebrow}>Category</Text>
          <Text style={styles.title}>{categoryLabel}</Text>
          <Text style={styles.subtitle}>{subtitle}</Text>
        </View>

        {showInlineError ? <Text style={styles.error}>{error}</Text> : null}

        {isLoading ? (
          <View style={styles.loadingWrap}>
            <ActivityIndicator size="large" color={colors.primary} />
          </View>
        ) : null}

        {!isLoading && !error && !posts.length ? (
          <View style={styles.emptyWrap}>
            <Text style={styles.emptyText}>No published posts in this category yet.</Text>
          </View>
        ) : null}

        {!isLoading
          ? posts.map((post) => {
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
            })
          : null}
      </ScrollView>
    </View>
  );
}

const createStyles = (colors: ThemeColors) => StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.background,
  },
  container: {
    padding: SPACING.xl,
    paddingBottom: SPACING.xxl * 2,
    gap: SPACING.md,
  },
  heroCard: {
    borderRadius: RADIUS.md,
    borderWidth: 1,
    borderColor: colors.accentBorder,
    backgroundColor: colors.accentSoft,
    padding: SPACING.lg,
    gap: SPACING.xs,
  },
  eyebrow: {
    color: colors.accent,
    fontSize: 12,
    fontWeight: "700",
    textTransform: "uppercase",
    letterSpacing: 0.6,
  },
  title: {
    color: colors.text,
    fontSize: 24,
    fontWeight: "700",
  },
  subtitle: {
    color: colors.mutedText,
    fontSize: FONT_SIZE.body,
  },
  error: {
    color: colors.danger,
    fontSize: 13,
  },
  loadingWrap: {
    minHeight: 180,
    alignItems: "center",
    justifyContent: "center",
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
