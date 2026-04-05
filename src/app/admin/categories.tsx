import { useEffect, useState } from "react";
import { Redirect } from "expo-router";
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

import {
  CONTROL_SIZE,
  FONT_SIZE,
  RADIUS,
  SPACING,
  type ThemeColors,
} from "@/constants/theme";
import {
  CATEGORIES_COLLECTION,
  createSlug,
  formatDate,
  mapCategoryRecord,
  type CategoryRecord,
} from "@/lib/content";
import { firestore } from "@/lib/firebase";
import { getActionErrorMessage, getRequestErrorMessage } from "@/lib/network";
import { useAuth } from "@/providers/auth-provider";
import { useNetworkStatus } from "@/providers/network-provider";
import { useAppTheme } from "@/providers/theme-provider";

export default function AdminCategoriesScreen() {
  const { colors } = useAppTheme();
  const { isConnected } = useNetworkStatus();
  const { isAdmin, user } = useAuth();
  const styles = createStyles(colors);
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
      (snapshotError) => {
        setError(
          getRequestErrorMessage({
            error: snapshotError,
            isConnected,
            onlineMessage: "Unable to load categories.",
          }),
        );
        setIsLoading(false);
      }
    );

    return unsubscribe;
  }, [isConnected]);

  const clearFeedback = () => {
    setError("");
    setSuccess("");
  };

  if (!isAdmin) {
    return <Redirect href="/admin/posts" />;
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
      setError(
        getActionErrorMessage({
          error: saveError,
          isConnected,
          fallbackMessage: "Unable to create category.",
        }),
      );
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
            placeholderTextColor={colors.mutedText}
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
            <ActivityIndicator size="small" color={colors.primaryText} />
          ) : (
            <Text style={styles.primaryButtonText}>Add Category</Text>
          )}
        </Pressable>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>All Categories ({categories.length})</Text>
        {isLoading ? <ActivityIndicator size="small" color={colors.primary} /> : null}
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

const createStyles = (colors: ThemeColors) => StyleSheet.create({
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
  success: {
    color: "#166534",
    fontSize: 13,
  },
  section: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: RADIUS.lg,
    padding: SPACING.lg,
    gap: SPACING.sm,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: colors.text,
  },
  inputWrap: {
    minHeight: CONTROL_SIZE.inputHeight,
    borderRadius: RADIUS.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    paddingHorizontal: SPACING.md,
    justifyContent: "center",
  },
  input: {
    color: colors.text,
    fontSize: FONT_SIZE.button,
  },
  primaryButton: {
    minHeight: CONTROL_SIZE.inputHeight,
    borderRadius: RADIUS.md,
    backgroundColor: colors.primary,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: SPACING.md,
  },
  primaryButtonText: {
    color: colors.primaryText,
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
    color: colors.mutedText,
    fontSize: FONT_SIZE.body,
  },
  card: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: RADIUS.md,
    padding: SPACING.md,
    backgroundColor: colors.surface,
    gap: SPACING.xs,
  },
  cardTitle: {
    color: colors.text,
    fontSize: 16,
    fontWeight: "700",
  },
  cardMeta: {
    color: colors.mutedText,
    fontSize: 12,
  },
});
