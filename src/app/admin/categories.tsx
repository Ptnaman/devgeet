import { useEffect, useState } from "react";
import { Redirect } from "expo-router";
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import {
  collection,
  deleteDoc,
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
  type ThemeMode,
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
  const { colors, resolvedTheme } = useAppTheme();
  const { isConnected } = useNetworkStatus();
  const { isAdmin, user } = useAuth();
  const styles = createStyles(colors, resolvedTheme);
  const [categories, setCategories] = useState<CategoryRecord[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [categoryName, setCategoryName] = useState("");
  const [editingCategoryId, setEditingCategoryId] = useState<string | null>(null);
  const [editingCategoryName, setEditingCategoryName] = useState("");
  const [isUpdatingCategoryId, setIsUpdatingCategoryId] = useState<string | null>(null);
  const [isDeletingCategoryId, setIsDeletingCategoryId] = useState<string | null>(null);
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

  const handleStartRenameCategory = (category: CategoryRecord) => {
    clearFeedback();
    setEditingCategoryId(category.id);
    setEditingCategoryName(category.name);
  };

  const handleCancelRenameCategory = () => {
    setEditingCategoryId(null);
    setEditingCategoryName("");
  };

  const handleRenameCategory = async (category: CategoryRecord) => {
    const trimmedName = editingCategoryName.trim();

    if (!trimmedName) {
      setError("Category name is required.");
      return;
    }

    if (trimmedName === category.name.trim()) {
      setSuccess("No changes to save.");
      handleCancelRenameCategory();
      return;
    }

    try {
      setIsUpdatingCategoryId(category.id);
      clearFeedback();

      await setDoc(
        doc(firestore, CATEGORIES_COLLECTION, category.id),
        {
          name: trimmedName,
          uploadDate: serverTimestamp(),
        },
        { merge: true },
      );

      setSuccess("Category renamed.");
      handleCancelRenameCategory();
    } catch (updateError) {
      setError(
        getActionErrorMessage({
          error: updateError,
          isConnected,
          fallbackMessage: "Unable to rename category.",
        }),
      );
    } finally {
      setIsUpdatingCategoryId(null);
    }
  };

  const runDeleteCategory = async (category: CategoryRecord) => {
    try {
      setIsDeletingCategoryId(category.id);
      clearFeedback();
      await deleteDoc(doc(firestore, CATEGORIES_COLLECTION, category.id));
      if (editingCategoryId === category.id) {
        handleCancelRenameCategory();
      }
      setSuccess("Category deleted.");
    } catch (deleteError) {
      setError(
        getActionErrorMessage({
          error: deleteError,
          isConnected,
          fallbackMessage: "Unable to delete category.",
        }),
      );
    } finally {
      setIsDeletingCategoryId(null);
    }
  };

  const handleDeleteCategory = (category: CategoryRecord) => {
    Alert.alert(
      "Delete Category",
      `Delete "${category.name}" category?`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: () => {
            void runDeleteCategory(category);
          },
        },
      ],
    );
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
        <View style={styles.sectionDivider} />
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
        <View style={styles.sectionDivider} />
        {isLoading ? <ActivityIndicator size="small" color={colors.primary} /> : null}
        {!isLoading && !categories.length ? (
          <Text style={styles.emptyText}>No categories yet.</Text>
        ) : null}
        {categories.map((item, index) => (
          <View key={item.id} style={[styles.card, index > 0 ? styles.cardDivider : undefined]}>
            {editingCategoryId === item.id ? (
              <>
                <Text style={styles.cardLabel}>Rename Category</Text>
                <View style={styles.inputWrap}>
                  <TextInput
                    value={editingCategoryName}
                    onChangeText={setEditingCategoryName}
                    placeholder="Category name"
                    placeholderTextColor={colors.mutedText}
                    style={styles.input}
                    editable={isUpdatingCategoryId !== item.id && isDeletingCategoryId !== item.id}
                  />
                </View>
              </>
            ) : (
              <Text style={styles.cardTitle}>{item.name}</Text>
            )}
            <Text style={styles.cardMeta}>Slug: {item.slug}</Text>
            <Text style={styles.cardMeta}>Create Date: {formatDate(item.createDate)}</Text>
            <Text style={styles.cardMeta}>Upload Date: {formatDate(item.uploadDate)}</Text>
            <View style={styles.cardActionRow}>
              {editingCategoryId === item.id ? (
                <>
                  <Pressable
                    style={({ pressed }) => [
                      styles.secondaryButton,
                      styles.cardActionButton,
                      pressed && styles.buttonPressed,
                      (isSaving ||
                        isUpdatingCategoryId === item.id ||
                        isDeletingCategoryId === item.id) &&
                        styles.buttonDisabled,
                    ]}
                    onPress={handleCancelRenameCategory}
                    disabled={
                      isSaving ||
                      isUpdatingCategoryId === item.id ||
                      isDeletingCategoryId === item.id
                    }
                  >
                    <Text style={styles.secondaryButtonText}>Cancel</Text>
                  </Pressable>
                  <Pressable
                    style={({ pressed }) => [
                      styles.primaryButton,
                      styles.cardActionButton,
                      pressed && styles.buttonPressed,
                      (isSaving ||
                        isUpdatingCategoryId === item.id ||
                        isDeletingCategoryId === item.id) &&
                        styles.buttonDisabled,
                    ]}
                    onPress={() => {
                      void handleRenameCategory(item);
                    }}
                    disabled={
                      isSaving ||
                      isUpdatingCategoryId === item.id ||
                      isDeletingCategoryId === item.id
                    }
                  >
                    {isUpdatingCategoryId === item.id ? (
                      <ActivityIndicator size="small" color={colors.primaryText} />
                    ) : (
                      <Text style={styles.primaryButtonText}>Save</Text>
                    )}
                  </Pressable>
                </>
              ) : (
                <>
                  <Pressable
                    style={({ pressed }) => [
                      styles.secondaryButton,
                      styles.cardActionButton,
                      pressed && styles.buttonPressed,
                      (isSaving || !!isUpdatingCategoryId || !!isDeletingCategoryId) &&
                        styles.buttonDisabled,
                    ]}
                    onPress={() => {
                      handleStartRenameCategory(item);
                    }}
                    disabled={isSaving || !!isUpdatingCategoryId || !!isDeletingCategoryId}
                  >
                    <Text style={styles.secondaryButtonText}>Rename</Text>
                  </Pressable>
                  <Pressable
                    style={({ pressed }) => [
                      styles.dangerButton,
                      styles.cardActionButton,
                      pressed && styles.buttonPressed,
                      (isSaving || !!isUpdatingCategoryId || !!isDeletingCategoryId) &&
                        styles.buttonDisabled,
                    ]}
                    onPress={() => {
                      handleDeleteCategory(item);
                    }}
                    disabled={isSaving || !!isUpdatingCategoryId || !!isDeletingCategoryId}
                  >
                    {isDeletingCategoryId === item.id ? (
                      <ActivityIndicator size="small" color={colors.danger} />
                    ) : (
                      <Text style={styles.dangerButtonText}>Delete</Text>
                    )}
                  </Pressable>
                </>
              )}
            </View>
          </View>
        ))}
      </View>
    </ScrollView>
  );
}

