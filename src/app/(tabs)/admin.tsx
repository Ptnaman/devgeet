import { Redirect } from "expo-router";
import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { HugeiconsIcon } from "@hugeicons/react-native";
import { Add01Icon } from "@hugeicons/core-free-icons";
import {
  collection,
  doc,
  getDoc,
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
  createSlug,
  formatDate,
  mapCategoryRecord,
  mapPostRecord,
  type CategoryRecord,
  type PostRecord,
  type PostStatus,
} from "@/lib/content";
import { firestore } from "@/lib/firebase";
import { useAuth } from "@/providers/auth-provider";

const POST_STATUSES: PostStatus[] = ["draft", "published"];

export default function AdminScreen() {
  const { user, isAdmin, isBootstrapping } = useAuth();
  const [categories, setCategories] = useState<CategoryRecord[]>([]);
  const [recentPosts, setRecentPosts] = useState<PostRecord[]>([]);
  const [isLoadingData, setIsLoadingData] = useState(true);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const [categoryName, setCategoryName] = useState("");
  const [isSavingCategory, setIsSavingCategory] = useState(false);

  const [title, setTitle] = useState("");
  const [slugInput, setSlugInput] = useState("");
  const [content, setContent] = useState("");
  const [category, setCategory] = useState("general");
  const [status, setStatus] = useState<PostStatus>("draft");
  const [isSavingPost, setIsSavingPost] = useState(false);

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
        const nextCategories = snapshot.docs.map((item) =>
          mapCategoryRecord(item.id, item.data() as DocumentData)
        );
        setCategories(nextCategories);
        setIsLoadingData(false);
      },
      () => {
        setError("Unable to load categories.");
        setIsLoadingData(false);
      }
    );

    const unsubscribePosts = onSnapshot(
      postsQuery,
      (snapshot) => {
        const nextPosts = snapshot.docs
          .map((item) => mapPostRecord(item.id, item.data() as DocumentData))
          .slice(0, 8);
        setRecentPosts(nextPosts);
      },
      () => {
        setError("Unable to load posts.");
      }
    );

    return () => {
      unsubscribeCategories();
      unsubscribePosts();
    };
  }, []);

  if (isBootstrapping) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={COLORS.primary} />
      </View>
    );
  }

  if (!user || !isAdmin) {
    return <Redirect href="/home" />;
  }

  const handleCreateCategory = async () => {
    const trimmedName = categoryName.trim();
    const slug = createSlug(trimmedName);

    if (!trimmedName) {
      setError("Category name is required.");
      return;
    }

    if (!slug) {
      setError("Category name must include letters or numbers.");
      return;
    }

    try {
      setIsSavingCategory(true);
      setError("");
      setSuccess("");

      const categoryRef = doc(firestore, CATEGORIES_COLLECTION, slug);
      const categorySnapshot = await getDoc(categoryRef);
      if (categorySnapshot.exists()) {
        setError("Category slug already exists.");
        return;
      }

      await setDoc(categoryRef, {
        id: slug,
        name: trimmedName,
        slug,
        createDate: serverTimestamp(),
        uploadDate: serverTimestamp(),
        createdBy: user.uid,
        createdByEmail: user.email ?? "",
      });

      setCategoryName("");
      setCategory(slug);
      setSuccess("Category created.");
    } catch (saveError) {
      if (saveError instanceof Error && saveError.message) {
        setError(saveError.message);
      } else {
        setError("Unable to create category.");
      }
    } finally {
      setIsSavingCategory(false);
    }
  };

  const handleCreatePost = async () => {
    const trimmedTitle = title.trim();
    const trimmedContent = content.trim();
    const normalizedCategory = category.trim().toLowerCase() || "general";
    const normalizedStatus: PostStatus = status === "published" ? "published" : "draft";
    const slugBase = createSlug(slugInput || trimmedTitle);

    if (!trimmedTitle || !trimmedContent) {
      setError("Title and content are required.");
      return;
    }

    if (!slugBase) {
      setError("Slug must include letters or numbers.");
      return;
    }

    if (
      normalizedCategory !== "general" &&
      !categories.some((item) => item.slug === normalizedCategory)
    ) {
      setError("Select an existing category or use general.");
      return;
    }

    try {
      setIsSavingPost(true);
      setError("");
      setSuccess("");

      const postRef = doc(collection(firestore, POSTS_COLLECTION));
      const uniqueSlug = `${slugBase}-${postRef.id.slice(0, 6)}`;

      await setDoc(postRef, {
        id: postRef.id,
        slug: uniqueSlug,
        title: trimmedTitle,
        content: trimmedContent,
        category: normalizedCategory,
        status: normalizedStatus,
        createDate: serverTimestamp(),
        uploadDate: serverTimestamp(),
        createdBy: user.uid,
        createdByEmail: user.email ?? "",
      });

      setTitle("");
      setSlugInput("");
      setContent("");
      setStatus("draft");
      setSuccess("Post created.");
    } catch (saveError) {
      if (saveError instanceof Error && saveError.message) {
        setError(saveError.message);
      } else {
        setError("Unable to create post.");
      }
    } finally {
      setIsSavingPost(false);
    }
  };

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Text style={styles.title}>Admin Panel</Text>
      <Text style={styles.subtitle}>Only approved admin email can create categories and posts.</Text>

      {error ? <Text style={styles.error}>{error}</Text> : null}
      {success ? <Text style={styles.success}>{success}</Text> : null}

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Create Category</Text>
        <View style={styles.inputWrap}>
          <TextInput
            value={categoryName}
            onChangeText={setCategoryName}
            placeholder="Category name"
            placeholderTextColor={COLORS.mutedText}
            style={styles.input}
          />
        </View>
        <Pressable
          style={({ pressed }) => [
            styles.primaryButton,
            pressed && styles.buttonPressed,
            isSavingCategory && styles.buttonDisabled,
          ]}
          onPress={handleCreateCategory}
          disabled={isSavingCategory}
        >
          {isSavingCategory ? (
            <ActivityIndicator size="small" color={COLORS.primaryText} />
          ) : (
            <HugeiconsIcon icon={Add01Icon} size={18} color={COLORS.primaryText} />
          )}
          <Text style={styles.primaryButtonText}>Create Category</Text>
        </Pressable>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Create Post</Text>

        <View style={styles.inputWrap}>
          <TextInput
            value={title}
            onChangeText={setTitle}
            placeholder="Post title"
            placeholderTextColor={COLORS.mutedText}
            style={styles.input}
          />
        </View>

        <View style={styles.inputWrap}>
          <TextInput
            value={slugInput}
            onChangeText={setSlugInput}
            placeholder="Custom slug (optional)"
            placeholderTextColor={COLORS.mutedText}
            autoCapitalize="none"
            style={styles.input}
          />
        </View>

        <View style={styles.textAreaWrap}>
          <TextInput
            value={content}
            onChangeText={setContent}
            placeholder="Post content"
            placeholderTextColor={COLORS.mutedText}
            style={styles.textArea}
            multiline
            textAlignVertical="top"
          />
        </View>

        <Text style={styles.label}>Status</Text>
        <View style={styles.chipRow}>
          {POST_STATUSES.map((item) => (
            <Pressable
              key={item}
              style={[
                styles.chip,
                status === item ? styles.chipActive : undefined,
              ]}
              onPress={() => setStatus(item)}
            >
              <Text
                style={[
                  styles.chipText,
                  status === item ? styles.chipTextActive : undefined,
                ]}
              >
                {item}
              </Text>
            </Pressable>
          ))}
        </View>

        <Text style={styles.label}>Category</Text>
        <View style={styles.inputWrap}>
          <TextInput
            value={category}
            onChangeText={setCategory}
            placeholder="general or existing category slug"
            placeholderTextColor={COLORS.mutedText}
            autoCapitalize="none"
            style={styles.input}
          />
        </View>

        <View style={styles.chipRow}>
          <Pressable
            style={[
              styles.chip,
              category === "general" ? styles.chipActive : undefined,
            ]}
            onPress={() => setCategory("general")}
          >
            <Text
              style={[
                styles.chipText,
                category === "general" ? styles.chipTextActive : undefined,
              ]}
            >
              general
            </Text>
          </Pressable>
          {categories.map((item) => (
            <Pressable
              key={item.id}
              style={[
                styles.chip,
                category === item.slug ? styles.chipActive : undefined,
              ]}
              onPress={() => setCategory(item.slug)}
            >
              <Text
                style={[
                  styles.chipText,
                  category === item.slug ? styles.chipTextActive : undefined,
                ]}
              >
                {item.slug}
              </Text>
            </Pressable>
          ))}
        </View>

        <Pressable
          style={({ pressed }) => [
            styles.primaryButton,
            pressed && styles.buttonPressed,
            isSavingPost && styles.buttonDisabled,
          ]}
          onPress={handleCreatePost}
          disabled={isSavingPost}
        >
          {isSavingPost ? (
            <ActivityIndicator size="small" color={COLORS.primaryText} />
          ) : (
            <HugeiconsIcon icon={Add01Icon} size={18} color={COLORS.primaryText} />
          )}
          <Text style={styles.primaryButtonText}>Create Post</Text>
        </Pressable>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Recent Posts</Text>
        {isLoadingData ? (
          <ActivityIndicator size="small" color={COLORS.primary} />
        ) : null}
        {!isLoadingData && !recentPosts.length ? (
          <Text style={styles.emptyText}>No posts yet.</Text>
        ) : null}
        {recentPosts.map((post) => (
          <View key={post.id} style={styles.postCard}>
            <Text style={styles.postTitle}>{post.title}</Text>
            <Text style={styles.postMeta}>ID: {post.id}</Text>
            <Text style={styles.postMeta}>Slug: {post.slug}</Text>
            <Text style={styles.postMeta}>Category: {post.category}</Text>
            <Text style={styles.postMeta}>Status: {post.status}</Text>
            <Text style={styles.postMeta}>Create Date: {formatDate(post.createDate)}</Text>
            <Text style={styles.postMeta}>Upload Date: {formatDate(post.uploadDate)}</Text>
          </View>
        ))}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  center: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: COLORS.background,
  },
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
  textAreaWrap: {
    minHeight: 120,
    borderRadius: RADIUS.md,
    borderWidth: 1,
    borderColor: COLORS.border,
    backgroundColor: COLORS.surface,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
  },
  input: {
    color: COLORS.text,
    fontSize: FONT_SIZE.button,
  },
  textArea: {
    minHeight: 100,
    color: COLORS.text,
    fontSize: FONT_SIZE.body,
  },
  label: {
    color: COLORS.text,
    fontWeight: "600",
    marginTop: 2,
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
  primaryButton: {
    minHeight: CONTROL_SIZE.inputHeight,
    borderRadius: RADIUS.md,
    backgroundColor: COLORS.primary,
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: SPACING.sm,
  },
  primaryButtonText: {
    color: COLORS.primaryText,
    fontSize: FONT_SIZE.button,
    fontWeight: "700",
  },
  buttonPressed: {
    opacity: 0.9,
  },
  buttonDisabled: {
    opacity: 0.6,
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

