import { useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";

import { LockPasswordIcon } from "@/components/icons/lock-password-icon";
import {
  CONTROL_SIZE,
  FONT_SIZE,
  RADIUS,
  SHADOWS,
  SPACING,
  type ThemeColors,
} from "@/constants/theme";
import {
  DEFAULT_OFFLINE_MESSAGE,
  getActionErrorMessage,
} from "@/lib/network";
import { useAuth } from "@/providers/auth-provider";
import { useNetworkStatus } from "@/providers/network-provider";
import { useAppTheme } from "@/providers/theme-provider";

export default function ProfileScreen() {
  const { colors } = useAppTheme();
  const { isConnected, showOfflineToast } = useNetworkStatus();
  const { deleteCurrentUserAccount, profile, user } = useAuth();
  const styles = createStyles(colors);
  const [deleteError, setDeleteError] = useState("");
  const [isDeleting, setIsDeleting] = useState(false);

  if (user && !profile) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  const fullName =
    `${profile?.firstName ?? ""} ${profile?.lastName ?? ""}`.trim() ||
    profile?.displayName ||
    user?.displayName ||
    "-";
  const username = profile?.username ? `@${profile.username}` : "-";
  const bio = profile?.bio || "No bio added yet.";
  const accountEmail = profile?.email || user?.email || "-";
  const authorUrl = user?.uid ? `/author/${user.uid}` : "-";

  const runDeleteAccount = async () => {
    try {
      setIsDeleting(true);
      setDeleteError("");
      await deleteCurrentUserAccount();
    } catch (deleteActionError) {
      const message = getActionErrorMessage({
        error: deleteActionError,
        isConnected,
        fallbackMessage: "Unable to delete your account right now.",
      });

      if (message === DEFAULT_OFFLINE_MESSAGE) {
        showOfflineToast();
      }

      setDeleteError(message);
    } finally {
      setIsDeleting(false);
    }
  };

  const handleDeleteAccount = () => {
    Alert.alert(
      "Delete Account",
      "This action permanently deletes your account access and cannot be undone.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: () => {
            void runDeleteAccount();
          },
        },
      ],
    );
  };

  return (
    <ScrollView
      contentContainerStyle={styles.container}
      keyboardShouldPersistTaps="handled"
      showsVerticalScrollIndicator={false}
    >
      <View style={styles.headerBlock}>
        <Text style={styles.pageTitle}>Profile</Text>
        <Text style={styles.pageSubtitle}>
          Your profile is visible here, but editing is disabled.
        </Text>
      </View>

      <View style={styles.sectionCard}>
        <Text style={styles.sectionTitle}>Basic Info</Text>

        <View style={styles.field}>
          <Text style={styles.label}>Full Name</Text>
          <View style={styles.readonlyField}>
            <Text style={styles.readonlyValue}>{fullName}</Text>
          </View>
        </View>

        <View style={styles.field}>
          <Text style={styles.label}>Username</Text>
          <View style={styles.readonlyField}>
            <Text style={styles.readonlyValue}>{username}</Text>
          </View>
        </View>
      </View>

      <View style={styles.sectionCard}>
        <Text style={styles.sectionTitle}>Locked Details</Text>

        <View style={styles.field}>
          <Text style={styles.label}>Author URL</Text>
          <View style={styles.lockedField}>
            <Text style={styles.lockedValue} numberOfLines={1}>
              {authorUrl}
            </Text>
            <View style={styles.lockedBadge}>
              <LockPasswordIcon color={colors.iconMuted} size={16} />
              <Text style={styles.lockedBadgeText}>Locked</Text>
            </View>
          </View>
        </View>

        <View style={styles.field}>
          <Text style={styles.label}>Email Address</Text>
          <View style={styles.lockedField}>
            <Text style={styles.lockedValue} numberOfLines={1}>
              {accountEmail}
            </Text>
            <View style={styles.lockedBadge}>
              <LockPasswordIcon color={colors.iconMuted} size={16} />
              <Text style={styles.lockedBadgeText}>Locked</Text>
            </View>
          </View>
        </View>
      </View>

      <View style={styles.sectionCard}>
        <Text style={styles.sectionTitle}>Appearance</Text>

        <View style={styles.field}>
          <Text style={styles.label}>Bio</Text>
          <View style={[styles.readonlyField, styles.bioField]}>
            <Text style={styles.readonlyValue}>{bio}</Text>
          </View>
        </View>
      </View>

      <View style={[styles.sectionCard, styles.dangerCard]}>
        <Text style={styles.dangerTitle}>Delete Account</Text>
        <Text style={styles.dangerDescription}>
          This permanently removes your account access. You will not be able to recover it.
        </Text>

        {deleteError ? (
          <View style={[styles.feedbackCard, styles.feedbackCardError]}>
            <Text style={styles.feedbackTextError}>{deleteError}</Text>
          </View>
        ) : null}

        <Pressable
          style={({ pressed }) => [
            styles.deleteButton,
            pressed && styles.buttonPressed,
            isDeleting && styles.buttonDisabled,
          ]}
          onPress={handleDeleteAccount}
          disabled={isDeleting}
        >
          {isDeleting ? (
            <ActivityIndicator size="small" color={colors.danger} />
          ) : (
            <Text style={styles.deleteButtonText}>Delete My Account</Text>
          )}
        </Pressable>
      </View>
    </ScrollView>
  );
}

const createStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    container: {
      padding: SPACING.lg,
      paddingBottom: SPACING.xxl * 2,
      gap: SPACING.md,
      backgroundColor: colors.background,
    },
    loadingContainer: {
      flex: 1,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: colors.background,
    },
    headerBlock: {
      gap: SPACING.xs,
      paddingHorizontal: 2,
      paddingTop: SPACING.xs,
    },
    pageTitle: {
      color: colors.text,
      fontSize: FONT_SIZE.title,
      fontWeight: "700",
    },
    pageSubtitle: {
      color: colors.mutedText,
      fontSize: FONT_SIZE.body,
      lineHeight: 20,
    },
    sectionCard: {
      borderRadius: RADIUS.lg,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.surface,
      padding: SPACING.lg,
      gap: SPACING.md,
      ...SHADOWS.sm,
    },
    sectionTitle: {
      color: colors.text,
      fontSize: 20,
      fontWeight: "700",
    },
    field: {
      gap: SPACING.sm,
    },
    label: {
      color: colors.text,
      fontSize: 13,
      fontWeight: "700",
    },
    readonlyField: {
      minHeight: CONTROL_SIZE.inputHeight,
      borderRadius: RADIUS.md,
      borderWidth: 1,
      borderColor: colors.divider,
      backgroundColor: colors.surfaceSoft,
      paddingHorizontal: SPACING.md,
      paddingVertical: SPACING.md,
      justifyContent: "center",
    },
    readonlyValue: {
      color: colors.text,
      fontSize: FONT_SIZE.button,
      fontWeight: "500",
      lineHeight: 22,
    },
    bioField: {
      minHeight: 124,
      justifyContent: "flex-start",
    },
    lockedField: {
      minHeight: CONTROL_SIZE.inputHeight,
      borderRadius: RADIUS.md,
      borderWidth: 1,
      borderColor: colors.divider,
      backgroundColor: colors.surfaceSoft,
      paddingHorizontal: SPACING.md,
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      gap: SPACING.sm,
    },
    lockedValue: {
      flex: 1,
      color: colors.text,
      fontSize: FONT_SIZE.button,
      fontWeight: "500",
    },
    lockedBadge: {
      flexDirection: "row",
      alignItems: "center",
      gap: 6,
      borderRadius: RADIUS.pill,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.surface,
      paddingHorizontal: SPACING.sm,
      paddingVertical: 6,
    },
    lockedBadgeText: {
      color: colors.iconMuted,
      fontSize: 11,
      fontWeight: "700",
    },
    feedbackCard: {
      borderRadius: RADIUS.md,
      borderWidth: 1,
      paddingHorizontal: SPACING.md,
      paddingVertical: SPACING.md,
    },
    feedbackCardError: {
      borderColor: colors.dangerBorder,
      backgroundColor: colors.dangerSoft,
    },
    feedbackTextError: {
      color: colors.danger,
      fontSize: 13,
      lineHeight: 19,
    },
    buttonPressed: {
      opacity: 0.9,
    },
    buttonDisabled: {
      opacity: 0.6,
    },
    dangerCard: {
      borderColor: colors.dangerBorder,
    },
    dangerTitle: {
      color: colors.danger,
      fontSize: 20,
      fontWeight: "700",
    },
    dangerDescription: {
      color: colors.mutedText,
      fontSize: 13,
      lineHeight: 19,
    },
    deleteButton: {
      minHeight: CONTROL_SIZE.inputHeight,
      borderRadius: RADIUS.md,
      borderWidth: 1,
      borderColor: colors.dangerBorder,
      backgroundColor: colors.dangerSoft,
      alignItems: "center",
      justifyContent: "center",
      paddingHorizontal: SPACING.md,
    },
    deleteButtonText: {
      color: colors.danger,
      fontSize: FONT_SIZE.button,
      fontWeight: "700",
    },
  });
