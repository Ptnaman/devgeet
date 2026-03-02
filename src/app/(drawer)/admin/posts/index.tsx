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
          snapshot.docs.map((item) => mapPostRecord(item.id, item.data() as DocumentData))
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
        List and filters are separate from post editing.
      </Text>

      {error ? <Text style={styles.error}>{error}</Text> : null}
      {success ? <Text style={styles.success}>{success}</Text> : null}

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Navigation</Text>
        <View style={styles.buttonRow}>
          <Pressable
            style={({ pressed }) => [styles.primaryButton, pressed && styles.buttonPressed]}
            onPress={() => router.push("/admin/posts/edit")}
          >
            <Text style={styles.primaryButtonText}>Create New Post</Text>
          </Pressable>
          <Pressable
            style={({ pressed }) => [styles.secondaryButton, pressed && styles.buttonPressed]}
            onPress={() => router.push("/admin/categories")}
          >
            <Text style={styles.secondaryButtonText}>Category Management</Text>
          </Pressable>
        </View>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Filters</Text>
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

        <Text style={styles.label}>Filter by Status</Text>
        <View style={styles.chipRow}>
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
        </View>

        <Text style={styles.label}>Filter by Category</Text>
        <View style={styles.chipRow}>
          <Pressable
            style={[styles.chip, categoryFilter === "all" ? styles.chipActive : undefined]}
            onPress={() => setCategoryFilter("all")}
          >
            <Text
              style={[styles.chipText, categoryFilter === "all" ? styles.chipTextActive : undefined]}
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
        </View>

        <Text style={styles.resultText}>
          Showing {filteredPosts.length} of {posts.length} posts
        </Text>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Posts</Text>
        {!filteredPosts.length ? (
          <Text style={styles.emptyText}>No posts match current filters.</Text>
        ) : null}

        {filteredPosts.map((post) => {
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
              <View style={styles.postHeaderRow}>
                <Text style={styles.postTitle}>{post.title}</Text>
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

              <Text style={styles.postBody}>
                {post.content.length > 180 ? `${post.content.slice(0, 180)}...` : post.content}
              </Text>
              <Text style={styles.postMeta}>ID: {post.id}</Text>
              <Text style={styles.postMeta}>Slug: {post.slug}</Text>
              <Text style={styles.postMeta}>Category: {post.category}</Text>
              <Text style={styles.postMeta}>Create Date: {formatDate(post.createDate)}</Text>
              <Text style={styles.postMeta}>Upload Date: {formatDate(post.uploadDate)}</Text>

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
  label: {
    color: COLORS.text,
    fontWeight: "600",
  },
  chipRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: SPACING.sm,
  },
  chip: {
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 999,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.xs,
    backgroundColor: COLORS.surface,
  },
  chipActive: {
    backgroundColor: COLORS.primary,
    borderColor: COLORS.primary,
  },
  chipText: {
    color: COLORS.text,
    fontSize: 13,
    fontWeight: "600",
  },
  chipTextActive: {
    color: COLORS.primaryText,
  },
  buttonRow: {
    flexDirection: "row",
    gap: SPACING.sm,
  },
  flexButton: {
    flex: 1,
  },
  primaryButton: {
    minHeight: CONTROL_SIZE.inputHeight,
    borderRadius: RADIUS.md,
    backgroundColor: COLORS.primary,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: SPACING.md,
  },
  primaryButtonText: {
    color: COLORS.primaryText,
    fontSize: FONT_SIZE.button,
    fontWeight: "700",
    textAlign: "center",
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
