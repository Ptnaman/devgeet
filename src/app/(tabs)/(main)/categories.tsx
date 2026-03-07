import { useRouter } from "expo-router";
import {
  collection,
  onSnapshot,
  orderBy,
  query,
  type DocumentData,
} from "firebase/firestore";
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

import { COLORS, FONT_SIZE, RADIUS, SHADOWS, SPACING } from "@/constants/theme";
import {
  CATEGORIES_COLLECTION,
  getPostCardThumbnailUrl,
  mapCategoryRecord,
  mapPostRecord,
  POSTS_COLLECTION,
  sortPostsByRecency,
  type CategoryRecord,
  type PostRecord,
} from "@/lib/content";
import { firestore } from "@/lib/firebase";

const normalizeCategoryKey = (value: string) => value.trim().toLowerCase();

export default function CategoriesScreen() {
  const router = useRouter();
  const [categories, setCategories] = useState<CategoryRecord[]>([]);
  const [posts, setPosts] = useState<PostRecord[]>([]);
  const [selectedCategory, setSelectedCategory] = useState("");
  const [isLoadingCategories, setIsLoadingCategories] = useState(true);
  const [isLoadingPosts, setIsLoadingPosts] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    const categoriesQuery = query(
      collection(firestore, CATEGORIES_COLLECTION),
      orderBy("name", "asc"),
    );
    const postsQuery = query(collection(firestore, POSTS_COLLECTION));

    const unsubscribeCategories = onSnapshot(
      categoriesQuery,
      (snapshot) => {
        const nextCategories = snapshot.docs.map((item) =>
          mapCategoryRecord(item.id, item.data() as DocumentData),
        );
        setCategories(nextCategories);
        setError("");
        setIsLoadingCategories(false);
      },
      () => {
        setIsLoadingCategories(false);
        setError("Unable to load categories.");
      },
    );

    const unsubscribePosts = onSnapshot(
      postsQuery,
      (snapshot) => {
        const nextPosts = sortPostsByRecency(
          snapshot.docs
            .map((item) => mapPostRecord(item.id, item.data() as DocumentData))
            .filter((item) => item.status === "published"),
        );
        setPosts(nextPosts);
        setError("");
        setIsLoadingPosts(false);
      },
      () => {
        setIsLoadingPosts(false);
        setError("Unable to load posts.");
      },
    );

    return () => {
      unsubscribeCategories();
      unsubscribePosts();
    };
  }, []);

  useEffect(() => {
    if (
      selectedCategory &&
      !categories.some(
        (item) =>
          normalizeCategoryKey(item.slug) ===
          normalizeCategoryKey(selectedCategory),
      )
    ) {
      setSelectedCategory("");
    }
  }, [categories, selectedCategory]);

  const isLoading = isLoadingCategories || isLoadingPosts;

  const postCountsByCategory = useMemo(() => {
    const counts = new Map<string, number>();
    posts.forEach((post) => {
      const key = normalizeCategoryKey(post.category);
      counts.set(key, (counts.get(key) ?? 0) + 1);
    });
    return counts;
  }, [posts]);

  const selectedCategoryName = useMemo(() => {
    if (!selectedCategory) {
      return "";
    }

    const selected = categories.find(
      (item) =>
        normalizeCategoryKey(item.slug) === normalizeCategoryKey(selectedCategory),
    );
    return selected?.name ?? selectedCategory;
  }, [categories, selectedCategory]);

  const categoryPosts = useMemo(() => {
    if (!selectedCategory) {
      return [];
    }

    const key = normalizeCategoryKey(selectedCategory);
    return posts.filter((item) => normalizeCategoryKey(item.category) === key);
  }, [posts, selectedCategory]);

  const openPost = (postId: string) => {
    router.push({ pathname: "/post/[postId]", params: { postId } });
  };

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Text style={styles.title}>Categories</Text>
      <Text style={styles.subtitle}>
        Category par tap karo aur uske saare published posts dekho.
      </Text>

      {error ? <Text style={styles.error}>{error}</Text> : null}

      {isLoading ? (
        <ActivityIndicator size="large" color={COLORS.primary} style={styles.loader} />
      ) : null}

      {!isLoading && !categories.length ? (
        <View style={styles.emptyWrap}>
          <Text style={styles.emptyText}>No categories found.</Text>
        </View>
      ) : null}

      {!!categories.length ? (
        <View style={styles.grid}>
          {categories.map((item) => {
            const categoryKey = normalizeCategoryKey(item.slug);
            const isActive =
              normalizeCategoryKey(selectedCategory) === categoryKey;
            const postCount = postCountsByCategory.get(categoryKey) ?? 0;

            return (
              <Pressable
                key={item.id}
                style={[
                  styles.categoryCard,
                  isActive ? styles.categoryCardActive : undefined,
                ]}
                onPress={() => setSelectedCategory(item.slug)}
              >
                <Text
                  style={[
                    styles.categoryName,
                    isActive ? styles.categoryNameActive : undefined,
                  ]}
                  numberOfLines={2}
                >
                  {item.name}
                </Text>
                <Text
                  style={[
                    styles.categorySlug,
                    isActive ? styles.categorySlugActive : undefined,
                  ]}
                  numberOfLines={1}
                >
                  {item.slug}
                </Text>
                <Text
                  style={[
                    styles.categoryCount,
                    isActive ? styles.categoryCountActive : undefined,
                  ]}
                >
                  {postCount} post{postCount === 1 ? "" : "s"}
                </Text>
              </Pressable>
            );
          })}
        </View>
      ) : null}

      {selectedCategory ? (
        <View style={styles.resultsWrap}>
          <Text style={styles.resultsTitle}>{selectedCategoryName} Posts</Text>
          <Text style={styles.resultsMeta}>
            {categoryPosts.length} post{categoryPosts.length === 1 ? "" : "s"}{" "}
            found
          </Text>

          {!categoryPosts.length ? (
            <View style={styles.emptyWrap}>
              <Text style={styles.emptyText}>
                No published posts in this category yet.
              </Text>
            </View>
          ) : null}

          {categoryPosts.map((post) => {
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
                  <Image
                    source={{ uri: thumbnailUrl }}
                    style={styles.thumbnail}
                    resizeMode="cover"
                  />
                ) : (
                  <View style={styles.thumbnailPlaceholder} />
                )}

                <View style={styles.postContent}>
                  <Text style={styles.postTitle} numberOfLines={2} ellipsizeMode="tail">
                    {post.title}
                  </Text>
                  <Text
                    style={styles.postPreview}
                    numberOfLines={3}
                    ellipsizeMode="tail"
                  >
                    {post.content.trim() || "-"}
                  </Text>
                </View>
              </Pressable>
            );
          })}
        </View>
      ) : (
        !isLoading && (
          <View style={styles.emptyWrap}>
            <Text style={styles.emptyText}>
              Select a category to view its posts.
            </Text>
          </View>
        )
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flexGrow: 1,
    padding: SPACING.xl,
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
  loader: {
    marginVertical: SPACING.md,
  },
  error: {
    color: COLORS.danger,
    fontSize: 13,
  },
  emptyWrap: {
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: RADIUS.md,
    padding: SPACING.md,
    backgroundColor: COLORS.surface,
  },
  emptyText: {
    color: COLORS.mutedText,
    fontSize: 13,
    textAlign: "center",
  },
  grid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: SPACING.sm,
  },
  categoryCard: {
    width: "48%",
    minHeight: 120,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: RADIUS.lg,
    backgroundColor: COLORS.surface,
    padding: SPACING.md,
    gap: SPACING.xs,
    justifyContent: "space-between",
    ...SHADOWS.sm,
  },
  categoryCardActive: {
    borderColor: COLORS.accentBorder,
    backgroundColor: COLORS.accentSoft,
  },
  categoryName: {
    color: COLORS.text,
    fontSize: 15,
    fontWeight: "700",
  },
  categoryNameActive: {
    color: COLORS.accent,
  },
  categorySlug: {
    color: COLORS.mutedText,
    fontSize: 12,
  },
  categorySlugActive: {
    color: COLORS.accent,
  },
  categoryCount: {
    color: COLORS.text,
    fontSize: 12,
    fontWeight: "600",
  },
  categoryCountActive: {
    color: COLORS.accent,
  },
  resultsWrap: {
    marginTop: SPACING.sm,
    gap: SPACING.sm,
  },
  resultsTitle: {
    color: COLORS.text,
    fontSize: 18,
    fontWeight: "700",
  },
  resultsMeta: {
    color: COLORS.mutedText,
    fontSize: 12,
  },
  postCard: {
    borderRadius: RADIUS.lg,
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.border,
    padding: SPACING.md,
    gap: SPACING.md,
    flexDirection: "row",
    alignItems: "center",
    minHeight: 112,
    ...SHADOWS.sm,
  },
  postCardPressed: {
    opacity: 0.92,
  },
  thumbnail: {
    width: 108,
    height: 84,
    borderRadius: RADIUS.md,
    backgroundColor: COLORS.surfaceSoft,
  },
  thumbnailPlaceholder: {
    width: 108,
    height: 84,
    borderRadius: RADIUS.md,
    backgroundColor: COLORS.surfaceSoft,
  },
  postContent: {
    flex: 1,
    justifyContent: "center",
    gap: SPACING.xs,
  },
  postTitle: {
    color: COLORS.text,
    fontSize: 16,
    fontWeight: "700",
    lineHeight: 21,
  },
  postPreview: {
    color: COLORS.mutedText,
    fontSize: FONT_SIZE.body,
    lineHeight: 19,
  },
});
