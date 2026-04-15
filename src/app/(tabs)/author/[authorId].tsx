import { Stack, useLocalSearchParams, useRouter } from "expo-router";
import {
  collection,
  doc,
  onSnapshot,
  query,
  where,
  type DocumentData,
} from "firebase/firestore";
import { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";

import { VerifiedRoleBadge } from "@/components/verified-role-badge";
import { useAuthorFollows } from "@/hooks/use-author-follows";
import { FONT_SIZE, RADIUS, SHADOWS, SPACING, type ThemeColors } from "@/constants/theme";
import { getEffectiveUserRole, type UserRole } from "@/lib/access";
import {
  formatDate,
  getPostCardThumbnailUrl,
  isPostTrashed,
  mapPostRecord,
  POSTS_COLLECTION,
  sortPostsByRecency,
  type PostRecord,
} from "@/lib/content";
import { firestore } from "@/lib/firebase";
import { DEFAULT_OFFLINE_MESSAGE, getActionErrorMessage, getRequestErrorMessage } from "@/lib/network";
import { useAuth } from "@/providers/auth-provider";
import { useNetworkStatus } from "@/providers/network-provider";
import { useAppTheme } from "@/providers/theme-provider";

const USERS_COLLECTION = "users";

type PublicAuthorProfile = {
  uid: string;
  displayName: string;
  username: string;
  bio: string;
  photoURL: string;
  role: UserRole;
};

const resolveAuthorId = (value: string | string[] | undefined) =>
  typeof value === "string" ? value : "";

const readStringValue = (value: unknown) => (typeof value === "string" ? value.trim() : "");

const mapPublicAuthorProfile = (uid: string, data: DocumentData): PublicAuthorProfile => {
  const displayName =
    readStringValue(data?.displayName) ||
    `${readStringValue(data?.firstName)} ${readStringValue(data?.lastName)}`.trim() ||
    readStringValue(data?.username) ||
    readStringValue(data?.email) ||
    "Author";

  return {
    uid,
    displayName,
    username: readStringValue(data?.username),
    bio: readStringValue(data?.bio),
    photoURL: readStringValue(data?.photoURL),
    role: getEffectiveUserRole(readStringValue(data?.role)),
  };
};

export default function AuthorProfileScreen() {
  const { colors } = useAppTheme();
  const { user } = useAuth();
  const { isConnected, showOfflineToast } = useNetworkStatus();
  const router = useRouter();
  const styles = createStyles(colors);
  const { authorId: authorIdParam } = useLocalSearchParams<{ authorId?: string }>();
  const authorId = resolveAuthorId(authorIdParam);
  const [author, setAuthor] = useState<PublicAuthorProfile | null>(null);
  const [posts, setPosts] = useState<PostRecord[]>([]);
  const [isLoadingAuthor, setIsLoadingAuthor] = useState(true);
  const [isLoadingPosts, setIsLoadingPosts] = useState(true);
  const [error, setError] = useState("");
  const { isFollowingAuthor, isLoadingAuthorFollows, toggleAuthorFollow } = useAuthorFollows();

  useEffect(() => {
    if (!authorId) {
      setError("Author not found.");
      setAuthor(null);
      setPosts([]);
      setIsLoadingAuthor(false);
      setIsLoadingPosts(false);
      return;
    }

    const unsubscribeAuthor = onSnapshot(
      doc(firestore, USERS_COLLECTION, authorId),
      (snapshot) => {
        if (!snapshot.exists()) {
          setAuthor(null);
          setError("Author profile is not available.");
          setIsLoadingAuthor(false);
          return;
        }

        setAuthor(mapPublicAuthorProfile(snapshot.id, snapshot.data() as DocumentData));
        setError("");
        setIsLoadingAuthor(false);
      },
      (snapshotError) => {
        setAuthor(null);
        setError(
          getRequestErrorMessage({
            error: snapshotError,
            isConnected,
            onlineMessage: "Unable to load author profile.",
          }),
        );
        setIsLoadingAuthor(false);
      },
    );

    const authorPostsQuery = query(
      collection(firestore, POSTS_COLLECTION),
      where("createdBy", "==", authorId),
      where("status", "==", "published"),
    );

    const unsubscribePosts = onSnapshot(
      authorPostsQuery,
      (snapshot) => {
        const nextPosts = sortPostsByRecency(
          snapshot.docs
            .map((item) => mapPostRecord(item.id, item.data() as DocumentData))
            .filter((item) => item.status === "published" && !isPostTrashed(item)),
        );
        setPosts(nextPosts);
        setIsLoadingPosts(false);
      },
      (snapshotError) => {
        setPosts([]);
        setError(
          getRequestErrorMessage({
            error: snapshotError,
            isConnected,
            onlineMessage: "Unable to load author posts.",
          }),
        );
        setIsLoadingPosts(false);
      },
    );

    return () => {
      unsubscribeAuthor();
      unsubscribePosts();
    };
  }, [authorId, isConnected]);

  const profileTitle = useMemo(() => author?.displayName || "Author Profile", [author?.displayName]);

  const openPost = (postId: string) => {
    router.push({ pathname: "/post/[postId]", params: { postId } });
  };

  const isLoading = isLoadingAuthor || isLoadingPosts;
  const canFollowAuthor = Boolean(
    author &&
      author.uid &&
      author.uid !== user?.uid &&
      (author.role === "author" || author.role === "admin"),
  );
  const isFollowingCurrentAuthor = author ? isFollowingAuthor(author.uid) : false;

  const handleToggleAuthorFollow = async () => {
    if (!author) {
      return;
    }

    try {
      await toggleAuthorFollow({
        uid: author.uid,
        displayName: author.displayName,
        username: author.username,
      });
    } catch (toggleError) {
      const message = getActionErrorMessage({
        error: toggleError,
        isConnected,
        fallbackMessage: "Author follow could not be updated right now.",
      });

      if (message === DEFAULT_OFFLINE_MESSAGE) {
        showOfflineToast();
        return;
      }

      Alert.alert("Unable to update follow", message);
    }
  };

  return (
    <View style={styles.screen}>
      <Stack.Screen options={{ title: profileTitle }} />

      <ScrollView contentContainerStyle={styles.container} showsVerticalScrollIndicator={false}>
        {isLoading ? (
          <View style={styles.loadingWrap}>
            <ActivityIndicator size="large" color={colors.primary} />
          </View>
        ) : null}

        {!isLoading && author ? (
          <>
            <View style={styles.heroCard}>
              {author.photoURL ? (
                <Image source={{ uri: author.photoURL }} style={styles.avatar} />
              ) : (
                <View style={[styles.avatar, styles.avatarFallback]}>
                  <Text style={styles.avatarFallbackText}>
                    {author.displayName.charAt(0).toUpperCase()}
                  </Text>
                </View>
              )}

              <View style={styles.titleRow}>
                <Text style={styles.title}>{author.displayName}</Text>
                <VerifiedRoleBadge role={author.role} size="md" />
              </View>
              {author.username ? <Text style={styles.username}>@{author.username}</Text> : null}
              {author.bio ? <Text style={styles.bio}>{author.bio}</Text> : null}
              <Text style={styles.meta}>
                {posts.length} published post{posts.length === 1 ? "" : "s"}
              </Text>
              {canFollowAuthor ? (
                <Pressable
                  style={({ pressed }) => [
                    styles.followButton,
                    isFollowingCurrentAuthor && styles.followButtonActive,
                    pressed && styles.followButtonPressed,
                  ]}
                  onPress={() => {
                    void handleToggleAuthorFollow();
                  }}
                  accessibilityRole="button"
                  accessibilityLabel={
                    isFollowingCurrentAuthor
                      ? `Unfollow ${author.displayName}`
                      : `Follow ${author.displayName}`
                  }
                >
                  {isLoadingAuthorFollows ? (
                    <ActivityIndicator
                      size="small"
                      color={isFollowingCurrentAuthor ? colors.text : colors.primaryText}
                    />
                  ) : (
                    <Text
                      style={[
                        styles.followButtonText,
                        isFollowingCurrentAuthor && styles.followButtonTextActive,
                      ]}
                    >
                      {isFollowingCurrentAuthor ? "Following" : "Follow Author"}
                    </Text>
                  )}
                </Pressable>
              ) : null}
            </View>

            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Published Posts</Text>
              {!posts.length ? (
                <Text style={styles.emptyText}>No published posts from this author yet.</Text>
              ) : null}

              {posts.map((post) => {
                const thumbnailUrl = getPostCardThumbnailUrl(post);

                return (
                  <Pressable
                    key={post.id}
                    style={({ pressed }) => [
                      styles.postCard,
                      pressed && styles.postCardPressed,
                    ]}
                    onPress={() => openPost(post.id)}
                  >
                    {thumbnailUrl ? (
                      <Image source={{ uri: thumbnailUrl }} style={styles.thumbnail} />
                    ) : (
                      <View style={styles.thumbnailPlaceholder} />
                    )}

                    <View style={styles.postContent}>
                      <Text style={styles.postTitle} numberOfLines={2}>
                        {post.title}
                      </Text>
                      <Text style={styles.postPreview} numberOfLines={2}>
                        {post.content.trim() || "-"}
                      </Text>
                      <Text style={styles.postMeta}>
                        Published {formatDate(post.publishedAt || post.uploadDate || post.createDate)}
                      </Text>
                    </View>
                  </Pressable>
                );
              })}
            </View>
          </>
        ) : null}

        {!isLoading && error ? <Text style={styles.error}>{error}</Text> : null}
      </ScrollView>
    </View>
  );
}

const createStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    screen: {
      flex: 1,
      backgroundColor: colors.background,
    },
    container: {
      padding: SPACING.xl,
      paddingBottom: SPACING.xxl * 2,
      gap: SPACING.md,
    },
    loadingWrap: {
      minHeight: 240,
      alignItems: "center",
      justifyContent: "center",
    },
    heroCard: {
      alignItems: "center",
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: RADIUS.lg,
      backgroundColor: colors.surface,
      padding: SPACING.xl,
      gap: SPACING.xs,
      ...SHADOWS.sm,
    },
    avatar: {
      width: 88,
      height: 88,
      borderRadius: 999,
      backgroundColor: colors.surfaceSoft,
    },
    avatarFallback: {
      alignItems: "center",
      justifyContent: "center",
    },
    avatarFallbackText: {
      color: colors.text,
      fontSize: 30,
      fontWeight: "700",
    },
    title: {
      color: colors.text,
      fontSize: 24,
      fontWeight: "700",
      textAlign: "center",
    },
    titleRow: {
      flexDirection: "row",
      flexWrap: "wrap",
      alignItems: "center",
      justifyContent: "center",
      gap: SPACING.sm,
    },
    username: {
      color: colors.accent,
      fontSize: 14,
      fontWeight: "700",
    },
    bio: {
      color: colors.text,
      fontSize: FONT_SIZE.body,
      lineHeight: 22,
      textAlign: "center",
    },
    meta: {
      color: colors.mutedText,
      fontSize: 13,
    },
    followButton: {
      minWidth: 144,
      marginTop: SPACING.md,
      alignItems: "center",
      justifyContent: "center",
      borderRadius: RADIUS.pill,
      backgroundColor: colors.primary,
      paddingHorizontal: SPACING.xl,
      paddingVertical: SPACING.sm + 2,
    },
    followButtonActive: {
      borderWidth: 1,
      borderColor: colors.accentBorder,
      backgroundColor: colors.accentSoft,
    },
    followButtonPressed: {
      opacity: 0.9,
    },
    followButtonText: {
      color: colors.primaryText,
      fontSize: 14,
      fontWeight: "700",
    },
    followButtonTextActive: {
      color: colors.text,
    },
    section: {
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: RADIUS.lg,
      backgroundColor: colors.surface,
      padding: SPACING.lg,
      gap: SPACING.sm,
      ...SHADOWS.sm,
    },
    sectionTitle: {
      color: colors.text,
      fontSize: 18,
      fontWeight: "700",
    },
    emptyText: {
      color: colors.mutedText,
      fontSize: FONT_SIZE.body,
    },
    postCard: {
      flexDirection: "row",
      gap: SPACING.md,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: RADIUS.md,
      backgroundColor: colors.surface,
      padding: SPACING.md,
    },
    postCardPressed: {
      opacity: 0.92,
    },
    thumbnail: {
      width: 112,
      height: 84,
      borderRadius: RADIUS.md,
      backgroundColor: colors.surfaceSoft,
    },
    thumbnailPlaceholder: {
      width: 112,
      height: 84,
      borderRadius: RADIUS.md,
      backgroundColor: colors.surfaceSoft,
    },
    postContent: {
      flex: 1,
      gap: SPACING.xs,
      justifyContent: "center",
    },
    postTitle: {
      color: colors.text,
      fontSize: 16,
      fontWeight: "700",
      lineHeight: 22,
    },
    postPreview: {
      color: colors.mutedText,
      fontSize: FONT_SIZE.body,
      lineHeight: 20,
    },
    postMeta: {
      color: colors.mutedText,
      fontSize: 12,
    },
    error: {
      color: colors.danger,
      fontSize: 13,
    },
  });
