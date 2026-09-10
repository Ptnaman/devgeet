import { Image } from "expo-image";
import { useLocalSearchParams, useRouter } from "expo-router";
import type { DocumentData, QueryDocumentSnapshot } from "firebase/firestore";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ActivityIndicator, Alert, Pressable, ScrollView, StyleSheet, Text, type GestureResponderEvent, View } from "react-native";

import { BookmarkCollectionSheet } from "@/components/bookmark-collection-sheet";
import { FavoriteTabIcon } from "@/components/icons/favorite-tab-icon";
import { MainTabFlatList } from "@/components/main-tabs/main-tab-flat-list";
import { SkeletonBlock } from "@/components/skeleton-block";
import {
  REMOTE_IMAGE_PLACEHOLDER,
  REMOTE_IMAGE_TRANSITION_MS,
} from "@/constants/image-loading";
import {
  RADIUS,
  SHADOWS,
  SPACING,
  type ThemeColors,
} from "@/constants/theme";
import {
  fetchCategoryPostsPageAsync,
  type CategoryPostsQueryMode,
} from "@/lib/category-post-feed";
import {
  createSlug,
  getContentPreviewLines,
  getPostCardThumbnailUrl,
  type PostRecord,
} from "@/lib/content";
import { appendPublishedPostsPage } from "@/lib/main-tab-data";
import { DEFAULT_OFFLINE_MESSAGE, getActionErrorMessage, getRequestErrorMessage } from "@/lib/network";
import { primePostNavigationCache } from "@/lib/post-navigation-cache";
import { useNetworkStatus } from "@/providers/network-provider";
import { useMainTabData } from "@/providers/main-tab-data-provider";
import { useAppTheme } from "@/providers/theme-provider";
import { useFavorites } from "@/hooks/use-favorites";

const ALL_CATEGORIES = "all";
const PAGE_SIZE = 9;
const POST_SKELETONS = Array.from({ length: 3 }, (_, index) => index);
type ListItem = number | PostRecord;
type CategorySession = {
  posts: PostRecord[];
  lastDoc: QueryDocumentSnapshot<DocumentData> | null;
  hasMore: boolean;
  queryMode: CategoryPostsQueryMode;
};
const CATEGORY_SESSIONS = new Map<string, CategorySession>();

