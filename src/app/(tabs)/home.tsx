import { FavouriteIcon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react-native";
import { useRouter } from "expo-router";
import {
  collection,
  onSnapshot,
  query,
  type DocumentData,
} from "firebase/firestore";
import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";

import { COLORS, FONT_SIZE, SHADOWS, SPACING } from "@/constants/theme";
import { useFavorites } from "@/hooks/use-favorites";
import {
  formatDate,
  getPostCardThumbnailUrl,
  mapPostRecord,
  POSTS_COLLECTION,
  sortPostsByRecency,
  type PostRecord,
} from "@/lib/content";
import { firestore } from "@/lib/firebase";

export default function HomeScreen() {
  const router = useRouter();
  const { isFavorite, toggleFavorite } = useFavorites();
  const [posts, setPosts] = useState<PostRecord[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    const postsQuery = query(collection(firestore, POSTS_COLLECTION));

    const unsubscribe = onSnapshot(
      postsQuery,
      (snapshot) => {
        const nextPosts = sortPostsByRecency(
          snapshot.docs
            .map((item) => mapPostRecord(item.id, item.data() as DocumentData))
            .filter((post) => post.status === "published"),
        );

        setError("");
        setPosts(nextPosts);
        setIsLoading(false);
      },
      () => {
        setError("Unable to load posts right now.");
        setIsLoading(false);
      },
    );

    return unsubscribe;
  }, []);

  const openPost = (postId: string) => {
    router.push({ pathname: "/post/[postId]", params: { postId } });
  };

  const handleToggleFavorite = async (post: PostRecord) => {
    await toggleFavorite(post).catch(() => undefined);
  };

  return (
    <ScrollView contentContainerStyle={styles.container}>
      {isLoading ? (
        <ActivityIndicator
          size="large"
          color={COLORS.primary}
          style={styles.loader}
        />
      ) : null}

      {posts.map((post) => {
        const thumbnailUrl = getPostCardThumbnailUrl(post);
        const favorite = isFavorite(post.id);
        const updatedLabel = formatDate(post.uploadDate || post.createDate);
        const categoryLabel = (post.category.trim() || "general")
          .split(/[\s-]+/)
          .filter(Boolean)
          .map((word) => `${word.charAt(0).toUpperCase()}${word.slice(1)}`)
          .join(" ");

        return (
          <View key={post.id} style={styles.card}>
            <Pressable
              style={({ pressed }) => [
                styles.cardBody,
                pressed && styles.cardBodyPressed,
              ]}
              onPress={() => openPost(post.id)}
            >
              {thumbnailUrl ? (
                <Image
                  source={{ uri: thumbnailUrl }}
                  style={styles.thumbnail}
                  resizeMode="cover"
                />
              ) : null}
              <View style={styles.cardTagRow}>
                <Text style={styles.categoryBadge}>{categoryLabel}</Text>
              </View>
              <Text style={styles.cardTitle} numberOfLines={3} ellipsizeMode="tail">
                {post.title}
              </Text>
              <Text style={styles.cardPreview} numberOfLines={2} ellipsizeMode="tail">
                {post.content.trim() || "-"}
              </Text>
            </Pressable>

            <View style={styles.cardFooter}>
              <Text style={styles.meta}>Updated {updatedLabel}</Text>
              <Pressable
                style={[
                  styles.favoriteButton,
                  favorite ? styles.favoriteButtonActive : undefined,
                ]}
                onPress={() => {
                  void handleToggleFavorite(post);
                }}
              >
                <HugeiconsIcon
                  icon={FavouriteIcon}
                  size={16}
                  color={favorite ? "#B91C1C" : COLORS.mutedText}
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
            </View>
          </View>
        );
      })}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flexGrow: 1,
    padding: SPACING.xxl,
    gap: SPACING.sm,
    backgroundColor: COLORS.background,
  },
  loader: {
    marginVertical: SPACING.md,
  },
  card: {
    backgroundColor: COLORS.surface,
    borderRadius: 16,
    padding: SPACING.lg,
    gap: SPACING.sm,
    ...SHADOWS.md,
  },
  cardBody: {
    gap: SPACING.sm,
  },
  cardBodyPressed: {
    opacity: 0.92,
  },
  thumbnail: {
    width: "100%",
    height: 180,
    borderRadius: 12,
    backgroundColor: "#E5E7EB",
  },
  cardTagRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  categoryBadge: {
    alignSelf: "flex-start",
    borderWidth: 1,
    borderColor: "#BFDBFE",
    borderRadius: 999,
    paddingHorizontal: SPACING.sm,
    paddingVertical: 3,
    backgroundColor: "#EFF6FF",
    color: "#1D4ED8",
    fontSize: 11,
    fontWeight: "700",
  },
  cardTitle: {
    fontSize: 17,
    fontWeight: "700",
    color: COLORS.text,
    lineHeight: 23,
  },
  cardPreview: {
    fontSize: FONT_SIZE.body,
    color: "#334155",
    lineHeight: 21,
  },
  cardFooter: {
    marginTop: SPACING.xs,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: SPACING.sm,
  },
  favoriteButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: SPACING.xs,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 5,
    backgroundColor: "#F8FAFC",
  },
  favoriteButtonActive: {
    borderColor: "#FECACA",
    backgroundColor: "#FEF2F2",
  },
  favoriteButtonText: {
    color: "#334155",
    fontSize: 12,
    fontWeight: "700",
  },
  favoriteButtonTextActive: {
    color: "#B91C1C",
  },
  meta: {
    fontSize: 12,
    color: COLORS.mutedText,
  },
});
