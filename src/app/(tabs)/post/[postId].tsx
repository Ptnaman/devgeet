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
  getFavoriteActionPalette,
  type ThemeColors,
  type ThemeMode,
} from "@/constants/theme";
import { FavoriteActionIcon } from "@/components/icons/favorite-action-icon";
import {
  createSlug,
  formatDate,
  getPostCardThumbnailUrl,
  getYouTubeVideoId,
  isPostTrashed,
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
  onOpenAuthor: (post: PostRecord) => void;
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
  onOpenAuthor,
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
  const favoritePalette = getFavoriteActionPalette(resolvedTheme);
  const youtubeVideoId = interactive ? getYouTubeVideoId(post.youtubeVideoUrl) : "";
  const canDecreaseLyricsSize = interactive && lyricsFontSize > MIN_LYRICS_FONT_SIZE;
  const canIncreaseLyricsSize = interactive && lyricsFontSize < MAX_LYRICS_FONT_SIZE;
  const authorLabel = post.authorDisplayName || "Community Author";
  const authorSubtitle = post.authorUsername
    ? `@${post.authorUsername}`
    : post.createdByEmail || "View public profile";

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
        <View style={styles.metaFontControlsWrap}>
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

      {post.authorId || post.createdBy ? (
        <Pressable
          style={({ pressed }) => [
            styles.authorCard,
            interactive && pressed && styles.authorCardPressed,
          ]}
          onPress={() => onOpenAuthor(post)}
          disabled={!interactive}
        >
          {post.authorPhotoURL ? (
            <Image source={{ uri: post.authorPhotoURL }} style={styles.authorAvatar} />
          ) : (
            <View style={[styles.authorAvatar, styles.authorAvatarFallback]}>
              <Text style={styles.authorAvatarText}>
                {authorLabel.charAt(0).toUpperCase()}
              </Text>
            </View>
          )}

          <View style={styles.authorTextWrap}>
            <Text style={styles.authorLabel}>Published by</Text>
            <Text style={styles.authorName} numberOfLines={1}>
              {authorLabel}
            </Text>
            <Text style={styles.authorSubtitle} numberOfLines={1}>
              {authorSubtitle}
            </Text>
          </View>

          <Pressable
            style={({ pressed }) => [
              styles.favoriteButton,
              styles.authorFavoriteButton,
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
              color={favoritePalette.color}
              filled={isFavoritePost}
              fillColor={favoritePalette.fillColor}
              accentColor={favoritePalette.accentColor}
              accentUnderlayColor={favoritePalette.accentUnderlayColor}
            />
          </Pressable>
        </Pressable>
      ) : null}

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
  const styles = createStyles(colors);

  const routePostId = resolvePostId(postIdParam);
  const scrollViewRef = useRef<ScrollView | null>(null);
  const pendingRoutePostIdRef = useRef<string | null>(null);
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
  const [settlingPreviewPost, setSettlingPreviewPost] = useState<PostRecord | null>(null);

  useEffect(() => {
    translateX.value = 0;
    previewDirectionValue.value = 0;
  }, [previewDirectionValue, translateX, width]);

  useEffect(() => {
    const pendingRoutePostId = pendingRoutePostIdRef.current;

    if (!routePostId) {
      pendingRoutePostIdRef.current = null;
      return;
    }

    if (pendingRoutePostId) {
      if (routePostId === pendingRoutePostId) {
        pendingRoutePostIdRef.current = null;
      }
      return;
    }

    if (routePostId === activePostId) {
      return;
    }

    setActivePostId(routePostId);
  }, [activePostId, routePostId]);

  useEffect(() => {
    if (!settlingPreviewPost) {
      return;
    }

    const targetPostId = settlingPreviewPost.id;
    if (post?.id !== targetPostId || routePostId !== targetPostId) {
      return;
    }

    let nestedFrame: number | null = null;
    const frame = requestAnimationFrame(() => {
      nestedFrame = requestAnimationFrame(() => {
        setSettlingPreviewPost(null);
        setPreviewDirection(null);
        isSwipeNavigating.value = false;
      });
    });

    return () => {
      cancelAnimationFrame(frame);

      if (nestedFrame !== null) {
        cancelAnimationFrame(nestedFrame);
      }
    };
  }, [isSwipeNavigating, post?.id, routePostId, settlingPreviewPost]);

  const activeCategoryPost = useMemo(
    () => categoryPosts.find((item) => item.id === activePostId) ?? null,
    [activePostId, categoryPosts],
  );

  useEffect(() => {
    if (!activePostId) {
      setError("Post not found.");
      setPost(null);
      setIsLoading(false);
      return;
    }

    if (activeCategoryPost) {
      setYoutubePlayerError("");
      setPost((currentPost) =>
        currentPost?.id === activeCategoryPost.id ? currentPost : activeCategoryPost,
      );
      setError("");
      setIsLoading(false);
      return;
    }

    if (post?.id !== activePostId) {
      setIsLoading(true);
    }
  }, [activeCategoryPost, activePostId, post?.id]);

  useEffect(() => {
    if (!activePostId) {
      return;
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
        if (nextPost.status !== "published" || isPostTrashed(nextPost)) {
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
  }, [activePostId, isConnected]);

  useEffect(() => {
    const categoryKey = post?.category.trim() || "";
    if (!categoryKey) {
      setCategoryPosts([]);
      return;
    }

    const categoryPostsQuery = query(
      collection(firestore, POSTS_COLLECTION),
      where("category", "==", categoryKey),
      where("status", "==", "published"),
    );

    const unsubscribe = onSnapshot(
      categoryPostsQuery,
      (snapshot) => {
        const nextCategoryPosts = sortPostsByRecency(
          snapshot.docs
            .map((item) => mapPostRecord(item.id, item.data() as DocumentData))
            .filter((item) => item.status === "published" && !isPostTrashed(item)),
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

  const handleOpenAuthor = (targetPost: PostRecord) => {
    const authorId = targetPost.authorId || targetPost.createdBy;

    if (!authorId) {
      return;
    }

    router.push({
      pathname: "/author/[authorId]",
      params: { authorId },
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
  const canSwipeToPreviousPost = Boolean(previousCategoryPostId) && previousCategoryPostId !== currentPostId;
  const canSwipeToNextPost = Boolean(nextCategoryPostId) && nextCategoryPostId !== currentPostId;
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

    pendingRoutePostIdRef.current = targetPostId;
    setSettlingPreviewPost(targetPost);
    setActivePostId(targetPostId);
    setYoutubePlayerError("");
    setError("");
    setIsLoading(false);

    if (targetPost) {
      setPost(targetPost);
    }

    scrollViewRef.current?.scrollTo({ y: 0, animated: false });
    router.setParams({ postId: targetPostId });
    requestAnimationFrame(() => {
      translateX.value = 0;
      previewDirectionValue.value = 0;
      setPreviewDirection(null);

      if (!targetPost) {
        isSwipeNavigating.value = false;
      }
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
      opacity: interpolate(distance, [0, safeWidth], [1, 0.94], Extrapolation.CLAMP),
      transform: [
        { translateX: translateX.value },
        {
          scale: interpolate(distance, [0, safeWidth], [1, 0.992], Extrapolation.CLAMP),
        },
      ],
    };
  });

  const previousPageStyle = useAnimatedStyle(() => ({
    opacity: canSwipeToPreviousPost
      ? interpolate(translateX.value, [0, width * 0.25, width], [0.18, 0.75, 1], Extrapolation.CLAMP)
      : 0,
    transform: [{ translateX: -width + translateX.value }],
  }));

  const nextPageStyle = useAnimatedStyle(() => ({
    opacity: canSwipeToNextPost
      ? interpolate(-translateX.value, [0, width * 0.25, width], [0.18, 0.75, 1], Extrapolation.CLAMP)
      : 0,
    transform: [{ translateX: width + translateX.value }],
  }));

  if (isLoading) {
    return (
      <View style={styles.screen}>
        <Stack.Screen
          options={{
            title: "Post Details",
            animation: "none",
            headerStyle: {
              backgroundColor: "#FFFFFF",
            },
          }}
        />
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      </View>
    );
  }

  if (error || !post) {
    return (
      <View style={styles.screen}>
        <Stack.Screen
          options={{
            title: "Post Details",
            animation: "none",
            headerStyle: {
              backgroundColor: "#FFFFFF",
            },
          }}
        />
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
      <Stack.Screen
        options={{
          title: "Post Details",
          animation: "none",
          headerStyle: {
            backgroundColor: "#FFFFFF",
          },
        }}
      />
      {previewDirection === "right" && canSwipeToPreviousPost ? (
        <Animated.View pointerEvents="none" style={[styles.page, styles.pageCard, previousPageStyle]}>
          <PostDetailsPage
            interactive={false}
            isFavoritePost={isFavorite(previousCategoryPostId)}
            lyricsFontSize={lyricsFontSize}
            onDecreaseLyricsFontSize={handleDecreaseLyricsFontSize}
            onIncreaseLyricsFontSize={handleIncreaseLyricsFontSize}
            onOpenCategory={handleOpenCategory}
            onOpenAuthor={handleOpenAuthor}
            onOpenInYouTube={handleOpenInYouTube}
            onToggleFavorite={handleToggleFavorite}
            post={previousCategoryPost as PostRecord}
            resolvedTheme={resolvedTheme}
            styles={styles}
          />
        </Animated.View>
      ) : null}

      {previewDirection === "left" && canSwipeToNextPost ? (
        <Animated.View pointerEvents="none" style={[styles.page, styles.pageCard, nextPageStyle]}>
          <PostDetailsPage
            interactive={false}
            isFavoritePost={isFavorite(nextCategoryPostId)}
            lyricsFontSize={lyricsFontSize}
            onDecreaseLyricsFontSize={handleDecreaseLyricsFontSize}
            onIncreaseLyricsFontSize={handleIncreaseLyricsFontSize}
            onOpenCategory={handleOpenCategory}
            onOpenAuthor={handleOpenAuthor}
            onOpenInYouTube={handleOpenInYouTube}
            onToggleFavorite={handleToggleFavorite}
            post={nextCategoryPost as PostRecord}
            resolvedTheme={resolvedTheme}
            styles={styles}
          />
        </Animated.View>
      ) : null}

      <GestureDetector gesture={panGesture}>
        <Animated.View style={[styles.page, styles.pageCard, currentPageStyle]}>
          <PostDetailsPage
            interactive
            isFavoritePost={isFavorite(post.id)}
            lyricsFontSize={lyricsFontSize}
            onDecreaseLyricsFontSize={handleDecreaseLyricsFontSize}
            onIncreaseLyricsFontSize={handleIncreaseLyricsFontSize}
            onOpenCategory={handleOpenCategory}
            onOpenAuthor={handleOpenAuthor}
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

      {settlingPreviewPost ? (
        <View pointerEvents="none" style={[styles.page, styles.pageCard]}>
          <PostDetailsPage
            interactive={false}
            isFavoritePost={isFavorite(settlingPreviewPost.id)}
            lyricsFontSize={lyricsFontSize}
            onDecreaseLyricsFontSize={handleDecreaseLyricsFontSize}
            onIncreaseLyricsFontSize={handleIncreaseLyricsFontSize}
            onOpenCategory={handleOpenCategory}
            onOpenAuthor={handleOpenAuthor}
            onOpenInYouTube={handleOpenInYouTube}
            onToggleFavorite={handleToggleFavorite}
            post={settlingPreviewPost}
            resolvedTheme={resolvedTheme}
            styles={styles}
          />
        </View>
      ) : null}
    </View>
  );
}

const createStyles = (colors: ThemeColors) => StyleSheet.create({
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
    borderColor: colors.inputBorderHover,
    borderRadius: RADIUS.md,
    backgroundColor: "#FFFFFF",
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.sm,
    ...SHADOWS.sm,
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
  pageCard: {
    backgroundColor: colors.background,
    overflow: "hidden",
    ...SHADOWS.md,
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
  authorCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: SPACING.sm,
    borderRadius: RADIUS.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surfaceMuted,
    padding: SPACING.md,
    ...SHADOWS.lg,
  },
  authorCardPressed: {
    opacity: 0.9,
  },
  authorAvatar: {
    width: 48,
    height: 48,
    borderRadius: 999,
    backgroundColor: colors.surfaceSoft,
  },
  authorAvatarFallback: {
    alignItems: "center",
    justifyContent: "center",
  },
  authorAvatarText: {
    color: colors.text,
    fontSize: 18,
    fontWeight: "700",
  },
  authorTextWrap: {
    flex: 1,
    gap: 2,
  },
  authorLabel: {
    color: colors.mutedText,
    fontSize: 11,
    fontWeight: "700",
    textTransform: "uppercase",
    letterSpacing: 0.4,
  },
  authorName: {
    color: colors.text,
    fontSize: 15,
    fontWeight: "700",
  },
  authorSubtitle: {
    color: colors.mutedText,
    fontSize: 12,
  },
  favoriteButton: {
    alignSelf: "flex-start",
    alignItems: "center",
    justifyContent: "center",
    width: 30,
    height: 28,
    borderRadius: 10,
    backgroundColor: colors.favoriteSurface,
    ...SHADOWS.lg,
    shadowColor: "#00000040",
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.18,
    shadowRadius: 22,
    elevation: 12,
  },
  favoriteButtonPressed: {
    opacity: 0.85,
  },
  authorFavoriteButton: {
    marginLeft: SPACING.xs,
    alignSelf: "center",
    flexShrink: 0,
  },
  metaFontControlsWrap: {
    marginLeft: "auto",
    alignItems: "center",
    justifyContent: "center",
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
    ...SHADOWS.lg,
    shadowColor: "#00000036",
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.14,
    shadowRadius: 26,
    elevation: 10,
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
    ...SHADOWS.sm,
    shadowColor: "#00000030",
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.12,
    shadowRadius: 18,
    elevation: 8,
  },
  video: {
    flex: 1,
    backgroundColor: colors.mediaSurface,
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
