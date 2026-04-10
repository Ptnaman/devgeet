import { useEffect, useMemo, useState } from "react";
import { Redirect, useRouter } from "expo-router";
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import {
  collection,
  onSnapshot,
  orderBy,
  query,
  type DocumentData,
} from "firebase/firestore";

import {
  CONTROL_SIZE,
  FONT_SIZE,
  RADIUS,
  SPACING,
  type ThemeColors,
  type ThemeMode,
} from "@/constants/theme";
import {
  CATEGORIES_COLLECTION,
  isPostTrashed,
  POSTS_COLLECTION,
  mapCategoryRecord,
  mapPostRecord,
  sortPostsByRecency,
  type CategoryRecord,
  type PostRecord,
} from "@/lib/content";
import { firestore } from "@/lib/firebase";
import { getRequestErrorMessage } from "@/lib/network";
import { useAuth } from "@/providers/auth-provider";
import { useNetworkStatus } from "@/providers/network-provider";
import { useAppTheme } from "@/providers/theme-provider";

export default function AdminOverviewScreen() {
  const { colors, resolvedTheme } = useAppTheme();
  const { isConnected } = useNetworkStatus();
  const router = useRouter();
  const { isAdmin, isOwner } = useAuth();
  const styles = createStyles(colors, resolvedTheme);
  const [categories, setCategories] = useState<CategoryRecord[]>([]);
  const [posts, setPosts] = useState<PostRecord[]>([]);
  const [isLoadingCategories, setIsLoadingCategories] = useState(true);
  const [isLoadingPosts, setIsLoadingPosts] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    const categoriesQuery = query(
      collection(firestore, CATEGORIES_COLLECTION),
      orderBy("name", "asc")
    );
    const postsQuery = query(collection(firestore, POSTS_COLLECTION));

    const unsubscribeCategories = onSnapshot(
      categoriesQuery,
      (snapshot) => {
        setCategories(
          snapshot.docs.map((item) =>
            mapCategoryRecord(item.id, item.data() as DocumentData)
          )
        );
        setError("");
        setIsLoadingCategories(false);
      },
      (snapshotError) => {
        setError(
          getRequestErrorMessage({
            error: snapshotError,
            isConnected,
            onlineMessage: "Unable to load categories.",
          })
        );
        setIsLoadingCategories(false);
      }
    );

    const unsubscribePosts = onSnapshot(
      postsQuery,
      (snapshot) => {
        setPosts(
          sortPostsByRecency(
            snapshot.docs.map((item) =>
              mapPostRecord(item.id, item.data() as DocumentData)
            )
          )
        );
        setError("");
        setIsLoadingPosts(false);
      },
      (snapshotError) => {
        setError(
          getRequestErrorMessage({
            error: snapshotError,
            isConnected,
            onlineMessage: "Unable to load posts.",
          })
        );
        setIsLoadingPosts(false);
      }
    );

    return () => {
      unsubscribeCategories();
      unsubscribePosts();
    };
  }, [isConnected]);

  const stats = useMemo(() => {
    const activePosts = posts.filter((item) => !isPostTrashed(item));
    const published = activePosts.filter((item) => item.status === "published").length;
    const pending = activePosts.filter((item) => item.status === "pending").length;
    const draft = activePosts.filter((item) => item.status === "draft").length;
    const trashed = posts.length - activePosts.length;

    return {
      totalPosts: activePosts.length,
      published,
      pending,
      draft,
      trashed,
      categories: categories.length,
    };
  }, [categories.length, posts]);

  const isLoading = isLoadingCategories || isLoadingPosts;

  if (!isAdmin) {
    return <Redirect href="/admin/posts" />;
  }

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Text style={styles.title}>Admin Control Center</Text>
      <Text style={styles.subtitle}>
        Posts and categories are read directly from Firebase.
      </Text>

      {error ? <Text style={styles.error}>{error}</Text> : null}
      {isLoading ? <ActivityIndicator size="small" color={colors.primary} /> : null}

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Overview</Text>
        <View style={styles.sectionDivider} />
        <View style={styles.statsGrid}>
          <View style={styles.statCard}>
            <Text style={styles.statLabel}>Total Posts</Text>
            <Text style={styles.statValue}>{stats.totalPosts}</Text>
          </View>
          <View style={styles.statCard}>
            <Text style={styles.statLabel}>Published</Text>
            <Text style={styles.statValue}>{stats.published}</Text>
          </View>
          <View style={styles.statCard}>
            <Text style={styles.statLabel}>Pending</Text>
            <Text style={styles.statValue}>{stats.pending}</Text>
          </View>
          <View style={styles.statCard}>
            <Text style={styles.statLabel}>Drafts</Text>
            <Text style={styles.statValue}>{stats.draft}</Text>
          </View>
          <View style={styles.statCard}>
            <Text style={styles.statLabel}>Categories</Text>
            <Text style={styles.statValue}>{stats.categories}</Text>
          </View>
          <View style={styles.statCard}>
            <Text style={styles.statLabel}>Recycle Bin</Text>
            <Text style={styles.statValue}>{stats.trashed}</Text>
          </View>
        </View>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Quick Actions</Text>
        <View style={styles.sectionDivider} />
        <View style={styles.quickGrid}>
          <Pressable
            style={({ pressed }) => [styles.quickCardPrimary, pressed && styles.buttonPressed]}
            onPress={() => router.push("/admin/posts/edit")}
          >
            <Text style={styles.quickCardTitlePrimary}>Create Post</Text>
            <Text style={styles.quickCardMetaPrimary}>Open post editor</Text>
          </Pressable>

          <Pressable
            style={({ pressed }) => [styles.quickCard, pressed && styles.buttonPressed]}
            onPress={() => router.push("/admin/posts")}
          >
            <Text style={styles.quickCardTitle}>Post List</Text>
            <Text style={styles.quickCardMeta}>Manage all posts</Text>
          </Pressable>

          <Pressable
            style={({ pressed }) => [styles.quickCard, pressed && styles.buttonPressed]}
            onPress={() => router.push("/admin/categories")}
          >
            <Text style={styles.quickCardTitle}>Categories</Text>
            <Text style={styles.quickCardMeta}>Manage categories</Text>
          </Pressable>

          {isOwner ? (
            <Pressable
              style={({ pressed }) => [styles.quickCard, pressed && styles.buttonPressed]}
              onPress={() => router.push("/admin/notifications")}
            >
              <Text style={styles.quickCardTitle}>Notifications</Text>
              <Text style={styles.quickCardMeta}>Send owner-only custom push alerts</Text>
            </Pressable>
          ) : null}

          {isOwner ? (
            <Pressable
              style={({ pressed }) => [styles.quickCard, pressed && styles.buttonPressed]}
              onPress={() => router.push("/admin/users")}
            >
              <Text style={styles.quickCardTitle}>Users</Text>
              <Text style={styles.quickCardMeta}>Assign roles and remove access</Text>
            </Pressable>
          ) : null}
        </View>
      </View>
    </ScrollView>
  );
}

