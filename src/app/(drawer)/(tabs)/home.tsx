import { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useRouter } from "expo-router";
import { HugeiconsIcon } from "@hugeicons/react-native";
import { FavouriteIcon } from "@hugeicons/core-free-icons";
import {
  collection,
  onSnapshot,
  orderBy,
  query,
  type DocumentData,
} from "firebase/firestore";

import { COLORS, FONT_SIZE, SPACING } from "@/constants/theme";
import {
  formatDate,
  getPostCardThumbnailUrl,
  getPreviewText,
  mapPostRecord,
  POSTS_COLLECTION,
  type PostRecord,
} from "@/lib/content";
import { useFavorites } from "@/hooks/use-favorites";
import { firestore } from "@/lib/firebase";
import { useAuth } from "@/providers/auth-provider";

export default function HomeScreen() {
  const router = useRouter();
  const { user, isAdmin } = useAuth();
  const { isFavorite, toggleFavorite } = useFavorites();
  const [posts, setPosts] = useState<PostRecord[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");

  const accountSubtitle = isAdmin
    ? `Admin logged in: ${user?.email || "Admin"}`
    : `User logged in: ${user?.displayName || user?.email || "User"}`;

  useEffect(() => {
    const postsQuery = query(
      collection(firestore, POSTS_COLLECTION),
      orderBy("createDate", "desc")
    );

    const unsubscribe = onSnapshot(
      postsQuery,
      (snapshot) => {
        const nextPosts = snapshot.docs
          .map((item) => mapPostRecord(item.id, item.data() as DocumentData))
          .filter((post) => post.status === "published");

        setError("");
        setPosts(nextPosts);
        setIsLoading(false);
      },
      () => {
        setError("Unable to load posts right now.");
        setIsLoading(false);
      }
    );

    return unsubscribe;
  }, []);

  const subtitle = useMemo(() => {
    if (isLoading) {
      return "Loading posts...";
    }

    if (error) {
      return error;
    }

    if (!posts.length) {
      return "No published posts yet.";
    }

    return `${posts.length} post${posts.length === 1 ? "" : "s"} published.`;
  }, [error, isLoading, posts.length]);

  const openPost = (postId: string) => {
    router.push({ pathname: "/post/[postId]", params: { postId } });
  };

  const handleToggleFavorite = async (post: PostRecord) => {
    await toggleFavorite(post).catch(() => undefined);
  };

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Text style={styles.title}>DevGeet Posts</Text>
      <Text style={styles.subtitle}>{accountSubtitle}</Text>
      <Text style={styles.feedText}>{subtitle}</Text>

      {isLoading ? (
        <ActivityIndicator size="large" color={COLORS.primary} style={styles.loader} />
      ) : null}

      {posts.map((post) => {
        const thumbnailUrl = getPostCardThumbnailUrl(post);

        return (
          <View key={post.id} style={styles.card}>
            <Pressable
              style={({ pressed }) => [styles.cardBody, pressed && styles.cardBodyPressed]}
              onPress={() => openPost(post.id)}
            >
              {thumbnailUrl ? (
                <Image
                  source={{ uri: thumbnailUrl }}
                  style={styles.thumbnail}
                  resizeMode="cover"
                />
              ) : null}
              <Text style={styles.cardTitle}>{post.title}</Text>
              <Text style={styles.cardPreview}>{getPreviewText(post.content, 18)}</Text>
              <Text style={styles.meta}>
                Last update: {formatDate(post.uploadDate || post.createDate)}
              </Text>
            </Pressable>

            <Pressable
              style={[
                styles.favoriteButton,
                isFavorite(post.id) ? styles.favoriteButtonActive : undefined,
              ]}
              onPress={() => {
                void handleToggleFavorite(post);
              }}
            >
              <HugeiconsIcon
                icon={FavouriteIcon}
                size={18}
                color={isFavorite(post.id) ? "#B91C1C" : COLORS.mutedText}
              />
              <Text
                style={[
                  styles.favoriteButtonText,
                  isFavorite(post.id) ? styles.favoriteButtonTextActive : undefined,
                ]}
              >
                {isFavorite(post.id) ? "Unfav" : "Add to Fav"}
              </Text>
            </Pressable>
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
  title: {
    fontSize: FONT_SIZE.title,
    fontWeight: "700",
    color: COLORS.text,
  },
  subtitle: {
    fontSize: FONT_SIZE.body,
    color: COLORS.mutedText,
  },
  feedText: {
    fontSize: FONT_SIZE.body,
    color: COLORS.text,
  },
  loader: {
    marginVertical: SPACING.md,
  },
  card: {
    backgroundColor: COLORS.surface,
    borderColor: COLORS.border,
    borderWidth: 1,
    borderRadius: 14,
    padding: SPACING.lg,
    gap: SPACING.sm,
  },
  cardBody: {
    gap: SPACING.xs,
  },
  cardBodyPressed: {
    opacity: 0.85,
  },
  thumbnail: {
    width: "100%",
    height: 170,
    borderRadius: 10,
    backgroundColor: "#E5E7EB",
  },
  cardTitle: {
    fontSize: 17,
    fontWeight: "700",
    color: COLORS.text,
  },
  cardPreview: {
    fontSize: FONT_SIZE.body,
    color: COLORS.text,
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
  meta: {
    fontSize: 12,
    color: COLORS.mutedText,
  },
});
