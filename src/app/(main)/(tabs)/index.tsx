import { memo, type Ref, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Image } from "expo-image";
import { useNavigation, useRouter } from "expo-router";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";

import { MainTabFlatList } from "@/components/main-tabs/main-tab-flat-list";
import { BookmarkCollectionSheet } from "@/components/bookmark-collection-sheet";
import { SkeletonBlock } from "@/components/skeleton-block";
import {
  FONT_SIZE,
  RADIUS,
  SHADOWS,
  SPACING,
  STATIC_COLORS,
  type ThemeColors,
} from "@/constants/theme";
import {
  REMOTE_IMAGE_PLACEHOLDER,
  REMOTE_IMAGE_TRANSITION_MS,
} from "@/constants/image-loading";
import {
  getContentPreviewLines,
  getPostCardThumbnailUrl,
  type PostRecord,
} from "@/lib/content";
import { primePostNavigationCache } from "@/lib/post-navigation-cache";
import { DEFAULT_OFFLINE_MESSAGE, getActionErrorMessage } from "@/lib/network";
import { useFavorites } from "@/hooks/use-favorites";
import { useNetworkStatus } from "@/providers/network-provider";
import { useMainTabData } from "@/providers/main-tab-data-provider";
import { useAppTheme } from "@/providers/theme-provider";

const HOME_SKELETON_ITEMS = Array.from({ length: 3 }, (_, index) => index);
type HomeListItem = number | PostRecord;
type HomeListRef = FlatList<HomeListItem>;
const HOME_FEED_MEMORY = { scrollOffset: 0 };
type HomeStyles = ReturnType<typeof createStyles>;

const HomeSkeletonCard = memo(function HomeSkeletonCard({ styles }: { styles: HomeStyles }) {
  return (
    <View style={styles.card}>
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
  );
});

const HomePostCard = memo(function HomePostCard({
  onDoublePressPost,
  onPressPost,
  post,
  styles,
}: {
  onDoublePressPost: (post: PostRecord) => void;
  onPressPost: (post: PostRecord) => void;
  post: PostRecord;
  styles: HomeStyles;
}) {
  const tapTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const thumbnailUrl = getPostCardThumbnailUrl(post);
  const previewText = getContentPreviewLines(post.content);
  const authorName =
    post.authorDisplayName.trim() ||
    post.authorUsername.trim() ||
    "Unknown Author";

  useEffect(() => () => {
    if (tapTimerRef.current) clearTimeout(tapTimerRef.current);
  }, []);

  const handlePress = () => {
    if (tapTimerRef.current) {
      clearTimeout(tapTimerRef.current);
      tapTimerRef.current = null;
      onDoublePressPost(post);
      return;
    }
    tapTimerRef.current = setTimeout(() => {
      tapTimerRef.current = null;
      onPressPost(post);
    }, 240);
  };

  return (
    <View style={styles.card}>
      <Pressable
        style={({ pressed }) => [
          styles.cardBody,
          pressed && styles.cardBodyPressed,
        ]}
        onPress={handlePress}
      >
        <View style={styles.mediaWrap}>
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
            <View style={styles.thumbnailFallback} />
          )}
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
        <Text style={styles.cardAuthor} numberOfLines={1}>
          {`By ${authorName}`}
        </Text>
      </Pressable>
    </View>
  );
});