const createStyles = (colors: ThemeColors, resolvedTheme: ThemeMode) => {
  return StyleSheet.create({
  container: {
    padding: SPACING.xl,
    gap: SPACING.md,
    backgroundColor: colors.background,
  },
  title: {
    fontSize: FONT_SIZE.title,
    fontWeight: "700",
    color: colors.text,
  },
  subtitle: {
    color: colors.mutedText,
    fontSize: FONT_SIZE.body,
  },
  error: {
    color: colors.danger,
    fontSize: 13,
  },
  section: {
    backgroundColor: colors.surface,
    borderRadius: RADIUS.lg,
    padding: SPACING.lg,
    gap: SPACING.sm,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: colors.text,
  },
  sectionDivider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: colors.divider,
  },
  statsGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: SPACING.sm,
  },
  statCard: {
    width: "48%",
    borderRadius: RADIUS.md,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.md,
    backgroundColor: colors.surfaceMuted,
  },
  statLabel: {
    fontSize: 12,
    color: colors.mutedText,
  },
  statValue: {
    fontSize: 20,
    fontWeight: "700",
    color: colors.text,
    marginTop: 2,
  },
  quickGrid: {
    gap: SPACING.sm,
  },
  quickCardPrimary: {
    minHeight: CONTROL_SIZE.inputHeight,
    borderRadius: RADIUS.md,
    backgroundColor: colors.primary,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.md,
    gap: 2,
  },
  quickCardTitlePrimary: {
    color: colors.primaryText,
    fontSize: 15,
    fontWeight: "700",
  },
  quickCardMetaPrimary: {
    color: colors.primaryMutedText,
    fontSize: 12,
  },
  quickCard: {
    minHeight: CONTROL_SIZE.inputHeight,
    borderRadius: RADIUS.md,
    backgroundColor: colors.surfaceMuted,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.md,
    gap: 2,
  },
  quickCardTitle: {
    color: colors.text,
    fontSize: 15,
    fontWeight: "700",
  },
  quickCardMeta: {
    color: colors.mutedText,
    fontSize: 12,
  },
  buttonPressed: {
    opacity: 0.9,
  },
  });
};
