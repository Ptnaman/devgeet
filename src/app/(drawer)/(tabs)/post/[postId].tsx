import { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
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

import { COLORS, FONT_SIZE, RADIUS, SPACING } from "@/constants/theme";
import { formatDate, mapPostRecord, POSTS_COLLECTION, type PostRecord } from "@/lib/content";
import { useFavorites } from "@/hooks/use-favorites";
import { firestore } from "@/lib/firebase";

const resolvePostId = (value: string | string[] | undefined) =>
  typeof value === "string" ? value : "";

export default function PostDetailsScreen() {
  const router = useRouter();
  const { postId: postIdParam } = useLocalSearchParams<{ postId?: string }>();
  const { isFavorite, toggleFavorite } = useFavorites();

  const postId = resolvePostId(postIdParam);
  const [post, setPost] = useState<PostRecord | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");

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
          color={favorite ? "#B91C1C" : COLORS.mutedText}
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

      <View style={styles.contentWrap}>
        <Text style={styles.content}>{post.content}</Text>
      </View>
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
    backgroundColor: COLORS.surface,
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
    backgroundColor: COLORS.surface,
    marginTop: SPACING.xs,
  },
  favoriteButtonActive: {
    borderColor: "#FCA5A5",
    backgroundColor: "#FEF2F2",
  },
  favoriteButtonText: {
    color: COLORS.text,
    fontSize: 12,
    fontWeight: "600",
  },
  favoriteButtonTextActive: {
    color: "#B91C1C",
  },
  contentWrap: {
    marginTop: SPACING.sm,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: RADIUS.md,
    backgroundColor: COLORS.surface,
    padding: SPACING.lg,
  },
  content: {
    color: COLORS.text,
    fontSize: FONT_SIZE.body,
    lineHeight: 24,
  },
});