export default function MainIndexScreen() {
  const { colors } = useAppTheme();
  const { isConnected, showOfflineToast } = useNetworkStatus();
  const { isFavorite, toggleFavorite } = useFavorites();
  const {
    publishedPosts,
    isLoadingPosts,
    isLoadingMorePosts,
    hasMorePublishedPosts,
    postsError,
    loadMorePublishedPostsAsync,
  } = useMainTabData();
  const navigation = useNavigation();
  const router = useRouter();
  const listRef = useRef<HomeListRef | null>(null);
  const hasRestoredInitialScrollRef = useRef(false);
  const [collectionPostId, setCollectionPostId] = useState("");
  const styles = useMemo(() => createStyles(colors), [colors]);
  // Background requests must keep existing cards mounted and scrollable.
  const isLoadingVisiblePosts = isLoadingPosts && publishedPosts.length === 0;
  const listItems = useMemo<HomeListItem[]>(
    () => (isLoadingVisiblePosts ? HOME_SKELETON_ITEMS : publishedPosts),
    [isLoadingVisiblePosts, publishedPosts],
  );
  const scrollHomeFeedToTop = useCallback((animated = true) => {
    HOME_FEED_MEMORY.scrollOffset = 0;
    listRef.current?.scrollToOffset({ offset: 0, animated });
  }, []);
  const openPost = useCallback((post: PostRecord) => {
    primePostNavigationCache(post);
    router.push({ pathname: "/post/[postId]", params: { postId: post.id } });
  }, [router]);
  const bookmarkPostWithDoubleTap = useCallback(async (post: PostRecord) => {
    try {
      if (!isFavorite(post.id)) {
        await toggleFavorite(post, { showToast: false });
      }
      setCollectionPostId(post.id);
    } catch (bookmarkError) {
      const message = getActionErrorMessage({ error: bookmarkError, isConnected, fallbackMessage: "Bookmark could not be saved right now." });
      if (message === DEFAULT_OFFLINE_MESSAGE) {
        showOfflineToast();
        return;
      }
      Alert.alert("Unable to save bookmark", message);
    }
  }, [isConnected, isFavorite, showOfflineToast, toggleFavorite]);

  const handleScroll = useCallback((event: NativeSyntheticEvent<NativeScrollEvent>) => {
    HOME_FEED_MEMORY.scrollOffset = event.nativeEvent.contentOffset.y;
  }, []);

  useEffect(() => {
    const subscribeToTabPress = (
      navigation as typeof navigation & {
        addListener: (eventName: string, callback: () => void) => () => void;
      }
    ).addListener;

    const unsubscribe = subscribeToTabPress("tabPress", () => {
      if (!navigation.isFocused()) {
        return;
      }

      scrollHomeFeedToTop();
    });

    return unsubscribe;
  }, [navigation, scrollHomeFeedToTop]);

  useEffect(() => {
    if (hasRestoredInitialScrollRef.current || isLoadingVisiblePosts) {
      return;
    }

    hasRestoredInitialScrollRef.current = true;

    if (HOME_FEED_MEMORY.scrollOffset <= 0) {
      return;
    }

    requestAnimationFrame(() => {
      listRef.current?.scrollToOffset({
        offset: HOME_FEED_MEMORY.scrollOffset,
        animated: false,
      });
    });
  }, [isLoadingVisiblePosts, listItems.length]);

  const keyExtractor = useCallback((item: HomeListItem) => {
    if (typeof item === "number") {
      return `skeleton-${item}`;
    }

    return item.id;
  }, []);

  const renderItem = useCallback(
    ({ item }: { item: HomeListItem }) => {
      if (typeof item === "number") {
        return <HomeSkeletonCard styles={styles} />;
      }

      return (
        <HomePostCard
          onDoublePressPost={(post) => void bookmarkPostWithDoubleTap(post)}
          onPressPost={openPost}
          post={item}
          styles={styles}
        />
      );
    },
    [bookmarkPostWithDoubleTap, openPost, styles],
  );

  const renderSeparator = useCallback(
    () => <View style={styles.listSeparator} />,
    [styles],
  );

  const listEmptyComponent = useMemo(
    () =>
      !isLoadingVisiblePosts && !postsError ? (
        <View style={styles.emptyWrap}>
          <Text style={styles.emptyText}>
            No published posts are available right now.
          </Text>
        </View>
      ) : null,
    [isLoadingVisiblePosts, postsError, styles],
  );

  const listFooterComponent = (
    <View style={styles.listFooter}>
      {!isLoadingVisiblePosts && postsError ? (
        <Text selectable style={styles.errorText}>{postsError}</Text>
      ) : null}
      {!isLoadingVisiblePosts && (hasMorePublishedPosts || isLoadingMorePosts) ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Load more posts"
          accessibilityState={{ busy: isLoadingMorePosts, disabled: isLoadingMorePosts }}
          disabled={isLoadingMorePosts}
          onPress={() => void loadMorePublishedPostsAsync()}
          style={({ pressed }) => [
            styles.loadMoreButton,
            isLoadingMorePosts && styles.loadMoreButtonDisabled,
            pressed && !isLoadingMorePosts && styles.loadMoreButtonPressed,
          ]}
        >
          {({ pressed }) => (
            <>
              {isLoadingMorePosts ? (
                <ActivityIndicator size="small" color={pressed ? colors.primaryText : colors.primary} />
              ) : null}
              <Text style={[styles.loadMoreButtonText, pressed && styles.loadMoreButtonTextPressed]}>
                {isLoadingMorePosts ? "Loading..." : "Load more"}
              </Text>
            </>
          )}
        </Pressable>
      ) : null}
    </View>
  );
  return (
    <View style={styles.screen}>
      <MainTabFlatList<HomeListItem>
        tabName="home"
        listRef={listRef as Ref<FlatList<HomeListItem>>}
        data={listItems}
        keyExtractor={keyExtractor}
        renderItem={renderItem}
        ItemSeparatorComponent={renderSeparator}
        ListEmptyComponent={listEmptyComponent}
        ListFooterComponent={listFooterComponent}
        contentContainerStyle={styles.listContentContainer}
        showsVerticalScrollIndicator={false}
        onScroll={handleScroll}
        contentInsetAdjustmentBehavior="automatic"
      />
      <BookmarkCollectionSheet
        isPresented={Boolean(collectionPostId)}
        onDismiss={() => setCollectionPostId("")}
        postId={collectionPostId}
      />
    </View>
  );
}

