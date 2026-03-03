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
  formatDate,
  getPostCardThumbnailUrl,
  mapCategoryRecord,
  mapPostRecord,
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
    const postsQuery = query(
      collection(firestore, POSTS_COLLECTION),
      orderBy("createDate", "desc")
    );

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
          snapshot.docs.map((item) => mapPostRecord(item.id, item.data() as DocumentData))
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
  const latestPosts = posts.slice(0, 5);

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
        <View style={styles.buttonRow}>
          <Pressable
            style={({ pressed }) => [styles.button, pressed && styles.buttonPressed]}
            onPress={() => router.push("/admin/posts")}
          >
            <Text style={styles.buttonText}>Manage Posts</Text>
          </Pressable>
          <Pressable
            style={({ pressed }) => [styles.button, pressed && styles.buttonPressed]}
            onPress={() => router.push("/admin/categories")}
          >
            <Text style={styles.buttonText}>Manage Categories</Text>
          </Pressable>
        </View>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Recent Posts</Text>
        {!latestPosts.length ? (
          <Text style={styles.mutedText}>No posts available yet.</Text>
        ) : null}
        {latestPosts.map((post) => {
          const thumbnailUrl = getPostCardThumbnailUrl(post);

          return (
            <View key={post.id} style={styles.postCard}>
              {thumbnailUrl ? (
                <Image
                  source={{ uri: thumbnailUrl }}
                  style={styles.thumbnail}
                  resizeMode="cover"
                />
              ) : null}
              <Text style={styles.postTitle}>{post.title}</Text>
              <Text style={styles.postMeta}>Category: {post.category}</Text>
              <Text style={styles.postMeta}>Status: {post.status}</Text>
              <Text style={styles.postMeta}>Upload Date: {formatDate(post.uploadDate)}</Text>
            </View>
          );
        })}
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
  buttonRow: {
    gap: SPACING.sm,
  },
  button: {
    minHeight: CONTROL_SIZE.inputHeight,
    borderRadius: RADIUS.md,
    backgroundColor: COLORS.primary,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: SPACING.md,
  },
  buttonText: {
    color: COLORS.primaryText,
    fontSize: FONT_SIZE.button,
    fontWeight: "700",
  },
  buttonPressed: {
    opacity: 0.9,
  },
  mutedText: {
    color: COLORS.mutedText,
    fontSize: FONT_SIZE.body,
  },
  postCard: {
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: RADIUS.md,
    padding: SPACING.md,
    backgroundColor: COLORS.surface,
    gap: SPACING.xs,
  },
  thumbnail: {
    width: "100%",
    height: 150,
    borderRadius: RADIUS.md,
    backgroundColor: "#E5E7EB",
    marginBottom: SPACING.xs,
  },
  postTitle: {
    color: COLORS.text,
    fontSize: 16,
    fontWeight: "700",
  },
  postMeta: {
    color: COLORS.mutedText,
    fontSize: 12,
  },
});
