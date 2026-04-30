import { Redirect } from "expo-router";
import { useState } from "react";
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
} from "react-native";

import {
  RADIUS,
  SHADOWS,
  SPACING,
  type ThemeColors,
  type ThemeMode,
} from "@/constants/theme";
import {
  sendCustomPushNotificationToAllActiveUsersAsync,
  sendCustomPushNotificationToUserAsync,
} from "@/lib/notifications";
import { getActionErrorMessage } from "@/lib/network";
import { type UserNotificationCategory } from "@/lib/user-notifications";
import { useAuth } from "@/providers/auth-provider";
import { useNetworkStatus } from "@/providers/network-provider";
import { useAppTheme } from "@/providers/theme-provider";

type AudienceMode = "all" | "single";

const CATEGORY_HELPER: Record<UserNotificationCategory, string> = {
  general: "Shows in Home tab notification page for all regular users.",
  creator: "Shows in Home tab notification page for creator/admin context.",
};

export default function AdminCustomNotificationsScreen() {
  const { colors, resolvedTheme } = useAppTheme();
  const { canManagePosts, isAdmin } = useAuth();
  const { isConnected, showOfflineToast, showToast } = useNetworkStatus();
  const styles = createStyles(colors, resolvedTheme);
  const [audienceMode, setAudienceMode] = useState<AudienceMode>("all");
  const [category, setCategory] = useState<UserNotificationCategory>("general");
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [imageUrl, setImageUrl] = useState("");
  const [targetUid, setTargetUid] = useState("");
  const [isPushEnabled, setIsPushEnabled] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [isSending, setIsSending] = useState(false);

  if (!canManagePosts) {
    return <Redirect href="/settings" />;
  }

  if (!isAdmin) {
    return <Redirect href="/admin" />;
  }

  const clearFeedback = () => {
    setError("");
    setSuccess("");
  };

  const handleSendNotification = async () => {
    if (!isConnected) {
      showOfflineToast();
      return;
    }

    const normalizedTitle = title.trim();
    const normalizedBody = body.trim();
    const normalizedImageUrl = imageUrl.trim();
    const normalizedUid = targetUid.trim();

    if (!normalizedTitle) {
      setError("Notification title is required.");
      setSuccess("");
      return;
    }

    if (!normalizedBody) {
      setError("Notification message is required.");
      setSuccess("");
      return;
    }

    if (audienceMode === "single" && !normalizedUid) {
      setError("Target user UID is required for single-user notifications.");
      setSuccess("");
      return;
    }

    try {
      setIsSending(true);
      clearFeedback();

      const result =
        audienceMode === "single"
          ? await sendCustomPushNotificationToUserAsync({
              uid: normalizedUid,
              title: normalizedTitle,
              body: normalizedBody,
              imageUrl: normalizedImageUrl,
              category,
              data: {
                source: "admin_custom",
                audience: "single",
                category,
              },
              sendPush: isPushEnabled,
              audience: "single",
            })
          : await sendCustomPushNotificationToAllActiveUsersAsync({
              title: normalizedTitle,
              body: normalizedBody,
              imageUrl: normalizedImageUrl,
              category,
              data: {
                source: "admin_custom",
                audience: "all",
                category,
              },
              sendPush: isPushEnabled,
              audience: "all",
            });

      if (!result.savedCount) {
        setError("No eligible recipients found for this notification.");
        return;
      }

      const successMessage = isPushEnabled
        ? `Notification sent. In-app: ${result.savedCount}, Push recipients: ${result.pushRecipientCount}, Push tokens: ${result.pushTokenCount}.`
        : `In-app notification sent. Saved: ${result.savedCount}. Push delivery is OFF.`;
      setSuccess(successMessage);
      showToast(isPushEnabled ? "Custom notification sent with push." : "In-app notification sent.");
      setBody("");
    } catch (sendError) {
      setError(
        getActionErrorMessage({
          error: sendError,
          isConnected,
          fallbackMessage: "Unable to send custom notification right now.",
        }),
      );
    } finally {
      setIsSending(false);
    }
  };

  return (
    <ScrollView
      contentContainerStyle={styles.container}
      showsVerticalScrollIndicator={false}
    >
      <View style={styles.introCard}>
        <Text style={styles.introTitle}>Send Custom Notification</Text>
        <Text style={styles.introText}>
          In-app notifications Home tab notification page par aayengi. Push bhejna ho to toggle ON karo.
        </Text>
      </View>

      <View style={styles.sectionCard}>
        <Text style={styles.sectionLabel}>Audience</Text>
        <View style={styles.optionRow}>
          <Pressable
            style={[
              styles.optionPill,
              audienceMode === "all" && styles.optionPillActive,
            ]}
            onPress={() => {
              clearFeedback();
              setAudienceMode("all");
            }}
          >
            <Text
              style={[
                styles.optionPillText,
                audienceMode === "all" && styles.optionPillTextActive,
              ]}
            >
              All Active Users
            </Text>
          </Pressable>
          <Pressable
            style={[
              styles.optionPill,
              audienceMode === "single" && styles.optionPillActive,
            ]}
            onPress={() => {
              clearFeedback();
              setAudienceMode("single");
            }}
          >
            <Text
              style={[
                styles.optionPillText,
                audienceMode === "single" && styles.optionPillTextActive,
              ]}
            >
              Single User
            </Text>
          </Pressable>
        </View>

        {audienceMode === "single" ? (
          <View style={styles.inputWrap}>
            <Text style={styles.inputLabel}>Target User UID</Text>
            <TextInput
              style={styles.input}
              placeholder="Enter Firebase UID..."
              placeholderTextColor={colors.placeholderText}
              value={targetUid}
              onChangeText={setTargetUid}
              autoCapitalize="none"
              autoCorrect={false}
            />
          </View>
        ) : null}
      </View>

      <View style={styles.sectionCard}>
        <Text style={styles.sectionLabel}>Notification Category</Text>
        <View style={styles.optionRow}>
          <Pressable
            style={[
              styles.optionPill,
              category === "general" && styles.optionPillActive,
            ]}
            onPress={() => {
              clearFeedback();
              setCategory("general");
            }}
          >
            <Text
              style={[
                styles.optionPillText,
                category === "general" && styles.optionPillTextActive,
              ]}
            >
              General
            </Text>
          </Pressable>
          <Pressable
            style={[
              styles.optionPill,
              category === "creator" && styles.optionPillActive,
            ]}
            onPress={() => {
              clearFeedback();
              setCategory("creator");
            }}
          >
            <Text
              style={[
                styles.optionPillText,
                category === "creator" && styles.optionPillTextActive,
              ]}
            >
              Creator
            </Text>
          </Pressable>
        </View>
        <Text style={styles.helperText}>{CATEGORY_HELPER[category]}</Text>
      </View>

      <View style={styles.sectionCard}>
        <View style={styles.toggleRow}>
          <View style={styles.toggleContent}>
            <Text style={styles.sectionLabel}>Push Notification</Text>
            <Text style={styles.helperText}>
              {isPushEnabled
                ? "ON: In-app + push notification send hoga."
                : "OFF: Sirf in-app notification send hoga."}
            </Text>
          </View>
          <Switch
            value={isPushEnabled}
            onValueChange={(value) => {
              clearFeedback();
              setIsPushEnabled(value);
            }}
            trackColor={{
              false: colors.surfaceMuted,
              true: colors.primary,
            }}
            thumbColor={colors.primaryText}
            disabled={isSending}
          />
        </View>
      </View>

      <View style={styles.sectionCard}>
        <View style={styles.inputWrap}>
          <Text style={styles.inputLabel}>Title</Text>
          <TextInput
            style={styles.input}
            placeholder="Notification title..."
            placeholderTextColor={colors.placeholderText}
            value={title}
            onChangeText={setTitle}
            maxLength={80}
          />
        </View>

        <View style={styles.inputWrap}>
          <Text style={styles.inputLabel}>Message</Text>
          <TextInput
            style={[styles.input, styles.bodyInput]}
            placeholder="Write notification message..."
            placeholderTextColor={colors.placeholderText}
            value={body}
            onChangeText={setBody}
            multiline
            textAlignVertical="top"
            maxLength={280}
          />
        </View>

        <View style={styles.inputWrap}>
          <Text style={styles.inputLabel}>Image URL (Optional)</Text>
          <TextInput
            style={styles.input}
            placeholder="https://..."
            placeholderTextColor={colors.placeholderText}
            value={imageUrl}
            onChangeText={setImageUrl}
            autoCapitalize="none"
            autoCorrect={false}
          />
        </View>
      </View>

      {error ? (
        <View style={[styles.feedbackCard, styles.feedbackError]}>
          <Text style={styles.feedbackErrorText}>{error}</Text>
        </View>
      ) : null}

      {success ? (
        <View style={[styles.feedbackCard, styles.feedbackSuccess]}>
          <Text style={styles.feedbackSuccessText}>{success}</Text>
        </View>
      ) : null}

      <Pressable
        style={({ pressed }) => [
          styles.submitButton,
          (pressed || isSending) && styles.submitButtonPressed,
          isSending && styles.submitButtonDisabled,
        ]}
        onPress={() => {
          void handleSendNotification();
        }}
        disabled={isSending}
      >
        <Text style={styles.submitButtonText}>
          {isSending ? "Sending..." : "Send Notification"}
        </Text>
      </Pressable>
    </ScrollView>
  );
}

