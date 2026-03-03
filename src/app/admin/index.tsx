import { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useRouter } from "expo-router";
import {
  collection,
  onSnapshot,
  orderBy,
  query,
  type DocumentData,
} from "firebase/firestore";

import { COLORS, CONTROL_SIZE, FONT_SIZE, RADIUS, SPACING } from "@/constants/theme";
import {
  CATEGORIES_COLLECTION,
  POSTS_COLLECTION,
  mapCategoryRecord,
  mapPostRecord,
  sortPostsByRecency,
  type CategoryRecord,
  type PostRecord,
} from "@/lib/content";
import { firestore } from "@/lib/firebase";

export default function AdminOverviewScreen() {
  const router = useRouter();
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
      () => {
        setError("Unable to load categories.");
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
      () => {
        setError("Unable to load posts.");
        setIsLoadingPosts(false);
      }
    );

    return () => {
      unsubscribeCategories();
      unsubscribePosts();
    };
  }, []);

  const stats = useMemo(() => {
    const published = posts.filter((item) => item.status === "published").length;
    const draft = posts.length - published;

    return {
      totalPosts: posts.length,
      published,
      draft,
      categories: categories.length,
    };
  }, [categories.length, posts]);

  const isLoading = isLoadingCategories || isLoadingPosts;

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Text style={styles.title}>Admin Control Center</Text>
      <Text style={styles.subtitle}>
        Posts and categories are read directly from Firebase.
      </Text>

      {error ? <Text style={styles.error}>{error}</Text> : null}
      {isLoading ? <ActivityIndicator size="small" color={COLORS.primary} /> : null}

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Overview</Text>
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
            <Text style={styles.statLabel}>Drafts</Text>
            <Text style={styles.statValue}>{stats.draft}</Text>
          </View>
          <View style={styles.statCard}>
            <Text style={styles.statLabel}>Categories</Text>
            <Text style={styles.statValue}>{stats.categories}</Text>
          </View>
        </View>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Quick Actions</Text>
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
        </View>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: SPACING.xl,
    gap: SPACING.md,
    backgroundColor: COLORS.background,
  },
  title: {
    fontSize: FONT_SIZE.title,
    fontWeight: "700",
    color: COLORS.text,
  },
  subtitle: {
    color: COLORS.mutedText,
    fontSize: FONT_SIZE.body,
  },
  error: {
    color: COLORS.danger,
    fontSize: 13,
  },
  section: {
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: RADIUS.lg,
    padding: SPACING.lg,
    gap: SPACING.sm,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: COLORS.text,
  },
  statsGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: SPACING.sm,
  },
  statCard: {
    width: "48%",
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: RADIUS.md,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.md,
    backgroundColor: COLORS.surface,
  },
  statLabel: {
    fontSize: 12,
    color: COLORS.mutedText,
  },
  statValue: {
    fontSize: 20,
    fontWeight: "700",
    color: COLORS.text,
    marginTop: 2,
  },
  quickGrid: {
    gap: SPACING.sm,
  },
  quickCardPrimary: {
    minHeight: CONTROL_SIZE.inputHeight,
    borderRadius: RADIUS.md,
    backgroundColor: COLORS.primary,
    borderWidth: 1,
    borderColor: COLORS.primary,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.md,
    gap: 2,
  },
  quickCardTitlePrimary: {
    color: COLORS.primaryText,
    fontSize: 15,
    fontWeight: "700",
  },
  quickCardMetaPrimary: {
    color: "#DBEAFE",
    fontSize: 12,
  },
  quickCard: {
    minHeight: CONTROL_SIZE.inputHeight,
    borderRadius: RADIUS.md,
    borderWidth: 1,
    borderColor: COLORS.border,
    backgroundColor: COLORS.surface,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.md,
    gap: 2,
  },
  quickCardTitle: {
    color: COLORS.text,
    fontSize: 15,
    fontWeight: "700",
  },
  quickCardMeta: {
    color: COLORS.mutedText,
    fontSize: 12,
  },
  buttonPressed: {
    opacity: 0.9,
  },
});
