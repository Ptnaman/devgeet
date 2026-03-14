import { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Image,
  Linking,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { HugeiconsIcon } from "@hugeicons/react-native";
import { FavouriteIcon } from "@hugeicons/core-free-icons";
import { doc, onSnapshot, type DocumentData } from "firebase/firestore";
import YoutubePlayer from "react-native-youtube-iframe";

import { COLORS, FONT_SIZE, RADIUS, SPACING } from "@/constants/theme";
import {
  formatDate,
  getPostCardThumbnailUrl,
  getYouTubeVideoId,
  mapPostRecord,
  POSTS_COLLECTION,
  type PostRecord,
} from "@/lib/content";
import { useFavorites } from "@/hooks/use-favorites";
import { firestore } from "@/lib/firebase";

const resolvePostId = (value: string | string[] | undefined) =>
  typeof value === "string" ? value : "";
const MIN_LYRICS_FONT_SIZE = 14;
const MAX_LYRICS_FONT_SIZE = 18;
const DEFAULT_LYRICS_FONT_SIZE = 16;
const LYRICS_FONT_STEP = 1;

export default function PostDetailsScreen() {
  const router = useRouter();
  const { postId: postIdParam } = useLocalSearchParams<{ postId?: string }>();
  const { isFavorite, toggleFavorite } = useFavorites();

  const postId = resolvePostId(postIdParam);
  const [post, setPost] = useState<PostRecord | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");
  const [youtubePlayerError, setYoutubePlayerError] = useState("");
  const [lyricsFontSize, setLyricsFontSize] = useState(DEFAULT_LYRICS_FONT_SIZE);

  useEffect(() => {
    if (!postId) {
      setError("Post not found.");
      setIsLoading(false);
      return;
    }

    const postRef = doc(firestore, POSTS_COLLECTION, postId);
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
      () => {
        setError("Unable to load post details.");
        setPost(null);
        setIsLoading(false);
      },
    );

    return unsubscribe;
  }, [postId]);

  const handleToggleFavorite = async () => {
    if (!post) {
      return;
    }

    await toggleFavorite(post).catch(() => undefined);
  };

  const handleOpenInYouTube = async (url: string) => {
    await Linking.openURL(url).catch(() => undefined);
  };

  const handleDecreaseLyricsFontSize = () => {
    setLyricsFontSize((value) => Math.max(MIN_LYRICS_FONT_SIZE, value - LYRICS_FONT_STEP));
  };

  const handleIncreaseLyricsFontSize = () => {
    setLyricsFontSize((value) => Math.min(MAX_LYRICS_FONT_SIZE, value + LYRICS_FONT_STEP));
  };

  const updateLabel = useMemo(() => {
    if (!post) {
      return "-";
    }
    return formatDate(post.uploadDate || post.createDate);
  }, [post]);

  const categoryLabel = useMemo(() => {
    const value = post?.category.trim() || "general";
    return value
      .split(/[\s-]+/)
      .filter(Boolean)
      .map((word) => `${word.charAt(0).toUpperCase()}${word.slice(1)}`)
      .join(" ");
  }, [post?.category]);

  const thumbnailUrl = useMemo(() => {
    if (!post) {
      return "";
    }

    return getPostCardThumbnailUrl(post);
  }, [post]);

  if (isLoading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={COLORS.primary} />
      </View>
    );
  }

  if (error || !post) {
    return (
      <View style={styles.errorContainer}>
        <Text style={styles.errorTitle}>{error || "Post not available."}</Text>
        <Pressable
          style={({ pressed }) => [styles.backButton, pressed && styles.backButtonPressed]}
          onPress={() => router.back()}
        >
          <Text style={styles.backButtonText}>Go Back</Text>
        </Pressable>
      </View>
    );
  }

  const favorite = isFavorite(post.id);
  const youtubeVideoId = getYouTubeVideoId(post.youtubeVideoUrl);
  const canDecreaseLyricsSize = lyricsFontSize > MIN_LYRICS_FONT_SIZE;
  const canIncreaseLyricsSize = lyricsFontSize < MAX_LYRICS_FONT_SIZE;

  return (
    <ScrollView
      contentContainerStyle={styles.container}
      showsVerticalScrollIndicator={false}
    >
      {thumbnailUrl ? (
        <Image source={{ uri: thumbnailUrl }} style={styles.thumbnail} resizeMode="cover" />
      ) : null}

      <Text style={styles.title}>{post.title}</Text>
      <Text style={styles.meta}>
        {categoryLabel} · {updateLabel}
      </Text>

      <View style={styles.actionRow}>
        <Pressable
          style={[
            styles.favoriteButton,
            favorite ? styles.favoriteButtonActive : undefined,
          ]}
          onPress={() => {
            void handleToggleFavorite();
          }}
        >
          <HugeiconsIcon
            icon={FavouriteIcon}
            size={18}
            color={favorite ? COLORS.danger : COLORS.mutedText}
          />
          <Text
            style={[
              styles.favoriteButtonText,
              favorite ? styles.favoriteButtonTextActive : undefined,
            ]}
          >
            {favorite ? "Saved" : "Save"}
          </Text>
        </Pressable>

        <View style={styles.fontControlsWrap}>
          <View style={styles.fontControlsActions}>
            <Pressable
              style={({ pressed }) => [
                styles.fontButton,
                pressed && styles.fontButtonPressed,
                !canDecreaseLyricsSize && styles.fontButtonDisabled,
              ]}
              onPress={handleDecreaseLyricsFontSize}
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
                pressed && styles.fontButtonPressed,
                !canIncreaseLyricsSize && styles.fontButtonDisabled,
              ]}
              onPress={handleIncreaseLyricsFontSize}
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

      <View style={styles.contentCard}>
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
      </View>

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
                setYoutubePlayerError(event || "Playback failed.");
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
                pressed && styles.openYoutubeButtonPressed,
              ]}
              onPress={() => {
                void handleOpenInYouTube(post.youtubeVideoUrl);
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

const styles = StyleSheet.create({
  loadingContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: COLORS.background,
  },
  errorContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: COLORS.background,
    padding: SPACING.xl,
    gap: SPACING.md,
  },
  errorTitle: {
    fontSize: FONT_SIZE.body,
    color: COLORS.danger,
    fontWeight: "600",
    textAlign: "center",
  },
  backButton: {
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: RADIUS.md,
    backgroundColor: COLORS.surfaceMuted,
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.sm,
  },
  backButtonPressed: {
    opacity: 0.85,
  },
  backButtonText: {
    color: COLORS.text,
    fontWeight: "600",
  },
  container: {
    padding: SPACING.xl,
    paddingBottom: SPACING.xxl * 2,
    gap: SPACING.md,
    backgroundColor: COLORS.background,
  },
  thumbnail: {
    width: "100%",
    aspectRatio: 16 / 9,
    borderRadius: 4,
    overflow: "hidden",
    backgroundColor: COLORS.surfaceSoft,
  },
  title: {
    fontSize: 22,
    fontWeight: "700",
    color: COLORS.text,
    lineHeight: 30,
  },
  meta: {
    color: COLORS.mutedText,
    fontSize: 12,
  },
  actionRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: SPACING.sm,
    flexWrap: "wrap",
  },
  contentCard: {
    borderRadius: RADIUS.sm,
    borderWidth: 1,
    borderColor: COLORS.border,
    backgroundColor: COLORS.surface,
    padding: SPACING.md,
    gap: SPACING.md,
  },
  favoriteButton: {
    alignSelf: "flex-start",
    flexDirection: "row",
    alignItems: "center",
    gap: SPACING.xs,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 999,
    paddingHorizontal: SPACING.md,
    paddingVertical: 8,
    backgroundColor: COLORS.surfaceMuted,
  },
  favoriteButtonActive: {
    borderColor: COLORS.dangerBorder,
    backgroundColor: COLORS.dangerSoft,
  },
  favoriteButtonText: {
    color: COLORS.text,
    fontSize: 12,
    fontWeight: "600",
  },
  favoriteButtonTextActive: {
    color: COLORS.danger,
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
    color: COLORS.text,
    fontSize: 16,
    fontWeight: "700",
  },
  fontButtonTextDisabled: {
    color: COLORS.mutedText,
  },
  fontValue: {
    minWidth: 24,
    textAlign: "center",
    color: COLORS.text,
    fontSize: 13,
    fontWeight: "700",
  },
  content: {
    color: COLORS.text,
  },
  videoCard: {
    borderRadius: RADIUS.md,
    borderWidth: 1,
    borderColor: COLORS.border,
    backgroundColor: COLORS.surface,
    padding: SPACING.md,
    gap: SPACING.sm,
  },
  videoTitle: {
    color: COLORS.text,
    fontSize: 16,
    fontWeight: "700",
  },
  videoFrame: {
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: RADIUS.lg,
    backgroundColor: COLORS.surface,
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
    color: COLORS.mutedText,
    fontSize: 12,
  },
  openYoutubeButton: {
    alignSelf: "flex-start",
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 999,
    backgroundColor: COLORS.surfaceMuted,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
  },
  openYoutubeButtonPressed: {
    opacity: 0.85,
  },
  openYoutubeButtonText: {
    color: COLORS.text,
    fontSize: 12,
    fontWeight: "700",
  },
});
