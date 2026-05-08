import { useCallback, useEffect, useMemo, useRef, useState, type RefObject } from "react";
import { Image } from "expo-image";
import {
  ActivityIndicator,
  Animated as RNAnimated,
  Alert,
  Easing,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from "react-native";
import { Stack, useLocalSearchParams, useRouter } from "expo-router";
import { useKeepAwake } from "expo-keep-awake";
import {
  collection,
  documentId,
  doc,
  getDocs,
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

import { VerifiedRoleBadge } from "@/components/verified-role-badge";
import {
  FONT_SIZE,
  RADIUS,
  SHADOWS,
  SPACING,
  type ThemeColors,
} from "@/constants/theme";
import { ArrowRightIcon } from "@/components/icons/arrow-right-icon";
import { BookmarkMenuIcon } from "@/components/icons/bookmark-menu-icon";
import { MoreVerticalIcon } from "@/components/icons/more-vertical-icon";
import { getEffectiveUserRole, type UserRole } from "@/lib/access";
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
import { useAuth } from "@/providers/auth-provider";
import { useLyricsReaderPreferences } from "@/providers/lyrics-reader-preferences-provider";
import { useMainTabData } from "@/providers/main-tab-data-provider";
import { useNetworkStatus } from "@/providers/network-provider";
import { useAppTheme } from "@/providers/theme-provider";

const resolvePostId = (value: string | string[] | undefined) =>
  typeof value === "string" ? value : "";
const resolveCategorySlug = (value: string | string[] | undefined) =>
  typeof value === "string" ? createSlug(value) : "";
const resolveSwipeAuthorId = (value: string | string[] | undefined) =>
  typeof value === "string" ? value.trim() : "";
const USERS_COLLECTION = "users";
const MIN_LYRICS_FONT_SIZE = 14;
const MAX_LYRICS_FONT_SIZE = 18;
const DEFAULT_LYRICS_FONT_SIZE = 16;
const LYRICS_FONT_STEP = 1;
const SWIPE_DISTANCE_THRESHOLD = 56;
const SWIPE_ACTIVATION_OFFSET = 14;
const SWIPE_VELOCITY_THRESHOLD = 460;
const AUTHOR_CARD_NAME_MAX_LENGTH = 18;
const EDGE_RESISTANCE = 0.24;
const MAX_DRAG_RATIO = 0.72;
const RELEASE_DURATION = 170;
const RESET_SPRING = {
  damping: 24,
  stiffness: 240,
};
const LYRICS_KEEP_AWAKE_TAG = "lyrics-reader-screen";
const FAVORITE_SWIPE_FETCH_BATCH_SIZE = 10;
const AUTHOR_ROLE_FETCH_CHUNK_SIZE = 10;
const BOOKMARK_PROMPT_HIDDEN_OFFSET = 46;
const BOOKMARK_PROMPT_SHOW_DURATION_MS = 260;
const BOOKMARK_PROMPT_HIDE_DURATION_MS = 220;
const POST_DETAILS_HEADER_TITLE = "Lyrics";
const authorRoleCache = new Map<string, UserRole>();

type SwipeDirection = "left" | "right";
type SwipeSource = "author" | "category" | "favorite";
type BookmarkPromptMode = "added" | "removed";

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

function LyricsReaderKeepAwake() {
  useKeepAwake(LYRICS_KEEP_AWAKE_TAG, {
    suppressDeactivateWarnings: true,
  });

  return null;
}

function getAuthorCardName(value: string) {
  const normalizedValue = value.trim();
  if (!normalizedValue) {
    return "Community Author";
  }

  if (normalizedValue.length <= AUTHOR_CARD_NAME_MAX_LENGTH) {
    return normalizedValue;
  }

  const [firstName] = normalizedValue.split(/\s+/);
  return firstName || normalizedValue;
}

function resolveSwipeSource(value: string | string[] | undefined): SwipeSource | null {
  if (value === "author" || value === "category" || value === "favorite") {
    return value;
  }

  return null;
}

function resolveSwipePostIds(value: string | string[] | undefined) {
  if (typeof value !== "string") {
    return [];
  }

  return value
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

function isSwipeEligiblePost(post: PostRecord) {
  return post.status === "published" && !isPostTrashed(post);
}

function getPostAuthorUserId(
  post: Pick<PostRecord, "authorId" | "createdBy"> | null,
) {
  return post?.authorId || post?.createdBy || "";
}

function resolvePostAuthorRole(
  post: Pick<PostRecord, "authorId" | "authorRole" | "createdBy" | "hasAuthorRole"> | null,
  authorRolesByUserId: Record<string, UserRole>,
): UserRole {
  if (!post) {
    return "user";
  }

  if (post.hasAuthorRole) {
    return post.authorRole;
  }

  const authorUserId = getPostAuthorUserId(post);
  if (!authorUserId) {
    return "user";
  }

  return authorRolesByUserId[authorUserId] || authorRoleCache.get(authorUserId) || "user";
}

function chunkPostIds(ids: string[], chunkSize: number) {
  const chunks: string[][] = [];

  for (let index = 0; index < ids.length; index += chunkSize) {
    chunks.push(ids.slice(index, index + chunkSize));
  }

  return chunks;
}

function useResolvedAuthorRoles(
  posts: (
    Pick<PostRecord, "authorId" | "authorRole" | "createdBy" | "hasAuthorRole">
    | null
  )[],
) {
  const [authorRolesByUserId, setAuthorRolesByUserId] = useState<Record<string, UserRole>>({});

  useEffect(() => {
    const immediateRoles: Record<string, UserRole> = {};
    const missingAuthorIds = new Set<string>();

    posts.forEach((post) => {
      if (!post) {
        return;
      }

      const authorUserId = getPostAuthorUserId(post);
      if (!authorUserId) {
        return;
      }

      if (post.hasAuthorRole) {
        authorRoleCache.set(authorUserId, post.authorRole);
        immediateRoles[authorUserId] = post.authorRole;
        return;
      }

      const cachedRole = authorRoleCache.get(authorUserId);
      if (cachedRole) {
        immediateRoles[authorUserId] = cachedRole;
        return;
      }

      missingAuthorIds.add(authorUserId);
    });

    if (Object.keys(immediateRoles).length) {
      setAuthorRolesByUserId((current) => {
        let changed = false;
        const nextState = { ...current };

        Object.entries(immediateRoles).forEach(([authorUserId, role]) => {
          if (nextState[authorUserId] === role) {
            return;
          }

          nextState[authorUserId] = role;
          changed = true;
        });

        return changed ? nextState : current;
      });
    }

    if (!missingAuthorIds.size) {
      return;
    }

    const chunks = chunkPostIds(
      Array.from(missingAuthorIds),
      AUTHOR_ROLE_FETCH_CHUNK_SIZE,
    );
    let cancelled = false;

    void Promise.all(
      chunks.map((chunk) =>
        getDocs(
          query(
            collection(firestore, USERS_COLLECTION),
            where(documentId(), "in", chunk),
          ),
        ),
      ),
    )
      .then((snapshots) => {
        if (cancelled) {
          return;
        }

        const fetchedRoles: Record<string, UserRole> = {};
        const seenIds = new Set<string>();

        snapshots.forEach((snapshot) => {
          snapshot.docs.forEach((item) => {
            const data = item.data() as DocumentData;
            const resolvedRole = getEffectiveUserRole(
              typeof data.role === "string" ? data.role : "",
            );

            authorRoleCache.set(item.id, resolvedRole);
            fetchedRoles[item.id] = resolvedRole;
            seenIds.add(item.id);
          });
        });

        missingAuthorIds.forEach((authorUserId) => {
          if (seenIds.has(authorUserId)) {
            return;
          }

          authorRoleCache.set(authorUserId, "user");
          fetchedRoles[authorUserId] = "user";
        });

        setAuthorRolesByUserId((current) => {
          let changed = false;
          const nextState = { ...current };

          Object.entries(fetchedRoles).forEach(([authorUserId, role]) => {
            if (nextState[authorUserId] === role) {
              return;
            }

            nextState[authorUserId] = role;
            changed = true;
          });

          return changed ? nextState : current;
        });
      })
      .catch(() => {
        if (cancelled) {
          return;
        }

        const fallbackRoles: Record<string, UserRole> = {};
        missingAuthorIds.forEach((authorUserId) => {
          authorRoleCache.set(authorUserId, "user");
          fallbackRoles[authorUserId] = "user";
        });

        setAuthorRolesByUserId((current) => ({ ...fallbackRoles, ...current }));
      });

    return () => {
      cancelled = true;
    };
  }, [posts]);

  return authorRolesByUserId;
}

type PostDetailsPageProps = {
  authorRole: UserRole;
  isVideoPlaying?: boolean;
  interactive: boolean;
  lyricsFontSize: number;
  onDecreaseLyricsFontSize: () => void;
  onIncreaseLyricsFontSize: () => void;
  onOpenCategory: (post: PostRecord) => void;
  onVideoPlaybackChange?: (isPlaying: boolean) => void;
  post: PostRecord;
  scrollViewRef?: RefObject<ScrollView | null>;
  styles: ReturnType<typeof createStyles>;
  youtubePlayerError?: string;
  onYoutubePlayerError?: (error: string) => void;
};

function PostDetailsPage({
  authorRole,
  isVideoPlaying = false,
  interactive,
  lyricsFontSize,
  onDecreaseLyricsFontSize,
  onIncreaseLyricsFontSize,
  onOpenCategory,
  onVideoPlaybackChange,
  post,
  scrollViewRef,
  styles,
  youtubePlayerError = "",
  onYoutubePlayerError,
}: PostDetailsPageProps) {
  const thumbnailUrl = getPostCardThumbnailUrl(post);
  const publishedLabel = formatDate(post.publishedAt || post.uploadDate || post.createDate);
  const categoryLabel = formatCategoryLabel(post.category);
  const youtubeVideoId = interactive ? getYouTubeVideoId(post.youtubeVideoUrl) : "";
  const canDecreaseLyricsSize = interactive && lyricsFontSize > MIN_LYRICS_FONT_SIZE;
  const canIncreaseLyricsSize = interactive && lyricsFontSize < MAX_LYRICS_FONT_SIZE;
  const authorLabel = post.authorDisplayName || "Community Author";
  const authorCardName = getAuthorCardName(authorLabel);

  return (
    <ScrollView
      ref={scrollViewRef}
      contentContainerStyle={styles.container}
      scrollEnabled={interactive}
      showsVerticalScrollIndicator={false}
    >
      {thumbnailUrl ? (
        <Image
          cachePolicy="memory-disk"
          contentFit="cover"
          source={{ uri: thumbnailUrl }}
          style={styles.thumbnail}
          transition={140}
        />
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
          <View style={styles.categoryLinkContent}>
            <Text style={styles.categoryLinkText}>{categoryLabel}</Text>
          </View>
        </Pressable>
        <Text style={[styles.meta, styles.metaPublished]}>{`Published: ${publishedLabel}`}</Text>
      </View>

      {post.authorId || post.createdBy ? (
        <View style={styles.authorCard}>
          {post.authorPhotoURL ? (
            <Image
              cachePolicy="memory-disk"
              contentFit="cover"
              source={{ uri: post.authorPhotoURL }}
              style={styles.authorAvatar}
              transition={120}
            />
          ) : (
            <View style={[styles.authorAvatar, styles.authorAvatarFallback]}>
              <Text style={styles.authorAvatarText}>
                {authorLabel.charAt(0).toUpperCase()}
              </Text>
            </View>
          )}

          <View style={styles.authorTextWrap}>
            <Text style={styles.authorLabel}>Published by</Text>
            <View style={styles.authorNameRow}>
              <Text style={styles.authorName} numberOfLines={1}>
                {authorCardName}
              </Text>
              <VerifiedRoleBadge role={authorRole} />
            </View>
          </View>
          <View style={styles.authorFontControlsWrap}>
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
              play={isVideoPlaying}
              forceAndroidAutoplay
              initialPlayerParams={{ rel: false, modestbranding: true }}
              webViewStyle={styles.video}
              onError={(event: string) => {
                onVideoPlaybackChange?.(false);
                onYoutubePlayerError?.(event || "Playback failed.");
              }}
              onChangeState={(state: string) => {
                if (state === "playing") {
                  onYoutubePlayerError?.("");
                  onVideoPlaybackChange?.(true);
                  return;
                }

                if (state === "paused" || state === "ended") {
                  onVideoPlaybackChange?.(false);
                }
              }}
            />
          </View>

          <View style={styles.videoErrorWrap}>
            {youtubePlayerError ? (
              <Text style={styles.videoErrorText}>Video not playing here.</Text>
            ) : null}
          </View>
        </View>
      ) : null}
    </ScrollView>
  );
}

export default function PostDetailsScreen() {
  const { colors, resolvedTheme } = useAppTheme();
  const { canManagePosts, canModeratePosts, user } = useAuth();
  const { keepLyricsScreenAwakeEnabled } = useLyricsReaderPreferences();
  const { isConnected, showOfflineToast, showToast } = useNetworkStatus();
  const isConnectedRef = useRef(isConnected);
  const router = useRouter();
  const { width } = useWindowDimensions();
  const swipeWidth = Math.max(width, 1);
  const {
    postId: postIdParam,
    swipeSource: swipeSourceParam,
    swipeAuthorId: swipeAuthorIdParam,
    swipeCategorySlug: swipeCategorySlugParam,
    swipePostIds: swipePostIdsParam,
  } = useLocalSearchParams<{
    postId?: string;
    swipeSource?: string;
    swipeAuthorId?: string;
    swipeCategorySlug?: string;
    swipePostIds?: string;
  }>();
  const { isFavorite, toggleFavorite } = useFavorites();
  const { publishedPosts } = useMainTabData();
  const styles = createStyles(colors, resolvedTheme === "dark");

  const routePostId = resolvePostId(postIdParam);
  const swipeSource = resolveSwipeSource(swipeSourceParam);
  const isSwipeDisabledForFavoriteSource = swipeSource === "favorite";
  const swipeAuthorId = resolveSwipeAuthorId(swipeAuthorIdParam);
  const swipeCategorySlug = resolveCategorySlug(swipeCategorySlugParam);
  const swipePostIds = useMemo(() => resolveSwipePostIds(swipePostIdsParam), [swipePostIdsParam]);
  const scrollViewRef = useRef<ScrollView | null>(null);
  const pendingRoutePostIdRef = useRef<string | null>(null);
  const [activePostId, setActivePostId] = useState(routePostId);
  const [post, setPost] = useState<PostRecord | null>(null);
  const [swipePosts, setSwipePosts] = useState<PostRecord[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");
  const [youtubePlayerError, setYoutubePlayerError] = useState("");
  const [isVideoPlaying, setIsVideoPlaying] = useState(false);
  const [lyricsFontSize, setLyricsFontSize] = useState(DEFAULT_LYRICS_FONT_SIZE);
  const [isHeaderMenuVisible, setIsHeaderMenuVisible] = useState(false);
  const [bookmarkPromptMode, setBookmarkPromptMode] = useState<BookmarkPromptMode | null>(null);
  const bookmarkPromptOpacity = useRef(new RNAnimated.Value(0)).current;
  const bookmarkPromptTranslateY = useRef(new RNAnimated.Value(BOOKMARK_PROMPT_HIDDEN_OFFSET)).current;
  const bookmarkPromptAnimationRef = useRef<RNAnimated.CompositeAnimation | null>(null);
  const translateX = useSharedValue(0);
  const isSwipeNavigating = useSharedValue(false);
  const previewDirectionValue = useSharedValue(0);
  const [previewDirection, setPreviewDirection] = useState<SwipeDirection | null>(null);
  const [settlingPreviewPost, setSettlingPreviewPost] = useState<PostRecord | null>(null);

  const stopBookmarkPromptAnimation = useCallback(() => {
    if (bookmarkPromptAnimationRef.current) {
      bookmarkPromptAnimationRef.current.stop();
      bookmarkPromptAnimationRef.current = null;
    }
  }, []);

  const resetBookmarkPromptAnimationValues = useCallback(() => {
    bookmarkPromptOpacity.setValue(0);
    bookmarkPromptTranslateY.setValue(BOOKMARK_PROMPT_HIDDEN_OFFSET);
  }, [bookmarkPromptOpacity, bookmarkPromptTranslateY]);

  const runBookmarkPromptAnimation = useCallback(
    (open: boolean, onComplete?: () => void) => {
      stopBookmarkPromptAnimation();

      const nextOpacity = open ? 1 : 0;
      const nextTranslateY = open ? 0 : BOOKMARK_PROMPT_HIDDEN_OFFSET;
      const animation = RNAnimated.parallel([
        RNAnimated.timing(bookmarkPromptOpacity, {
          toValue: nextOpacity,
          duration: open ? BOOKMARK_PROMPT_SHOW_DURATION_MS : BOOKMARK_PROMPT_HIDE_DURATION_MS,
          easing: open
            ? Easing.out(Easing.cubic)
            : Easing.inOut(Easing.cubic),
          useNativeDriver: true,
        }),
        RNAnimated.timing(bookmarkPromptTranslateY, {
          toValue: nextTranslateY,
          duration: open ? BOOKMARK_PROMPT_SHOW_DURATION_MS : BOOKMARK_PROMPT_HIDE_DURATION_MS,
          easing: open
            ? Easing.out(Easing.bezier(0.22, 1, 0.36, 1))
            : Easing.inOut(Easing.bezier(0.4, 0, 1, 1)),
          useNativeDriver: true,
        }),
      ]);

      bookmarkPromptAnimationRef.current = animation;
      animation.start(({ finished }) => {
        if (bookmarkPromptAnimationRef.current === animation) {
          bookmarkPromptAnimationRef.current = null;
        }

        if (finished) {
          onComplete?.();
        }
      });
    },
    [
      bookmarkPromptOpacity,
      bookmarkPromptTranslateY,
      stopBookmarkPromptAnimation,
    ],
  );

  const dismissBookmarkPromptImmediately = useCallback(() => {
    stopBookmarkPromptAnimation();
    setBookmarkPromptMode(null);
    resetBookmarkPromptAnimationValues();
  }, [resetBookmarkPromptAnimationValues, stopBookmarkPromptAnimation]);

  const closeBookmarkPrompt = useCallback(() => {
    if (!bookmarkPromptMode) {
      return;
    }

    runBookmarkPromptAnimation(false, () => {
      setBookmarkPromptMode((current) => (current ? null : current));
      resetBookmarkPromptAnimationValues();
    });
  }, [
    bookmarkPromptMode,
    resetBookmarkPromptAnimationValues,
    runBookmarkPromptAnimation,
  ]);

  const showBookmarkPrompt = useCallback((mode: BookmarkPromptMode) => {
    setBookmarkPromptMode(mode);
    if (!bookmarkPromptMode) {
      resetBookmarkPromptAnimationValues();
    }
    runBookmarkPromptAnimation(true);
  }, [
    bookmarkPromptMode,
    resetBookmarkPromptAnimationValues,
    runBookmarkPromptAnimation,
  ]);

  const handleViewBookmark = useCallback(() => {
    closeBookmarkPrompt();
    router.push({ pathname: "/home", params: { tab: "favorite" } });
  }, [closeBookmarkPrompt, router]);

  useEffect(() => {
    isConnectedRef.current = isConnected;
  }, [isConnected]);

  useEffect(() => {
    translateX.value = 0;
    previewDirectionValue.value = 0;
  }, [previewDirectionValue, translateX, width]);

  useEffect(() => {
    setIsHeaderMenuVisible(false);
    setIsVideoPlaying(false);
    dismissBookmarkPromptImmediately();
  }, [dismissBookmarkPromptImmediately, post?.id]);

  useEffect(() => {
    return () => {
      stopBookmarkPromptAnimation();
    };
  }, [stopBookmarkPromptAnimation]);

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

  const activeSwipePost = useMemo(
    () => swipePosts.find((item) => item.id === activePostId) ?? null,
    [activePostId, swipePosts],
  );
  const cachedActivePost = useMemo(
    () => publishedPosts.find((item) => item.id === activePostId) ?? null,
    [activePostId, publishedPosts],
  );

  useEffect(() => {
    if (!activePostId) {
      setError("Post not found.");
      setPost(null);
      setIsLoading(false);
      return;
    }

    if (activeSwipePost) {
      setYoutubePlayerError("");
      setPost((currentPost) =>
        currentPost?.id === activeSwipePost.id ? currentPost : activeSwipePost,
      );
      setError("");
      setIsLoading(false);
      return;
    }

    if (cachedActivePost) {
      setYoutubePlayerError("");
      setPost((currentPost) =>
        currentPost?.id === cachedActivePost.id ? currentPost : cachedActivePost,
      );
      setError("");
      setIsLoading(false);
      return;
    }

    if (post?.id !== activePostId) {
      setIsLoading(true);
    }
  }, [activePostId, activeSwipePost, cachedActivePost, post?.id]);

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
        if (!isSwipeEligiblePost(nextPost)) {
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
        if (cachedActivePost) {
          setYoutubePlayerError("");
          setPost(cachedActivePost);
          setError("");
          setIsLoading(false);
          return;
        }

        setError(
          getRequestErrorMessage({
            error: snapshotError,
            isConnected: isConnectedRef.current,
            onlineMessage: "Unable to load post details.",
          }),
        );
        setPost(null);
        setIsLoading(false);
      },
    );

    return unsubscribe;
  }, [activePostId, cachedActivePost]);

  useEffect(() => {
    if (swipeSource === "author") {
      if (!swipeAuthorId) {
        setSwipePosts([]);
        return;
      }

      let authorIdPosts: PostRecord[] = [];
      let createdByPosts: PostRecord[] = [];

      const syncAuthorSwipePosts = () => {
        const postsById = new Map<string, PostRecord>();

        [...authorIdPosts, ...createdByPosts].forEach((item) => {
          if (isSwipeEligiblePost(item)) {
            postsById.set(item.id, item);
          }
        });

        setSwipePosts(sortPostsByRecency(Array.from(postsById.values())));
      };

      const mapSnapshotPosts = (snapshot: {
        docs: { id: string; data: () => DocumentData }[];
      }) =>
        snapshot.docs
          .map((item) => mapPostRecord(item.id, item.data() as DocumentData))
          .filter(isSwipeEligiblePost);

      const authorIdPostsQuery = query(
        collection(firestore, POSTS_COLLECTION),
        where("authorId", "==", swipeAuthorId),
        where("status", "==", "published"),
      );
      const createdByPostsQuery = query(
        collection(firestore, POSTS_COLLECTION),
        where("createdBy", "==", swipeAuthorId),
        where("status", "==", "published"),
      );

      const unsubscribeAuthorIdPosts = onSnapshot(
        authorIdPostsQuery,
        (snapshot) => {
          authorIdPosts = mapSnapshotPosts(snapshot);
          syncAuthorSwipePosts();
        },
        () => {
          authorIdPosts = [];
          syncAuthorSwipePosts();
        },
      );
      const unsubscribeCreatedByPosts = onSnapshot(
        createdByPostsQuery,
        (snapshot) => {
          createdByPosts = mapSnapshotPosts(snapshot);
          syncAuthorSwipePosts();
        },
        () => {
          createdByPosts = [];
          syncAuthorSwipePosts();
        },
      );

      return () => {
        unsubscribeAuthorIdPosts();
        unsubscribeCreatedByPosts();
      };
    }

    if (swipeSource === "category") {
      if (!swipeCategorySlug) {
        setSwipePosts([]);
        return;
      }

      const categoryPostsQuery = query(
        collection(firestore, POSTS_COLLECTION),
        where("category", "==", swipeCategorySlug),
        where("status", "==", "published"),
      );

      const unsubscribe = onSnapshot(
        categoryPostsQuery,
        (snapshot) => {
          const nextSwipePosts = sortPostsByRecency(
            snapshot.docs
              .map((item) => mapPostRecord(item.id, item.data() as DocumentData))
              .filter(isSwipeEligiblePost),
          );
          setSwipePosts(nextSwipePosts);
        },
        () => {
          setSwipePosts([]);
        },
      );

      return unsubscribe;
    }

    if (swipeSource === "favorite") {
      if (!swipePostIds.length) {
        setSwipePosts([]);
        return;
      }

      let isActive = true;

      const favoritePostIdChunks = chunkPostIds(
        swipePostIds,
        FAVORITE_SWIPE_FETCH_BATCH_SIZE,
      );

      void Promise.all(
        favoritePostIdChunks.map((postIdChunk) =>
          getDocs(
            query(
              collection(firestore, POSTS_COLLECTION),
              where(documentId(), "in", postIdChunk),
            ),
          ),
        ),
      )
        .then((snapshotsByChunk) => {
          if (!isActive) {
            return;
          }

          const postsById = new Map<string, PostRecord>();
          snapshotsByChunk.forEach((chunkSnapshot) => {
            chunkSnapshot.docs.forEach((snapshot) => {
              const nextPost = mapPostRecord(snapshot.id, snapshot.data() as DocumentData);
              if (!isSwipeEligiblePost(nextPost)) {
                return;
              }

              postsById.set(nextPost.id, nextPost);
            });
          });

          setSwipePosts(swipePostIds.map((postId) => postsById.get(postId)).filter(Boolean) as PostRecord[]);
        })
        .catch(() => {
          if (isActive) {
            setSwipePosts([]);
          }
        });

      return () => {
        isActive = false;
      };
    }

    setSwipePosts([]);
  }, [swipeAuthorId, swipeCategorySlug, swipePostIds, swipeSource]);

  const handleToggleFavorite = async (targetPost: PostRecord) => {
    const promptMode: BookmarkPromptMode = isFavorite(targetPost.id) ? "removed" : "added";
    showBookmarkPrompt(promptMode);

    try {
      await toggleFavorite(targetPost, { showToast: false });
    } catch (toggleError) {
      dismissBookmarkPromptImmediately();

      const message = getActionErrorMessage({
        error: toggleError,
        isConnected,
        fallbackMessage: "Bookmarks could not be updated right now.",
      });

      if (message === DEFAULT_OFFLINE_MESSAGE) {
        showOfflineToast();
        return;
      }

      Alert.alert(
        "Unable to update bookmarks",
        message,
      );
    }
  };

  const closeHeaderMenu = () => {
    setIsHeaderMenuVisible(false);
  };

  const openHeaderMenu = () => {
    if (!post) {
      return;
    }

    setIsHeaderMenuVisible((current) => !current);
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

  const handleOpenPostEditor = (targetPost: PostRecord) => {
    router.push(`/admin/posts/edit?postId=${targetPost.id}`);
  };

  const handleBackNavigation = () => {
    if (router.canGoBack()) {
      router.back();
      return;
    }

    router.replace("/home");
  };

  const handleDecreaseLyricsFontSize = () => {
    setLyricsFontSize((value) => Math.max(MIN_LYRICS_FONT_SIZE, value - LYRICS_FONT_STEP));
    showToast("Lyrics font size decreased.");
  };

  const handleIncreaseLyricsFontSize = () => {
    setLyricsFontSize((value) => Math.min(MAX_LYRICS_FONT_SIZE, value + LYRICS_FONT_STEP));
    showToast("Lyrics font size increased.");
  };

  const currentPostIndex = useMemo(() => {
    if (!post) {
      return -1;
    }

    return swipePosts.findIndex((item) => item.id === post.id);
  }, [post, swipePosts]);

  const previousSwipePost = useMemo(() => {
    if (currentPostIndex <= 0) {
      return null;
    }

    return swipePosts[currentPostIndex - 1] ?? null;
  }, [currentPostIndex, swipePosts]);

  const nextSwipePost = useMemo(() => {
    if (currentPostIndex < 0 || currentPostIndex >= swipePosts.length - 1) {
      return null;
    }

    return swipePosts[currentPostIndex + 1] ?? null;
  }, [currentPostIndex, swipePosts]);
  const visibleAuthorPosts = useMemo(
    () => [post, previousSwipePost, nextSwipePost, settlingPreviewPost],
    [nextSwipePost, post, previousSwipePost, settlingPreviewPost],
  );
  const authorRolesByUserId = useResolvedAuthorRoles(visibleAuthorPosts);
  const currentPostAuthorRole = resolvePostAuthorRole(post, authorRolesByUserId);
  const canEditCurrentPost = Boolean(
    post &&
      canManagePosts &&
      user &&
      (
        canModeratePosts ||
        post.createdBy === user.uid ||
        post.authorId === user.uid ||
        (!!user.email && post.createdByEmail === user.email)
      ),
  );

  const currentPostId = post?.id ?? activePostId;
  const previousSwipePostId = previousSwipePost?.id ?? "";
  const nextSwipePostId = nextSwipePost?.id ?? "";
  const canSwipeToPreviousPost = Boolean(previousSwipePostId) && previousSwipePostId !== currentPostId;
  const canSwipeToNextPost = Boolean(nextSwipePostId) && nextSwipePostId !== currentPostId;
  const isSwipeNavigationEnabled =
    !isSwipeDisabledForFavoriteSource &&
    (canSwipeToPreviousPost || canSwipeToNextPost);
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
    const targetPost = swipePosts.find((item) => item.id === targetPostId) ?? null;

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
    if (swipeSource === "author") {
      router.setParams({
        postId: targetPostId,
        swipeSource,
        swipeAuthorId,
      });
    } else if (swipeSource === "category") {
      router.setParams({
        postId: targetPostId,
        swipeSource,
        swipeCategorySlug,
      });
    } else if (swipeSource === "favorite") {
      router.setParams({
        postId: targetPostId,
        swipeSource,
        swipePostIds: swipePostIds.join(","),
      });
    } else {
      router.setParams({ postId: targetPostId });
    }
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
      const targetPostId = direction === "left" ? nextSwipePostId : previousSwipePostId;
      const hasAdjacentPost = Boolean(targetPostId) && targetPostId !== currentPostId;
      const dampenedOffset = hasAdjacentPost
        ? event.translationX
        : event.translationX * EDGE_RESISTANCE;
      const maxOffset =
        swipeWidth * (hasAdjacentPost ? MAX_DRAG_RATIO : EDGE_RESISTANCE);
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
      const targetPostId = direction === "left" ? nextSwipePostId : previousSwipePostId;
      const hasAdjacentPost = Boolean(targetPostId) && targetPostId !== currentPostId;
      const passedThreshold =
        Math.abs(event.translationX) >= SWIPE_DISTANCE_THRESHOLD ||
        Math.abs(event.velocityX) >= SWIPE_VELOCITY_THRESHOLD;

      if (!direction || !targetPostId || !hasAdjacentPost || !passedThreshold) {
        resetToCurrentPost();
        return;
      }

      isSwipeNavigating.value = true;
      translateX.value = withTiming(
        direction === "left" ? -swipeWidth : swipeWidth,
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
    const distance = Math.abs(translateX.value);

    return {
      opacity: interpolate(distance, [0, swipeWidth], [1, 0.94], Extrapolation.CLAMP),
      transform: [
        { translateX: translateX.value },
        {
          scale: interpolate(distance, [0, swipeWidth], [1, 0.992], Extrapolation.CLAMP),
        },
      ],
    };
  });

  const previousPageStyle = useAnimatedStyle(() => ({
    opacity: canSwipeToPreviousPost
      ? interpolate(
          translateX.value,
          [0, swipeWidth * 0.25, swipeWidth],
          [0.18, 0.75, 1],
          Extrapolation.CLAMP,
        )
      : 0,
    transform: [{ translateX: -swipeWidth + translateX.value }],
  }));

  const nextPageStyle = useAnimatedStyle(() => ({
    opacity: canSwipeToNextPost
      ? interpolate(
          -translateX.value,
          [0, swipeWidth * 0.25, swipeWidth],
          [0.18, 0.75, 1],
          Extrapolation.CLAMP,
        )
      : 0,
    transform: [{ translateX: swipeWidth + translateX.value }],
  }));

  if (isLoading) {
    return (
      <View style={styles.screen}>
        <Stack.Screen
          options={{
            title: POST_DETAILS_HEADER_TITLE,
            animation: "none",
            headerShadowVisible: false,
            headerTintColor: colors.text,
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
            title: POST_DETAILS_HEADER_TITLE,
            animation: "none",
            headerShadowVisible: false,
            headerTintColor: colors.text,
          }}
        />
        <View style={styles.errorContainer}>
          <Text style={styles.errorTitle}>{error || "Post not available."}</Text>
          <Pressable
            style={({ pressed }) => [styles.backButton, pressed && styles.backButtonPressed]}
            onPress={handleBackNavigation}
          >
            <Text style={styles.backButtonText}>Go Back</Text>
          </Pressable>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.screen}>
      {keepLyricsScreenAwakeEnabled ? <LyricsReaderKeepAwake /> : null}
      <Stack.Screen
        options={{
          title: POST_DETAILS_HEADER_TITLE,
          animation: "none",
          headerShadowVisible: false,
          headerTintColor: colors.text,
          headerRight: () => (
            <Pressable
              style={({ pressed }) => [
                styles.headerMenuButton,
                pressed && styles.headerMenuButtonPressed,
              ]}
              onPress={openHeaderMenu}
              accessibilityRole="button"
              accessibilityLabel="Open post actions"
            >
              <MoreVerticalIcon color={colors.text} size={22} />
            </Pressable>
          ),
        }}
      />
      {isSwipeNavigationEnabled && previewDirection === "right" && canSwipeToPreviousPost ? (
        <Animated.View pointerEvents="none" style={[styles.page, styles.pageCard, previousPageStyle]}>
          <PostDetailsPage
            authorRole={resolvePostAuthorRole(previousSwipePost, authorRolesByUserId)}
            interactive={false}
            lyricsFontSize={lyricsFontSize}
            onDecreaseLyricsFontSize={handleDecreaseLyricsFontSize}
            onIncreaseLyricsFontSize={handleIncreaseLyricsFontSize}
            onOpenCategory={handleOpenCategory}
            post={previousSwipePost as PostRecord}
            styles={styles}
          />
        </Animated.View>
      ) : null}

      {isSwipeNavigationEnabled && previewDirection === "left" && canSwipeToNextPost ? (
        <Animated.View pointerEvents="none" style={[styles.page, styles.pageCard, nextPageStyle]}>
          <PostDetailsPage
            authorRole={resolvePostAuthorRole(nextSwipePost, authorRolesByUserId)}
            interactive={false}
            lyricsFontSize={lyricsFontSize}
            onDecreaseLyricsFontSize={handleDecreaseLyricsFontSize}
            onIncreaseLyricsFontSize={handleIncreaseLyricsFontSize}
            onOpenCategory={handleOpenCategory}
            post={nextSwipePost as PostRecord}
            styles={styles}
          />
        </Animated.View>
      ) : null}

      {isSwipeNavigationEnabled ? (
        <GestureDetector gesture={panGesture}>
          <Animated.View style={[styles.page, styles.pageCard, currentPageStyle]}>
            <PostDetailsPage
              authorRole={currentPostAuthorRole}
              interactive
              lyricsFontSize={lyricsFontSize}
              onDecreaseLyricsFontSize={handleDecreaseLyricsFontSize}
              onIncreaseLyricsFontSize={handleIncreaseLyricsFontSize}
              onOpenCategory={handleOpenCategory}
              onVideoPlaybackChange={setIsVideoPlaying}
              post={post}
              scrollViewRef={scrollViewRef}
              styles={styles}
              isVideoPlaying={isVideoPlaying}
              youtubePlayerError={youtubePlayerError}
              onYoutubePlayerError={setYoutubePlayerError}
            />
          </Animated.View>
        </GestureDetector>
      ) : (
        <Animated.View style={[styles.page, styles.pageCard, currentPageStyle]}>
          <PostDetailsPage
            authorRole={currentPostAuthorRole}
            interactive
            lyricsFontSize={lyricsFontSize}
            onDecreaseLyricsFontSize={handleDecreaseLyricsFontSize}
            onIncreaseLyricsFontSize={handleIncreaseLyricsFontSize}
            onOpenCategory={handleOpenCategory}
            onVideoPlaybackChange={setIsVideoPlaying}
            post={post}
            scrollViewRef={scrollViewRef}
            styles={styles}
            isVideoPlaying={isVideoPlaying}
            youtubePlayerError={youtubePlayerError}
            onYoutubePlayerError={setYoutubePlayerError}
          />
        </Animated.View>
      )}

      {settlingPreviewPost ? (
        <View pointerEvents="none" style={[styles.page, styles.pageCard]}>
          <PostDetailsPage
            authorRole={resolvePostAuthorRole(settlingPreviewPost, authorRolesByUserId)}
            interactive={false}
            lyricsFontSize={lyricsFontSize}
            onDecreaseLyricsFontSize={handleDecreaseLyricsFontSize}
            onIncreaseLyricsFontSize={handleIncreaseLyricsFontSize}
            onOpenCategory={handleOpenCategory}
            post={settlingPreviewPost}
            styles={styles}
          />
        </View>
      ) : null}

      {Boolean(post) && isHeaderMenuVisible ? (
        <View style={styles.headerMenuOverlay}>
          <Pressable style={styles.headerMenuBackdrop} onPress={closeHeaderMenu} />

          <View style={styles.headerMenuDropdown}>
            {canEditCurrentPost ? (
              <>
                <Pressable
                  style={({ pressed }) => [
                    styles.headerMenuAction,
                    pressed && styles.headerMenuActionPressed,
                  ]}
                  onPress={() => {
                    if (!post) {
                      return;
                    }

                    closeHeaderMenu();
                    handleOpenPostEditor(post);
                  }}
                  accessibilityRole="button"
                  accessibilityLabel="Edit post"
                >
                  <View style={styles.headerMenuActionIconWrap}>
                    <ArrowRightIcon color={colors.subtleText} size={14} />
                  </View>
                  <Text style={styles.headerMenuActionTitle}>Edit post</Text>
                </Pressable>
                <View style={styles.headerMenuActionDivider} />
              </>
            ) : null}

            <Pressable
              style={({ pressed }) => [
                styles.headerMenuAction,
                pressed && styles.headerMenuActionPressed,
              ]}
              onPress={() => {
                if (!post) {
                  return;
                }

                closeHeaderMenu();
                void handleToggleFavorite(post);
              }}
              accessibilityRole="button"
              accessibilityLabel={
                post && isFavorite(post.id)
                  ? "Remove from bookmarks"
                  : "Save to bookmarks"
              }
            >
              <View style={styles.headerMenuActionIconWrap}>
                <BookmarkMenuIcon
                  color={colors.subtleText}
                  active={Boolean(post && isFavorite(post.id))}
                  size={18}
                />
              </View>
              <Text style={styles.headerMenuActionTitle}>
                {post && isFavorite(post.id) ? "Remove bookmark" : "Add bookmark"}
              </Text>
            </Pressable>
          </View>
        </View>
      ) : null}

      {bookmarkPromptMode ? (
        <RNAnimated.View
          style={[
            styles.bookmarkPromptOverlay,
            { opacity: bookmarkPromptOpacity },
          ]}
        >
          <Pressable style={styles.bookmarkPromptBackdrop} onPress={closeBookmarkPrompt} />
          <RNAnimated.View
            style={[
              styles.bookmarkPromptSheet,
              { transform: [{ translateY: bookmarkPromptTranslateY }] },
            ]}
          >
            <View style={styles.bookmarkPromptHandle} />
            <View style={styles.bookmarkPromptIconWrap}>
              <View style={styles.bookmarkPromptIconCircle}>
                <BookmarkMenuIcon active color="#FFFFFF" size={34} />
              </View>
            </View>
            <Text style={styles.bookmarkPromptTitle}>
              {bookmarkPromptMode === "added" ? "Added to Bookmarks" : "Removed from Bookmarks"}
            </Text>
            <Text style={styles.bookmarkPromptDescription}>
              {bookmarkPromptMode === "added"
                ? "Post has been added to your bookmarks."
                : "Post has been removed from your bookmarks."}
            </Text>
            <View
              style={[
                styles.bookmarkPromptActions,
                bookmarkPromptMode === "removed" && styles.bookmarkPromptActionsSingle,
              ]}
            >
              {bookmarkPromptMode === "added" ? (
                <Pressable
                  style={({ pressed }) => [
                    styles.bookmarkPromptPrimaryAction,
                    pressed && styles.bookmarkPromptActionPressed,
                  ]}
                  onPress={handleViewBookmark}
                  accessibilityRole="button"
                  accessibilityLabel="View bookmarks"
                >
                  <Text style={styles.bookmarkPromptPrimaryActionText}>View Bookmarks</Text>
                </Pressable>
              ) : null}
              <Pressable
                style={({ pressed }) => [
                  styles.bookmarkPromptSecondaryAction,
                  bookmarkPromptMode === "removed" && styles.bookmarkPromptSecondaryActionSingle,
                  pressed && styles.bookmarkPromptActionPressed,
                ]}
                onPress={closeBookmarkPrompt}
                accessibilityRole="button"
                accessibilityLabel={
                  bookmarkPromptMode === "removed" ? "Continue browsing" : "Continue"
                }
              >
                <Text style={styles.bookmarkPromptActionText}>
                  {bookmarkPromptMode === "removed" ? "Continue Browsing" : "Continue"}
                </Text>
              </Pressable>
            </View>
          </RNAnimated.View>
        </RNAnimated.View>
      ) : null}
    </View>
  );
}

const createStyles = (colors: ThemeColors, isDarkTheme: boolean) => StyleSheet.create({
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
  headerMenuButton: {
    width: 36,
    height: 36,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  headerMenuButtonPressed: {
    opacity: 0.82,
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
  metaPublished: {
    marginLeft: SPACING.sm,
  },
  metaRow: {
    flexDirection: "row",
    alignItems: "center",
    flexWrap: "wrap",
    gap: SPACING.xs,
  },
  categoryLink: {
    borderRadius: RADIUS.pill,
    backgroundColor: isDarkTheme ? colors.surfaceMuted : "#FFFFFF",
    paddingHorizontal: SPACING.md,
    paddingVertical: 4,
  },
  categoryLinkContent: {
    flexDirection: "row",
    alignItems: "center",
  },
  categoryLinkPressed: {
    opacity: 0.7,
  },
  categoryLinkText: {
    color: colors.text,
    fontSize: 12,
    fontWeight: "600",
  },
  authorCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: SPACING.sm,
    borderRadius: 9,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: isDarkTheme ? colors.surfaceMuted : "#FFFFFF",
    padding: SPACING.md,
    marginVertical: SPACING.sm,
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
    minWidth: 0,
    gap: 1,
  },
  authorLabel: {
    color: colors.mutedText,
    fontSize: 10,
    fontWeight: "600",
  },
  authorName: {
    color: colors.text,
    fontSize: 15,
    fontWeight: "700",
    flexShrink: 1,
  },
  authorNameRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: SPACING.xs,
    minWidth: 0,
  },
  headerMenuOverlay: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 60,
  },
  headerMenuBackdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "transparent",
  },
  headerMenuDropdown: {
    position: "absolute",
    top: SPACING.xl,
    right: SPACING.lg,
    minWidth: 188,
    borderRadius: RADIUS.inputSm,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    overflow: "hidden",
    ...SHADOWS.md,
  },
  headerMenuAction: {
    minHeight: 46,
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.md,
    flexDirection: "row",
    alignItems: "center",
    gap: SPACING.sm,
    justifyContent: "flex-start",
    backgroundColor: colors.surface,
  },
  headerMenuActionPressed: {
    backgroundColor: colors.surfaceMuted,
  },
  headerMenuActionIconWrap: {
    width: 16,
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  },
  headerMenuActionDivider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: colors.border,
  },
  headerMenuActionTitle: {
    flex: 1,
    color: colors.text,
    fontSize: 13,
    fontWeight: "600",
  },
  authorFontControlsWrap: {
    marginLeft: SPACING.sm,
    alignItems: "center",
    justifyContent: "center",
  },
  fontControlsActions: {
    flexDirection: "row",
    alignItems: "center",
    gap: SPACING.md,
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
  bookmarkPromptOverlay: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 56,
    justifyContent: "flex-end",
  },
  bookmarkPromptBackdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: colors.backdropOverlay,
  },
  bookmarkPromptSheet: {
    borderTopLeftRadius: RADIUS.xl,
    borderTopRightRadius: RADIUS.xl,
    backgroundColor: colors.surface,
    paddingHorizontal: SPACING.xl,
    paddingTop: SPACING.sm,
    paddingBottom: SPACING.xl,
    alignItems: "center",
    ...SHADOWS.lg,
  },
  bookmarkPromptHandle: {
    width: 56,
    height: 5,
    borderRadius: RADIUS.pill,
    backgroundColor: colors.border,
    marginBottom: SPACING.lg,
  },
  bookmarkPromptIconWrap: {
    width: "100%",
    alignItems: "center",
    marginBottom: SPACING.md,
  },
  bookmarkPromptIconCircle: {
    width: 96,
    height: 96,
    borderRadius: 999,
    backgroundColor: colors.brandAccent,
    alignItems: "center",
    justifyContent: "center",
  },
  bookmarkPromptTitle: {
    color: colors.text,
    fontSize: FONT_SIZE.title,
    fontWeight: "700",
    textAlign: "center",
    marginBottom: SPACING.sm,
  },
  bookmarkPromptDescription: {
    color: colors.mutedText,
    fontSize: 16,
    textAlign: "center",
    lineHeight: 23,
    marginBottom: SPACING.lg,
  },
  bookmarkPromptActions: {
    width: "100%",
    flexDirection: "row",
    gap: SPACING.sm,
  },
  bookmarkPromptActionsSingle: {
    justifyContent: "center",
  },
  bookmarkPromptPrimaryAction: {
    flex: 1,
    minHeight: 52,
    borderRadius: RADIUS.sm,
    backgroundColor: colors.primary,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: SPACING.md,
  },
  bookmarkPromptSecondaryAction: {
    flex: 1,
    minHeight: 52,
    borderRadius: RADIUS.sm,
    borderWidth: 1,
    borderColor: colors.inputBorderHover,
    backgroundColor: colors.surface,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: SPACING.md,
  },
  bookmarkPromptSecondaryActionSingle: {
    flex: 0,
    minWidth: 220,
  },
  bookmarkPromptActionPressed: {
    opacity: 0.82,
  },
  bookmarkPromptActionText: {
    color: colors.text,
    fontSize: FONT_SIZE.button,
    fontWeight: "600",
  },
  bookmarkPromptPrimaryActionText: {
    color: colors.primaryText,
    fontSize: FONT_SIZE.button,
    fontWeight: "700",
  },
});
