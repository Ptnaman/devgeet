import { useMemo } from "react";
import { useRouter } from "expo-router";
import {
  ActivityIndicator,
  Alert,
  Image,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";

import { FavoriteTabIcon } from "@/components/icons/favorite-tab-icon";
import { MainTabScrollView } from "@/components/main-tabs/main-tab-scroll-view";
import { TrashActionIcon } from "@/components/icons/trash-action-icon";
import {
  FONT_SIZE,
  RADIUS,
  SHADOWS,
  SPACING,
  STATIC_COLORS,
  type ThemeColors,
} from "@/constants/theme";
import { getPostCardThumbnailUrl, type PostRecord } from "@/lib/content";
import {
  DEFAULT_OFFLINE_MESSAGE,
  getActionErrorMessage,
} from "@/lib/network";
import { useFavorites } from "@/hooks/use-favorites";
import { useNetworkStatus } from "@/providers/network-provider";
import { useMainTabData } from "@/providers/main-tab-data-provider";
import { useAppTheme } from "@/providers/theme-provider";

export function FavoriteTabContent() {
  const { colors } = useAppTheme();
  const { publishedPosts, isLoadingPosts, postsError } = useMainTabData();
  const { isConnected, showOfflineToast } = useNetworkStatus();
  const router = useRouter();
  const {
    favoritePostIds,
    favoritesError,
    isLoadingFavorites,
    clearFavorites,
    toggleFavorite,
  } = useFavorites();
  const styles = createStyles(colors);

  const favoritePosts = useMemo(
    () => publishedPosts.filter((post) => favoritePostIds.has(post.id)),
    [favoritePostIds, publishedPosts],
  );

  const isLoading = isLoadingPosts || isLoadingFavorites;
  const combinedError = postsError || favoritesError;
  const isOfflineState = !isConnected || combinedError === DEFAULT_OFFLINE_MESSAGE;
  const showInlineError = Boolean(combinedError) && !isOfflineState;

  const openPost = (postId: string) => {
    router.push({ pathname: "/post/[postId]", params: { postId } });
  };

  const handleToggleFavorite = async (post: PostRecord) => {
    try {
      await toggleFavorite(post);
    } catch (toggleError) {
      const message = getActionErrorMessage({
        error: toggleError,
        isConnected,
        fallbackMessage: "Favorites could not be updated right now.",
      });

      if (message === DEFAULT_OFFLINE_MESSAGE) {
        showOfflineToast();
        return;
      }

      Alert.alert("Unable to update favorites", message);
    }
  };

  const handleClearAllFavorites = async () => {
    try {
      await clearFavorites();
    } catch (clearError) {
      const message = getActionErrorMessage({
        error: clearError,
        isConnected,
        fallbackMessage: "Favorites could not be cleared right now.",
      });

      if (message === DEFAULT_OFFLINE_MESSAGE) {
        showOfflineToast();
        return;
      }

      Alert.alert("Unable to clear favorites", message);
    }
  };

  const handleConfirmClearAllFavorites = () => {
    Alert.alert(
      "Clear all favorites?",
      "This will remove every saved post from your favorites.",
      [
        {
          text: "Cancel",
          style: "cancel",
        },
        {
          text: "Clear all",
          style: "destructive",
          onPress: () => {
            void handleClearAllFavorites();
          },
        },
      ],
    );
  };

  const subtitle = useMemo(() => {
    if (isLoading) {
      return "Loading your saved posts...";
    }

    if (showInlineError) {
      return combinedError;
    }

    if (!favoritePosts.length) {
      return "Posts you save will appear here.";
    }

    return `${favoritePosts.length} saved post${favoritePosts.length === 1 ? "" : "s"}.`;
  }, [combinedError, favoritePosts.length, isLoading, showInlineError]);

  return (
    <View style={styles.screen}>
      <MainTabScrollView tabName="favorite" contentContainerStyle={styles.container}>
        <View style={styles.headerCard}>
          <View style={styles.headerRow}>
            <View style={styles.headerTextWrap}>
              <Text style={styles.title}>Favorites</Text>
              <Text style={styles.subtitle}>{subtitle}</Text>
            </View>
            <View style={styles.headerActions}>
              {!isLoading && favoritePosts.length ? (
                <Pressable
                  style={({ pressed }) => [
                    styles.clearAllButton,
                    pressed && styles.clearAllButtonPressed,
                  ]}
                  onPress={handleConfirmClearAllFavorites}
                  accessibilityRole="button"
                  accessibilityLabel="Clear all favorites"
                >
                  <Text style={styles.clearAllButtonText}>Clear all</Text>
                </Pressable>
              ) : null}
              <View style={styles.countPill}>
                <Text style={styles.countPillText}>{favoritePosts.length}</Text>
              </View>
            </View>
          </View>
        </View>

        {isLoading ? (
          <ActivityIndicator size="large" color={colors.primary} style={styles.loader} />
        ) : null}

        {!isLoading && showInlineError ? (
          <Text style={styles.errorText}>{combinedError}</Text>
        ) : null}

        {!isLoading && !combinedError && !favoritePosts.length ? (
          <View style={styles.emptyWrap}>
            <View style={styles.emptyIconCard}>
              <FavoriteTabIcon size={30} color={colors.mutedText} />
            </View>
            <Text style={styles.emptyTitle}>No favorites yet</Text>
            <Text style={styles.emptyText}>
              Save any post and it will show here for quick access.
            </Text>
          </View>
        ) : null}

        {favoritePosts.map((post) => {
          const thumbnailUrl = getPostCardThumbnailUrl(post);

          return (
            <View key={post.id} style={styles.card}>
              <Pressable
                style={({ pressed }) => [
                  styles.cardBody,
                  pressed && styles.cardBodyPressed,
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
                  <View style={styles.thumbnailFallback}>
                    <FavoriteTabIcon size={18} color={colors.mutedText} />
                  </View>
                )}

                <View style={styles.cardContent}>
                  <Text style={styles.cardTitle} numberOfLines={2} ellipsizeMode="tail">
                    {post.title}
                  </Text>
                  <Text style={styles.cardPreview} numberOfLines={1} ellipsizeMode="tail">
                    {post.content.trim() || "-"}
                  </Text>
                </View>
              </Pressable>

              <Pressable
                style={({ pressed }) => [
                  styles.removeButton,
                  pressed && styles.removeButtonPressed,
                ]}
                onPress={() => {
                  void handleToggleFavorite(post);
                }}
                accessibilityRole="button"
                accessibilityLabel={`Remove ${post.title} from favorites`}
              >
                <TrashActionIcon size={17} color={STATIC_COLORS.white} />
              </Pressable>
            </View>
          );
        })}
      </MainTabScrollView>
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
  headerActions: {
    flexDirection: "row",
    alignItems: "center",
    gap: SPACING.sm,
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
  clearAllButton: {
    borderRadius: 999,
    borderWidth: 1,
    borderColor: colors.dangerBorder,
    backgroundColor: colors.dangerSoft,
    paddingHorizontal: SPACING.md,
    paddingVertical: 8,
  },
  clearAllButtonPressed: {
    opacity: 0.85,
  },
  clearAllButtonText: {
    color: colors.danger,
    fontSize: 12,
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
    borderRadius: RADIUS.md,
    padding: SPACING.md,
    borderWidth: 1,
    borderColor: colors.border,
    ...SHADOWS.sm,
    flexDirection: "row",
    alignItems: "center",
    gap: SPACING.md,
  },
  cardBody: {
    flexDirection: "row",
    alignItems: "center",
    flex: 1,
    gap: SPACING.md,
  },
  cardBodyPressed: {
    opacity: 0.92,
  },
  thumbnail: {
    width: 84,
    height: 84,
    borderRadius: RADIUS.sm,
    backgroundColor: colors.surfaceSoft,
  },
  thumbnailFallback: {
    width: 84,
    height: 84,
    borderRadius: RADIUS.sm,
    backgroundColor: colors.surfaceMuted,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: "center",
    justifyContent: "center",
  },
  cardContent: {
    flex: 1,
    justifyContent: "center",
    gap: 8,
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: colors.text,
    lineHeight: 22,
  },
  cardPreview: {
    color: colors.mutedText,
    fontSize: 13,
    lineHeight: 18,
  },
  removeButton: {
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 12,
    width: 42,
    height: 42,
    backgroundColor: colors.favoriteRemove,
  },
  removeButtonPressed: {
    opacity: 0.88,
  },
});
