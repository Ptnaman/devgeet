import { memo, type Ref, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Image } from "expo-image";
import { useNavigation, useRouter } from "expo-router";
import {
  ActivityIndicator,
  FlatList,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";

import { MainTabFlatList } from "@/components/main-tabs/main-tab-flat-list";
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
  getContentPreviewLines,
  getPostCardThumbnailUrl,
  sortPostsByRecency,
  type PostRecord,
} from "@/lib/content";
import { primePostNavigationCache } from "@/lib/post-navigation-cache";
import { useMainTabData } from "@/providers/main-tab-data-provider";
import { useAppTheme } from "@/providers/theme-provider";

const HOME_SKELETON_ITEMS = Array.from({ length: 3 }, (_, index) => index);
const HOME_CATEGORY_SKELETON_ITEMS = Array.from({ length: 4 }, (_, index) => index);
const ALL_CATEGORY_SLUG = "__all__";
const ALL_CATEGORY_LABEL = "All";
const HOME_CATEGORY_SLUG = "home";
const HOME_CATEGORY_LABEL = "Home";
type HomeListItem =
  | number
  | PostRecord;
type HomeListRef = FlatList<HomeListItem>;

const HOME_FEED_MEMORY: {
  scrollOffset: number;
  selectedCategorySlug: string;
} = {
  scrollOffset: 0,
  selectedCategorySlug: ALL_CATEGORY_SLUG,
};

const normalizeCategorySlug = (value: string) => value.trim().toLowerCase();
const toCategoryLabel = (slug: string) =>
  slug
    .split(/[-_]+/)
    .filter(Boolean)
    .map((segment) =>
      segment.charAt(0).toUpperCase() + segment.slice(1),
    )
    .join(" ");

type HomeStyles = ReturnType<typeof createStyles>;