export default function CategoriesTabScreen() {
  const { colors } = useAppTheme();
  const {
    categories,
    categoriesError,
    publishedPosts,
    postsError,
    isLoadingCategories,
    isLoadingPosts,
    isLoadingMorePosts,
    hasMorePublishedPosts,
    loadMorePublishedPostsAsync,
  } = useMainTabData();
  const { isConnected, showOfflineToast } = useNetworkStatus();
  const { isFavorite, toggleFavorite } = useFavorites();
  const router = useRouter();
  const params = useLocalSearchParams<{ categorySlug?: string | string[] }>();
  const requestedSlug = createSlug(
    Array.isArray(params.categorySlug) ? params.categorySlug[0] ?? "" : params.categorySlug ?? "",
  ) || ALL_CATEGORIES;
  const styles = useMemo(() => createStyles(colors), [colors]);
  const cursorRef = useRef<QueryDocumentSnapshot<DocumentData> | null>(null);
  const queryModeRef = useRef<CategoryPostsQueryMode>("uploadDate");
  const requestIdRef = useRef(0);
  const [selectedSlug, setSelectedSlug] = useState(ALL_CATEGORIES);
  const [categoryPosts, setCategoryPosts] = useState<PostRecord[]>([]);
  const [isLoadingCategoryPosts, setIsLoadingCategoryPosts] = useState(false);
  const [isLoadingMoreCategoryPosts, setIsLoadingMoreCategoryPosts] = useState(false);
  const [hasMoreCategoryPosts, setHasMoreCategoryPosts] = useState(false);
  const [categoryPostsError, setCategoryPostsError] = useState("");
  const [collectionPostId, setCollectionPostId] = useState("");

  const visiblePosts = selectedSlug === ALL_CATEGORIES ? publishedPosts : categoryPosts;
  const selectedCategory = categories.find((item) => createSlug(item.slug) === selectedSlug);
  const isInitialLoading = selectedSlug === ALL_CATEGORIES
    ? isLoadingPosts && publishedPosts.length === 0
    : isLoadingCategoryPosts && categoryPosts.length === 0;
  const isLoadingMore = selectedSlug === ALL_CATEGORIES
    ? isLoadingMorePosts
    : isLoadingMoreCategoryPosts;
  const hasMore = selectedSlug === ALL_CATEGORIES
    ? hasMorePublishedPosts
    : hasMoreCategoryPosts;
  const error = selectedSlug === ALL_CATEGORIES ? postsError : categoryPostsError;
  const listItems = useMemo<ListItem[]>(
    () => isInitialLoading ? POST_SKELETONS : visiblePosts,
    [isInitialLoading, visiblePosts],
  );

  const selectCategory = useCallback(async (slug: string) => {
    if (slug === selectedSlug) return;
    const requestId = ++requestIdRef.current;
    setSelectedSlug(slug);
    setCategoryPostsError("");

    if (slug === ALL_CATEGORIES) {
      setIsLoadingCategoryPosts(false);
      return;
    }

    const cached = CATEGORY_SESSIONS.get(slug);
    if (cached) {
      setCategoryPosts(cached.posts);
      cursorRef.current = cached.lastDoc;
      queryModeRef.current = cached.queryMode;
      setHasMoreCategoryPosts(cached.hasMore);
      setIsLoadingCategoryPosts(false);
      return;
    }

    setCategoryPosts([]);
    setIsLoadingCategoryPosts(true);
    setHasMoreCategoryPosts(false);
    cursorRef.current = null;
    queryModeRef.current = "uploadDate";

    try {
      const page = await fetchCategoryPostsPageAsync({
        categorySlug: slug,
        pageSize: PAGE_SIZE,
        preferredMode: "uploadDate",
      });
      if (requestId !== requestIdRef.current) return;
      const session: CategorySession = {
        posts: page.posts,
        lastDoc: page.lastDoc ?? null,
        hasMore: page.hasMore,
        queryMode: page.modeUsed,
      };
      CATEGORY_SESSIONS.set(slug, session);
      setCategoryPosts(session.posts);
      setHasMoreCategoryPosts(session.hasMore);
      cursorRef.current = session.lastDoc;
      queryModeRef.current = session.queryMode;
    } catch (loadError) {
      if (requestId === requestIdRef.current) {
        setCategoryPostsError(getRequestErrorMessage({
          error: loadError,
          isConnected,
          onlineMessage: "Unable to load category posts right now.",
        }));
      }
    } finally {
      if (requestId === requestIdRef.current) setIsLoadingCategoryPosts(false);
    }
  }, [isConnected, selectedSlug]);

  useEffect(() => {
    if (requestedSlug !== selectedSlug) void selectCategory(requestedSlug);
  }, [requestedSlug, selectCategory, selectedSlug]);

  const selectVisibleCategory = useCallback((slug: string) => {
    router.setParams({ categorySlug: slug });
    void selectCategory(slug);
  }, [router, selectCategory]);

  const loadMore = useCallback(async () => {
    if (!hasMore || isLoadingMore) return;
    if (selectedSlug === ALL_CATEGORIES) {
      await loadMorePublishedPostsAsync();
      return;
    }

    setIsLoadingMoreCategoryPosts(true);
    setCategoryPostsError("");
    try {
      const page = await fetchCategoryPostsPageAsync({
        afterDoc: cursorRef.current ?? undefined,
        categorySlug: selectedSlug,
        pageSize: PAGE_SIZE,
        preferredMode: queryModeRef.current,
      });
      const posts = appendPublishedPostsPage(categoryPosts, page.posts);
      const session: CategorySession = {
        posts,
        lastDoc: page.lastDoc ?? cursorRef.current,
        hasMore: page.hasMore,
        queryMode: page.modeUsed,
      };
      CATEGORY_SESSIONS.set(selectedSlug, session);
      setCategoryPosts(posts);
      setHasMoreCategoryPosts(session.hasMore);
      cursorRef.current = session.lastDoc;
      queryModeRef.current = session.queryMode;
    } catch (loadError) {
      setCategoryPostsError(getRequestErrorMessage({
        error: loadError,
        isConnected,
        onlineMessage: "Unable to load more posts right now.",
      }));
    } finally {
      setIsLoadingMoreCategoryPosts(false);
    }
  }, [categoryPosts, hasMore, isConnected, isLoadingMore, loadMorePublishedPostsAsync, selectedSlug]);

  const openPost = useCallback((post: PostRecord) => {
    primePostNavigationCache(post);
    router.push({ pathname: "/post/[postId]", params: { postId: post.id } });
  }, [router]);

  const handleBookmark = useCallback(async (post: PostRecord) => {
    try {
      if (isFavorite(post.id)) {
        await toggleFavorite(post);
        return;
      }
      await toggleFavorite(post, { showToast: false });
      setCollectionPostId(post.id);
    } catch (bookmarkError) {
      const message = getActionErrorMessage({ error: bookmarkError, isConnected, fallbackMessage: "Bookmark could not be updated right now." });
      if (message === DEFAULT_OFFLINE_MESSAGE) showOfflineToast();
      else Alert.alert("Unable to update bookmark", message);
    }
  }, [isConnected, isFavorite, showOfflineToast, toggleFavorite]);

  const renderPost = useCallback(({ item }: { item: ListItem }) => {
    if (typeof item === "number") {
      return (
        <View style={styles.skeletonCard}>
          <SkeletonBlock height={172} borderRadius={RADIUS.md} />
          <SkeletonBlock width="82%" height={22} />
          <SkeletonBlock width="96%" height={15} />
        </View>
      );
    }
    const thumbnailUrl = getPostCardThumbnailUrl(item);
    const author = item.authorDisplayName.trim() || item.authorUsername.trim() || "Unknown Author";
    return (
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`Open ${item.title}`}
        onPress={() => openPost(item)}
        style={({ pressed }) => [styles.postCard, pressed && styles.postCardPressed]}
      >
        <View style={styles.mediaWrap}>
          {thumbnailUrl ? (
            <Image
              accessibilityLabel={item.title}
              cachePolicy="memory-disk"
              contentFit="cover"
              placeholder={REMOTE_IMAGE_PLACEHOLDER}
              placeholderContentFit="cover"
              source={{ uri: thumbnailUrl }}
              style={styles.thumbnail}
              transition={REMOTE_IMAGE_TRANSITION_MS}
            />
          ) : <View style={styles.thumbnailFallback} />}
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={isFavorite(item.id) ? "Remove bookmark" : "Add bookmark"}
            onPress={(event: GestureResponderEvent) => { event.stopPropagation(); void handleBookmark(item); }}
            style={({ pressed }) => [styles.bookmarkButton, isFavorite(item.id) && styles.bookmarkButtonActive, pressed && styles.chipPressed]}
          >
            <FavoriteTabIcon size={20} color={isFavorite(item.id) ? colors.tabActive : colors.iconMuted} filled={isFavorite(item.id)} />
          </Pressable>
        </View>
        <View style={styles.postContent}>
          <Text style={styles.postTitle} numberOfLines={2}>{item.title}</Text>
          <Text style={styles.postPreview} numberOfLines={2}>{getContentPreviewLines(item.content)}</Text>
          <Text style={styles.postAuthor} numberOfLines={1}>{`By ${author}`}</Text>
        </View>
      </Pressable>
    );
  }, [colors.iconMuted, colors.tabActive, handleBookmark, isFavorite, openPost, styles]);

  const listHeader = (
    <View style={styles.header}>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.categoryRow}>
        <CategoryChip
          label="All"
          selected={selectedSlug === ALL_CATEGORIES}
          onPress={() => selectVisibleCategory(ALL_CATEGORIES)}
          styles={styles}
        />
        {categories.map((item) => {
          const slug = createSlug(item.slug);
          return (
            <CategoryChip
              key={item.id}
              label={item.name}
              selected={selectedSlug === slug}
              onPress={() => selectVisibleCategory(slug)}
              styles={styles}
            />
          );
        })}
        {isLoadingCategories ? <ActivityIndicator color={colors.tabActive} style={styles.categoryLoader} /> : null}
      </ScrollView>
      <View>
        <Text style={styles.heading}>{selectedCategory?.name ?? "All posts"}</Text>
        <Text style={styles.count}>{`${visiblePosts.length} ${visiblePosts.length === 1 ? "post" : "posts"}`}</Text>
      </View>
      {categoriesError && !categories.length ? <Text style={styles.error}>{categoriesError}</Text> : null}
    </View>
  );

  return (
    <View style={styles.screen}>
      <MainTabFlatList<ListItem>
        tabName="categories"
        data={listItems}
        keyExtractor={(item) => typeof item === "number" ? `skeleton-${item}` : item.id}
        renderItem={renderPost}
        ItemSeparatorComponent={() => <View style={styles.separator} />}
        ListHeaderComponent={listHeader}
        ListFooterComponent={(
          <View style={styles.footer}>
            {error ? <Text style={styles.error}>{error}</Text> : null}
            {!isInitialLoading && hasMore ? (
              <Pressable
                accessibilityRole="button"
                accessibilityState={{ busy: isLoadingMore, disabled: isLoadingMore }}
                disabled={isLoadingMore}
                onPress={() => void loadMore()}
                style={({ pressed }) => [styles.loadMoreButton, pressed && styles.loadMorePressed]}
              >
                {isLoadingMore ? <ActivityIndicator color={colors.primaryText} /> : null}
                <Text style={styles.loadMoreText}>{isLoadingMore ? "Loading..." : "Load more"}</Text>
              </Pressable>
            ) : null}
          </View>
        )}
        ListEmptyComponent={!isInitialLoading && !error ? (
          <View style={styles.emptyWrap}>
            <Text style={styles.emptyTitle}>No posts found</Text>
            <Text style={styles.emptyText}>There are no published posts in this category yet.</Text>
          </View>
        ) : null}
        contentContainerStyle={styles.container}
        contentInsetAdjustmentBehavior="automatic"
        showsVerticalScrollIndicator={false}
      />
      <BookmarkCollectionSheet isPresented={Boolean(collectionPostId)} onDismiss={() => setCollectionPostId("")} postId={collectionPostId} />
    </View>
  );
}

