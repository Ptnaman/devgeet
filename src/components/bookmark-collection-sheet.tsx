import { BottomSheet, RNHostView } from "@expo/ui";
import { useEffect, useState } from "react";
import { ActivityIndicator, Alert, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";

import { RADIUS, SPACING, type ThemeColors } from "@/constants/theme";
import { useBookmarkCollections } from "@/hooks/use-bookmark-collections";
import { getActionErrorMessage } from "@/lib/network";
import { useNetworkStatus } from "@/providers/network-provider";
import { useAppTheme } from "@/providers/theme-provider";

export function BookmarkCollectionManagerSheet({
  collectionId,
  collectionName,
  isPresented,
  onDismiss,
}: {
  collectionId?: string;
  collectionName?: string;
  isPresented: boolean;
  onDismiss: () => void;
}) {
  const { colors } = useAppTheme();
  const { isConnected, showToast } = useNetworkStatus();
  const { createCollection, deleteCollection, renameCollection } = useBookmarkCollections();
  const [name, setName] = useState("");
  const [error, setError] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const styles = createStyles(colors);
  const isEditing = Boolean(collectionId);

  useEffect(() => {
    if (isPresented) {
      setName(collectionName ?? "");
      setError("");
    }
  }, [collectionName, isPresented]);

  const save = async () => {
    try {
      setIsSaving(true);
      setError("");
      if (collectionId) await renameCollection(collectionId, name);
      else await createCollection(name);
      showToast(collectionId ? "Collection renamed" : "Collection created");
      onDismiss();
    } catch (saveError) {
      setError(getActionErrorMessage({ error: saveError, isConnected, fallbackMessage: "Could not save collection." }));
    } finally {
      setIsSaving(false);
    }
  };

  const confirmDelete = () => {
    if (!collectionId) return;
    Alert.alert("Delete collection?", `Delete “${collectionName}”? Your bookmarked posts will stay in Favorite.`, [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete",
        style: "destructive",
        onPress: async () => {
          try {
            setIsSaving(true);
            await deleteCollection(collectionId);
            showToast("Collection deleted");
            onDismiss();
          } catch (deleteError) {
            setError(getActionErrorMessage({ error: deleteError, isConnected, fallbackMessage: "Could not delete collection." }));
          } finally {
            setIsSaving(false);
          }
        },
      },
    ]);
  };

  return (
    <BottomSheet isPresented={isPresented} onDismiss={onDismiss} containerColor={colors.surface}>
      <RNHostView matchContents>
        <View style={styles.content}>
          <Text style={styles.title}>{isEditing ? "Rename collection" : "New collection"}</Text>
          <TextInput
            autoFocus
            maxLength={40}
            onChangeText={setName}
            onSubmitEditing={() => { if (name.trim() && !isSaving) void save(); }}
            placeholder="Collection name"
            placeholderTextColor={colors.subtleText}
            returnKeyType="done"
            style={styles.input}
            value={name}
          />
          {error ? <Text style={styles.error}>{error}</Text> : null}
          <View style={styles.managerActions}>
            {isEditing ? (
              <Pressable disabled={isSaving} onPress={confirmDelete} style={({ pressed }) => [styles.deleteButton, pressed && styles.pressed]}>
                <Text style={styles.deleteText}>Delete</Text>
              </Pressable>
            ) : <View />}
            <Pressable disabled={isSaving || !name.trim()} onPress={() => void save()} style={({ pressed }) => [styles.primaryButton, (isSaving || !name.trim()) && styles.primaryButtonDisabled, pressed && styles.pressed]}>
              {isSaving ? <ActivityIndicator size="small" color={colors.primaryText} /> : <Text style={styles.primaryText}>{isEditing ? "Save" : "Create"}</Text>}
            </Pressable>
          </View>
        </View>
      </RNHostView>
    </BottomSheet>
  );
}