const HomeControlChip = memo(function HomeControlChip({
  accessibilityLabel,
  label,
  onPress,
  selected,
  styles,
}: {
  accessibilityLabel: string;
  label: string;
  onPress: () => void;
  selected: boolean;
  styles: HomeStyles;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      accessibilityState={{ selected }}
      hitSlop={6}
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
  onPressPost,
  post,
  styles,
}: {
  onPressPost: (post: PostRecord) => void;
  post: PostRecord;
  styles: HomeStyles;
}) {
  const thumbnailUrl = getPostCardThumbnailUrl(post);
  const previewText = getContentPreviewLines(post.content);
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
        onPress={() => onPressPost(post)}
      >
        <View style={styles.mediaWrap}>
          {thumbnailUrl ? (
            <Image
              cachePolicy="memory-disk"
              contentFit="cover"
              source={{ uri: thumbnailUrl }}
              style={styles.thumbnail}
              transition={120}
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
  const { colors, resolvedTheme } = useAppTheme();
  const {
    categories,
    publishedPosts,
    isLoadingCategories,
    isLoadingPosts,
    isLoadingMorePosts,
    hasMorePublishedPosts,
    isRefreshing,
    postsError,
    refreshMainTabDataAsync,
    loadMorePublishedPostsAsync,
  } = useMainTabData();
  const navigation = useNavigation();
  const router = useRouter();
  const listRef = useRef<HomeListRef | null>(null);
  const hasRestoredInitialScrollRef = useRef(false);
  const [selectedCategorySlug, setSelectedCategorySlug] = useState<string>(
    HOME_FEED_MEMORY.selectedCategorySlug,
  );
  const styles = useMemo(
    () => createStyles(colors, resolvedTheme),
    [colors, resolvedTheme],
  );
  const showInlineError = Boolean(postsError);

  useEffect(() => {
    HOME_FEED_MEMORY.selectedCategorySlug = selectedCategorySlug;
  }, [selectedCategorySlug]);

  const scrollHomeFeedToTop = useCallback((animated = true) => {
    HOME_FEED_MEMORY.scrollOffset = 0;
    listRef.current?.scrollToOffset({ offset: 0, animated });
  }, []);

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
      if (!slug || slug === ALL_CATEGORY_SLUG || filtersBySlug.has(slug)) {
        return;
      }

      const fallbackLabel = slug === HOME_CATEGORY_SLUG ? HOME_CATEGORY_LABEL : toCategoryLabel(slug);
      const label = labelValue.trim() || fallbackLabel;

      filtersBySlug.set(slug, {
        key,
        slug,
        label,
        accessibilityLabel: `Filter posts by ${label}`,
      });
    };

    categories.forEach((item) => {
      registerFilter(item.slug, item.name, item.id);
    });

    publishedPosts.forEach((post) => {
      const normalizedSlug = normalizeCategorySlug(post.category);
      registerFilter(post.category, "", `post-${normalizedSlug}`);
    });

    return [
      {
        key: ALL_CATEGORY_SLUG,
        slug: ALL_CATEGORY_SLUG,
        label: ALL_CATEGORY_LABEL,
        accessibilityLabel: "Show all posts",
      },
      ...Array.from(filtersBySlug.values()),
    ];
  }, [categories, publishedPosts]);

  const visiblePosts = useMemo(() => {
    if (selectedCategorySlug === ALL_CATEGORY_SLUG) {
      return publishedPosts;
    }

    return sortPostsByRecency(
      publishedPosts.filter(
        (post) => normalizeCategorySlug(post.category) === selectedCategorySlug,
      ),
    );
  }, [publishedPosts, selectedCategorySlug]);

  const listItems = useMemo<HomeListItem[]>(
    () => (isLoadingPosts ? HOME_SKELETON_ITEMS : visiblePosts),
    [isLoadingPosts, visiblePosts],
  );

  const openPost = useCallback((post: PostRecord) => {
    primePostNavigationCache(post);
    router.push({ pathname: "/post/[postId]", params: { postId: post.id } });
  }, [router]);

  const selectCategory = useCallback((categorySlug: string) => {
    const normalizedSlug = normalizeCategorySlug(categorySlug);
    if (!normalizedSlug) {
      return;
    }

    setSelectedCategorySlug(normalizedSlug);
    scrollHomeFeedToTop();
  }, [scrollHomeFeedToTop]);

  const refreshHomeFeed = useCallback(async () => {
    await refreshMainTabDataAsync();
  }, [refreshMainTabDataAsync]);

  const loadMoreHomeFeed = useCallback(async () => {
    await loadMorePublishedPostsAsync();
  }, [loadMorePublishedPostsAsync]);

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
    if (hasRestoredInitialScrollRef.current || isLoadingPosts) {
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
  }, [isLoadingPosts, listItems.length]);

  useEffect(() => {
    if (
      isLoadingPosts ||
      isLoadingMorePosts ||
      !hasMorePublishedPosts ||
      selectedCategorySlug === ALL_CATEGORY_SLUG ||
      visiblePosts.length > 0
    ) {
      return;
    }

    void loadMorePublishedPostsAsync();
  }, [
    hasMorePublishedPosts,
    isLoadingMorePosts,
    isLoadingPosts,
    loadMorePublishedPostsAsync,
    selectedCategorySlug,
    visiblePosts.length,
  ]);

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
          onPressPost={openPost}
          post={item}
          styles={styles}
        />
      );
    },
    [openPost, styles],
  );

  const renderSeparator = useCallback(
    () => <View style={styles.listSeparator} />,
    [styles],
  );

  const listEmptyComponent = useMemo(
    () =>
      !isLoadingPosts && !showInlineError ? (
        <View style={styles.emptyWrap}>
          <Text style={styles.emptyText}>
            {selectedCategorySlug !== ALL_CATEGORY_SLUG
              ? "No posts are available in this category right now."
              : "No published posts are available right now."}
          </Text>
        </View>
      ) : null,
    [isLoadingPosts, selectedCategorySlug, showInlineError, styles],
  );

  const listFooterComponent = useMemo(
    () =>
      !isLoadingPosts && isLoadingMorePosts ? (
        <View style={styles.listFooter}>
          <ActivityIndicator size="small" color={colors.primary} />
        </View>
      ) : null,
    [colors.primary, isLoadingMorePosts, isLoadingPosts, styles.listFooter],
  );

  const listHeaderComponent = useMemo(
    () => (
      <View style={styles.controlsWrap}>
        <View style={styles.controlsSection}>
          {isLoadingCategories ? (
            <View style={styles.categorySkeletonRow}>
              {HOME_CATEGORY_SKELETON_ITEMS.map((item) => (
                <SkeletonBlock
                  key={`category-skeleton-${item}`}
                  width={96}
                  height={34}
                  borderRadius={RADIUS.pill}
                />
              ))}
            </View>
          ) : (
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.controlRowContent}
            >
              {categoryFilters.map((item) => (
                <HomeControlChip
                  key={item.key}
                  accessibilityLabel={item.accessibilityLabel}
                  label={item.label}
                  onPress={() => selectCategory(item.slug)}
                  selected={selectedCategorySlug === item.slug}
                  styles={styles}
                />
              ))}
            </ScrollView>
          )}
        </View>

        {!isLoadingPosts && showInlineError ? (
          <Text style={styles.errorText}>{postsError}</Text>
        ) : null}
      </View>
    ),
    [
      categoryFilters,
      isLoadingCategories,
      isLoadingPosts,
      postsError,
      selectCategory,
      selectedCategorySlug,
      showInlineError,
      styles,
    ],
  );

  return (
    <View style={styles.screen}>
      <MainTabFlatList<HomeListItem>
        tabName="home"
        listRef={listRef as Ref<FlatList<HomeListItem>>}
        data={listItems}
        keyExtractor={keyExtractor}
        renderItem={renderItem}
        ListHeaderComponent={listHeaderComponent}
        ItemSeparatorComponent={renderSeparator}
        ListEmptyComponent={listEmptyComponent}
        ListFooterComponent={listFooterComponent}
        contentContainerStyle={styles.listContentContainer}
        showsVerticalScrollIndicator={false}
        onScroll={handleScroll}
        refreshing={isRefreshing}
        onRefresh={refreshHomeFeed}
        onEndReachedThreshold={0.35}
        onEndReached={() => {
          if (!hasMorePublishedPosts || isLoadingPosts || isLoadingMorePosts) {
            return;
          }

          void loadMoreHomeFeed();
        }}
      />
    </View>
  );
}

const createStyles = (
  colors: ThemeColors,
  resolvedTheme: "light" | "dark",
) => {
  const isDarkTheme = resolvedTheme === "dark";
  const launcherBorderColor = isDarkTheme ? colors.inputBorder : colors.border;
  const launcherBackgroundColor = colors.surface;
  const chipActiveBackgroundColor = isDarkTheme ? colors.accent : colors.tabActive;

  return StyleSheet.create({
    screen: {
      flex: 1,
      backgroundColor: colors.background,
    },
    controlsWrap: {
      gap: SPACING.md,
      paddingTop: SPACING.lg,
      paddingBottom: SPACING.md,
    },
    controlsSection: {
      gap: SPACING.xs,
    },
    controlRowContent: {
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
      borderColor: launcherBorderColor,
      backgroundColor: launcherBackgroundColor,
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
    listContentContainer: {
      flexGrow: 1,
      paddingHorizontal: SPACING.xxl,
      paddingBottom: SPACING.xxl * 2,
      backgroundColor: colors.background,
    },
    listSeparator: {
      height: SPACING.xl,
    },
    listFooter: {
      paddingVertical: SPACING.lg,
      alignItems: "center",
      justifyContent: "center",
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
