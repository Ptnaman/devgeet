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
  createSlug,
  formatDate,
  mapCategoryRecord,
  type CategoryRecord,
} from "@/lib/content";
import { firestore } from "@/lib/firebase";
import { useAuth } from "@/providers/auth-provider";

export default function AdminCategoriesScreen() {
  const { user } = useAuth();
  const [categories, setCategories] = useState<CategoryRecord[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [categoryName, setCategoryName] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  useEffect(() => {
    const categoriesQuery = query(
      collection(firestore, CATEGORIES_COLLECTION),
      orderBy("name", "asc")
    );

    const unsubscribe = onSnapshot(
      categoriesQuery,
      (snapshot) => {
        setCategories(
          snapshot.docs.map((item) =>
            mapCategoryRecord(item.id, item.data() as DocumentData)
          )
        );
        setError("");
        setIsLoading(false);
      },
      () => {
        setError("Unable to load categories.");
        setIsLoading(false);
      }
    );

    return unsubscribe;
  }, []);

  const clearFeedback = () => {
    setError("");
    setSuccess("");
  };

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
      setIsSaving(true);
      clearFeedback();

      if (categories.some((item) => item.slug === slug)) {
        setError("Category slug already exists.");
        return;
      }

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
        createdBy: user?.uid ?? "",
        createdByEmail: user?.email ?? "",
      });

      setCategoryName("");
      setSuccess("Category created.");
    } catch (saveError) {
      if (saveError instanceof Error && saveError.message) {
        setError(saveError.message);
      } else {
        setError("Unable to create category.");
      }
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Text style={styles.title}>Category Management</Text>
      <Text style={styles.subtitle}>
        Categories are stored in Firebase collection `categories`.
      </Text>

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
            isSaving && styles.buttonDisabled,
          ]}
          onPress={handleCreateCategory}
          disabled={isSaving}
        >
          {isSaving ? (
            <ActivityIndicator size="small" color={COLORS.primaryText} />
          ) : (
            <Text style={styles.primaryButtonText}>Add Category</Text>
          )}
        </Pressable>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>All Categories ({categories.length})</Text>
        {isLoading ? <ActivityIndicator size="small" color={COLORS.primary} /> : null}
        {!isLoading && !categories.length ? (
          <Text style={styles.emptyText}>No categories yet.</Text>
        ) : null}
        {categories.map((item) => (
          <View key={item.id} style={styles.card}>
            <Text style={styles.cardTitle}>{item.name}</Text>
            <Text style={styles.cardMeta}>Slug: {item.slug}</Text>
            <Text style={styles.cardMeta}>Create Date: {formatDate(item.createDate)}</Text>
            <Text style={styles.cardMeta}>Upload Date: {formatDate(item.uploadDate)}</Text>
          </View>
        ))}
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
  card: {
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: RADIUS.md,
    padding: SPACING.md,
    backgroundColor: COLORS.surface,
    gap: SPACING.xs,
  },
  cardTitle: {
    color: COLORS.text,
    fontSize: 16,
    fontWeight: "700",
  },
  cardMeta: {
    color: COLORS.mutedText,
    fontSize: 12,
  },
});
