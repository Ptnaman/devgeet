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
import { useRouter } from "expo-router";
import { HugeiconsIcon } from "@hugeicons/react-native";
import { FavouriteIcon } from "@hugeicons/core-free-icons";
import {
  collection,
  onSnapshot,
  query,
  type DocumentData,
} from "firebase/firestore";

import { COLORS, FONT_SIZE, RADIUS, SHADOWS, SPACING } from "@/constants/theme";
import {
  formatDate,
  getPostCardThumbnailUrl,
  mapPostRecord,
  POSTS_COLLECTION,
  sortPostsByRecency,
  type PostRecord,
} from "@/lib/content";
import { useFavorites } from "@/hooks/use-favorites";
import { firestore } from "@/lib/firebase";

export default function FavoriteScreen() {
  const router = useRouter();
  const { favoritePostIds, isFavorite, isLoadingFavorites, toggleFavorite } =
    useFavorites();
  const [posts, setPosts] = useState<PostRecord[]>([]);
  const [isLoadingPosts, setIsLoadingPosts] = useState(true);
  const [postsError, setPostsError] = useState("");

  useEffect(() => {
    const postsQuery = query(collection(firestore, POSTS_COLLECTION));

    const unsubscribe = onSnapshot(
      postsQuery,
      (snapshot) => {
        const nextPosts = sortPostsByRecency(
          snapshot.docs
            .map((item) => mapPostRecord(item.id, item.data() as DocumentData))
            .filter((post) => post.status === "published"),
        );

        setPosts(nextPosts);
        setPostsError("");
        setIsLoadingPosts(false);
      },
      () => {
        setPosts([]);
        setPostsError("Unable to load posts right now.");
        setIsLoadingPosts(false);
      },
    );

    return unsubscribe;
  }, []);

  const favoritePosts = useMemo(
    () => posts.filter((post) => favoritePostIds.has(post.id)),
    [favoritePostIds, posts],
  );

  const isLoading = isLoadingPosts || isLoadingFavorites;

  const openPost = (postId: string) => {
    router.push({ pathname: "/post/[postId]", params: { postId } });
  };

  const handleToggleFavorite = async (post: PostRecord) => {
    await toggleFavorite(post).catch(() => undefined);
  };

  const subtitle = useMemo(() => {
    if (isLoading) {
      return "Loading your saved posts...";
    }

    if (!favoritePosts.length) {
      return "Posts you save will appear here.";
    }

    return `${favoritePosts.length} saved post${favoritePosts.length === 1 ? "" : "s"}.`;
  }, [favoritePosts.length, isLoading]);

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <View style={styles.headerCard}>
        <View style={styles.headerRow}>
          <View style={styles.headerTextWrap}>
            <Text style={styles.title}>Favorites</Text>
            <Text style={styles.subtitle}>{subtitle}</Text>
          </View>
          <View style={styles.countPill}>
            <Text style={styles.countPillText}>{favoritePosts.length}</Text>
          </View>
        </View>
      </View>

      {isLoading ? (
        <ActivityIndicator size="large" color={COLORS.primary} style={styles.loader} />
      ) : null}

      {!isLoading && postsError ? (
        <Text style={styles.errorText}>{postsError}</Text>
      ) : null}

      {!isLoading && !favoritePosts.length ? (
        <View style={styles.emptyWrap}>
          <View style={styles.emptyIconCard}>
            <HugeiconsIcon icon={FavouriteIcon} size={30} color={COLORS.mutedText} />
          </View>
          <Text style={styles.emptyTitle}>No favorites yet</Text>
          <Text style={styles.emptyText}>
            Save any post and it will show here for quick access.
          </Text>
        </View>
      ) : null}

      {favoritePosts.map((post) => {
        const thumbnailUrl = getPostCardThumbnailUrl(post);
        const favorite = isFavorite(post.id);
        const updatedLabel = formatDate(post.uploadDate || post.createDate);
        const categoryLabel = (post.category.trim() || "general")
          .split(/[\s-]+/)
          .filter(Boolean)
          .map((word) => `${word.charAt(0).toUpperCase()}${word.slice(1)}`)
          .join(" ");

        return (
          <View key={post.id} style={styles.card}>
            <Pressable
              style={({ pressed }) => [styles.cardBody, pressed && styles.cardBodyPressed]}
              onPress={() => openPost(post.id)}
            >
              <View style={styles.cardRow}>
                {thumbnailUrl ? (
                  <Image
                    source={{ uri: thumbnailUrl }}
                    style={styles.thumbnail}
                    resizeMode="cover"
                  />
                ) : (
                  <View style={styles.thumbnailFallback}>
                    <HugeiconsIcon icon={FavouriteIcon} size={18} color={COLORS.mutedText} />
                  </View>
                )}

                <View style={styles.cardContent}>
                  <View style={styles.cardHeaderRow}>
                    <Text style={styles.categoryBadge}>{categoryLabel}</Text>
                    <Text style={styles.meta}>Updated {updatedLabel}</Text>
                  </View>

                  <Text style={styles.cardTitle} numberOfLines={2} ellipsizeMode="tail">
                    {post.title}
                  </Text>
                  <Text style={styles.cardPreview} numberOfLines={2} ellipsizeMode="tail">
                    {post.content.trim() || "-"}
                  </Text>

                  <View style={styles.cardFooterRow}>
                    <Pressable
                      style={[
                        styles.favoriteButton,
                        favorite ? styles.favoriteButtonActive : undefined,
                      ]}
                      onPress={() => {
                        void handleToggleFavorite(post);
                      }}
                    >
                      <HugeiconsIcon
                        icon={FavouriteIcon}
                        size={16}
                        color={favorite ? COLORS.danger : COLORS.mutedText}
                      />
                      <Text
                        style={[
                          styles.favoriteButtonText,
                          favorite ? styles.favoriteButtonTextActive : undefined,
                        ]}
                      >
                        {favorite ? "Saved" : "Save"}
                      </Text>
                    </Pressable>
                  </View>
                </View>
              </View>
            </Pressable>
          </View>
        );
      })}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flexGrow: 1,
    padding: SPACING.xl,
    gap: SPACING.md,
    backgroundColor: COLORS.background,
    paddingBottom: SPACING.xxl * 2,
  },
  headerCard: {
    backgroundColor: COLORS.surface,
    borderRadius: RADIUS.lg,
    padding: SPACING.lg,
    borderWidth: 1,
    borderColor: COLORS.border,
    ...SHADOWS.sm,
  },
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: SPACING.md,
  },
  headerTextWrap: {
    flex: 1,
    gap: 4,
  },
  title: {
    fontSize: FONT_SIZE.title,
    fontWeight: "700",
    color: COLORS.text,
  },
  subtitle: {
    fontSize: 13,
    color: COLORS.mutedText,
    lineHeight: 20,
  },
  countPill: {
    minWidth: 38,
    height: 38,
    paddingHorizontal: SPACING.md,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: COLORS.border,
    backgroundColor: COLORS.surfaceMuted,
    alignItems: "center",
    justifyContent: "center",
  },
  countPillText: {
    color: COLORS.text,
    fontSize: 13,
    fontWeight: "700",
  },
  loader: {
    marginVertical: SPACING.md,
  },
  errorText: {
    color: COLORS.danger,
    fontSize: 13,
  },
  emptyWrap: {
    alignItems: "center",
    justifyContent: "center",
    gap: SPACING.sm,
    borderRadius: RADIUS.lg,
    padding: SPACING.xl,
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.border,
    ...SHADOWS.sm,
  },
  emptyIconCard: {
    width: 60,
    height: 60,
    borderRadius: 999,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: COLORS.surfaceMuted,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  emptyTitle: {
    color: COLORS.text,
    fontSize: 17,
    fontWeight: "700",
  },
  emptyText: {
    color: COLORS.mutedText,
    fontSize: 13,
    textAlign: "center",
    lineHeight: 20,
  },
  card: {
    backgroundColor: COLORS.surface,
    borderRadius: RADIUS.lg,
    padding: SPACING.md,
    borderWidth: 1,
    borderColor: COLORS.border,
    ...SHADOWS.sm,
  },
  cardBody: {
    gap: SPACING.sm,
  },
  cardBodyPressed: {
    opacity: 0.92,
  },
  cardRow: {
    flexDirection: "row",
    alignItems: "stretch",
    gap: SPACING.md,
  },
  thumbnail: {
    width: 96,
    height: 108,
    borderRadius: RADIUS.md,
    backgroundColor: COLORS.surfaceSoft,
  },
  thumbnailFallback: {
    width: 96,
    height: 108,
    borderRadius: RADIUS.md,
    backgroundColor: COLORS.surfaceMuted,
    borderWidth: 1,
    borderColor: COLORS.border,
    alignItems: "center",
    justifyContent: "center",
  },
  cardContent: {
    flex: 1,
    minHeight: 108,
    justifyContent: "space-between",
    gap: SPACING.sm,
  },
  cardHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: SPACING.sm,
  },
  categoryBadge: {
    alignSelf: "flex-start",
    borderWidth: 1,
    borderColor: COLORS.accentBorder,
    borderRadius: 999,
    paddingHorizontal: SPACING.sm,
    paddingVertical: 3,
    backgroundColor: COLORS.accentSoft,
    color: COLORS.accent,
    fontSize: 11,
    fontWeight: "700",
  },
  cardFooterRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "flex-end",
    gap: SPACING.md,
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: COLORS.text,
    lineHeight: 22,
  },
  cardPreview: {
    fontSize: 13,
    color: COLORS.mutedText,
    lineHeight: 19,
  },
  favoriteButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: SPACING.xs,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 7,
    backgroundColor: COLORS.surfaceMuted,
  },
  favoriteButtonActive: {
    borderColor: COLORS.dangerBorder,
    backgroundColor: COLORS.dangerSoft,
  },
  favoriteButtonText: {
    color: COLORS.text,
    fontSize: 12,
    fontWeight: "700",
  },
  favoriteButtonTextActive: {
    color: COLORS.danger,
  },
  meta: {
    fontSize: 12,
    color: COLORS.mutedText,
    flexShrink: 1,
    textAlign: "right",
  },
});
