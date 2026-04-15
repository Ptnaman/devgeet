import { useDeferredValue, useMemo, useState } from "react";
import { useRouter } from "expo-router";
import { Alert, Image, Pressable, StyleSheet, Text, View } from "react-native";

import { FavoriteActionIcon } from "@/components/icons/favorite-action-icon";
import { MainTabScrollView } from "@/components/main-tabs/main-tab-scroll-view";
import { SearchInput } from "@/components/search-input";
import { SkeletonBlock } from "@/components/skeleton-block";
import {
  FONT_SIZE,
  RADIUS,
  SHADOWS,
  SPACING,
  getFavoriteActionPalette,
  type ThemeColors,
} from "@/constants/theme";
import { useFavorites } from "@/hooks/use-favorites";
import {
  formatDate,
  getContentPreviewLines,
  getPostCardThumbnailUrl,
  matchesPostSearch,
  type PostRecord,
} from "@/lib/content";
import {
  DEFAULT_OFFLINE_MESSAGE,
  getActionErrorMessage,
} from "@/lib/network";
import { useNetworkStatus } from "@/providers/network-provider";
import { useMainTabData } from "@/providers/main-tab-data-provider";
import { useAppTheme } from "@/providers/theme-provider";

const HOME_SKELETON_ITEMS = Array.from({ length: 3 }, (_, index) => index);

