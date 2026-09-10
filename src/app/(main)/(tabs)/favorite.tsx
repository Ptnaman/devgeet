import { memo, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Image } from "expo-image";
import { useRouter } from "expo-router";
import {
  collection,
  documentId,
  getDocs,
  query,
  where,
  type DocumentData,
} from "firebase/firestore";
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";

import { FavoriteTabIcon } from "@/components/icons/favorite-tab-icon";
import { MainTabFlatList } from "@/components/main-tabs/main-tab-flat-list";
import { TrashActionIcon } from "@/components/icons/trash-action-icon";
import {
  REMOTE_IMAGE_PLACEHOLDER,
  REMOTE_IMAGE_TRANSITION_MS,
} from "@/constants/image-loading";
import {
  FONT_SIZE,
  RADIUS,
  SHADOWS,
  SPACING,
  STATIC_COLORS,
  type ThemeColors,
} from "@/constants/theme";
import {
  getPostCardThumbnailUrl,
  isPostTrashed,
  mapPostRecord,
  POSTS_COLLECTION,
  sortPostsByRecency,
  type PostRecord,
} from "@/lib/content";
import { firestore } from "@/lib/firebase";
import { primePostNavigationCache } from "@/lib/post-navigation-cache";
import {
  DEFAULT_OFFLINE_MESSAGE,
  getActionErrorMessage,
  getRequestErrorMessage,
} from "@/lib/network";
import { useFavorites } from "@/hooks/use-favorites";
import { useBookmarkCollections } from "@/hooks/use-bookmark-collections";
import { useNetworkStatus } from "@/providers/network-provider";
import { useAppTheme } from "@/providers/theme-provider";

const FAVORITE_POST_IDS_CHUNK_SIZE = 10;
type FavoriteStyles = ReturnType<typeof createStyles>;

const mergeFavoritePosts = ({
  currentPosts,
  nextPosts,
  favoriteIds,
}: {
  currentPosts: PostRecord[];
  nextPosts: PostRecord[];
  favoriteIds: Set<string>;
}) => {
  const postsById = new Map<string, PostRecord>();

  currentPosts.forEach((post) => {
    if (favoriteIds.has(post.id)) {
      postsById.set(post.id, post);
    }
  });

  nextPosts.forEach((post) => {
    if (favoriteIds.has(post.id)) {
      postsById.set(post.id, post);
    }
  });

  return sortPostsByRecency(Array.from(postsById.values()));
};

