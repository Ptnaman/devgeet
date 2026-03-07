import { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
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
const MAX_LYRICS_FONT_SIZE = 30;
const DEFAULT_LYRICS_FONT_SIZE = FONT_SIZE.body;

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
    setLyricsFontSize((value) => Math.max(MIN_LYRICS_FONT_SIZE, value - 1));
  };

  const handleIncreaseLyricsFontSize = () => {
    setLyricsFontSize((value) => Math.min(MAX_LYRICS_FONT_SIZE, value + 1));
  };

  const updateLabel = useMemo(() => {
    if (!post) {
      return "-";
    }
    return formatDate(post.uploadDate || post.createDate);
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
    <ScrollView contentContainerStyle={styles.container}>
      <Text style={styles.title}>{post.title}</Text>
      <Text style={styles.meta}>Last update: {updateLabel}</Text>
      <Text style={styles.meta}>Category: {post.category}</Text>

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
          {favorite ? "Unfav" : "Add to Fav"}
        </Text>
      </Pressable>

      <View style={styles.fontControlsRow}>
        <Text style={styles.fontControlsLabel}>Lyrics Size</Text>
        <View style={styles.fontControlsActions}>
          <Pressable
            style={[
              styles.fontButton,
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
            style={[
              styles.fontButton,
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

      <View style={styles.contentWrap}>
        <Text
          style={[
            styles.content,
            {
              fontSize: lyricsFontSize,
              lineHeight: Math.round(lyricsFontSize * 1.55),
            },
          ]}
        >
          {post.content}
        </Text>
      </View>

      {youtubeVideoId ? (
        <View style={styles.videoSection}>
          <Text style={styles.videoTitle}>YouTube Video</Text>
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
          {youtubePlayerError ? (
            <View style={styles.videoErrorWrap}>
              <Text style={styles.videoErrorText}>
                Inline player error: {youtubePlayerError}
              </Text>
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
          ) : null}
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
    gap: SPACING.sm,
    backgroundColor: COLORS.background,
  },
  title: {
    fontSize: FONT_SIZE.title,
    fontWeight: "700",
    color: COLORS.text,
  },
  meta: {
    fontSize: 12,
    color: COLORS.mutedText,
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
    paddingVertical: 6,
    backgroundColor: COLORS.surfaceMuted,
    marginTop: SPACING.xs,
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
  fontControlsRow: {
    marginTop: SPACING.sm,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: SPACING.sm,
  },
  fontControlsLabel: {
    color: COLORS.text,
    fontSize: 13,
    fontWeight: "600",
  },
  fontControlsActions: {
    flexDirection: "row",
    alignItems: "center",
    gap: SPACING.xs,
  },
  fontButton: {
    minWidth: 36,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: RADIUS.md,
    backgroundColor: COLORS.surfaceMuted,
    paddingHorizontal: SPACING.sm,
    paddingVertical: SPACING.xs,
    alignItems: "center",
    justifyContent: "center",
  },
  fontButtonDisabled: {
    opacity: 0.45,
  },
  fontButtonText: {
    color: COLORS.text,
    fontSize: 12,
    fontWeight: "700",
  },
  fontButtonTextDisabled: {
    color: COLORS.mutedText,
  },
  fontValue: {
    minWidth: 24,
    textAlign: "center",
    color: COLORS.text,
    fontSize: 12,
    fontWeight: "600",
  },
  contentWrap: {
    marginTop: SPACING.sm,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: RADIUS.lg,
    backgroundColor: COLORS.surface,
    padding: SPACING.lg,
  },
  content: {
    color: COLORS.text,
  },
  videoSection: {
    marginTop: SPACING.sm,
    gap: SPACING.xs,
  },
  videoTitle: {
    color: COLORS.text,
    fontSize: FONT_SIZE.body,
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
    borderRadius: RADIUS.md,
    backgroundColor: COLORS.surfaceMuted,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.xs,
  },
  openYoutubeButtonPressed: {
    opacity: 0.85,
  },
  openYoutubeButtonText: {
    color: COLORS.primary,
    fontSize: 12,
    fontWeight: "700",
  },
});
