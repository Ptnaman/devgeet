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
  query,
  type DocumentData,
} from "firebase/firestore";

import { COLORS, FONT_SIZE, RADIUS, SHADOWS, SPACING } from "@/constants/theme";
import {
  formatDate,
  getPostCardThumbnailUrl,
  mapPostRecord,
  POSTS_COLLECTION,
  sortPostsByRecency,
  type PostRecord,
} from "@/lib/content";
import { useFavorites } from "@/hooks/use-favorites";
import { firestore } from "@/lib/firebase";

export default function FavoriteScreen() {
  const router = useRouter();
  const { favoritePostIds, isFavorite, isLoadingFavorites, toggleFavorite } =
    useFavorites();
  const [posts, setPosts] = useState<PostRecord[]>([]);
  const [isLoadingPosts, setIsLoadingPosts] = useState(true);
  const [postsError, setPostsError] = useState("");

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

        setPosts(nextPosts);
        setPostsError("");
        setIsLoadingPosts(false);
      },
      () => {
        setPosts([]);
        setPostsError("Unable to load posts right now.");
        setIsLoadingPosts(false);
      },
    );

    return unsubscribe;
  }, []);

  const favoritePosts = useMemo(
    () => posts.filter((post) => favoritePostIds.has(post.id)),
    [favoritePostIds, posts],
  );

  const isLoading = isLoadingPosts || isLoadingFavorites;

  const openPost = (postId: string) => {
    router.push({ pathname: "/post/[postId]", params: { postId } });
  };

  const handleToggleFavorite = async (post: PostRecord) => {
    await toggleFavorite(post).catch(() => undefined);
  };

  const subtitle = useMemo(() => {
    if (isLoading) {
      return "Syncing favorite posts...";
    }

    if (postsError) {
      return postsError;
    }

    if (!favoritePosts.length) {
      return "No favorite posts yet.";
    }

    return `${favoritePosts.length} favorite post${favoritePosts.length === 1 ? "" : "s"}.`;
  }, [favoritePosts.length, isLoading, postsError]);

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Text style={styles.title}>Favorite Posts</Text>
      <Text style={styles.subtitle}>{subtitle}</Text>

      {isLoading ? (
        <ActivityIndicator size="large" color={COLORS.primary} style={styles.loader} />
      ) : null}

      {!isLoading && !favoritePosts.length ? (
        <View style={styles.emptyWrap}>
          <HugeiconsIcon icon={FavouriteIcon} size={40} color={COLORS.mutedText} />
          <Text style={styles.emptyText}>Add posts to favorite from Home or Post screen.</Text>
        </View>
      ) : null}

      {favoritePosts.map((post) => {
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
    padding: SPACING.xl,
    gap: SPACING.xl,
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
  loader: {
    marginVertical: SPACING.md,
  },
  emptyWrap: {
    alignItems: "center",
    justifyContent: "center",
    gap: SPACING.sm,
    borderRadius: RADIUS.md,
    padding: SPACING.lg,
    backgroundColor: COLORS.surface,
    ...SHADOWS.sm,
  },
  emptyText: {
    color: COLORS.mutedText,
    fontSize: 13,
    textAlign: "center",
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
    height: 156,
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
