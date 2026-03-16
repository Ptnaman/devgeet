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
  Alert,
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";

import { FONT_SIZE, RADIUS, SHADOWS, SPACING, type ThemeColors } from "@/constants/theme";
import { SkeletonBlock } from "@/components/skeleton-block";
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
import { getActionErrorMessage, getRequestErrorMessage } from "@/lib/network";
import { useNetworkStatus } from "@/providers/network-provider";
import { useAppTheme } from "@/providers/theme-provider";

const HOME_SKELETON_ITEMS = Array.from({ length: 3 }, (_, index) => index);

export default function HomeScreen() {
  const { colors } = useAppTheme();
  const router = useRouter();
  const { isFavorite, toggleFavorite } = useFavorites();
  const { isConnected } = useNetworkStatus();
  const styles = createStyles(colors);
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
      (snapshotError) => {
        setError(
          getRequestErrorMessage({
            error: snapshotError,
            isConnected,
            onlineMessage: "Unable to load posts right now.",
          }),
        );
        setIsLoading(false);
      },
    );

    return unsubscribe;
  }, [isConnected]);

  const openPost = (postId: string) => {
    router.push({ pathname: "/post/[postId]", params: { postId } });
  };

  const handleToggleFavorite = async (post: PostRecord) => {
    try {
      await toggleFavorite(post);
    } catch (toggleError) {
      Alert.alert(
        "Unable to update favorites",
        getActionErrorMessage({
          error: toggleError,
          isConnected,
          fallbackMessage: "Favorites could not be updated right now.",
        }),
      );
    }
  };

  return (
    <ScrollView contentContainerStyle={styles.container}>
      {isLoading
        ? HOME_SKELETON_ITEMS.map((item) => (
            <View key={item} style={styles.card}>
              <View style={styles.cardBody}>
                <SkeletonBlock height={156} borderRadius={RADIUS.md} />
                <SkeletonBlock width="82%" height={24} />
                <SkeletonBlock width="68%" height={24} />
                <SkeletonBlock width="100%" height={16} borderRadius={RADIUS.sm} />
                <SkeletonBlock width="76%" height={16} borderRadius={RADIUS.sm} />
              </View>

              <View style={styles.cardFooter}>
                <SkeletonBlock width={92} height={16} borderRadius={RADIUS.sm} />
                <SkeletonBlock
                  width={86}
                  height={34}
                  borderRadius={RADIUS.pill}
                />
              </View>
            </View>
          ))
        : null}

      {!isLoading && error ? <Text style={styles.errorText}>{error}</Text> : null}

      {!isLoading
        ? posts.map((post) => {
            const thumbnailUrl = getPostCardThumbnailUrl(post);
            const favorite = isFavorite(post.id);
            const updatedLabel = formatDate(post.uploadDate || post.createDate);

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
                  <Text style={styles.cardTitle} numberOfLines={3} ellipsizeMode="tail">
                    {post.title}
                  </Text>
                  <Text
                    style={styles.cardPreview}
                    numberOfLines={2}
                    ellipsizeMode="tail"
                  >
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
                      color={favorite ? colors.danger : colors.mutedText}
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
          })
        : null}
    </ScrollView>
  );
}

const createStyles = (colors: ThemeColors) => StyleSheet.create({
  container: {
    flexGrow: 1,
    padding: SPACING.xxl,
    gap: SPACING.xl,
    backgroundColor: colors.background,
  },
  card: {
    backgroundColor: colors.surface,
    borderRadius: RADIUS.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: SPACING.lg,
    gap: SPACING.sm,
    ...SHADOWS.sm,
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
    borderRadius: RADIUS.md,
    backgroundColor: colors.surfaceSoft,
  },
  cardTitle: {
    fontSize: 17,
    fontWeight: "700",
    color: colors.text,
    lineHeight: 23,
  },
  cardPreview: {
    fontSize: FONT_SIZE.body,
    color: colors.mutedText,
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
    borderColor: colors.border,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 5,
    backgroundColor: colors.surfaceMuted,
  },
  favoriteButtonActive: {
    borderColor: colors.dangerBorder,
    backgroundColor: colors.dangerSoft,
  },
  favoriteButtonText: {
    color: colors.text,
    fontSize: 12,
    fontWeight: "700",
  },
  favoriteButtonTextActive: {
    color: colors.danger,
  },
  errorText: {
    color: colors.danger,
    fontSize: 13,
  },
  meta: {
    fontSize: 12,
    color: colors.mutedText,
  },
});
