import { Image } from "expo-image";
import { useFocusEffect, useRouter } from "expo-router";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Alert,
  FlatList,
  Pressable,
  StyleSheet,
  Text,
  type GestureResponderEvent,
  View,
  useWindowDimensions,
} from "react-native";

import { BookmarkCollectionSheet } from "@/components/bookmark-collection-sheet";
import { ArrowRightIcon } from "@/components/icons/arrow-right-icon";
import { FavoriteTabIcon } from "@/components/icons/favorite-tab-icon";
import { MainTabScrollView } from "@/components/main-tabs/main-tab-scroll-view";
import { SkeletonBlock } from "@/components/skeleton-block";
import {
  REMOTE_IMAGE_PLACEHOLDER,
  REMOTE_IMAGE_TRANSITION_MS,
} from "@/constants/image-loading";
import { RADIUS, SHADOWS, SPACING, type ThemeColors } from "@/constants/theme";
import { useFavorites } from "@/hooks/use-favorites";
import {
  getContentPreviewLines,
  getPostCardThumbnailUrl,
  type PostRecord,
} from "@/lib/content";
import { DEFAULT_OFFLINE_MESSAGE, getActionErrorMessage } from "@/lib/network";
import { primePostNavigationCache } from "@/lib/post-navigation-cache";
import { getRecommendedPostsAsync } from "@/lib/reading-history";
import { useAuth } from "@/providers/auth-provider";
import { useMainTabData } from "@/providers/main-tab-data-provider";
import { useNetworkStatus } from "@/providers/network-provider";
import { useAppTheme } from "@/providers/theme-provider";

const FEATURED_LIMIT = 4;
const CATEGORY_LIMIT = 6;
const RECOMMENDED_LIMIT = 5;
const AUTO_SCROLL_INTERVAL_MS = 4_500;

type HomeStyles = ReturnType<typeof createStyles>;

function BookmarkButton({
  active,
  onPress,
  styles,
}: {
  active: boolean;
  onPress: () => void;
  styles: HomeStyles;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={active ? "Remove bookmark" : "Add bookmark"}
      accessibilityState={{ selected: active }}
      hitSlop={8}
      onPress={(event: GestureResponderEvent) => {
        event.stopPropagation();
        onPress();
      }}
      style={({ pressed }) => [
        styles.bookmarkButton,
        active && styles.bookmarkButtonActive,
        pressed && styles.pressed,
      ]}
    >
      <FavoriteTabIcon
        color={active ? styles.bookmarkActiveColor.color : styles.bookmarkColor.color}
        filled={active}
        size={21}
      />
    </Pressable>
  );
}

function RecommendedPostCard({
  bookmarked,
  onBookmark,
  onOpen,
  post,
  styles,
}: {
  bookmarked: boolean;
  onBookmark: () => void;
  onOpen: () => void;
  post: PostRecord;
  styles: HomeStyles;
}) {
  const thumbnailUrl = getPostCardThumbnailUrl(post);
  const author = post.authorDisplayName.trim() || post.authorUsername.trim() || "Unknown Author";

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`Open ${post.title}`}
      onPress={onOpen}
      style={({ pressed }) => [styles.postCard, pressed && styles.cardPressed]}
    >
      <View style={styles.postMedia}>
        {thumbnailUrl ? (
          <Image
            accessibilityLabel={post.title}
            cachePolicy="memory-disk"
            contentFit="cover"
            placeholder={REMOTE_IMAGE_PLACEHOLDER}
            placeholderContentFit="cover"
            source={{ uri: thumbnailUrl }}
            style={styles.postImage}
            transition={REMOTE_IMAGE_TRANSITION_MS}
          />
        ) : <View style={styles.postImageFallback} />}
        <BookmarkButton active={bookmarked} onPress={onBookmark} styles={styles} />
      </View>
      <View style={styles.postBody}>
        <Text style={styles.postTitle} numberOfLines={2}>{post.title}</Text>
        <Text style={styles.postPreview} numberOfLines={2}>{getContentPreviewLines(post.content)}</Text>
        <Text style={styles.postAuthor} numberOfLines={1}>{`By ${author}`}</Text>
      </View>
    </Pressable>
  );
}

