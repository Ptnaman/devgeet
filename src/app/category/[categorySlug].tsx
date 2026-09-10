import { Stack, useLocalSearchParams, useRouter } from "expo-router";
import { Image } from "expo-image";
import { type QueryDocumentSnapshot, type DocumentData } from "firebase/firestore";
import { memo, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  type LayoutChangeEvent,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";

import { CategoryTabIcon } from "@/components/icons/category-tab-icon";
import { BookmarkCollectionSheet } from "@/components/bookmark-collection-sheet";
import { SkeletonBlock } from "@/components/skeleton-block";
import {
  REMOTE_IMAGE_PLACEHOLDER,
  REMOTE_IMAGE_TRANSITION_MS,
} from "@/constants/image-loading";
import {
  DEFAULT_LIST_INITIAL_NUM_TO_RENDER,
  DEFAULT_LIST_MAX_TO_RENDER_PER_BATCH,
  DEFAULT_LIST_REMOVE_CLIPPED_SUBVIEWS,
  DEFAULT_LIST_UPDATE_BATCHING_PERIOD,
  DEFAULT_LIST_WINDOW_SIZE,
} from "@/constants/list-performance";
import {
  FONT_SIZE,
  RADIUS,
  SHADOWS,
  SPACING,
  STATIC_COLORS,
  type ThemeColors,
} from "@/constants/theme";
import {
  fetchCategoryPostsPageAsync,
  type CategoryPostsQueryMode,
} from "@/lib/category-post-feed";
import {
  hydrateCategoryPostsCacheAsync,
  persistCategoryPostsCacheAsync,
} from "@/lib/category-post-cache";
import {
  createSlug,
  getContentPreviewLines,
  getPostCardThumbnailUrl,
  sortPostsByRecency,
  type PostRecord,
} from "@/lib/content";
import { primePostNavigationCache } from "@/lib/post-navigation-cache";
import { DEFAULT_OFFLINE_MESSAGE, getRequestErrorMessage } from "@/lib/network";
import { getActionErrorMessage } from "@/lib/network";
import { useFavorites } from "@/hooks/use-favorites";
import { useMainTabData } from "@/providers/main-tab-data-provider";
import { useNetworkStatus } from "@/providers/network-provider";
import { useAppTheme } from "@/providers/theme-provider";

const resolveCategorySlug = (value: string | string[] | undefined) =>
  typeof value === "string" ? createSlug(value) : "";
const CATEGORY_POSTS_INITIAL_PAGE_SIZE = 9;
const CATEGORY_POSTS_LOAD_MORE_PAGE_SIZE = 9;
const CATEGORY_FILTER_SKELETON_ITEMS = Array.from({ length: 4 }, (_, index) => index);
const CATEGORY_POSTS_MEMORY_CACHE = new Map<string, PostRecord[]>();
type CategoryPostsSessionState = {
  hasMore: boolean;
  lastDoc: QueryDocumentSnapshot<DocumentData> | null;
  posts: PostRecord[];
  queryMode: CategoryPostsQueryMode;
};
const CATEGORY_POSTS_SESSION_CACHE = new Map<string, CategoryPostsSessionState>();
const normalizeCategorySlug = (value: string) => createSlug(value);

type CategoryStyles = ReturnType<typeof createStyles>;

const mergeCategoryPosts = (...postGroups: PostRecord[][]) => {
  const postsById = new Map<string, PostRecord>();

  postGroups.flat().forEach((post) => {
    postsById.set(post.id, post);
  });

  return sortPostsByRecency(Array.from(postsById.values()));
};

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

const CategoryControlChip = memo(function CategoryControlChip({
  accessibilityLabel,
  label,
  onLayout,
  onPress,
  selected,
  styles,
}: {
  accessibilityLabel: string;
  label: string;
  onLayout?: (event: LayoutChangeEvent) => void;
  onPress: () => void;
  selected: boolean;
  styles: CategoryStyles;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      accessibilityState={{ selected }}
      hitSlop={6}
      onLayout={onLayout}
      onPress={onPress}
      style={({ pressed }) => [
        styles.controlChip,
        selected ? styles.controlChipSelected : null,
        pressed ? styles.controlChipPressed : null,
      ]}
    >
      <Text
        style={[
          styles.controlChipText,
          selected ? styles.controlChipTextSelected : null,
        ]}
        numberOfLines={1}
      >
        {label}
      </Text>
    </Pressable>
  );
});

const CategoryPostCard = memo(function CategoryPostCard({
  onDoublePressPost,
  onOpenPost,
  post,
  styles,
}: {
  onDoublePressPost: (post: PostRecord) => void;
  onOpenPost: (post: PostRecord) => void;
  post: PostRecord;
  styles: CategoryStyles;
}) {
  const tapTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const thumbnailUrl = getPostCardThumbnailUrl(post);
  const authorName =
    post.authorDisplayName.trim() ||
    post.authorUsername.trim() ||
    "Unknown Author";
  const previewText = getContentPreviewLines(post.content);

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
      onOpenPost(post);
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

export default function CategoryPostsScreen() {
  const { colors, resolvedTheme } = useAppTheme();
  const { isConnected, showOfflineToast } = useNetworkStatus();
  const { isFavorite, toggleFavorite } = useFavorites();
  const isConnectedRef = useRef(isConnected);
  const router = useRouter();
  const styles = useMemo(
    () => createStyles(colors, resolvedTheme),
    [colors, resolvedTheme],
  );
  const { categorySlug: categorySlugParam } = useLocalSearchParams<{ categorySlug?: string }>();
  const { categories, isLoadingCategories, publishedPosts } = useMainTabData();
  const categorySlug = resolveCategorySlug(categorySlugParam);
  const categoryLabel = useMemo(
    () =>
      categories.find((item) => normalizeCategorySlug(item.slug) === categorySlug)?.name.trim() ||
      formatCategoryLabel(categorySlug),
    [categories, categorySlug],
  );
  const lastPostCursorRef = useRef<QueryDocumentSnapshot<DocumentData> | null>(null);
  const postsListRef = useRef<FlatList<PostRecord> | null>(null);
  const categoryScrollerRef = useRef<ScrollView | null>(null);
  const categoryScrollerWidthRef = useRef(0);
  const categoryChipLayoutsRef = useRef(new Map<string, { width: number; x: number }>());
  const categoryQueryModeRef = useRef<CategoryPostsQueryMode>("uploadDate");
  const cachedCategoryPostsRef = useRef<PostRecord[]>([]);
  const [posts, setPosts] = useState<PostRecord[]>([]);
  const [displayedCategorySlug, setDisplayedCategorySlug] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [hasMorePosts, setHasMorePosts] = useState(true);
  const [error, setError] = useState("");
  const [collectionPostId, setCollectionPostId] = useState("");
  const cachedCategoryPosts = useMemo(
    () =>
      sortPostsByRecency(
        publishedPosts.filter((item) => createSlug(item.category) === categorySlug),
      ),
    [categorySlug, publishedPosts],
  );
  const categoryFilters = useMemo(() => {
    const filtersBySlug = new Map<
      string,
      {
        key: string;
        slug: string;
        label: string;
        accessibilityLabel: string;
      }
    >();

    const registerFilter = (slugValue: string, labelValue: string, key: string) => {
      const slug = normalizeCategorySlug(slugValue);
      if (!slug || filtersBySlug.has(slug)) {
        return;
      }

      const label = labelValue.trim() || formatCategoryLabel(slug);
      filtersBySlug.set(slug, {
        key,
        slug,
        label,
        accessibilityLabel: `Open ${label} posts`,
      });
    };

    categories.forEach((item) => {
      registerFilter(item.slug, item.name, item.id);
    });

    publishedPosts.forEach((post) => {
      const normalizedSlug = normalizeCategorySlug(post.category);
      registerFilter(post.category, "", `post-${normalizedSlug}`);
    });

    if (categorySlug && !filtersBySlug.has(categorySlug)) {
      registerFilter(categorySlug, categoryLabel, `active-${categorySlug}`);
    }

    return Array.from(filtersBySlug.values());
  }, [categories, categoryLabel, categorySlug, publishedPosts]);

  useEffect(() => {
    isConnectedRef.current = isConnected;
  }, [isConnected]);

  useEffect(() => {
    cachedCategoryPostsRef.current = cachedCategoryPosts;
  }, [cachedCategoryPosts]);

  const fetchCategoryPage = useCallback(
    async ({
      afterDoc,
      pageSize,
    }: {
      afterDoc?: QueryDocumentSnapshot<DocumentData>;
      pageSize: number;
    }) => {
      const page = await fetchCategoryPostsPageAsync({
        afterDoc,
        categorySlug,
        pageSize,
        preferredMode: categoryQueryModeRef.current,
      });
      categoryQueryModeRef.current = page.modeUsed;

      return page;
    },
    [categorySlug],
  );

  useEffect(() => {
    if (
      !categorySlug ||
      !cachedCategoryPosts.length ||
      CATEGORY_POSTS_SESSION_CACHE.has(categorySlug)
    ) {
      return;
    }

    setPosts((currentPosts) => {
      const nextPosts = mergeCategoryPosts(currentPosts, cachedCategoryPosts).slice(
        0,
        CATEGORY_POSTS_INITIAL_PAGE_SIZE,
      );
      CATEGORY_POSTS_MEMORY_CACHE.set(categorySlug, nextPosts);
      return nextPosts;
    });
  }, [cachedCategoryPosts, categorySlug]);

  useEffect(() => {
    let active = true;
    const sessionState = categorySlug
      ? CATEGORY_POSTS_SESSION_CACHE.get(categorySlug)
      : undefined;
    const memoryCachedPosts = categorySlug
      ? CATEGORY_POSTS_MEMORY_CACHE.get(categorySlug) ?? []
      : [];
    const initialCachedPosts = mergeCategoryPosts(
      memoryCachedPosts,
      cachedCategoryPostsRef.current,
    ).slice(0, CATEGORY_POSTS_INITIAL_PAGE_SIZE);

    setIsLoading(!sessionState && initialCachedPosts.length === 0);
    setIsLoadingMore(false);
    setHasMorePosts(sessionState?.hasMore ?? true);
    lastPostCursorRef.current = sessionState?.lastDoc ?? null;
    categoryQueryModeRef.current = sessionState?.queryMode ?? "uploadDate";

    if (!categorySlug) {
      setPosts([]);
      setDisplayedCategorySlug("");
      setError("Category not found.");
      setIsLoading(false);
      return;
    }

    if (sessionState) {
      setPosts(sessionState.posts);
      setDisplayedCategorySlug(categorySlug);
      setError("");
      setIsLoading(false);
      return () => {
        active = false;
      };
    }

    if (initialCachedPosts.length) {
      CATEGORY_POSTS_MEMORY_CACHE.set(categorySlug, initialCachedPosts);
      setPosts(initialCachedPosts);
      setError("");
    } else {
      setPosts([]);
    }
    setDisplayedCategorySlug(categorySlug);

    const hydrateCategoryPosts = async () => {
      try {
        const persistedPosts = await hydrateCategoryPostsCacheAsync(categorySlug);
        if (!active) {
          return;
        }

        if (persistedPosts.length) {
          setPosts((currentPosts) => {
            const nextPosts = mergeCategoryPosts(currentPosts, persistedPosts).slice(
              0,
              CATEGORY_POSTS_INITIAL_PAGE_SIZE,
            );
            CATEGORY_POSTS_MEMORY_CACHE.set(categorySlug, nextPosts);
            return nextPosts;
          });
          setError("");
          setIsLoading(false);
        }

        const firstPage = await fetchCategoryPage({
          pageSize: CATEGORY_POSTS_INITIAL_PAGE_SIZE,
        });
        if (!active) {
          return;
        }

        setPosts(firstPage.posts);
        CATEGORY_POSTS_MEMORY_CACHE.set(categorySlug, firstPage.posts);
        void persistCategoryPostsCacheAsync(categorySlug, firstPage.posts).catch(() => {});
        setHasMorePosts(firstPage.hasMore);
        lastPostCursorRef.current = firstPage.lastDoc;
        CATEGORY_POSTS_SESSION_CACHE.set(categorySlug, {
          hasMore: firstPage.hasMore,
          lastDoc: firstPage.lastDoc,
          posts: firstPage.posts,
          queryMode: firstPage.modeUsed,
        });
        setError("");
      } catch (loadError) {
        if (!active) {
          return;
        }

        if (initialCachedPosts.length) {
          setPosts(initialCachedPosts);
          setError("");
        } else {
          setPosts([]);
          setError(
            getRequestErrorMessage({
              error: loadError,
              isConnected: isConnectedRef.current,
              onlineMessage: "Unable to load category posts.",
            }),
          );
        }
      } finally {
        if (active) {
          setIsLoading(false);
        }
      }
    };

    void hydrateCategoryPosts();

    return () => {
      active = false;
    };
  }, [categorySlug, fetchCategoryPage]);

  const loadMorePosts = useCallback(async () => {
    if (
      isLoading ||
      isLoadingMore ||
      !hasMorePosts ||
      !lastPostCursorRef.current
    ) {
      return;
    }

    try {
      setIsLoadingMore(true);
      const page = await fetchCategoryPage({
        afterDoc: lastPostCursorRef.current,
        pageSize: CATEGORY_POSTS_LOAD_MORE_PAGE_SIZE,
      });
      lastPostCursorRef.current = page.lastDoc ?? lastPostCursorRef.current;
      setHasMorePosts(page.hasMore);
      setPosts((currentPosts) => {
        const nextPosts = mergeCategoryPosts(currentPosts, page.posts);
        if (categorySlug) {
          CATEGORY_POSTS_MEMORY_CACHE.set(categorySlug, nextPosts);
          CATEGORY_POSTS_SESSION_CACHE.set(categorySlug, {
            hasMore: page.hasMore,
            lastDoc: page.lastDoc ?? lastPostCursorRef.current,
            posts: nextPosts,
            queryMode: page.modeUsed,
          });
          void persistCategoryPostsCacheAsync(categorySlug, nextPosts).catch(() => {});
        }
        return nextPosts;
      });
      setError("");
    } catch (loadError) {
      setError(
        getRequestErrorMessage({
          error: loadError,
          isConnected: isConnectedRef.current,
          onlineMessage: "Unable to load more posts.",
        }),
      );
    } finally {
      setIsLoadingMore(false);
    }
  }, [
    categorySlug,
    fetchCategoryPage,
    hasMorePosts,
    isLoading,
    isLoadingMore,
  ]);

  const isOfflineState = !isConnected || error === DEFAULT_OFFLINE_MESSAGE;
  const showInlineError = Boolean(error) && !isOfflineState;
  const pendingCategoryPosts =
    CATEGORY_POSTS_SESSION_CACHE.get(categorySlug)?.posts ??
    CATEGORY_POSTS_MEMORY_CACHE.get(categorySlug) ??
    cachedCategoryPosts;
  const visiblePosts =
    displayedCategorySlug === categorySlug ? posts : pendingCategoryPosts;
  const isLoadingCurrentCategory =
    displayedCategorySlug === categorySlug
      ? isLoading
      : pendingCategoryPosts.length === 0;
  const subtitle = useMemo(
    () =>
      isLoadingCurrentCategory
        ? `${categoryLabel} posts loading...`
        : `Browse all published posts in ${categoryLabel}.`,
    [categoryLabel, isLoadingCurrentCategory],
  );
  const summaryLabel = isLoadingCurrentCategory
    ? "Updating posts..."
    : `${visiblePosts.length} loaded post${visiblePosts.length === 1 ? "" : "s"}`;
  const activeCategoryIndex = useMemo(
    () => categoryFilters.findIndex((item) => item.slug === categorySlug),
    [categoryFilters, categorySlug],
  );
  const previousCategorySlug = activeCategoryIndex > 0
    ? categoryFilters[activeCategoryIndex - 1]?.slug ?? ""
    : "";
  const nextCategorySlug = activeCategoryIndex >= 0
    ? categoryFilters[activeCategoryIndex + 1]?.slug ?? ""
    : "";
  const scrollSelectedCategoryIntoView = useCallback((slug: string, animated = true) => {
    const layout = categoryChipLayoutsRef.current.get(slug);
    const scrollerWidth = categoryScrollerWidthRef.current;
    if (!layout || scrollerWidth <= 0) {
      return;
    }

    categoryScrollerRef.current?.scrollTo({
      x: Math.max(0, layout.x - (scrollerWidth - layout.width) / 2),
      animated,
    });
  }, []);

  useEffect(() => {
    requestAnimationFrame(() => {
      postsListRef.current?.scrollToOffset({ offset: 0, animated: false });
    });
  }, [categorySlug]);

  useEffect(() => {
    requestAnimationFrame(() => scrollSelectedCategoryIntoView(categorySlug));
  }, [categoryFilters.length, categorySlug, scrollSelectedCategoryIntoView]);

  const openPost = useCallback((post: PostRecord) => {
    primePostNavigationCache(post);
    router.push({
      pathname: "/post/[postId]",
      params: {
        postId: post.id,
        swipeSource: "category",
        swipeCategorySlug: categorySlug,
      },
    });
  }, [categorySlug, router]);
  const bookmarkPostWithDoubleTap = useCallback(async (post: PostRecord) => {
    try {
      if (!isFavorite(post.id)) {
        await toggleFavorite(post, { showToast: false });
      }
      setCollectionPostId(post.id);
    } catch (bookmarkError) {
      const message = getActionErrorMessage({
        error: bookmarkError,
        isConnected,
        fallbackMessage: "Bookmark could not be saved right now.",
      });
      if (message === DEFAULT_OFFLINE_MESSAGE) {
        showOfflineToast();
        return;
      }
      Alert.alert("Unable to save bookmark", message);
    }
  }, [isConnected, isFavorite, showOfflineToast, toggleFavorite]);
  const openCategoryFeed = useCallback((nextCategorySlug: string) => {
    const normalizedSlug = normalizeCategorySlug(nextCategorySlug);
    if (!normalizedSlug || normalizedSlug === categorySlug) {
      return;
    }

    router.setParams({ categorySlug: normalizedSlug });
  }, [categorySlug, router]);
  const openPreviousCategory = useCallback(() => {
    if (!previousCategorySlug) {
      return;
    }

    openCategoryFeed(previousCategorySlug);
  }, [openCategoryFeed, previousCategorySlug]);
  const openNextCategory = useCallback(() => {
    if (!nextCategorySlug) {
      return;
    }

    openCategoryFeed(nextCategorySlug);
  }, [nextCategorySlug, openCategoryFeed]);
  const categorySwipeGesture = useMemo(
    () =>
      Gesture.Pan()
        .activeOffsetX([-36, 36])
        .failOffsetY([-20, 20])
        .runOnJS(true)
        .onEnd((event) => {
          const completedSwipe =
            Math.abs(event.translationX) >= 64 || Math.abs(event.velocityX) >= 500;
          if (!completedSwipe) {
            return;
          }

          if (event.translationX < 0) {
            openNextCategory();
          } else {
            openPreviousCategory();
          }
        }),
    [openNextCategory, openPreviousCategory],
  );

  const keyExtractor = useCallback((item: PostRecord) => item.id, []);

  const renderPost = useCallback(
    ({ item }: { item: PostRecord }) => (
      <CategoryPostCard
        onDoublePressPost={(post) => void bookmarkPostWithDoubleTap(post)}
        onOpenPost={openPost}
        post={item}
        styles={styles}
      />
    ),
    [bookmarkPostWithDoubleTap, openPost, styles],
  );

  const renderSeparator = useCallback(
    () => <View style={styles.listSeparator} />,
    [styles],
  );

  const listFooterComponent = useMemo(
    () =>
      !isLoading && (hasMorePosts || isLoadingMore) ? (
        <View style={styles.loadingMoreWrap}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Load more posts"
            accessibilityState={{ busy: isLoadingMore, disabled: isLoadingMore }}
            disabled={isLoadingMore}
            onPress={() => void loadMorePosts()}
            style={({ pressed }) => [
              styles.loadMoreButton,
              isLoadingMore ? styles.loadMoreButtonDisabled : null,
              pressed && !isLoadingMore ? styles.loadMoreButtonPressed : null,
            ]}
          >
            {({ pressed }) => (
              <>
                {isLoadingMore ? (
                  <ActivityIndicator size="small" color={pressed ? colors.primaryText : colors.primary} />
                ) : null}
                <Text style={[styles.loadMoreButtonText, pressed && styles.loadMoreButtonTextPressed]}>
                  {isLoadingMore ? "Loading..." : "Load more"}
                </Text>
              </>
            )}
          </Pressable>
        </View>
      ) : null,
    [
      colors.primary,
      colors.primaryText,
      hasMorePosts,
      isLoading,
      isLoadingMore,
      loadMorePosts,
      styles.loadMoreButton,
      styles.loadMoreButtonDisabled,
      styles.loadMoreButtonPressed,
      styles.loadMoreButtonText,
      styles.loadingMoreWrap,
    ],
  );

  const listHeaderComponent = useMemo(
    () => (
      <View style={styles.headerContent}>
        <View style={styles.controlsSection}>
          {isLoadingCategories && !categoryFilters.length ? (
            <View style={styles.categorySkeletonRow}>
              {CATEGORY_FILTER_SKELETON_ITEMS.map((item) => (
                <SkeletonBlock
                  key={`category-filter-skeleton-${item}`}
                  width={96}
                  height={34}
                  borderRadius={RADIUS.pill}
                />
              ))}
            </View>
          ) : null}
          <View style={styles.controlsRow}>
            <View style={styles.controlScroller}>
              {categoryFilters.length ? (
                <ScrollView
                  ref={categoryScrollerRef}
                  horizontal
                  onLayout={(event) => {
                    categoryScrollerWidthRef.current = event.nativeEvent.layout.width;
                    scrollSelectedCategoryIntoView(categorySlug, false);
                  }}
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={styles.controlRowContent}
                >
                  {categoryFilters.map((item) => (
                    <CategoryControlChip
                      key={item.key}
                      accessibilityLabel={item.accessibilityLabel}
                      label={item.label}
                      onLayout={(event) => {
                        categoryChipLayoutsRef.current.set(item.slug, event.nativeEvent.layout);
                        if (item.slug === categorySlug) {
                          scrollSelectedCategoryIntoView(item.slug, false);
                        }
                      }}
                      onPress={() => openCategoryFeed(item.slug)}
                      selected={item.slug === categorySlug}
                      styles={styles}
                    />
                  ))}
                </ScrollView>
              ) : null}
            </View>
          </View>
        </View>

        <View style={styles.heroCard}>
          <View style={styles.heroTopRow}>
            <View style={styles.heroIconWrap}>
              <CategoryTabIcon color={colors.accent} size={20} />
            </View>
            <View style={styles.heroTextWrap}>
              <Text style={styles.eyebrow}>{categoryLabel}</Text>
              <Text style={styles.subtitle}>{subtitle}</Text>
            </View>
          </View>
          <View style={styles.summaryChip}>
            <Text style={styles.summaryChipText}>{summaryLabel}</Text>
          </View>
        </View>

        {showInlineError ? <Text style={styles.error}>{error}</Text> : null}

        {isLoadingCurrentCategory ? (
          <View style={styles.loadingWrap}>
            <ActivityIndicator size="large" color={colors.primary} />
          </View>
        ) : null}
      </View>
    ),
    [
      colors.accent,
      colors.primary,
      colors.text,
      error,
      categoryFilters,
      categorySlug,
      categoryLabel,
      isLoadingCategories,
      isLoadingCurrentCategory,
      openCategoryFeed,
      scrollSelectedCategoryIntoView,
      showInlineError,
      styles,
      subtitle,
      summaryLabel,
    ],
  );

  const listEmptyComponent = useMemo(
    () =>
      !isLoadingCurrentCategory && !error ? (
        <View style={styles.emptyWrap}>
          <Text style={styles.emptyText}>No published posts in this category yet.</Text>
        </View>
      ) : null,
    [error, isLoadingCurrentCategory, styles],
  );

  return (
    <View style={styles.screen}>
      <Stack.Screen options={{ title: categoryLabel }} />
      <GestureDetector gesture={categorySwipeGesture}>
        <FlatList
          ref={postsListRef}
          data={visiblePosts}
          initialNumToRender={DEFAULT_LIST_INITIAL_NUM_TO_RENDER}
          keyExtractor={keyExtractor}
          maxToRenderPerBatch={DEFAULT_LIST_MAX_TO_RENDER_PER_BATCH}
          removeClippedSubviews={DEFAULT_LIST_REMOVE_CLIPPED_SUBVIEWS}
          renderItem={renderPost}
          ItemSeparatorComponent={renderSeparator}
          ListFooterComponent={listFooterComponent}
          ListHeaderComponent={listHeaderComponent}
          ListEmptyComponent={listEmptyComponent}
          contentContainerStyle={styles.container}
          showsVerticalScrollIndicator={false}
          updateCellsBatchingPeriod={DEFAULT_LIST_UPDATE_BATCHING_PERIOD}
          windowSize={DEFAULT_LIST_WINDOW_SIZE}
          contentInsetAdjustmentBehavior="automatic"
        />
      </GestureDetector>
      <BookmarkCollectionSheet
        isPresented={Boolean(collectionPostId)}
        onDismiss={() => setCollectionPostId("")}
        postId={collectionPostId}
      />
    </View>
  );
}

const createStyles = (
  colors: ThemeColors,
  resolvedTheme: "light" | "dark",
) => {
  const isDarkTheme = resolvedTheme === "dark";
  const chipBorderColor = isDarkTheme ? colors.inputBorder : colors.border;
  const chipActiveBackgroundColor = isDarkTheme ? colors.accent : colors.tabActive;

  return StyleSheet.create({
    screen: {
      flex: 1,
      backgroundColor: colors.background,
    },
    container: {
      flexGrow: 1,
      paddingHorizontal: SPACING.xxl,
      paddingBottom: SPACING.xxl * 2,
      backgroundColor: colors.background,
    },
    headerContent: {
      paddingTop: SPACING.lg,
      marginBottom: SPACING.md,
      gap: SPACING.md,
    },
    controlsSection: {
      gap: SPACING.xs,
    },
    controlsRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: SPACING.sm,
    },
    controlScroller: {
      flex: 1,
      minHeight: 34,
    },
    controlRowContent: {
      flexDirection: "row",
      gap: SPACING.sm,
      paddingRight: SPACING.md,
    },
    categorySkeletonRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: SPACING.sm,
    },
    controlChip: {
      minHeight: 34,
      paddingHorizontal: SPACING.md,
      borderRadius: RADIUS.pill,
      borderWidth: 1,
      borderColor: chipBorderColor,
      backgroundColor: colors.surface,
      justifyContent: "center",
      alignItems: "center",
    },
    controlChipSelected: {
      borderColor: chipActiveBackgroundColor,
      backgroundColor: chipActiveBackgroundColor,
    },
    controlChipPressed: {
      opacity: 0.84,
    },
    controlChipText: {
      color: colors.text,
      fontSize: 13,
      fontWeight: "600",
    },
    controlChipTextSelected: {
      color: STATIC_COLORS.white,
    },
    listSeparator: {
      height: SPACING.xl,
    },
    heroCard: {
      borderRadius: RADIUS.md,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.surface,
      padding: SPACING.lg,
      gap: SPACING.md,
      ...SHADOWS.sm,
    },
    heroTopRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: SPACING.md,
    },
    heroIconWrap: {
      width: 40,
      height: 40,
      borderRadius: RADIUS.pill,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: colors.accentSoft,
      borderWidth: 1,
      borderColor: colors.accentBorder,
    },
    heroTextWrap: {
      flex: 1,
      gap: 4,
    },
    eyebrow: {
      color: colors.text,
      fontSize: 14,
      fontWeight: "700",
    },
    subtitle: {
      color: colors.mutedText,
      fontSize: 13,
      lineHeight: 19,
    },
    summaryChip: {
      alignSelf: "flex-start",
      borderRadius: RADIUS.pill,
      paddingHorizontal: SPACING.md,
      paddingVertical: SPACING.xs + 1,
      borderWidth: 1,
      borderColor: colors.accentBorder,
      backgroundColor: colors.accentSoft,
    },
    summaryChipText: {
      color: colors.accent,
      fontSize: 12,
      fontWeight: "700",
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
    loadingMoreWrap: {
      paddingVertical: SPACING.lg,
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
  });
};
