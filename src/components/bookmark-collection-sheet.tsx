import { BottomSheet, Host } from "@expo/ui";
import { useEffect, useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";

import { PlusIcon } from "@/components/icons/plus-icon";
import { RADIUS, SPACING, type ThemeColors } from "@/constants/theme";
import { useBookmarkCollections } from "@/hooks/use-bookmark-collections";
import { getActionErrorMessage } from "@/lib/network";
import { useNetworkStatus } from "@/providers/network-provider";
import { useAppTheme } from "@/providers/theme-provider";

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
  const [isCreating, setIsCreating] = useState(false);
  const [name, setName] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState("");
  const styles = createStyles(colors);

  useEffect(() => {
    if (!isPresented) {
      setName("");
      setError("");
      setIsCreating(false);
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
    <Host>
      <BottomSheet
        isPresented={isPresented}
        onDismiss={onDismiss}
        snapPoints={["half", "full"]}
        containerColor={colors.surface}
      >
        <View style={styles.content}>
          <Text style={styles.title}>Save to collection</Text>
          <Text style={styles.subtitle}>Choose where you want to keep this bookmark.</Text>
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
          {isCreating ? (
            <View style={styles.createWrap}>
              <TextInput
                autoFocus
                maxLength={40}
                onChangeText={setName}
                placeholder="Collection name"
                placeholderTextColor={colors.subtleText}
                style={styles.input}
                value={name}
              />
              <Pressable disabled={isSaving || !name.trim()} onPress={() => void saveNewCollection()} style={styles.primaryButton}>
                {isSaving ? <ActivityIndicator size="small" color={colors.primaryText} /> : <Text style={styles.primaryText}>Create</Text>}
              </Pressable>
            </View>
          ) : (
            <Pressable onPress={() => setIsCreating(true)} style={styles.createButton}>
              <PlusIcon size={18} color={colors.primary} />
              <Text style={styles.createText}>Create new collection</Text>
            </Pressable>
          )}
          {error ? <Text style={styles.error}>{error}</Text> : null}
        </View>
      </BottomSheet>
    </Host>
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
  input: { flex: 1, minHeight: 48, borderRadius: RADIUS.md, borderWidth: 1, borderColor: colors.border, color: colors.text, paddingHorizontal: SPACING.md, backgroundColor: colors.background },
  primaryButton: { minWidth: 88, minHeight: 48, borderRadius: RADIUS.md, alignItems: "center", justifyContent: "center", backgroundColor: colors.primary },
  primaryText: { color: colors.primaryText, fontWeight: "800" },
  createButton: { minHeight: 48, borderRadius: RADIUS.md, borderWidth: 1, borderColor: colors.primary, flexDirection: "row", gap: SPACING.sm, alignItems: "center", justifyContent: "center" },
  createText: { color: colors.primary, fontWeight: "800" },
  error: { color: colors.danger, fontSize: 13 },
});