export default function HomeTabScreen() {
  const { colors } = useAppTheme();
  const { user } = useAuth();
  const { isConnected, showOfflineToast } = useNetworkStatus();
  const { isFavorite, toggleFavorite } = useFavorites();
  const { categories, isLoadingCategories, isLoadingPosts, postsError, publishedPosts } = useMainTabData();
  const router = useRouter();
  const { width } = useWindowDimensions();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const carouselRef = useRef<FlatList<PostRecord> | null>(null);
  const activeSlideRef = useRef(0);
  const [activeSlide, setActiveSlide] = useState(0);
  const [recommendedPosts, setRecommendedPosts] = useState<PostRecord[]>([]);
  const [collectionPostId, setCollectionPostId] = useState("");

  const carouselWidth = Math.max(width - SPACING.xxl * 2, 1);
  const categoryCardWidth = Math.max((carouselWidth - SPACING.sm) / 2, 1);
  const featuredPosts = useMemo(
    () => publishedPosts.filter((post) => Boolean(getPostCardThumbnailUrl(post))).slice(0, FEATURED_LIMIT),
    [publishedPosts],
  );
  const visibleCategories = useMemo(() => categories.slice(0, CATEGORY_LIMIT), [categories]);

  const refreshRecommendations = useCallback(() => {
    let active = true;
    void getRecommendedPostsAsync(user?.uid ?? "guest", publishedPosts, RECOMMENDED_LIMIT)
      .then((posts) => {
        if (active) setRecommendedPosts(posts);
      })
      .catch(() => {
        if (active) setRecommendedPosts(publishedPosts.slice(0, RECOMMENDED_LIMIT));
      });
    return () => {
      active = false;
    };
  }, [publishedPosts, user?.uid]);

  useFocusEffect(refreshRecommendations);

  useEffect(() => {
    if (featuredPosts.length < 2) return;
    const intervalId = setInterval(() => {
      const nextIndex = (activeSlideRef.current + 1) % featuredPosts.length;
      carouselRef.current?.scrollToOffset({ offset: nextIndex * carouselWidth, animated: true });
      activeSlideRef.current = nextIndex;
      setActiveSlide(nextIndex);
    }, AUTO_SCROLL_INTERVAL_MS);
    return () => clearInterval(intervalId);
  }, [carouselWidth, featuredPosts.length]);

  useEffect(() => {
    if (activeSlideRef.current < featuredPosts.length) return;
    activeSlideRef.current = 0;
    setActiveSlide(0);
    carouselRef.current?.scrollToOffset({ offset: 0, animated: false });
  }, [featuredPosts.length]);

  const openPost = useCallback((post: PostRecord) => {
    primePostNavigationCache(post);
    router.push({ pathname: "/post/[postId]", params: { postId: post.id } });
  }, [router]);

  const openCategory = useCallback((categorySlug: string) => {
    router.push({ pathname: "/(main)/(tabs)/categories", params: { categorySlug } });
  }, [router]);

  const handleBookmark = useCallback(async (post: PostRecord) => {
    try {
      if (isFavorite(post.id)) {
        await toggleFavorite(post);
        return;
      }
      await toggleFavorite(post, { showToast: false });
      setCollectionPostId(post.id);
    } catch (error) {
      const message = getActionErrorMessage({
        error,
        isConnected,
        fallbackMessage: "Bookmark could not be updated right now.",
      });
      if (message === DEFAULT_OFFLINE_MESSAGE) showOfflineToast();
      else Alert.alert("Unable to update bookmark", message);
    }
  }, [isConnected, isFavorite, showOfflineToast, toggleFavorite]);

  return (
    <View style={styles.screen}>
      <MainTabScrollView
        tabName="home"
        contentContainerStyle={styles.content}
        contentInsetAdjustmentBehavior="automatic"
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Featured</Text>
          {isLoadingPosts && !featuredPosts.length ? (
            <SkeletonBlock height={carouselWidth * 9 / 16} borderRadius={4} />
          ) : null}
          {featuredPosts.length ? (
            <View>
              <FlatList
                ref={carouselRef}
                horizontal
                data={featuredPosts}
                keyExtractor={(post) => post.id}
                pagingEnabled
                showsHorizontalScrollIndicator={false}
                getItemLayout={(_, index) => ({ length: carouselWidth, offset: carouselWidth * index, index })}
                onMomentumScrollEnd={(event) => {
                  const nextIndex = Math.round(event.nativeEvent.contentOffset.x / carouselWidth);
                  activeSlideRef.current = nextIndex;
                  setActiveSlide(nextIndex);
                }}
                renderItem={({ item }) => (
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel={`Open featured post ${item.title}`}
                    onPress={() => openPost(item)}
                    style={[styles.featuredCard, { width: carouselWidth }]}
                  >
                    <Image
                      accessibilityLabel={item.title}
                      cachePolicy="memory-disk"
                      contentFit="cover"
                      placeholder={REMOTE_IMAGE_PLACEHOLDER}
                      placeholderContentFit="cover"
                      source={{ uri: getPostCardThumbnailUrl(item) }}
                      style={styles.featuredImage}
                      transition={REMOTE_IMAGE_TRANSITION_MS}
                    />
                    <View style={styles.featuredOverlay}>
                      <Text style={styles.featuredTitle} numberOfLines={2}>{item.title}</Text>
                    </View>
                  </Pressable>
                )}
              />
              <View style={styles.dots}>
                {featuredPosts.map((post, index) => (
                  <View key={post.id} style={[styles.dot, index === activeSlide && styles.dotActive]} />
                ))}
              </View>
            </View>
          ) : null}
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Categories</Text>
          <View style={styles.categoryGrid}>
            {isLoadingCategories && !visibleCategories.length
              ? Array.from({ length: CATEGORY_LIMIT }, (_, index) => (
                  <SkeletonBlock key={index} width={categoryCardWidth} height={132} borderRadius={4} />
                ))
              : visibleCategories.map((category) => (
                  <Pressable
                    key={category.id}
                    accessibilityRole="button"
                    accessibilityLabel={`Open ${category.name}`}
                    onPress={() => openCategory(category.slug)}
                    style={({ pressed }) => [styles.categoryCard, { width: categoryCardWidth }, pressed && styles.cardPressed]}
                  >
                    {category.imageUrl ? (
                      <Image
                        accessibilityLabel={category.name}
                        cachePolicy="memory-disk"
                        contentFit="cover"
                        placeholder={REMOTE_IMAGE_PLACEHOLDER}
                        placeholderContentFit="cover"
                        source={{ uri: category.imageUrl }}
                        style={styles.categoryImage}
                        transition={REMOTE_IMAGE_TRANSITION_MS}
                      />
                    ) : (
                      <View style={styles.categoryImageFallback}>
                        <Text style={styles.categoryInitialText}>{category.name.trim().charAt(0).toUpperCase()}</Text>
                      </View>
                    )}
                    <View style={styles.categoryContent}>
                      <Text style={styles.categoryName} numberOfLines={1}>{category.name}</Text>
                      <ArrowRightIcon size={15} color={colors.tabActive} />
                    </View>
                  </Pressable>
                ))}
          </View>
        </View>

        <View style={styles.section}>
          <View style={styles.sectionHeadingRow}>
            <Text style={styles.sectionTitle}>Recommended for you</Text>
            <Text style={styles.sectionCount}>{recommendedPosts.length}/5</Text>
          </View>
          {isLoadingPosts && !recommendedPosts.length
            ? Array.from({ length: 2 }, (_, index) => (
                <SkeletonBlock key={index} height={250} borderRadius={RADIUS.lg} />
              ))
            : recommendedPosts.map((post) => (
                <RecommendedPostCard
                  key={post.id}
                  bookmarked={isFavorite(post.id)}
                  onBookmark={() => void handleBookmark(post)}
                  onOpen={() => openPost(post)}
                  post={post}
                  styles={styles}
                />
              ))}
          {postsError ? <Text selectable style={styles.errorText}>{postsError}</Text> : null}
        </View>
      </MainTabScrollView>

      <BookmarkCollectionSheet
        isPresented={Boolean(collectionPostId)}
        onDismiss={() => setCollectionPostId("")}
        postId={collectionPostId}
      />
    </View>
  );
}