const createStyles = (colors: ThemeColors, resolvedTheme: ThemeMode) => {
  const outlineColor = resolvedTheme === "dark" ? colors.divider : colors.border;

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
    success: {
      color: colors.success,
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
    inputWrap: {
      minHeight: CONTROL_SIZE.inputHeight,
      borderRadius: RADIUS.md,
      borderWidth: 1,
      borderColor: outlineColor,
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
      paddingVertical: SPACING.md,
      gap: SPACING.xs,
    },
    cardDivider: {
      borderTopWidth: StyleSheet.hairlineWidth,
      borderTopColor: colors.divider,
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
    cardLabel: {
      color: colors.mutedText,
      fontSize: 12,
      fontWeight: "600",
      textTransform: "uppercase",
      letterSpacing: 0.3,
    },
    cardActionRow: {
      marginTop: SPACING.xs,
      flexDirection: "row",
      gap: SPACING.sm,
    },
    cardActionButton: {
      flex: 1,
      minHeight: 42,
    },
    secondaryButton: {
      minHeight: CONTROL_SIZE.inputHeight,
      borderRadius: RADIUS.md,
      borderWidth: 1,
      borderColor: outlineColor,
      backgroundColor: colors.surface,
      alignItems: "center",
      justifyContent: "center",
      paddingHorizontal: SPACING.md,
    },
    secondaryButtonText: {
      color: colors.text,
      fontSize: 14,
      fontWeight: "700",
    },
    dangerButton: {
      minHeight: CONTROL_SIZE.inputHeight,
      borderRadius: RADIUS.md,
      borderWidth: 1,
      borderColor: colors.dangerBorder,
      backgroundColor: colors.dangerSoft,
      alignItems: "center",
      justifyContent: "center",
      paddingHorizontal: SPACING.md,
    },
    dangerButtonText: {
      color: colors.danger,
      fontSize: 14,
      fontWeight: "700",
    },
  });
};