export function HomeTabContent() {
  const { colors, resolvedTheme } = useAppTheme();
  const { publishedPosts, isLoadingPosts, postsError } = useMainTabData();
  const router = useRouter();
  const { isFavorite, toggleFavorite } = useFavorites();
  const { isConnected, showOfflineToast } = useNetworkStatus();
  const favoritePalette = getFavoriteActionPalette(resolvedTheme);
  const styles = createStyles(colors);
  const [searchTerm, setSearchTerm] = useState("");
  const deferredSearchTerm = useDeferredValue(searchTerm);
  const isOfflineState = !isConnected || postsError === DEFAULT_OFFLINE_MESSAGE;
  const showInlineError = Boolean(postsError) && !isOfflineState;
  const filteredPosts = useMemo(
    () => publishedPosts.filter((post) => matchesPostSearch(post, deferredSearchTerm)),
    [deferredSearchTerm, publishedPosts],
  );
  const hasActiveSearch = Boolean(searchTerm.trim());

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
        fallbackMessage: "Bookmarks could not be updated right now.",
      });

      if (message === DEFAULT_OFFLINE_MESSAGE) {
        showOfflineToast();
        return;
      }

      Alert.alert("Unable to update bookmarks", message);
    }
  };

  return (
    <View style={styles.screen}>
      <MainTabScrollView
        tabName="home"
        contentContainerStyle={styles.container}
        showsVerticalScrollIndicator={false}
      >
        <SearchInput
          value={searchTerm}
          onChangeText={setSearchTerm}
          placeholder="Search lyrics"
          accessibilityLabel="Search posts"
        />

        {isLoadingPosts
          ? HOME_SKELETON_ITEMS.map((item) => (
            <View key={item} style={styles.card}>
              <View style={styles.cardBody}>
                <SkeletonBlock height={156} borderRadius={RADIUS.md} />
                <SkeletonBlock width="82%" height={24} />
                <SkeletonBlock width="68%" height={24} />
                <SkeletonBlock width="100%" height={16} borderRadius={RADIUS.sm} />
                <SkeletonBlock width="76%" height={16} borderRadius={RADIUS.sm} />
              </View>

              <View style={styles.cardFooter}>
                <SkeletonBlock width={92} height={16} borderRadius={RADIUS.sm} />
              </View>
            </View>
          ))
          : null}

        {!isLoadingPosts && showInlineError ? (
          <Text style={styles.errorText}>{postsError}</Text>
        ) : null}

        {!isLoadingPosts && !showInlineError && hasActiveSearch ? (
          <Text style={styles.resultText}>
            {`Showing ${filteredPosts.length} of ${publishedPosts.length} posts`}
          </Text>
        ) : null}

        {!isLoadingPosts && !showInlineError && !filteredPosts.length ? (
          <View style={styles.emptyWrap}>
            <Text style={styles.emptyText}>
              {hasActiveSearch
                ? "No posts match the current search."
                : "No published posts are available right now."}
            </Text>
          </View>
        ) : null}

        {!isLoadingPosts
          ? filteredPosts.map((post) => {
            const thumbnailUrl = getPostCardThumbnailUrl(post);
            const favorite = isFavorite(post.id);
            const updatedLabel = formatDate(post.uploadDate || post.createDate);
            const previewText = getContentPreviewLines(post.content);

            return (
              <View key={post.id} style={styles.card}>
                <Pressable
                  style={({ pressed }) => [
                    styles.cardBody,
                    pressed && styles.cardBodyPressed,
                  ]}
                  onPress={() => openPost(post.id)}
                >
                  <View style={styles.mediaWrap}>
                    {thumbnailUrl ? (
                      <Image
                        source={{ uri: thumbnailUrl }}
                        style={styles.thumbnail}
                        resizeMode="cover"
                      />
                    ) : (
                      <View style={styles.thumbnailFallback} />
                    )}
                    <Pressable
                      style={({ pressed }) => [
                        styles.favoriteButton,
                        pressed && styles.favoriteButtonPressed,
                      ]}
                      onPress={(event) => {
                        event.stopPropagation();
                        void handleToggleFavorite(post);
                      }}
                      accessibilityRole="button"
                      accessibilityLabel={
                        favorite
                          ? `Remove ${post.title} from bookmarks`
                          : `Add ${post.title} to bookmarks`
                      }
                    >
                      <FavoriteActionIcon
                        size={16}
                        color={favoritePalette.color}
                        filled={favorite}
                        fillColor={favoritePalette.fillColor}
                        accentColor={favoritePalette.accentColor}
                        accentUnderlayColor={favoritePalette.accentUnderlayColor}
                      />
                    </Pressable>
                  </View>
                  <Text style={styles.cardTitle} numberOfLines={3} ellipsizeMode="tail">
                    {post.title}
                  </Text>
                  <Text
                    style={styles.cardPreview}
                    numberOfLines={2}
                    ellipsizeMode="tail"
                  >
                    {previewText}
                  </Text>
                </Pressable>

                <View style={styles.cardFooter}>
                  <Text style={styles.meta}>{`Updated ${updatedLabel}`}</Text>
                </View>
              </View>
            );
          })
          : null}
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
    padding: SPACING.xxl,
    gap: SPACING.xl,
    backgroundColor: colors.surface,
  },
  card: {
    padding: SPACING.sm,
    gap: SPACING.sm,
  },
  cardBody: {
    gap: SPACING.sm,
    
  },
  cardBodyPressed: {
    opacity: 0.92,
  },
  mediaWrap: {
    position: "relative",
  },
  thumbnail: {
    width: "100%",
    height: 156,
    borderRadius: RADIUS.md,
    backgroundColor: colors.surfaceSoft,
  },
  thumbnailFallback: {
    width: "100%",
    height: 156,
    borderRadius: RADIUS.md,
    backgroundColor: colors.surfaceSoft,
  },
  cardTitle: {
    fontSize: 17,
    fontWeight: "700",
    color: colors.text,
    lineHeight: 23,
  },
  cardPreview: {
    fontSize: FONT_SIZE.body,
    color: colors.mutedText,
    lineHeight: 21,
  },
  cardFooter: {
    marginTop: SPACING.xs,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: SPACING.sm,
  },
  favoriteButton: {
    position: "absolute",
    top: SPACING.sm,
    right: SPACING.sm,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 10,
    width: 32,
    height: 32,
    backgroundColor: colors.favoriteSurface,
    ...SHADOWS.lg,
  },
  favoriteButtonPressed: {
    opacity: 0.85,
  },
  errorText: {
    color: colors.danger,
    fontSize: 13,
  },
  resultText: {
    color: colors.mutedText,
    fontSize: 13,
  },
  emptyWrap: {
    borderRadius: RADIUS.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    padding: SPACING.lg,
  },
  emptyText: {
    color: colors.mutedText,
    fontSize: 14,
    textAlign: "center",
  },
  meta: {
    fontSize: 12,
    color: colors.mutedText,
  },
});