function CategoryChip({ label, onPress, selected, styles }: {
  label: string;
  onPress: () => void;
  selected: boolean;
  styles: CategoryStyles;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected }}
      onPress={onPress}
      style={({ pressed }) => [styles.categoryChip, selected && styles.categoryChipSelected, pressed && styles.chipPressed]}
    >
      <Text style={[styles.categoryChipText, selected && styles.categoryChipTextSelected]} numberOfLines={1}>{label}</Text>
    </Pressable>
  );
}

type CategoryStyles = ReturnType<typeof createStyles>;

const createStyles = (colors: ThemeColors) => StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  container: {
    flexGrow: 1,
    paddingHorizontal: SPACING.xxl,
    paddingBottom: SPACING.xxl * 2,
    backgroundColor: colors.background,
  },
  header: { paddingTop: SPACING.lg, paddingBottom: SPACING.xl, gap: SPACING.xl },
  categoryRow: { gap: SPACING.sm, paddingRight: SPACING.xxl, alignItems: "center" },
  categoryChip: {
    minHeight: 38,
    paddingHorizontal: SPACING.lg,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: RADIUS.pill,
    backgroundColor: colors.surface,
    alignItems: "center",
    justifyContent: "center",
    borderCurve: "continuous",
  },
  categoryChipSelected: { backgroundColor: colors.tabActive, borderColor: colors.tabActive },
  categoryChipText: { color: colors.mutedText, fontSize: 14, fontWeight: "600" },
  categoryChipTextSelected: { color: "#FFFFFF", fontWeight: "700" },
  chipPressed: { opacity: 0.76 },
  categoryLoader: { width: 38 },
  heading: { color: colors.text, fontSize: 22, lineHeight: 28, fontWeight: "800" },
  count: { color: colors.subtleText, fontSize: 13, marginTop: 2 },
  separator: { height: SPACING.xl },
  postCard: {
    overflow: "hidden",
    borderRadius: 9,
    backgroundColor: colors.surface,
    borderCurve: "continuous",
    ...SHADOWS.sm,
  },
  postCardPressed: { opacity: 0.93, transform: [{ scale: 0.995 }] },
  thumbnail: { width: "100%", height: 172, backgroundColor: colors.surfaceSoft },
  thumbnailFallback: { width: "100%", height: 172, backgroundColor: colors.surfaceSoft },
  mediaWrap: { position: "relative" },
  bookmarkButton: { position: "absolute", top: SPACING.sm, right: SPACING.sm, width: 38, height: 38, borderRadius: RADIUS.pill, alignItems: "center", justifyContent: "center", backgroundColor: colors.surface, ...SHADOWS.sm },
  bookmarkButtonActive: { backgroundColor: colors.favoriteSurface },
  postContent: { padding: SPACING.lg, gap: SPACING.sm },
  postTitle: { color: colors.text, fontSize: 18, lineHeight: 24, fontWeight: "700" },
  postPreview: { color: colors.mutedText, fontSize: 14, lineHeight: 20 },
  postAuthor: { color: colors.subtleText, fontSize: 12, fontWeight: "600" },
  skeletonCard: {
    padding: SPACING.md,
    gap: SPACING.md,
    borderRadius: RADIUS.lg,
    backgroundColor: colors.surface,
  },
  footer: { minHeight: 92, paddingVertical: SPACING.xl, gap: SPACING.md, alignItems: "center" },
  loadMoreButton: {
    minWidth: 150,
    minHeight: 48,
    paddingHorizontal: SPACING.xl,
    borderRadius: RADIUS.pill,
    backgroundColor: colors.primary,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: SPACING.sm,
  },
  loadMorePressed: { opacity: 0.82 },
  loadMoreText: { color: colors.primaryText, fontSize: 14, fontWeight: "700" },
  error: { color: colors.danger, fontSize: 13, textAlign: "center" },
  emptyWrap: {
    padding: SPACING.xxl,
    borderRadius: RADIUS.lg,
    backgroundColor: colors.surface,
    alignItems: "center",
    gap: SPACING.sm,
  },
  emptyTitle: { color: colors.text, fontSize: 17, fontWeight: "700" },
  emptyText: { color: colors.mutedText, fontSize: 14, lineHeight: 20, textAlign: "center" },
});
