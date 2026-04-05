import { useEffect, useMemo, useRef, useState, type RefObject } from "react";
import {
  ActivityIndicator,
  Alert,
  Image,
  Linking,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from "react-native";
import { Stack, useLocalSearchParams, useRouter } from "expo-router";
import {
  collection,
  doc,
  onSnapshot,
  query,
  where,
  type DocumentData,
} from "firebase/firestore";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import Animated, {
  Extrapolation,
  cancelAnimation,
  interpolate,
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from "react-native-reanimated";
import YoutubePlayer from "react-native-youtube-iframe";

import {
  FONT_SIZE,
  RADIUS,
  SHADOWS,
  SPACING,
  type ThemeColors,
  type ThemeMode,
} from "@/constants/theme";
import { FavoriteActionIcon } from "@/components/icons/favorite-action-icon";
import {
  createSlug,
  formatDate,
  getPostCardThumbnailUrl,
  getYouTubeVideoId,
  mapPostRecord,
  POSTS_COLLECTION,
  sortPostsByRecency,
  type PostRecord,
} from "@/lib/content";
import { useFavorites } from "@/hooks/use-favorites";
import { firestore } from "@/lib/firebase";
import {
  DEFAULT_OFFLINE_MESSAGE,
  getActionErrorMessage,
  getRequestErrorMessage,
} from "@/lib/network";
import { useNetworkStatus } from "@/providers/network-provider";
import { useAppTheme } from "@/providers/theme-provider";

const resolvePostId = (value: string | string[] | undefined) =>
  typeof value === "string" ? value : "";
const MIN_LYRICS_FONT_SIZE = 14;
const MAX_LYRICS_FONT_SIZE = 18;
const DEFAULT_LYRICS_FONT_SIZE = 16;
const LYRICS_FONT_STEP = 1;
const SWIPE_DISTANCE_THRESHOLD = 56;
const SWIPE_ACTIVATION_OFFSET = 14;
const SWIPE_VELOCITY_THRESHOLD = 460;
const EDGE_RESISTANCE = 0.24;
const MAX_DRAG_RATIO = 0.72;
const RELEASE_DURATION = 170;
const RESET_SPRING = {
  damping: 24,
  stiffness: 240,
};

type SwipeDirection = "left" | "right";

function clamp(value: number, min: number, max: number) {
  "worklet";
  return Math.min(Math.max(value, min), max);
}

function getSwipeDirection(translationX: number): SwipeDirection | null {
  "worklet";

  if (translationX < 0) {
    return "left";
  }

  if (translationX > 0) {
    return "right";
  }

  return null;
}

function formatCategoryLabel(value: string) {
  return (value.trim() || "general")
    .split(/[\s-]+/)
    .filter(Boolean)
    .map((word) => `${word.charAt(0).toUpperCase()}${word.slice(1)}`)
    .join(" ");
}

type PostDetailsPageProps = {
  interactive: boolean;
  isFavoritePost: boolean;
  lyricsFontSize: number;
  onDecreaseLyricsFontSize: () => void;
  onIncreaseLyricsFontSize: () => void;
  onOpenCategory: (post: PostRecord) => void;
  onOpenInYouTube: (url: string) => Promise<void>;
  onToggleFavorite: (post: PostRecord) => Promise<void>;
  post: PostRecord;
  resolvedTheme: ThemeMode;
  scrollViewRef?: RefObject<ScrollView | null>;
  styles: ReturnType<typeof createStyles>;
  youtubePlayerError?: string;
  onYoutubePlayerError?: (error: string) => void;
};

function PostDetailsPage({
  interactive,
  isFavoritePost,
  lyricsFontSize,
  onDecreaseLyricsFontSize,
  onIncreaseLyricsFontSize,
  onOpenCategory,
  onOpenInYouTube,
  onToggleFavorite,
  post,
  resolvedTheme,
  scrollViewRef,
  styles,
  youtubePlayerError = "",
  onYoutubePlayerError,
}: PostDetailsPageProps) {
  const thumbnailUrl = getPostCardThumbnailUrl(post);
  const updateLabel = formatDate(post.uploadDate || post.createDate);
  const categoryLabel = formatCategoryLabel(post.category);
  const favoriteIconColor = resolvedTheme === "dark" ? "#FFFFFF" : "#111111";
  const favoriteFillColor = resolvedTheme === "dark" ? "#FFFFFF" : "#111111";
  const youtubeVideoId = interactive ? getYouTubeVideoId(post.youtubeVideoUrl) : "";
  const canDecreaseLyricsSize = interactive && lyricsFontSize > MIN_LYRICS_FONT_SIZE;
  const canIncreaseLyricsSize = interactive && lyricsFontSize < MAX_LYRICS_FONT_SIZE;

  return (
    <ScrollView
      ref={scrollViewRef}
      contentContainerStyle={styles.container}
      scrollEnabled={interactive}
      showsVerticalScrollIndicator={false}
    >
      {thumbnailUrl ? (
        <Image source={{ uri: thumbnailUrl }} style={styles.thumbnail} resizeMode="cover" />
      ) : null}

      <Text style={styles.title}>{post.title}</Text>
      <View style={styles.metaRow}>
        <Pressable
          style={({ pressed }) => [
            styles.categoryLink,
            interactive && pressed && styles.categoryLinkPressed,
          ]}
          onPress={() => onOpenCategory(post)}
          accessibilityRole="button"
          accessibilityLabel={`Open ${categoryLabel} posts`}
          disabled={!interactive}
        >
          <Text style={styles.categoryLinkText}>{categoryLabel}</Text>
        </Pressable>
        <Text style={styles.metaSeparator}>·</Text>
        <Text style={styles.meta}>{updateLabel}</Text>
      </View>

      <View style={styles.actionRow}>
        <Pressable
          style={({ pressed }) => [
            styles.favoriteButton,
            interactive && pressed && styles.favoriteButtonPressed,
          ]}
          onPress={() => {
            void onToggleFavorite(post);
          }}
          accessibilityRole="button"
          accessibilityLabel={
            isFavoritePost ? "Remove from favorites" : "Add to favorites"
          }
          disabled={!interactive}
        >
          <FavoriteActionIcon
            size={16}
            color={favoriteIconColor}
            filled={isFavoritePost}
            fillColor={favoriteFillColor}
            accentColor="#111111"
            accentUnderlayColor={resolvedTheme === "dark" ? undefined : "#FFFFFF"}
          />
        </Pressable>

        <View style={styles.fontControlsWrap}>
          <View style={styles.fontControlsActions}>
            <Pressable
              style={({ pressed }) => [
                styles.fontButton,
                interactive && pressed && styles.fontButtonPressed,
                !canDecreaseLyricsSize && styles.fontButtonDisabled,
              ]}
              onPress={onDecreaseLyricsFontSize}
              disabled={!canDecreaseLyricsSize}
            >
              <Text
                style={[
                  styles.fontButtonText,
                  !canDecreaseLyricsSize && styles.fontButtonTextDisabled,
                ]}
              >
                A-
              </Text>
            </Pressable>
            <Text style={styles.fontValue}>{Math.round(lyricsFontSize)}</Text>
            <Pressable
              style={({ pressed }) => [
                styles.fontButton,
                interactive && pressed && styles.fontButtonPressed,
                !canIncreaseLyricsSize && styles.fontButtonDisabled,
              ]}
              onPress={onIncreaseLyricsFontSize}
              disabled={!canIncreaseLyricsSize}
            >
              <Text
                style={[
                  styles.fontButtonText,
                  !canIncreaseLyricsSize && styles.fontButtonTextDisabled,
                ]}
              >
                A+
              </Text>
            </Pressable>
          </View>
        </View>
      </View>

      <Text
        style={[
          styles.content,
          {
            fontSize: lyricsFontSize,
            lineHeight: Math.round(lyricsFontSize * 1.55),
          },
        ]}
      >
        {post.content.trim() || "Lyrics are not available for this post yet."}
      </Text>

      {youtubeVideoId ? (
        <View style={styles.videoCard}>
          <Text style={styles.videoTitle}>Video</Text>
          <View style={styles.videoFrame}>
            <YoutubePlayer
              height={220}
              videoId={youtubeVideoId}
              play={false}
              initialPlayerParams={{ rel: false, modestbranding: true }}
              webViewStyle={styles.video}
              onError={(event: string) => {
                onYoutubePlayerError?.(event || "Playback failed.");
              }}
            />
          </View>

          <View style={styles.videoErrorWrap}>
            {youtubePlayerError ? (
              <Text style={styles.videoErrorText}>Video not playing here.</Text>
            ) : null}
            <Pressable
              style={({ pressed }) => [
                styles.openYoutubeButton,
                interactive && pressed && styles.openYoutubeButtonPressed,
              ]}
              onPress={() => {
                void onOpenInYouTube(post.youtubeVideoUrl);
              }}
            >
              <Text style={styles.openYoutubeButtonText}>Open in YouTube</Text>
            </Pressable>
          </View>
        </View>
      ) : null}
    </ScrollView>
  );
}

export default function PostDetailsScreen() {
  const { colors, resolvedTheme } = useAppTheme();
  const { isConnected, showOfflineToast } = useNetworkStatus();
  const router = useRouter();
  const { width } = useWindowDimensions();
  const { postId: postIdParam } = useLocalSearchParams<{ postId?: string }>();
  const { isFavorite, toggleFavorite } = useFavorites();
  const styles = createStyles(colors, resolvedTheme);

  const routePostId = resolvePostId(postIdParam);
  const scrollViewRef = useRef<ScrollView | null>(null);
  const [activePostId, setActivePostId] = useState(routePostId);
  const [post, setPost] = useState<PostRecord | null>(null);
  const [categoryPosts, setCategoryPosts] = useState<PostRecord[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");
  const [youtubePlayerError, setYoutubePlayerError] = useState("");
  const [lyricsFontSize, setLyricsFontSize] = useState(DEFAULT_LYRICS_FONT_SIZE);
  const translateX = useSharedValue(0);
  const isSwipeNavigating = useSharedValue(false);
  const previewDirectionValue = useSharedValue(0);
  const [previewDirection, setPreviewDirection] = useState<SwipeDirection | null>(null);

  useEffect(() => {
    translateX.value = 0;
    isSwipeNavigating.value = false;
    previewDirectionValue.value = 0;
    setPreviewDirection(null);
  }, [activePostId, isSwipeNavigating, previewDirectionValue, translateX]);

  useEffect(() => {
    if (!routePostId || routePostId === activePostId) {
      return;
    }

    setActivePostId(routePostId);
  }, [activePostId, routePostId]);

  const cachedActivePost = useMemo(() => {
    const categoryPostMatch =
      categoryPosts.find((item) => item.id === activePostId) ?? null;

    if (categoryPostMatch) {
      return categoryPostMatch;
    }

    return post?.id === activePostId ? post : null;
  }, [activePostId, categoryPosts, post]);

  useEffect(() => {
    if (!activePostId) {
      setError("Post not found.");
      setPost(null);
      setIsLoading(false);
      return;
    }

    if (cachedActivePost) {
      setYoutubePlayerError("");
      setPost(cachedActivePost);
      setError("");
      setIsLoading(false);
    } else {
      setIsLoading(true);
    }

    const postRef = doc(firestore, POSTS_COLLECTION, activePostId);
    const unsubscribe = onSnapshot(
      postRef,
      (snapshot) => {
        if (!snapshot.exists()) {
          setError("Post not found.");
          setPost(null);
          setIsLoading(false);
          return;
        }

        const nextPost = mapPostRecord(snapshot.id, snapshot.data() as DocumentData);
        if (nextPost.status !== "published") {
          setError("Post is not published.");
          setPost(null);
          setIsLoading(false);
          return;
        }

        setYoutubePlayerError("");
        setPost(nextPost);
        setError("");
        setIsLoading(false);
      },
      (snapshotError) => {
        setError(
          getRequestErrorMessage({
            error: snapshotError,
            isConnected,
            onlineMessage: "Unable to load post details.",
          }),
        );
        setPost(null);
        setIsLoading(false);
      },
    );

    return unsubscribe;
  }, [activePostId, cachedActivePost, isConnected]);

  useEffect(() => {
    const categoryKey = post?.category.trim() || "";
    if (!categoryKey) {
      setCategoryPosts([]);
      return;
    }

    const categoryPostsQuery = query(
      collection(firestore, POSTS_COLLECTION),
      where("category", "==", categoryKey),
    );

    const unsubscribe = onSnapshot(
      categoryPostsQuery,
      (snapshot) => {
        const nextCategoryPosts = sortPostsByRecency(
          snapshot.docs
            .map((item) => mapPostRecord(item.id, item.data() as DocumentData))
            .filter((item) => item.status === "published"),
        );
        setCategoryPosts(nextCategoryPosts);
      },
      () => {
        setCategoryPosts([]);
      },
    );

    return unsubscribe;
  }, [post?.category]);

  const handleToggleFavorite = async (targetPost: PostRecord) => {
    try {
      await toggleFavorite(targetPost);
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

      Alert.alert(
        "Unable to update favorites",
        message,
      );
    }
  };

  const handleOpenInYouTube = async (url: string) => {
    if (!isConnected) {
      showOfflineToast();
      return;
    }

    await Linking.openURL(url).catch(() => {
      Alert.alert("YouTube unavailable", "Unable to open YouTube right now.");
    });
  };

  const handleOpenCategory = (targetPost: PostRecord) => {
    const categorySlug = createSlug(targetPost.category);
    if (!categorySlug) {
      return;
    }

    router.push({
      pathname: "/category/[categorySlug]",
      params: { categorySlug },
    });
  };

  const handleDecreaseLyricsFontSize = () => {
    setLyricsFontSize((value) => Math.max(MIN_LYRICS_FONT_SIZE, value - LYRICS_FONT_STEP));
  };

  const handleIncreaseLyricsFontSize = () => {
    setLyricsFontSize((value) => Math.min(MAX_LYRICS_FONT_SIZE, value + LYRICS_FONT_STEP));
  };

  const currentPostIndex = useMemo(() => {
    if (!post) {
      return -1;
    }

    return categoryPosts.findIndex((item) => item.id === post.id);
  }, [categoryPosts, post]);

  const previousCategoryPost = useMemo(() => {
    if (currentPostIndex <= 0) {
      return null;
    }

    return categoryPosts[currentPostIndex - 1] ?? null;
  }, [categoryPosts, currentPostIndex]);

  const nextCategoryPost = useMemo(() => {
    if (currentPostIndex < 0 || currentPostIndex >= categoryPosts.length - 1) {
      return null;
    }

    return categoryPosts[currentPostIndex + 1] ?? null;
  }, [categoryPosts, currentPostIndex]);

  const currentPostId = post?.id ?? activePostId;
  const previousCategoryPostId = previousCategoryPost?.id ?? "";
  const nextCategoryPostId = nextCategoryPost?.id ?? "";
  const setActivePreview = (direction: SwipeDirection | null) => {
    setPreviewDirection((currentDirection) =>
      currentDirection === direction ? currentDirection : direction,
    );
  };
  const clearActivePreview = () => {
    setPreviewDirection(null);
  };
  const resetToCurrentPost = () => {
    "worklet";

    translateX.value = withSpring(0, RESET_SPRING, (finished) => {
      if (!finished) {
        return;
      }

      previewDirectionValue.value = 0;
      runOnJS(clearActivePreview)();
    });
  };
  const commitAdjacentPost = (targetPostId: string) => {
    const targetPost =
      categoryPosts.find((item) => item.id === targetPostId) ?? null;

    setActivePostId(targetPostId);
    setYoutubePlayerError("");
    setError("");
    setIsLoading(false);

    if (targetPost) {
      setPost(targetPost);
    }

    scrollViewRef.current?.scrollTo({ y: 0, animated: false });
    translateX.value = 0;
    previewDirectionValue.value = 0;
    setPreviewDirection(null);
    isSwipeNavigating.value = false;

    router.replace({
      pathname: "/post/[postId]",
      params: { postId: targetPostId },
    });
  };

  const panGesture = Gesture.Pan()
    .activeOffsetX([-SWIPE_ACTIVATION_OFFSET, SWIPE_ACTIVATION_OFFSET])
    .failOffsetY([-12, 12])
    .onBegin(() => {
      cancelAnimation(translateX);
    })
    .onUpdate((event) => {
      if (isSwipeNavigating.value) {
        return;
      }

      const direction = getSwipeDirection(event.translationX);
      const targetPostId =
        direction === "left" ? nextCategoryPostId : previousCategoryPostId;
      const hasAdjacentPost = Boolean(targetPostId) && targetPostId !== currentPostId;
      const safeWidth = Math.max(width, 1);
      const dampenedOffset = hasAdjacentPost
        ? event.translationX
        : event.translationX * EDGE_RESISTANCE;
      const maxOffset =
        safeWidth * (hasAdjacentPost ? MAX_DRAG_RATIO : EDGE_RESISTANCE);
      const nextPreviewDirection = hasAdjacentPost ? direction : null;
      const nextPreviewDirectionValue =
        nextPreviewDirection === "left" ? 1 : nextPreviewDirection === "right" ? 2 : 0;

      if (previewDirectionValue.value !== nextPreviewDirectionValue) {
        previewDirectionValue.value = nextPreviewDirectionValue;
        runOnJS(setActivePreview)(nextPreviewDirection);
      }

      translateX.value = clamp(dampenedOffset, -maxOffset, maxOffset);
    })
    .onEnd((event) => {
      if (isSwipeNavigating.value) {
        return;
      }

      const direction = getSwipeDirection(event.translationX);
      const targetPostId =
        direction === "left" ? nextCategoryPostId : previousCategoryPostId;
      const hasAdjacentPost = Boolean(targetPostId) && targetPostId !== currentPostId;
      const safeWidth = Math.max(width, 1);
      const passedThreshold =
        Math.abs(event.translationX) >= SWIPE_DISTANCE_THRESHOLD ||
        Math.abs(event.velocityX) >= SWIPE_VELOCITY_THRESHOLD;

      if (!direction || !targetPostId || !hasAdjacentPost || !passedThreshold) {
        resetToCurrentPost();
        return;
      }

      isSwipeNavigating.value = true;
      translateX.value = withTiming(
        direction === "left" ? -safeWidth : safeWidth,
        { duration: RELEASE_DURATION },
        (finished) => {
          if (!finished) {
            translateX.value = 0;
            isSwipeNavigating.value = false;
            previewDirectionValue.value = 0;
            runOnJS(clearActivePreview)();
            return;
          }

          runOnJS(commitAdjacentPost)(targetPostId);
        },
      );
    })
    .onFinalize(() => {
      if (isSwipeNavigating.value) {
        return;
      }

      if (translateX.value !== 0) {
        resetToCurrentPost();
        return;
      }

      if (previewDirectionValue.value !== 0) {
        previewDirectionValue.value = 0;
        runOnJS(clearActivePreview)();
      }
    });

  const currentPageStyle = useAnimatedStyle(() => {
    const safeWidth = Math.max(width, 1);
    const distance = Math.abs(translateX.value);

    return {
      opacity: interpolate(distance, [0, safeWidth], [1, 0.92], Extrapolation.CLAMP),
      transform: [
        { translateX: translateX.value },
        {
          scale: interpolate(
            distance,
            [0, safeWidth],
            [1, 0.992],
            Extrapolation.CLAMP,
          ),
        },
      ],
    };
  });

  const previousPageStyle = useAnimatedStyle(() => ({
    opacity: previousCategoryPost
      ? interpolate(translateX.value, [0, width * 0.25, width], [0.18, 0.75, 1], Extrapolation.CLAMP)
      : 0,
    transform: [{ translateX: -width + translateX.value }],
  }));

  const nextPageStyle = useAnimatedStyle(() => ({
    opacity: nextCategoryPost
      ? interpolate(-translateX.value, [0, width * 0.25, width], [0.18, 0.75, 1], Extrapolation.CLAMP)
      : 0,
    transform: [{ translateX: width + translateX.value }],
  }));

  if (isLoading) {
    return (
      <View style={styles.screen}>
        <Stack.Screen options={{ title: "Post Details", animation: "none" }} />
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      </View>
    );
  }

  if (error || !post) {
    return (
      <View style={styles.screen}>
        <Stack.Screen options={{ title: "Post Details", animation: "none" }} />
        <View style={styles.errorContainer}>
          <Text style={styles.errorTitle}>{error || "Post not available."}</Text>
          <Pressable
            style={({ pressed }) => [styles.backButton, pressed && styles.backButtonPressed]}
            onPress={() => router.back()}
          >
            <Text style={styles.backButtonText}>Go Back</Text>
          </Pressable>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.screen}>
      <Stack.Screen options={{ title: "Post Details", animation: "none" }} />
      {previewDirection === "right" && previousCategoryPost ? (
        <Animated.View pointerEvents="none" style={[styles.page, previousPageStyle]}>
          <PostDetailsPage
            interactive={false}
            isFavoritePost={isFavorite(previousCategoryPost.id)}
            lyricsFontSize={lyricsFontSize}
            onDecreaseLyricsFontSize={handleDecreaseLyricsFontSize}
            onIncreaseLyricsFontSize={handleIncreaseLyricsFontSize}
            onOpenCategory={handleOpenCategory}
            onOpenInYouTube={handleOpenInYouTube}
            onToggleFavorite={handleToggleFavorite}
            post={previousCategoryPost}
            resolvedTheme={resolvedTheme}
            styles={styles}
          />
        </Animated.View>
      ) : null}

      {previewDirection === "left" && nextCategoryPost ? (
        <Animated.View pointerEvents="none" style={[styles.page, nextPageStyle]}>
          <PostDetailsPage
            interactive={false}
            isFavoritePost={isFavorite(nextCategoryPost.id)}
            lyricsFontSize={lyricsFontSize}
            onDecreaseLyricsFontSize={handleDecreaseLyricsFontSize}
            onIncreaseLyricsFontSize={handleIncreaseLyricsFontSize}
            onOpenCategory={handleOpenCategory}
            onOpenInYouTube={handleOpenInYouTube}
            onToggleFavorite={handleToggleFavorite}
            post={nextCategoryPost}
            resolvedTheme={resolvedTheme}
            styles={styles}
          />
        </Animated.View>
      ) : null}

      <GestureDetector gesture={panGesture}>
        <Animated.View style={[styles.page, currentPageStyle]}>
          <PostDetailsPage
            interactive
            isFavoritePost={isFavorite(post.id)}
            lyricsFontSize={lyricsFontSize}
            onDecreaseLyricsFontSize={handleDecreaseLyricsFontSize}
            onIncreaseLyricsFontSize={handleIncreaseLyricsFontSize}
            onOpenCategory={handleOpenCategory}
            onOpenInYouTube={handleOpenInYouTube}
            onToggleFavorite={handleToggleFavorite}
            post={post}
            resolvedTheme={resolvedTheme}
            scrollViewRef={scrollViewRef}
            styles={styles}
            youtubePlayerError={youtubePlayerError}
            onYoutubePlayerError={setYoutubePlayerError}
          />
        </Animated.View>
      </GestureDetector>
    </View>
  );
}

const createStyles = (colors: ThemeColors, resolvedTheme: ThemeMode) => StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.background,
    overflow: "hidden",
  },
  loadingContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.background,
  },
  errorContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.background,
    padding: SPACING.xl,
    gap: SPACING.md,
  },
  errorTitle: {
    fontSize: FONT_SIZE.body,
    color: colors.danger,
    fontWeight: "600",
    textAlign: "center",
  },
  backButton: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: RADIUS.md,
    backgroundColor: colors.surfaceMuted,
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.sm,
  },
  backButtonPressed: {
    opacity: 0.85,
  },
  backButtonText: {
    color: colors.text,
    fontWeight: "600",
  },
  container: {
    padding: SPACING.xl,
    paddingBottom: SPACING.xxl * 2,
    gap: SPACING.md,
    backgroundColor: colors.background,
  },
  page: {
    ...StyleSheet.absoluteFillObject,
  },
  thumbnail: {
    width: "100%",
    aspectRatio: 16 / 9,
    borderRadius: 4,
    overflow: "hidden",
    backgroundColor: colors.surfaceSoft,
  },
  title: {
    fontSize: 22,
    fontWeight: "700",
    color: colors.text,
    lineHeight: 30,
  },
  meta: {
    color: colors.mutedText,
    fontSize: 12,
  },
  metaRow: {
    flexDirection: "row",
    alignItems: "center",
    flexWrap: "wrap",
    gap: SPACING.xs,
  },
  metaSeparator: {
    color: colors.mutedText,
    fontSize: 12,
  },
  categoryLink: {
    borderRadius: RADIUS.pill,
  },
  categoryLinkPressed: {
    opacity: 0.7,
  },
  categoryLinkText: {
    color: colors.accent,
    fontSize: 12,
    fontWeight: "700",
  },
  actionRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: SPACING.sm,
    flexWrap: "wrap",
  },
  favoriteButton: {
    alignSelf: "flex-start",
    alignItems: "center",
    justifyContent: "center",
    width: 30,
    height: 28,
    borderRadius: 10,
    backgroundColor: resolvedTheme === "dark" ? "#2D2D30" : "#FFFFFF",
    ...SHADOWS.lg,
  },
  favoriteButtonPressed: {
    opacity: 0.85,
  },
  fontControlsWrap: {
    marginLeft: "auto",
    alignItems: "flex-end",
  },
  fontControlsActions: {
    flexDirection: "row",
    alignItems: "center",
    gap: SPACING.xs,
    paddingHorizontal: SPACING.xs,
    paddingVertical: 2,
  },
  fontButton: {
    minWidth: 30,
    minHeight: 28,
    paddingHorizontal: SPACING.xs,
    alignItems: "center",
    justifyContent: "center",
  },
  fontButtonPressed: {
    opacity: 0.7,
  },
  fontButtonDisabled: {
    opacity: 0.35,
  },
  fontButtonText: {
    color: colors.text,
    fontSize: 16,
    fontWeight: "700",
  },
  fontButtonTextDisabled: {
    color: colors.mutedText,
  },
  fontValue: {
    minWidth: 24,
    textAlign: "center",
    color: colors.text,
    fontSize: 13,
    fontWeight: "700",
  },
  content: {
    color: colors.text,
    paddingHorizontal: SPACING.sm,
    paddingVertical: SPACING.xs,
  },
  videoCard: {
    borderRadius: RADIUS.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    padding: SPACING.md,
    gap: SPACING.sm,
  },
  videoTitle: {
    color: colors.text,
    fontSize: 16,
    fontWeight: "700",
  },
  videoFrame: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: RADIUS.lg,
    backgroundColor: colors.surface,
    overflow: "hidden",
    width: "100%",
    aspectRatio: 16 / 9,
  },
  video: {
    flex: 1,
    backgroundColor: "#000000",
  },
  videoErrorWrap: {
    marginTop: SPACING.xs,
    gap: SPACING.xs,
  },
  videoErrorText: {
    color: colors.mutedText,
    fontSize: 12,
  },
  openYoutubeButton: {
    alignSelf: "flex-start",
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 999,
    backgroundColor: colors.surfaceMuted,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
  },
  openYoutubeButtonPressed: {
    opacity: 0.85,
  },
  openYoutubeButtonText: {
    color: colors.text,
    fontSize: 12,
    fontWeight: "700",
  },
});