const FavoritePostCard = memo(function FavoritePostCard({
  colors,
  onOpenPost,
  onRemoveFavorite,
  post,
  styles,
}: {
  colors: ThemeColors;
  onOpenPost: (post: PostRecord) => void;
  onRemoveFavorite: (post: PostRecord) => Promise<void>;
  post: PostRecord;
  styles: FavoriteStyles;
}) {
  const thumbnailUrl = getPostCardThumbnailUrl(post);
  const authorName =
    post.authorDisplayName.trim() ||
    post.authorUsername.trim() ||
    "Unknown Author";

  return (
    <View style={styles.card}>
      <Pressable
        style={({ pressed }) => [
          styles.cardBody,
          pressed && styles.cardBodyPressed,
        ]}
        onPress={() => onOpenPost(post)}
      >
        {thumbnailUrl ? (
          <Image
            cachePolicy="memory-disk"
            contentFit="cover"
            placeholder={REMOTE_IMAGE_PLACEHOLDER}
            placeholderContentFit="cover"
            source={{ uri: thumbnailUrl }}
            style={styles.thumbnail}
            transition={REMOTE_IMAGE_TRANSITION_MS}
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
          <Text style={styles.cardAuthor} numberOfLines={1}>
            {`By ${authorName}`}
          </Text>
        </View>
      </Pressable>

      <Pressable
        style={({ pressed }) => [
          styles.removeButton,
          pressed && styles.removeButtonPressed,
        ]}
        onPress={() => {
          void onRemoveFavorite(post);
        }}
        accessibilityRole="button"
        accessibilityLabel={`Remove ${post.title} from bookmarks`}
      >
        <TrashActionIcon size={17} color={STATIC_COLORS.white} />
      </Pressable>
    </View>
  );
});

export default function FavoriteTabScreen() {
  const { colors } = useAppTheme();
  const { isConnected, refreshConnection, showOfflineToast } = useNetworkStatus();
  const router = useRouter();
  const {
    favoritePostIds,
    favoritesError,
    isLoadingFavorites,
    clearFavorites,
    toggleFavorite,
  } = useFavorites();
  const { collections } = useBookmarkCollections();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const isConnectedRef = useRef(isConnected);
  const favoritePostsRef = useRef<PostRecord[]>([]);
  const favoriteSwipePostIdsRef = useRef("");
  const [favoritePosts, setFavoritePosts] = useState<PostRecord[]>([]);
  const [favoritePostsError, setFavoritePostsError] = useState("");
  const [isLoadingFavoritePosts, setIsLoadingFavoritePosts] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [selectedCollectionId, setSelectedCollectionId] = useState("");

  const selectedCollection = collections.find((item) => item.id === selectedCollectionId);
  const visibleFavoritePosts = useMemo(() => {
    if (!selectedCollection) return favoritePosts;
    const selectedPostIds = new Set(selectedCollection.postIds);
    return favoritePosts.filter((post) => selectedPostIds.has(post.id));
  }, [favoritePosts, selectedCollection]);

  useEffect(() => {
    if (selectedCollectionId && !collections.some((item) => item.id === selectedCollectionId)) {
      setSelectedCollectionId("");
    }
  }, [collections, selectedCollectionId]);

  useEffect(() => {
    isConnectedRef.current = isConnected;
  }, [isConnected]);

  useEffect(() => {
    favoritePostsRef.current = favoritePosts;
    favoriteSwipePostIdsRef.current = favoritePosts.map((item) => item.id).join(",");
  }, [favoritePosts]);

  const fetchFavoritePostsByIdsAsync = useCallback(async (favoriteIds: string[]) => {
    const chunks: string[][] = [];
    for (let index = 0; index < favoriteIds.length; index += FAVORITE_POST_IDS_CHUNK_SIZE) {
      chunks.push(favoriteIds.slice(index, index + FAVORITE_POST_IDS_CHUNK_SIZE));
    }

    const snapshots = await Promise.all(
      chunks.map((chunk) =>
        getDocs(
          query(
            collection(firestore, POSTS_COLLECTION),
            where(documentId(), "in", chunk),
          ),
        ),
      ),
    );

    return sortPostsByRecency(
      snapshots
        .flatMap((snapshot) => snapshot.docs)
        .map((item) => mapPostRecord(item.id, item.data() as DocumentData))
        .filter((post) => post.status === "published" && !isPostTrashed(post)),
    );
  }, []);

  useEffect(() => {
    let active = true;
    const favoriteIds = Array.from(favoritePostIds);
    const favoriteIdsSet = new Set(favoriteIds);

    if (!favoriteIds.length) {
      setFavoritePosts([]);
      setFavoritePostsError("");
      setIsLoadingFavoritePosts(false);
      return () => {
        active = false;
      };
    }

    const retainedPosts = sortPostsByRecency(
      favoritePostsRef.current.filter((post) => favoriteIdsSet.has(post.id)),
    );
    const retainedIds = new Set(retainedPosts.map((post) => post.id));
    const missingIds = favoriteIds.filter((postId) => !retainedIds.has(postId));

    setFavoritePosts(retainedPosts);
    setFavoritePostsError("");

    if (!missingIds.length) {
      setIsLoadingFavoritePosts(false);
      return () => {
        active = false;
      };
    }

    const hydrateFavoritePosts = async () => {
      try {
        setIsLoadingFavoritePosts(retainedPosts.length === 0);
        const posts = await fetchFavoritePostsByIdsAsync(missingIds);

        if (!active) {
          return;
        }

        setFavoritePosts((currentPosts) => mergeFavoritePosts({
          currentPosts,
          nextPosts: posts,
          favoriteIds: favoriteIdsSet,
        }));
        setFavoritePostsError("");
      } catch (loadError) {
        if (!active) {
          return;
        }

        setFavoritePostsError(
          getRequestErrorMessage({
            error: loadError,
            isConnected: isConnectedRef.current,
            onlineMessage: "Unable to load bookmarked posts right now.",
          }),
        );
      } finally {
        if (active) {
          setIsLoadingFavoritePosts(false);
        }
      }
    };

    void hydrateFavoritePosts();

    return () => {
      active = false;
    };
  }, [favoritePostIds, fetchFavoritePostsByIdsAsync]);

  const refreshFavoritePostsAsync = useCallback(async () => {
    if (isRefreshing) {
      return;
    }

    setIsRefreshing(true);
    try {
      const latestConnectionState = await refreshConnection();
      isConnectedRef.current = latestConnectionState;
    } catch {
      // Continue refresh attempt even if connectivity probe fails.
    }

    const favoriteIds = Array.from(favoritePostIds);
    if (!favoriteIds.length) {
      setFavoritePosts([]);
      setFavoritePostsError("");
      setIsRefreshing(false);
      return;
    }

    try {
      const posts = await fetchFavoritePostsByIdsAsync(favoriteIds);
      setFavoritePosts(posts);
      setFavoritePostsError("");
    } catch (loadError) {
      setFavoritePostsError(
        getRequestErrorMessage({
          error: loadError,
          isConnected: isConnectedRef.current,
          onlineMessage: "Unable to refresh bookmarked posts right now.",
        }),
      );
    } finally {
      setIsRefreshing(false);
    }
  }, [
    favoritePostIds,
    fetchFavoritePostsByIdsAsync,
    isRefreshing,
    refreshConnection,
  ]);

  const isLoading = isLoadingFavoritePosts || isLoadingFavorites;
  const combinedError = favoritePostsError || favoritesError;
  const isOfflineState = !isConnected || combinedError === DEFAULT_OFFLINE_MESSAGE;
  const showInlineError = Boolean(combinedError) && !isOfflineState;

  const openPost = useCallback((post: PostRecord) => {
    primePostNavigationCache(post);
    router.push({
      pathname: "/post/[postId]",
      params: {
        postId: post.id,
        swipeSource: "favorite",
        swipePostIds: favoriteSwipePostIdsRef.current,
      },
    });
  }, [router]);

  const handleToggleFavorite = useCallback(async (post: PostRecord) => {
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
  }, [isConnected, showOfflineToast, toggleFavorite]);

  const handleClearAllFavorites = useCallback(async () => {
    try {
      await clearFavorites();
    } catch (clearError) {
      const message = getActionErrorMessage({
        error: clearError,
        isConnected,
        fallbackMessage: "Bookmarks could not be cleared right now.",
      });

      if (message === DEFAULT_OFFLINE_MESSAGE) {
        showOfflineToast();
        return;
      }

      Alert.alert("Unable to clear bookmarks", message);
    }
  }, [clearFavorites, isConnected, showOfflineToast]);

  const handleConfirmClearAllFavorites = useCallback(() => {
    Alert.alert(
      "Clear all bookmarks?",
      "This will remove every saved post from your bookmarks.",
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
  }, [handleClearAllFavorites]);

  const keyExtractor = useCallback((item: PostRecord) => item.id, []);

  const renderFavoritePost = useCallback(
    ({ item }: { item: PostRecord }) => (
      <FavoritePostCard
        colors={colors}
        onOpenPost={openPost}
        onRemoveFavorite={handleToggleFavorite}
        post={item}
        styles={styles}
      />
    ),
    [colors, handleToggleFavorite, openPost, styles],
  );

  const renderSeparator = useCallback(
    () => <View style={styles.listSeparator} />,
    [styles],
  );

  const subtitle = useMemo(() => {
    if (isLoading) {
      return "Loading your bookmarks...";
    }

    if (showInlineError) {
      return combinedError;
    }

    if (!favoritePosts.length) {
      return "Posts you bookmark will appear here.";
    }

    return `${favoritePosts.length} bookmark${favoritePosts.length === 1 ? "" : "s"}`;
  }, [combinedError, favoritePosts.length, isLoading, showInlineError]);

  return (
    <View style={styles.screen}>
      <MainTabFlatList
        tabName="favorite"
        data={isLoading ? [] : visibleFavoritePosts}
        keyExtractor={keyExtractor}
        renderItem={renderFavoritePost}
        ItemSeparatorComponent={renderSeparator}
        ListHeaderComponent={
          <View style={styles.headerContent}>
            <View style={styles.headerCard}>
              <View style={styles.headerRow}>
                <View style={styles.headerTextWrap}>
                  <Text style={styles.title}>Bookmarks</Text>
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
                      accessibilityLabel="Clear all bookmarks"
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

            {collections.length ? (
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.collectionRow}>
                <Pressable
                  onPress={() => setSelectedCollectionId("")}
                  style={[styles.collectionChip, !selectedCollectionId && styles.collectionChipSelected]}
                >
                  <Text style={[styles.collectionChipText, !selectedCollectionId && styles.collectionChipTextSelected]}>All</Text>
                </Pressable>
                {collections.map((item) => (
                  <Pressable
                    key={item.id}
                    onPress={() => setSelectedCollectionId(item.id)}
                    style={[styles.collectionChip, selectedCollectionId === item.id && styles.collectionChipSelected]}
                  >
                    <Text style={[styles.collectionChipText, selectedCollectionId === item.id && styles.collectionChipTextSelected]}>{item.name}</Text>
                  </Pressable>
                ))}
              </ScrollView>
            ) : null}

            {isLoading ? (
              <ActivityIndicator size="large" color={colors.primary} style={styles.loader} />
            ) : null}

            {!isLoading && showInlineError ? (
              <Text style={styles.errorText}>{combinedError}</Text>
            ) : null}
          </View>
        }
        ListEmptyComponent={
          !isLoading && !combinedError ? (
            <View style={styles.emptyWrap}>
              <View style={styles.emptyIconCard}>
                <FavoriteTabIcon size={30} color={colors.mutedText} />
              </View>
              <Text style={styles.emptyTitle}>{selectedCollection ? "No posts in this collection" : "No bookmarks yet"}</Text>
              <Text style={styles.emptyText}>
                Bookmark any post and it will show here for quick access.
              </Text>
            </View>
          ) : null
        }
        contentContainerStyle={styles.container}
        showsVerticalScrollIndicator={false}
        refreshing={isRefreshing}
        onRefresh={() => {
          void refreshFavoritePostsAsync();
        }}
      />
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
    backgroundColor: colors.background,
    paddingBottom: SPACING.xxl * 2,
  },
  headerContent: {
    marginBottom: SPACING.md,
    gap: SPACING.md,
  },
  collectionRow: { gap: SPACING.sm, paddingRight: SPACING.md },
  collectionChip: { minHeight: 38, paddingHorizontal: SPACING.md, borderRadius: RADIUS.pill, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface, alignItems: "center", justifyContent: "center" },
  collectionChipSelected: { backgroundColor: colors.primary, borderColor: colors.primary },
  collectionChipText: { color: colors.text, fontSize: 13, fontWeight: "700" },
  collectionChipTextSelected: { color: colors.primaryText },
  listSeparator: {
    height: SPACING.md,
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
  cardAuthor: {
    color: colors.subtleText,
    fontSize: 12,
    fontWeight: "600",
    lineHeight: 17,
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