const createStyles = (colors: ThemeColors, resolvedTheme: ThemeMode) => {
  const outlineColor = resolvedTheme === "dark" ? colors.divider : colors.border;

  return StyleSheet.create({
    container: {
      padding: SPACING.lg,
      paddingBottom: SPACING.xxl * 2,
      gap: SPACING.md,
      backgroundColor: colors.background,
    },
    introCard: {
      borderRadius: RADIUS.md,
      borderWidth: 1,
      borderColor: outlineColor,
      backgroundColor: colors.surface,
      paddingHorizontal: SPACING.lg,
      paddingVertical: SPACING.lg,
      gap: 6,
      ...SHADOWS.sm,
    },
    introTitle: {
      color: colors.text,
      fontSize: 19,
      fontWeight: "700",
    },
    introText: {
      color: colors.mutedText,
      fontSize: 13,
      lineHeight: 20,
    },
    sectionCard: {
      borderRadius: RADIUS.md,
      borderWidth: 1,
      borderColor: outlineColor,
      backgroundColor: colors.surface,
      paddingHorizontal: SPACING.lg,
      paddingVertical: SPACING.lg,
      gap: SPACING.md,
      ...SHADOWS.sm,
    },
    sectionLabel: {
      color: colors.text,
      fontSize: 15,
      fontWeight: "700",
    },
    optionRow: {
      flexDirection: "row",
      flexWrap: "wrap",
      gap: SPACING.sm,
    },
    optionPill: {
      borderRadius: 999,
      borderWidth: 1,
      borderColor: outlineColor,
      backgroundColor: colors.surfaceMuted,
      paddingHorizontal: SPACING.md,
      paddingVertical: 8,
    },
    optionPillActive: {
      borderColor: colors.accentBorder,
      backgroundColor: colors.activeSurface,
    },
    optionPillText: {
      color: colors.text,
      fontSize: 13,
      fontWeight: "600",
    },
    optionPillTextActive: {
      color: colors.accent,
      fontWeight: "700",
    },
    helperText: {
      color: colors.mutedText,
      fontSize: 12,
      lineHeight: 18,
    },
    toggleRow: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      gap: SPACING.md,
    },
    toggleContent: {
      flex: 1,
      gap: 4,
    },
    inputWrap: {
      gap: 6,
    },
    inputLabel: {
      color: colors.text,
      fontSize: 13,
      fontWeight: "600",
    },
    input: {
      borderWidth: 1,
      borderColor: outlineColor,
      borderRadius: RADIUS.md,
      backgroundColor: colors.surfaceMuted,
      color: colors.text,
      paddingHorizontal: SPACING.md,
      paddingVertical: SPACING.md,
      fontSize: 14,
    },
    bodyInput: {
      minHeight: 120,
    },
    feedbackCard: {
      borderRadius: RADIUS.md,
      borderWidth: 1,
      paddingHorizontal: SPACING.lg,
      paddingVertical: SPACING.md,
    },
    feedbackError: {
      backgroundColor: colors.dangerSoft,
      borderColor: colors.dangerBorder,
    },
    feedbackSuccess: {
      backgroundColor: colors.successSoft,
      borderColor: colors.successBorder,
    },
    feedbackErrorText: {
      color: colors.danger,
      fontSize: 13,
      lineHeight: 19,
    },
    feedbackSuccessText: {
      color: colors.success,
      fontSize: 13,
      lineHeight: 19,
    },
    submitButton: {
      borderRadius: RADIUS.md,
      backgroundColor: colors.primary,
      alignItems: "center",
      justifyContent: "center",
      minHeight: 48,
      paddingHorizontal: SPACING.lg,
      ...SHADOWS.sm,
    },
    submitButtonPressed: {
      opacity: 0.9,
    },
    submitButtonDisabled: {
      opacity: 0.6,
    },
    submitButtonText: {
      color: colors.primaryText,
      fontSize: 15,
      fontWeight: "700",
    },
  });
};