const createStyles = (colors: ThemeColors) => {
  return StyleSheet.create({
    screen: {
      flex: 1,
      backgroundColor: colors.background,
    },
    listContentContainer: {
      flexGrow: 1,
      paddingHorizontal: SPACING.xxl,
      paddingTop: SPACING.lg,
      paddingBottom: SPACING.xxl * 2,
      backgroundColor: colors.background,
    },
    listSeparator: {
      height: SPACING.xl,
    },
    listFooter: {
      minHeight: 88,
      gap: SPACING.md,
      paddingVertical: SPACING.lg,
      alignItems: "center",
      justifyContent: "center",
    },
    loadMoreButton: {
      width: "100%",
      minHeight: 50,
      paddingVertical: SPACING.md,
      paddingHorizontal: SPACING.lg,
      borderRadius: RADIUS.md,
      backgroundColor: STATIC_COLORS.white,
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: SPACING.sm,
      borderCurve: "continuous",
      boxShadow: "0 5px 16px rgba(0, 0, 0, 0.12)",
    },
    loadMoreButtonDisabled: {
      opacity: 0.7,
    },
    loadMoreButtonPressed: {
      backgroundColor: colors.primary,
      transform: [{ scale: 0.97 }],
    },
    loadMoreButtonText: {
      color: colors.text,
      fontSize: 15,
      fontWeight: "800",
    },
    loadMoreButtonTextPressed: { color: colors.primaryText },
    card: {
      borderRadius: 14,
      backgroundColor: colors.surface,
      padding: SPACING.md,
      gap: SPACING.sm,
      ...SHADOWS.sm,
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
      borderRadius: 9,
      backgroundColor: colors.surfaceSoft,
    },
    thumbnailFallback: {
      width: "100%",
      height: 156,
      borderRadius: 9,
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
    cardAuthor: {
      fontSize: 12,
      color: colors.subtleText,
      fontWeight: "600",
      lineHeight: 18,
    },
    cardFooter: {
      marginTop: SPACING.xs,
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      gap: SPACING.sm,
    },
    errorText: {
      color: colors.danger,
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
  });
};