export function BookmarkCollectionSheet({
  isPresented,
  onDismiss,
  postId,
}: {
  isPresented: boolean;
  onDismiss: () => void;
  postId: string;
}) {
  const { colors } = useAppTheme();
  const { isConnected, showToast } = useNetworkStatus();
  const { collections, isLoadingCollections, collectionsError, addPostToCollection, createCollection } = useBookmarkCollections();
  const [name, setName] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState("");
  const styles = createStyles(colors);

  useEffect(() => {
    if (!isPresented) {
      setName("");
      setError("");
    }
  }, [isPresented]);

  const saveToCollection = async (collectionId: string, collectionName: string) => {
    try {
      setIsSaving(true);
      setError("");
      await addPostToCollection(collectionId, postId);
      showToast(`Saved to ${collectionName}`);
      onDismiss();
    } catch (saveError) {
      setError(getActionErrorMessage({ error: saveError, isConnected, fallbackMessage: "Could not save to collection." }));
    } finally {
      setIsSaving(false);
    }
  };

  const saveNewCollection = async () => {
    try {
      setIsSaving(true);
      setError("");
      await createCollection(name, postId);
      showToast(`Saved to ${name.trim()}`);
      onDismiss();
    } catch (saveError) {
      setError(getActionErrorMessage({ error: saveError, isConnected, fallbackMessage: "Could not create collection." }));
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <BottomSheet
        isPresented={isPresented}
        onDismiss={onDismiss}
        snapPoints={["half", "full"]}
        containerColor={colors.surface}
      >
        <RNHostView matchContents>
          <View style={styles.content}>
          <Text style={styles.title}>Save to collection</Text>
          <Text style={styles.subtitle}>Choose where you want to keep this bookmark.</Text>
          <Text style={styles.createLabel}>Create new collection</Text>
          <View style={styles.createWrap}>
            <TextInput
              maxLength={40}
              onChangeText={setName}
              onSubmitEditing={() => {
                if (name.trim() && !isSaving) void saveNewCollection();
              }}
              placeholder="Collection name"
              placeholderTextColor={colors.subtleText}
              returnKeyType="done"
              style={styles.input}
              value={name}
            />
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Create collection"
              accessibilityState={{ disabled: isSaving || !name.trim(), busy: isSaving }}
              disabled={isSaving || !name.trim()}
              onPress={() => void saveNewCollection()}
              style={({ pressed }) => [
                styles.primaryButton,
                (isSaving || !name.trim()) && styles.primaryButtonDisabled,
                pressed && styles.pressed,
              ]}
            >
              {isSaving ? <ActivityIndicator size="small" color={colors.primaryText} /> : <Text style={styles.primaryText}>Create</Text>}
            </Pressable>
          </View>
          {isLoadingCollections ? <ActivityIndicator color={colors.primary} /> : null}
          <ScrollView style={styles.list} contentContainerStyle={styles.listContent}>
            {collections.map((item) => (
              <Pressable
                key={item.id}
                disabled={isSaving}
                onPress={() => void saveToCollection(item.id, item.name)}
                style={({ pressed }) => [styles.row, pressed && styles.pressed]}
              >
                <Text style={styles.rowText}>{item.name}</Text>
                <Text style={styles.count}>{item.postIds.length}</Text>
              </Pressable>
            ))}
          </ScrollView>
          {collectionsError ? <Text style={styles.error}>{collectionsError}</Text> : null}
          {error ? <Text style={styles.error}>{error}</Text> : null}
          </View>
        </RNHostView>
    </BottomSheet>
  );
}

const createStyles = (colors: ThemeColors) => StyleSheet.create({
  content: { padding: SPACING.xl, gap: SPACING.md, backgroundColor: colors.surface },
  title: { color: colors.text, fontSize: 21, fontWeight: "800" },
  subtitle: { color: colors.mutedText, fontSize: 14 },
  list: { maxHeight: 230 },
  listContent: { gap: SPACING.sm },
  row: { minHeight: 48, paddingHorizontal: SPACING.md, borderRadius: RADIUS.md, backgroundColor: colors.surfaceSoft, flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  rowText: { color: colors.text, fontSize: 15, fontWeight: "700" },
  count: { color: colors.mutedText, fontSize: 13 },
  pressed: { opacity: 0.72 },
  createWrap: { flexDirection: "row", gap: SPACING.sm },
  createLabel: { color: colors.text, fontSize: 14, fontWeight: "700" },
  input: { flex: 1, minHeight: 48, borderRadius: RADIUS.md, borderWidth: 1, borderColor: colors.border, color: colors.text, paddingHorizontal: SPACING.md, backgroundColor: colors.background },
  primaryButton: { minWidth: 88, minHeight: 48, borderRadius: RADIUS.md, alignItems: "center", justifyContent: "center", backgroundColor: colors.primary },
  primaryButtonDisabled: { opacity: 0.45 },
  primaryText: { color: colors.primaryText, fontWeight: "800" },
  managerActions: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: SPACING.md },
  deleteButton: { minHeight: 48, paddingHorizontal: SPACING.md, alignItems: "center", justifyContent: "center" },
  deleteText: { color: colors.danger, fontWeight: "800" },
  error: { color: colors.danger, fontSize: 13 },
});
