import { useLocalSearchParams, useRouter } from "expo-router";
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

import {
  COLORS,
  CONTROL_SIZE,
  FONT_SIZE,
  RADIUS,
  SPACING,
} from "@/constants/theme";
import {
  CATEGORIES_COLLECTION,
  POSTS_COLLECTION,
  createSlug,
  mapCategoryRecord,
  mapPostRecord,
  type CategoryRecord,
  type PostRecord,
  type PostStatus,
} from "@/lib/content";
import { firestore } from "@/lib/firebase";
import { useAuth } from "@/providers/auth-provider";

const POST_STATUSES: PostStatus[] = ["draft", "published"];
const DEFAULT_CATEGORY = "general";

const resolvePostId = (value: string | string[] | undefined) =>
  typeof value === "string" ? value : "";

export default function AdminPostEditScreen() {
  const router = useRouter();
  const { postId: postIdParam } = useLocalSearchParams<{ postId?: string }>();
  const { user } = useAuth();

  const postId = resolvePostId(postIdParam);
  const isEditing = Boolean(postId);

  const [categories, setCategories] = useState<CategoryRecord[]>([]);
  const [posts, setPosts] = useState<PostRecord[]>([]);
  const [isLoadingCategories, setIsLoadingCategories] = useState(true);
  const [isLoadingPost, setIsLoadingPost] = useState(isEditing);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const [title, setTitle] = useState("");
  const [slugInput, setSlugInput] = useState("");
  const [content, setContent] = useState("");
  const [category, setCategory] = useState(DEFAULT_CATEGORY);
  const [status, setStatus] = useState<PostStatus>("draft");

  useEffect(() => {
    const categoriesQuery = query(
      collection(firestore, CATEGORIES_COLLECTION),
      orderBy("name", "asc"),
    );
    const postsQuery = query(
      collection(firestore, POSTS_COLLECTION),
      orderBy("createDate", "desc"),
    );

    const unsubscribeCategories = onSnapshot(
      categoriesQuery,
      (snapshot) => {
        setCategories(
          snapshot.docs.map((item) =>
            mapCategoryRecord(item.id, item.data() as DocumentData),
          ),
        );
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
        setPosts(
          snapshot.docs.map((item) =>
            mapPostRecord(item.id, item.data() as DocumentData),
          ),
        );
      },
      () => {
        setError("Unable to load posts for validation.");
      },
    );

    return () => {
      unsubscribeCategories();
      unsubscribePosts();
    };
  }, []);

  useEffect(() => {
    if (!isEditing) {
      setIsLoadingPost(false);
      return;
    }

    let active = true;

    const hydratePost = async () => {
      try {
        const postRef = doc(firestore, POSTS_COLLECTION, postId);
        const snapshot = await getDoc(postRef);

        if (!snapshot.exists()) {
          if (active) {
            setError("Post not found.");
          }
          return;
        }

        const post = mapPostRecord(
          snapshot.id,
          snapshot.data() as DocumentData,
        );

        if (!active) {
          return;
        }

        setTitle(post.title);
        setSlugInput(post.slug);
        setContent(post.content);
        setCategory(post.category);
        setStatus(post.status);
        setError("");
      } catch {
        if (active) {
          setError("Unable to load post details.");
        }
      } finally {
        if (active) {
          setIsLoadingPost(false);
        }
      }
    };

    void hydratePost();

    return () => {
      active = false;
    };
  }, [isEditing, postId]);

  const isLoadingInitial = isLoadingCategories || isLoadingPost;

  const getUniqueSlug = (base: string) => {
    const normalizedBase = base || "post";
    let candidate = normalizedBase;
    let suffix = 1;

    while (
      posts.some((item) => item.slug === candidate && item.id !== postId)
    ) {
      candidate = `${normalizedBase}-${suffix}`;
      suffix += 1;
    }

    return candidate;
  };

  const clearFeedback = () => {
    setError("");
    setSuccess("");
  };

  const handleSave = async () => {
    const trimmedTitle = title.trim();
    const trimmedContent = content.trim();
    const normalizedCategory =
      category.trim().toLowerCase() || DEFAULT_CATEGORY;
    const normalizedStatus: PostStatus =
      status === "published" ? "published" : "draft";
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
      normalizedCategory !== DEFAULT_CATEGORY &&
      !categories.some((item) => item.slug === normalizedCategory)
    ) {
      setError("Select an existing category or use general.");
      return;
    }

    try {
      setIsSubmitting(true);
      clearFeedback();

      if (isEditing) {
        const uniqueSlug = getUniqueSlug(slugBase);
        const postRef = doc(firestore, POSTS_COLLECTION, postId);

        await setDoc(
          postRef,
          {
            id: postId,
            slug: uniqueSlug,
            title: trimmedTitle,
            content: trimmedContent,
            category: normalizedCategory,
            status: normalizedStatus,
            uploadDate: serverTimestamp(),
            updatedBy: user?.uid ?? "",
            updatedByEmail: user?.email ?? "",
          },
          { merge: true },
        );

        setSuccess("Post updated in Firebase.");
      } else {
        const postRef = doc(collection(firestore, POSTS_COLLECTION));
        const uniqueSlug = `${getUniqueSlug(slugBase)}-${postRef.id.slice(0, 6)}`;

        await setDoc(postRef, {
          id: postRef.id,
          slug: uniqueSlug,
          title: trimmedTitle,
          content: trimmedContent,
          category: normalizedCategory,
          status: normalizedStatus,
          createDate: serverTimestamp(),
          uploadDate: serverTimestamp(),
          createdBy: user?.uid ?? "",
          createdByEmail: user?.email ?? "",
        });

        setSuccess("Post created in Firebase.");
      }

      router.replace("/admin/posts");
    } catch (saveError) {
      if (saveError instanceof Error && saveError.message) {
        setError(saveError.message);
      } else {
        setError("Unable to save post to Firebase.");
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isLoadingInitial) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={COLORS.primary} />
      </View>
    );
  }

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Text style={styles.title}>
        {isEditing ? "Edit Post" : "Create Post"}
      </Text>
      <Text style={styles.subtitle}>
        Save will write post data to Firebase collection `posts`.
      </Text>

      {error ? <Text style={styles.error}>{error}</Text> : null}
      {success ? <Text style={styles.success}>{success}</Text> : null}

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Post Details</Text>

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
        <View style={styles.chipRow}>
          <Pressable
            style={[
              styles.chip,
              category === DEFAULT_CATEGORY ? styles.chipActive : undefined,
            ]}
            onPress={() => setCategory(DEFAULT_CATEGORY)}
          >
            <Text
              style={[
                styles.chipText,
                category === DEFAULT_CATEGORY
                  ? styles.chipTextActive
                  : undefined,
              ]}
            >
              {DEFAULT_CATEGORY}
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

        <View style={styles.buttonRow}>
          <Pressable
            style={({ pressed }) => [
              styles.primaryButton,
              pressed && styles.buttonPressed,
              isSubmitting && styles.buttonDisabled,
            ]}
            onPress={handleSave}
            disabled={isSubmitting}
          >
            {isSubmitting ? (
              <ActivityIndicator size="small" color={COLORS.primaryText} />
            ) : (
              <Text style={styles.primaryButtonText}>
                {isEditing ? "Update Post" : "Create Post"}
              </Text>
            )}
          </Pressable>

          <Pressable
            style={({ pressed }) => [
              styles.secondaryButton,
              pressed && styles.buttonPressed,
            ]}
            onPress={() => router.replace("/admin/posts")}
            disabled={isSubmitting}
          >
            <Text style={styles.secondaryButtonText}>Back to Post List</Text>
          </Pressable>
        </View>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  loadingContainer: {
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
    minHeight: 140,
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
    minHeight: 120,
    color: COLORS.text,
    fontSize: FONT_SIZE.body,
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
  primaryButton: {
    flex: 1,
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
  },
  secondaryButton: {
    flex: 1,
    minHeight: CONTROL_SIZE.inputHeight,
    borderRadius: RADIUS.md,
    borderWidth: 1,
    borderColor: COLORS.border,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: COLORS.surface,
    paddingHorizontal: SPACING.md,
  },
  secondaryButtonText: {
    color: COLORS.text,
    fontSize: 14,
    fontWeight: "600",
    textAlign: "center",
  },
  buttonPressed: {
    opacity: 0.9,
  },
  buttonDisabled: {
    opacity: 0.6,
  },
});
