import { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
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

import { FONT_SIZE, RADIUS, SHADOWS, SPACING, type ThemeColors } from "@/constants/theme";
import {
  getPostCardThumbnailUrl,
  mapPostRecord,
  POSTS_COLLECTION,
  sortPostsByRecency,
  type PostRecord,
} from "@/lib/content";
import { useFavorites } from "@/hooks/use-favorites";
import { firestore } from "@/lib/firebase";
import { getActionErrorMessage, getRequestErrorMessage } from "@/lib/network";
import { useNetworkStatus } from "@/providers/network-provider";
import { useAppTheme } from "@/providers/theme-provider";

export default function FavoriteScreen() {
  const { colors } = useAppTheme();
  const { isConnected } = useNetworkStatus();
  const router = useRouter();
  const {
    favoritePostIds,
    favoritesError,
    isFavorite,
    isLoadingFavorites,
    toggleFavorite,
  } =
    useFavorites();
  const styles = createStyles(colors);
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
      (snapshotError) => {
        setPosts([]);
        setPostsError(
          getRequestErrorMessage({
            error: snapshotError,
            isConnected,
            onlineMessage: "Unable to load posts right now.",
          }),
        );
        setIsLoadingPosts(false);
      },
    );

    return unsubscribe;
  }, [isConnected]);

  const favoritePosts = useMemo(
    () => posts.filter((post) => favoritePostIds.has(post.id)),
    [favoritePostIds, posts],
  );

  const isLoading = isLoadingPosts || isLoadingFavorites;

  const openPost = (postId: string) => {
    router.push({ pathname: "/post/[postId]", params: { postId } });
  };

  const handleToggleFavorite = async (post: PostRecord) => {
    try {
      await toggleFavorite(post);
    } catch (toggleError) {
      Alert.alert(
        "Unable to update favorites",
        getActionErrorMessage({
          error: toggleError,
          isConnected,
          fallbackMessage: "Favorites could not be updated right now.",
        }),
      );
    }
  };

  const combinedError = postsError || favoritesError;

  const subtitle = useMemo(() => {
    if (isLoading) {
      return "Loading your saved posts...";
    }

    if (combinedError) {
      return combinedError;
    }

    if (!favoritePosts.length) {
      return "Posts you save will appear here.";
    }

    return `${favoritePosts.length} saved post${favoritePosts.length === 1 ? "" : "s"}.`;
  }, [combinedError, favoritePosts.length, isLoading]);

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
        <ActivityIndicator size="large" color={colors.primary} style={styles.loader} />
      ) : null}

      {!isLoading && combinedError ? (
        <Text style={styles.errorText}>{combinedError}</Text>
      ) : null}

      {!isLoading && !combinedError && !favoritePosts.length ? (
        <View style={styles.emptyWrap}>
          <View style={styles.emptyIconCard}>
            <HugeiconsIcon icon={FavouriteIcon} size={30} color={colors.mutedText} />
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
                    <HugeiconsIcon icon={FavouriteIcon} size={18} color={colors.mutedText} />
                  </View>
                )}

                <View style={styles.cardContent}>
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
                        color={favorite ? colors.danger : colors.mutedText}
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

const createStyles = (colors: ThemeColors) => StyleSheet.create({
  container: {
    flexGrow: 1,
    padding: SPACING.xl,
    gap: SPACING.md,
    backgroundColor: colors.background,
    paddingBottom: SPACING.xxl * 2,
  },
  headerCard: {
    backgroundColor: colors.surface,
    padding: SPACING.lg,
    borderWidth: 1,
    borderColor: colors.border,
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
    color: colors.text,
  },
  subtitle: {
    fontSize: 13,
    color: colors.mutedText,
    lineHeight: 20,
  },
  countPill: {
    minWidth: 38,
    height: 38,
    paddingHorizontal: SPACING.md,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surfaceMuted,
    alignItems: "center",
    justifyContent: "center",
  },
  countPillText: {
    color: colors.text,
    fontSize: 13,
    fontWeight: "700",
  },
  loader: {
    marginVertical: SPACING.md,
  },
  errorText: {
    color: colors.danger,
    fontSize: 13,
  },
  emptyWrap: {
    alignItems: "center",
    justifyContent: "center",
    gap: SPACING.sm,
    borderRadius: RADIUS.lg,
    padding: SPACING.xl,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    ...SHADOWS.sm,
  },
  emptyIconCard: {
    width: 60,
    height: 60,
    borderRadius: 999,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.surfaceMuted,
    borderWidth: 1,
    borderColor: colors.border,
  },
  emptyTitle: {
    color: colors.text,
    fontSize: 17,
    fontWeight: "700",
  },
  emptyText: {
    color: colors.mutedText,
    fontSize: 13,
    textAlign: "center",
    lineHeight: 20,
  },
  card: {
    backgroundColor: colors.surface,
    borderRadius: RADIUS.xs,
    padding: SPACING.md,
    borderWidth: 1,
    borderColor: colors.border,
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
    borderRadius: RADIUS.xs,
    backgroundColor: colors.surfaceSoft,
  },
  thumbnailFallback: {
    width: 96,
    height: 108,
    borderRadius: RADIUS.md,
    backgroundColor: colors.surfaceMuted,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: "center",
    justifyContent: "center",
  },
  cardContent: {
    flex: 1,
    minHeight: 108,
    justifyContent: "space-between",
    gap: SPACING.sm,
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
    color: colors.text,
    lineHeight: 22,
  },
  cardPreview: {
    fontSize: 13,
    color: colors.mutedText,
    lineHeight: 19,
  },
  favoriteButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: SPACING.xs,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 7,
    backgroundColor: colors.surfaceMuted,
  },
  favoriteButtonActive: {
    borderColor: colors.dangerBorder,
    backgroundColor: colors.dangerSoft,
  },
  favoriteButtonText: {
    color: colors.text,
    fontSize: 12,
    fontWeight: "700",
  },
  favoriteButtonTextActive: {
    color: colors.danger,
  },
});