const createStyles = (colors: ThemeColors) => StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  content: {
    paddingHorizontal: SPACING.xxl,
    paddingTop: SPACING.lg,
    paddingBottom: SPACING.xxl * 2,
    gap: SPACING.xxl,
  },
  section: { gap: SPACING.md },
  sectionHeadingRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  sectionTitle: { color: colors.text, fontSize: 21, lineHeight: 27, fontWeight: "800" },
  sectionCount: { color: colors.subtleText, fontSize: 13, fontVariant: ["tabular-nums"] },
  featuredCard: {
    aspectRatio: 16 / 9,
    overflow: "hidden",
    borderRadius: 4,
    backgroundColor: colors.surfaceSoft,
    borderCurve: "continuous",
  },
  featuredImage: { width: "100%", height: "100%" },
  featuredOverlay: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    paddingHorizontal: SPACING.lg,
    paddingTop: SPACING.xxl,
    paddingBottom: SPACING.lg,
    backgroundColor: "#00000080",
  },
  featuredTitle: { color: "#FFFFFF", fontSize: 19, lineHeight: 25, fontWeight: "800" },
  dots: { flexDirection: "row", justifyContent: "center", gap: 6, paddingTop: SPACING.sm },
  dot: { width: 6, height: 6, borderRadius: RADIUS.pill, backgroundColor: colors.border },
  dotActive: { width: 20, backgroundColor: colors.tabActive },
  categoryGrid: { flexDirection: "row", flexWrap: "wrap", gap: SPACING.sm },
  categoryCard: {
    overflow: "hidden",
    borderRadius: 4,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderCurve: "continuous",
  },
  categoryImage: { width: "100%", aspectRatio: 16 / 9, backgroundColor: colors.surfaceSoft },
  categoryImageFallback: { width: "100%", aspectRatio: 16 / 9, alignItems: "center", justifyContent: "center", backgroundColor: colors.activeSurface },
  categoryInitialText: { color: colors.tabActive, fontSize: 22, fontWeight: "800" },
  categoryContent: { minHeight: 46, paddingHorizontal: SPACING.md, flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: SPACING.sm },
  categoryName: { flex: 1, color: colors.text, fontSize: 14, lineHeight: 18, fontWeight: "700" },
  postCard: {
    overflow: "hidden",
    borderRadius: 9,
    backgroundColor: colors.surface,
    borderCurve: "continuous",
    ...SHADOWS.sm,
  },
  cardPressed: { opacity: 0.92, transform: [{ scale: 0.995 }] },
  postImage: { width: "100%", height: 158, backgroundColor: colors.surfaceSoft },
  postImageFallback: { width: "100%", height: 158, backgroundColor: colors.surfaceSoft },
  postMedia: { position: "relative" },
  postBody: { padding: SPACING.lg, gap: SPACING.sm },
  postTitle: { color: colors.text, fontSize: 17, lineHeight: 23, fontWeight: "700" },
  postPreview: { color: colors.mutedText, fontSize: 14, lineHeight: 20 },
  postAuthor: { color: colors.subtleText, fontSize: 12, fontWeight: "600" },
  bookmarkButton: {
    position: "absolute",
    top: SPACING.sm,
    right: SPACING.sm,
    width: 38,
    height: 38,
    borderRadius: RADIUS.pill,
    backgroundColor: colors.surface,
    alignItems: "center",
    justifyContent: "center",
    ...SHADOWS.sm,
  },
  bookmarkButtonActive: { backgroundColor: colors.favoriteSurface },
  bookmarkColor: { color: colors.iconMuted },
  bookmarkActiveColor: { color: colors.tabActive },
  pressed: { opacity: 0.7 },
  errorText: { color: colors.danger, fontSize: 13 },
});
