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
  Image,
  Linking,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";

import { FONT_SIZE, RADIUS, SHADOWS, SPACING, type ThemeColors } from "@/constants/theme";
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
import { getRequestErrorMessage } from "@/lib/network";
import { useNetworkStatus } from "@/providers/network-provider";
import { useAppTheme } from "@/providers/theme-provider";

const USERS_COLLECTION = "users";

type PublicAuthorProfile = {
  uid: string;
  displayName: string;
  username: string;
  bio: string;
  location: string;
  website: string;
  instagramUrl: string;
  youtubeUrl: string;
  facebookUrl: string;
  photoURL: string;
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
    location: readStringValue(data?.location),
    website: readStringValue(data?.website),
    instagramUrl: readStringValue(data?.instagramUrl),
    youtubeUrl: readStringValue(data?.youtubeUrl),
    facebookUrl: readStringValue(data?.facebookUrl),
    photoURL: readStringValue(data?.photoURL),
  };
};

export default function AuthorProfileScreen() {
  const { colors } = useAppTheme();
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
  const links = useMemo(
    () =>
      [
        { label: "Website", value: author?.website ?? "" },
        { label: "Instagram", value: author?.instagramUrl ?? "" },
        { label: "YouTube", value: author?.youtubeUrl ?? "" },
        { label: "Facebook", value: author?.facebookUrl ?? "" },
      ].filter((item) => item.value),
    [author?.facebookUrl, author?.instagramUrl, author?.website, author?.youtubeUrl],
  );

  const openExternalLink = async (url: string) => {
    if (!isConnected) {
      showOfflineToast();
      return;
    }

    await Linking.openURL(url).catch(() => {
      setError("Unable to open this link right now.");
    });
  };

  const openPost = (postId: string) => {
    router.push({ pathname: "/post/[postId]", params: { postId } });
  };

  const isLoading = isLoadingAuthor || isLoadingPosts;

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

              <Text style={styles.title}>{author.displayName}</Text>
              {author.username ? <Text style={styles.username}>@{author.username}</Text> : null}
              {author.bio ? <Text style={styles.bio}>{author.bio}</Text> : null}
              {author.location ? <Text style={styles.meta}>Location: {author.location}</Text> : null}
              <Text style={styles.meta}>
                {posts.length} published post{posts.length === 1 ? "" : "s"}
              </Text>
            </View>

            {links.length ? (
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>Links</Text>
                <View style={styles.linkRow}>
                  {links.map((item) => (
                    <Pressable
                      key={item.label}
                      style={({ pressed }) => [
                        styles.linkChip,
                        pressed && styles.linkChipPressed,
                      ]}
                      onPress={() => {
                        void openExternalLink(item.value);
                      }}
                    >
                      <Text style={styles.linkChipText}>{item.label}</Text>
                    </Pressable>
                  ))}
                </View>
              </View>
            ) : null}

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
    linkRow: {
      flexDirection: "row",
      flexWrap: "wrap",
      gap: SPACING.sm,
    },
    linkChip: {
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 999,
      backgroundColor: colors.surfaceMuted,
      paddingHorizontal: SPACING.md,
      paddingVertical: SPACING.sm,
    },
    linkChipPressed: {
      opacity: 0.85,
    },
    linkChipText: {
      color: colors.text,
      fontSize: 13,
      fontWeight: "600",
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
