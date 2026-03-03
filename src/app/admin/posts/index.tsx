import { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useRouter } from "expo-router";
import {
  collection,
  deleteDoc,
  doc,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
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
  sortPostsByRecency,
  type CategoryRecord,
  type PostRecord,
  type PostStatus,
} from "@/lib/content";
import { firestore } from "@/lib/firebase";

const POST_STATUSES: PostStatus[] = ["draft", "published"];
type PostStatusFilter = "all" | PostStatus;
const DEFAULT_CATEGORY = "general";

export default function AdminPostsListScreen() {
  const router = useRouter();
  const [categories, setCategories] = useState<CategoryRecord[]>([]);
  const [posts, setPosts] = useState<PostRecord[]>([]);
  const [isLoadingCategories, setIsLoadingCategories] = useState(true);
  const [isLoadingPosts, setIsLoadingPosts] = useState(true);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<PostStatusFilter>("all");
  const [categoryFilter, setCategoryFilter] = useState<string>("all");

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
        setIsLoadingCategories(false);
        setError("");
      },
      () => {
        setIsLoadingCategories(false);
        setError("Unable to load categories.");
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
        setIsLoadingPosts(false);
        setError("");
      },
      () => {
        setIsLoadingPosts(false);
        setError("Unable to load posts.");
      }
    );

    return () => {
      unsubscribeCategories();
      unsubscribePosts();
    };
  }, []);

  const isLoadingData = isLoadingCategories || isLoadingPosts;

  const filteredPosts = useMemo(() => {
    const keyword = searchTerm.trim().toLowerCase();

    return posts.filter((post) => {
      if (statusFilter !== "all" && post.status !== statusFilter) {
        return false;
      }

      if (categoryFilter !== "all" && post.category !== categoryFilter) {
        return false;
      }

      if (!keyword) {
        return true;
      }

      return [post.title, post.content, post.slug, post.category]
        .join(" ")
        .toLowerCase()
        .includes(keyword);
    });
  }, [categoryFilter, posts, searchTerm, statusFilter]);

  const hasActiveFilters =
    Boolean(searchTerm.trim()) || statusFilter !== "all" || categoryFilter !== "all";

  const postStats = useMemo(() => {
    return {
      total: posts.length,
      visible: filteredPosts.length,
    };
  }, [filteredPosts.length, posts]);

  const clearFeedback = () => {
    setError("");
    setSuccess("");
  };

  const handleToggleStatus = async (post: PostRecord) => {
    try {
      clearFeedback();
      const postRef = doc(firestore, POSTS_COLLECTION, post.id);
      const nextStatus: PostStatus = post.status === "published" ? "draft" : "published";
      await setDoc(
        postRef,
        {
          status: nextStatus,
          uploadDate: serverTimestamp(),
        },
        { merge: true }
      );
      setSuccess(`Post moved to ${nextStatus}.`);
    } catch (updateError) {
      if (updateError instanceof Error && updateError.message) {
        setError(updateError.message);
      } else {
        setError("Unable to update post status.");
      }
    }
  };

  const runDeletePost = async (post: PostRecord) => {
    try {
      clearFeedback();
      await deleteDoc(doc(firestore, POSTS_COLLECTION, post.id));
      setSuccess("Post deleted.");
    } catch (deleteError) {
      if (deleteError instanceof Error && deleteError.message) {
        setError(deleteError.message);
      } else {
        setError("Unable to delete post.");
      }
    }
  };

  const handleDeletePost = (post: PostRecord) => {
    Alert.alert("Delete Post", `Delete "${post.title}" permanently?`, [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete",
        style: "destructive",
        onPress: () => {
          void runDeletePost(post);
        },
      },
    ]);
  };

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Text style={styles.title}>Post List</Text>
      <Text style={styles.subtitle}>
        Filter, manage, and publish posts quickly.
      </Text>

      {error ? <Text style={styles.error}>{error}</Text> : null}
      {success ? <Text style={styles.success}>{success}</Text> : null}

      <View style={styles.section}>
        <View style={styles.filterHeader}>
          <Text style={styles.sectionTitle}>Filters</Text>
          <Pressable
            style={({ pressed }) => [
              styles.resetInlineButton,
              !hasActiveFilters && styles.buttonDisabled,
              pressed && styles.buttonPressed,
            ]}
            onPress={() => {
              setSearchTerm("");
              setStatusFilter("all");
              setCategoryFilter("all");
              clearFeedback();
            }}
            disabled={!hasActiveFilters}
          >
            <Text style={styles.resetInlineButtonText}>Reset</Text>
          </Pressable>
        </View>
        {isLoadingData ? <ActivityIndicator size="small" color={COLORS.primary} /> : null}

        <View style={styles.inputWrap}>
          <TextInput
            value={searchTerm}
            onChangeText={setSearchTerm}
            placeholder="Search by title, slug, content, category"
            placeholderTextColor={COLORS.mutedText}
            autoCapitalize="none"
            style={styles.input}
          />
        </View>

        <View style={styles.compactFilterRow}>
          <Text style={styles.compactFilterLabel}>Status</Text>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.chipRow}
          >
            {(["all", ...POST_STATUSES] as PostStatusFilter[]).map((item) => (
              <Pressable
                key={item}
                style={[styles.chip, statusFilter === item ? styles.chipActive : undefined]}
                onPress={() => setStatusFilter(item)}
              >
                <Text
                  style={[
                    styles.chipText,
                    statusFilter === item ? styles.chipTextActive : undefined,
                  ]}
                >
                  {item}
                </Text>
              </Pressable>
            ))}
          </ScrollView>
        </View>

        <View style={styles.compactFilterRow}>
          <Text style={styles.compactFilterLabel}>Category</Text>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.chipRow}
          >
            <Pressable
              style={[styles.chip, categoryFilter === "all" ? styles.chipActive : undefined]}
              onPress={() => setCategoryFilter("all")}
            >
              <Text
                style={[
                  styles.chipText,
                  categoryFilter === "all" ? styles.chipTextActive : undefined,
                ]}
              >
                all
              </Text>
            </Pressable>
            <Pressable
              style={[
                styles.chip,
                categoryFilter === DEFAULT_CATEGORY ? styles.chipActive : undefined,
              ]}
              onPress={() => setCategoryFilter(DEFAULT_CATEGORY)}
            >
              <Text
                style={[
                  styles.chipText,
                  categoryFilter === DEFAULT_CATEGORY ? styles.chipTextActive : undefined,
                ]}
              >
                {DEFAULT_CATEGORY}
              </Text>
            </Pressable>
            {categories.map((item) => (
              <Pressable
                key={item.id}
                style={[styles.chip, categoryFilter === item.slug ? styles.chipActive : undefined]}
                onPress={() => setCategoryFilter(item.slug)}
              >
                <Text
                  style={[
                    styles.chipText,
                    categoryFilter === item.slug ? styles.chipTextActive : undefined,
                  ]}
                >
                  {item.slug}
                </Text>
              </Pressable>
            ))}
          </ScrollView>
        </View>

        <Text style={styles.resultText}>
          Showing {postStats.visible} of {postStats.total} posts
        </Text>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Posts</Text>
        {!filteredPosts.length ? (
          <Text style={styles.emptyText}>No posts match current filters.</Text>
        ) : null}

        {filteredPosts.map((post) => {
          const thumbnailUrl = getPostCardThumbnailUrl(post);
          const updatedLabel = formatDate(post.uploadDate || post.createDate);
          const createdLabel = formatDate(post.createDate);
          const categoryLabel = (post.category.trim() || "general")
            .split(/[\s-]+/)
            .filter(Boolean)
            .map((word) => `${word.charAt(0).toUpperCase()}${word.slice(1)}`)
            .join(" ");

          return (
            <View key={post.id} style={styles.postCard}>
              {thumbnailUrl ? (
                <Image
                  source={{ uri: thumbnailUrl }}
                  style={styles.thumbnail}
                  resizeMode="cover"
                />
              ) : null}
              <View style={styles.postHeaderRow}>
                <Text style={styles.categoryBadge}>{categoryLabel}</Text>
                <View
                  style={[
                    styles.statusBadge,
                    post.status === "published"
                      ? styles.statusBadgePublished
                      : styles.statusBadgeDraft,
                  ]}
                >
                  <Text
                    style={[
                      styles.statusBadgeText,
                      post.status === "published"
                        ? styles.statusBadgeTextPublished
                        : styles.statusBadgeTextDraft,
                    ]}
                  >
                    {post.status}
                  </Text>
                </View>
              </View>

              <View style={styles.postHeaderRow}>
                <Text style={styles.postTitle}>{post.title}</Text>
              </View>

              <Text style={styles.postBody}>
                {post.content.length > 180 ? `${post.content.slice(0, 180)}...` : post.content}
              </Text>

              <View style={styles.metaRow}>
                <Text style={styles.postMeta}>Created {createdLabel}</Text>
                <Text style={styles.postMeta}>Updated {updatedLabel}</Text>
              </View>
              <Text style={styles.postMeta}>Slug: {post.slug}</Text>
              <Text style={styles.postMeta}>ID: {post.id}</Text>

              <View style={styles.buttonRow}>
                <Pressable
                  style={({ pressed }) => [
                    styles.secondaryButton,
                    styles.flexButton,
                    pressed && styles.buttonPressed,
                  ]}
                  onPress={() => router.push(`/admin/posts/edit?postId=${post.id}`)}
                >
                  <Text style={styles.secondaryButtonText}>Edit</Text>
                </Pressable>

                <Pressable
                  style={({ pressed }) => [
                    styles.secondaryButton,
                    styles.flexButton,
                    pressed && styles.buttonPressed,
                  ]}
                  onPress={() => {
                    void handleToggleStatus(post);
                  }}
                >
                  <Text style={styles.secondaryButtonText}>
                    {post.status === "published" ? "Move to Draft" : "Publish"}
                  </Text>
                </Pressable>

                <Pressable
                  style={({ pressed }) => [
                    styles.deleteButton,
                    styles.flexButton,
                    pressed && styles.buttonPressed,
                  ]}
                  onPress={() => handleDeletePost(post)}
                >
                  <Text style={styles.deleteButtonText}>Delete</Text>
                </Pressable>
              </View>
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
    backgroundColor: COLORS.background,
    gap: SPACING.md,
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
  success: {
    color: "#166534",
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
  filterHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: SPACING.sm,
  },
  inputWrap: {
    minHeight: CONTROL_SIZE.inputHeight,
    borderRadius: RADIUS.md,
    borderWidth: 1,
    borderColor: COLORS.border,
    backgroundColor: COLORS.surface,
    paddingHorizontal: SPACING.md,
    justifyContent: "center",
  },
  input: {
    color: COLORS.text,
    fontSize: FONT_SIZE.button,
  },
  compactFilterRow: {
    gap: SPACING.xs,
  },
  compactFilterLabel: {
    color: COLORS.mutedText,
    fontSize: 12,
    fontWeight: "700",
    textTransform: "uppercase",
    letterSpacing: 0.3,
  },
  chipRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: SPACING.xs,
    paddingRight: SPACING.md,
  },
  chip: {
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 999,
    paddingHorizontal: SPACING.sm,
    paddingVertical: 5,
    backgroundColor: COLORS.surface,
  },
  chipActive: {
    backgroundColor: COLORS.primary,
    borderColor: COLORS.primary,
  },
  chipText: {
    color: COLORS.text,
    fontSize: 12,
    fontWeight: "600",
  },
  chipTextActive: {
    color: COLORS.primaryText,
  },
  resetInlineButton: {
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 999,
    paddingHorizontal: SPACING.sm,
    paddingVertical: 5,
    backgroundColor: COLORS.surface,
  },
  resetInlineButtonText: {
    color: COLORS.text,
    fontSize: 12,
    fontWeight: "700",
  },
  buttonRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: SPACING.sm,
  },
  flexButton: {
    flex: 1,
  },
  secondaryButton: {
    minHeight: CONTROL_SIZE.inputHeight,
    borderRadius: RADIUS.md,
    borderWidth: 1,
    borderColor: COLORS.border,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: COLORS.surface,
    paddingHorizontal: SPACING.sm,
  },
  secondaryButtonText: {
    color: COLORS.text,
    fontSize: 14,
    fontWeight: "600",
    textAlign: "center",
  },
  deleteButton: {
    minHeight: CONTROL_SIZE.inputHeight,
    borderRadius: RADIUS.md,
    borderWidth: 1,
    borderColor: "#DC2626",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#FEF2F2",
    paddingHorizontal: SPACING.sm,
  },
  deleteButtonText: {
    color: "#B91C1C",
    fontSize: 14,
    fontWeight: "700",
    textAlign: "center",
  },
  buttonPressed: {
    opacity: 0.9,
  },
  buttonDisabled: {
    opacity: 0.55,
  },
  resultText: {
    color: COLORS.mutedText,
    fontSize: 13,
  },
  emptyText: {
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
    height: 180,
    borderRadius: RADIUS.md,
    backgroundColor: "#E5E7EB",
    marginBottom: SPACING.xs,
  },
  postHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: SPACING.sm,
  },
  categoryBadge: {
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
  postTitle: {
    color: COLORS.text,
    fontSize: 16,
    fontWeight: "700",
    flex: 1,
  },
  postBody: {
    color: COLORS.text,
    fontSize: FONT_SIZE.body,
  },
  metaRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: SPACING.sm,
  },
  postMeta: {
    color: COLORS.mutedText,
    fontSize: 12,
  },
  statusBadge: {
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: SPACING.sm,
    paddingVertical: 3,
  },
  statusBadgePublished: {
    borderColor: "#16A34A",
    backgroundColor: "#F0FDF4",
  },
  statusBadgeDraft: {
    borderColor: "#D97706",
    backgroundColor: "#FFFBEB",
  },
  statusBadgeText: {
    fontSize: 11,
    fontWeight: "700",
    textTransform: "uppercase",
  },
  statusBadgeTextPublished: {
    color: "#166534",
  },
  statusBadgeTextDraft: {
    color: "#92400E",
  },
});
