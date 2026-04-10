import { Redirect } from "expo-router";
import { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { collection, onSnapshot, query, type DocumentData } from "firebase/firestore";

import {
  CONTROL_SIZE,
  FONT_SIZE,
  RADIUS,
  SHADOWS,
  SPACING,
  type ThemeColors,
  type ThemeMode,
} from "@/constants/theme";
import { isValidOptionalHttpUrl } from "@/lib/content";
import { firestore } from "@/lib/firebase";
import {
  sendCustomPushNotificationToAllActiveUsersAsync,
  sendCustomPushNotificationToUserAsync,
} from "@/lib/notifications";
import { getActionErrorMessage, getRequestErrorMessage } from "@/lib/network";
import { useAuth } from "@/providers/auth-provider";
import { useNetworkStatus } from "@/providers/network-provider";
import { useAppTheme } from "@/providers/theme-provider";

const USERS_COLLECTION = "users";
const TITLE_LIMIT = 60;
const BODY_LIMIT = 180;

type AudienceMode = "all" | "single";

type NotificationRecipient = {
  uid: string;
  displayName: string;
  email: string;
  username: string;
  accountStatus: "active" | "deleted";
};

const readStringValue = (value: unknown) => (typeof value === "string" ? value.trim() : "");

const mapRecipient = (uid: string, data: DocumentData): NotificationRecipient => {
  const email = readStringValue(data?.email);
  const firstName = readStringValue(data?.firstName);
  const lastName = readStringValue(data?.lastName);
  const username = readStringValue(data?.username);
  const displayName =
    readStringValue(data?.displayName) ||
    `${firstName} ${lastName}`.trim() ||
    username ||
    email ||
    "User";

  return {
    uid,
    displayName,
    email,
    username,
    accountStatus: readStringValue(data?.accountStatus) === "deleted" ? "deleted" : "active",
  };
};

export default function AdminNotificationsScreen() {
  const { colors, resolvedTheme } = useAppTheme();
  const { isConnected, showOfflineToast, showToast } = useNetworkStatus();
  const { isOwner } = useAuth();
  const styles = createStyles(colors, resolvedTheme);
  const [audienceMode, setAudienceMode] = useState<AudienceMode>("all");
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [imageUrl, setImageUrl] = useState("");
  const [recipientQuery, setRecipientQuery] = useState("");
  const [selectedUserId, setSelectedUserId] = useState("");
  const [users, setUsers] = useState<NotificationRecipient[]>([]);
  const [loadError, setLoadError] = useState("");
  const [submitError, setSubmitError] = useState("");
  const [isLoadingUsers, setIsLoadingUsers] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (!isOwner) {
      return;
    }

    const usersQuery = query(collection(firestore, USERS_COLLECTION));
    const unsubscribe = onSnapshot(
      usersQuery,
      (snapshot) => {
        setUsers(
          snapshot.docs
            .map((item) => mapRecipient(item.id, item.data() as DocumentData))
            .sort((left, right) => left.displayName.localeCompare(right.displayName)),
        );
        setLoadError("");
        setIsLoadingUsers(false);
      },
      (snapshotError) => {
        setLoadError(
          getRequestErrorMessage({
            error: snapshotError,
            isConnected,
            onlineMessage: "Unable to load users for notifications.",
          }),
        );
        setIsLoadingUsers(false);
      },
    );

    return unsubscribe;
  }, [isConnected, isOwner]);

  const activeUsers = useMemo(
    () => users.filter((item) => item.accountStatus === "active"),
    [users],
  );

  const selectedUser = useMemo(
    () => activeUsers.find((item) => item.uid === selectedUserId) ?? null,
    [activeUsers, selectedUserId],
  );

  const filteredUsers = useMemo(() => {
    const keyword = recipientQuery.trim().toLowerCase();
    const matchedUsers = activeUsers.filter((item) => {
      if (!keyword) {
        return true;
      }

      return [item.displayName, item.email, item.username, item.uid]
        .join(" ")
        .toLowerCase()
        .includes(keyword);
    });

    return matchedUsers.slice(0, 12);
  }, [activeUsers, recipientQuery]);

  useEffect(() => {
    if (selectedUserId && !selectedUser) {
      setSelectedUserId("");
    }
  }, [selectedUser, selectedUserId]);

  if (!isOwner) {
    return <Redirect href="/admin" />;
  }

  const resetForm = () => {
    setTitle("");
    setBody("");
    setImageUrl("");
    setRecipientQuery("");
    if (audienceMode === "all") {
      setSelectedUserId("");
    }
  };

  const handleSendNotification = async () => {
    if (!isConnected) {
      showOfflineToast();
      return;
    }

    const normalizedTitle = title.trim();
    const normalizedBody = body.trim();
    const normalizedImageUrl = imageUrl.trim();

    setSubmitError("");

    if (!normalizedTitle) {
      setSubmitError("Notification title is required.");
      return;
    }

    if (!normalizedBody) {
      setSubmitError("Notification message is required.");
      return;
    }

    if (!isValidOptionalHttpUrl(normalizedImageUrl)) {
      setSubmitError("Image URL must be a valid HTTP or HTTPS link.");
      return;
    }

    if (audienceMode === "single" && !selectedUser) {
      setSubmitError("Select one recipient before sending.");
      return;
    }

    try {
      setIsSubmitting(true);

      const dispatchResult =
        audienceMode === "all"
          ? await sendCustomPushNotificationToAllActiveUsersAsync({
              title: normalizedTitle,
              body: normalizedBody,
              imageUrl: normalizedImageUrl || undefined,
            })
          : await sendCustomPushNotificationToUserAsync({
              uid: selectedUserId,
              title: normalizedTitle,
              body: normalizedBody,
              imageUrl: normalizedImageUrl || undefined,
            });

      if (!dispatchResult.savedCount) {
        setSubmitError(
          audienceMode === "all"
            ? "No active users were available for this notification."
            : "Selected user is no longer available for notifications.",
        );
        return;
      }

      if (audienceMode === "all") {
        showToast(
          dispatchResult.pushRecipientCount > 0
            ? dispatchResult.pushRecipientCount === dispatchResult.savedCount
              ? `Notification sent and saved for ${dispatchResult.savedCount} active users.`
              : `Saved for ${dispatchResult.savedCount} active users. Push sent to ${dispatchResult.pushRecipientCount} users with active devices.`
            : `Saved for ${dispatchResult.savedCount} active users. No active push tokens were available.`,
        );
      } else {
        showToast(
          dispatchResult.pushRecipientCount > 0
            ? `Notification sent and saved for ${selectedUser?.displayName ?? "the selected user"}.`
            : `Notification saved for ${selectedUser?.displayName ?? "the selected user"}. No active push token is registered yet.`,
        );
      }
      resetForm();
    } catch (error) {
      setSubmitError(
        getActionErrorMessage({
          error,
          isConnected,
          fallbackMessage: "Unable to send and save the custom notification.",
        }),
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <ScrollView
      contentContainerStyle={styles.container}
      keyboardShouldPersistTaps="handled"
    >
      <Text style={styles.title}>Custom Notifications</Text>
      <Text style={styles.subtitle}>
        Owner-only broadcast tool. Sends push notifications and also saves them to each
        user&apos;s Notifications tab.
      </Text>

      {loadError ? <Text style={styles.error}>{loadError}</Text> : null}
      {submitError ? <Text style={styles.error}>{submitError}</Text> : null}

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Audience</Text>
        <View style={styles.sectionDivider} />
        <Text style={styles.helperText}>
          {activeUsers.length} active users are currently available for targeting.
        </Text>

        <View style={styles.segmentRow}>
          <Pressable
            style={[
              styles.segmentButton,
              audienceMode === "all" ? styles.segmentButtonActive : undefined,
            ]}
            onPress={() => setAudienceMode("all")}
          >
            <Text
              style={[
                styles.segmentButtonText,
                audienceMode === "all" ? styles.segmentButtonTextActive : undefined,
              ]}
            >
              All Active Users
            </Text>
          </Pressable>

          <Pressable
            style={[
              styles.segmentButton,
              audienceMode === "single" ? styles.segmentButtonActive : undefined,
            ]}
            onPress={() => setAudienceMode("single")}
          >
            <Text
              style={[
                styles.segmentButtonText,
                audienceMode === "single" ? styles.segmentButtonTextActive : undefined,
              ]}
            >
              Single User
            </Text>
          </Pressable>
        </View>

        {audienceMode === "single" ? (
          <View style={styles.selectorSection}>
            <View style={styles.inputWrap}>
              <TextInput
                value={recipientQuery}
                onChangeText={setRecipientQuery}
                placeholder="Search by name, email, username, or UID"
                placeholderTextColor={colors.mutedText}
                autoCapitalize="none"
                style={styles.input}
              />
            </View>

            {selectedUser ? (
              <View style={styles.selectedUserCard}>
                <View style={styles.selectedUserTextWrap}>
                  <Text style={styles.selectedUserName}>{selectedUser.displayName}</Text>
                  <Text style={styles.selectedUserMeta}>
                    {selectedUser.email || `@${selectedUser.username || "unknown"}`}
                  </Text>
                  <Text style={styles.selectedUserMeta}>{selectedUser.uid}</Text>
                </View>

                <Pressable
                  style={styles.clearSelectionButton}
                  onPress={() => setSelectedUserId("")}
                >
                  <Text style={styles.clearSelectionText}>Clear</Text>
                </Pressable>
              </View>
            ) : null}

            {isLoadingUsers ? (
              <ActivityIndicator size="small" color={colors.primary} />
            ) : (
              <View style={styles.recipientList}>
                {filteredUsers.map((item, index) => {
                  const isSelected = item.uid === selectedUserId;

                  return (
                    <Pressable
                      key={item.uid}
                      style={[
                        styles.recipientCard,
                        index > 0 ? styles.recipientCardDivider : undefined,
                        isSelected ? styles.recipientCardSelected : undefined,
                      ]}
                      onPress={() => setSelectedUserId(item.uid)}
                    >
                      <Text style={styles.recipientName}>{item.displayName}</Text>
                      <Text style={styles.recipientMeta}>
                        {item.email || `@${item.username || "unknown"}`}
                      </Text>
                      <Text style={styles.recipientMeta} numberOfLines={1}>
                        {item.uid}
                      </Text>
                    </Pressable>
                  );
                })}

                {!filteredUsers.length ? (
                  <Text style={styles.emptyText}>No active users match the current search.</Text>
                ) : null}
              </View>
            )}
          </View>
        ) : null}
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Message</Text>
        <View style={styles.sectionDivider} />

        <View style={styles.fieldGroup}>
          <Text style={styles.label}>Title</Text>
          <View style={styles.inputWrap}>
            <TextInput
              value={title}
              onChangeText={setTitle}
              placeholder="Notification title"
              placeholderTextColor={colors.mutedText}
              maxLength={TITLE_LIMIT}
              style={styles.input}
            />
          </View>
          <Text style={styles.counterText}>
            {title.trim().length}/{TITLE_LIMIT}
          </Text>
        </View>

        <View style={styles.fieldGroup}>
          <Text style={styles.label}>Message</Text>
          <View style={[styles.inputWrap, styles.textAreaWrap]}>
            <TextInput
              value={body}
              onChangeText={setBody}
              placeholder="Write the notification message"
              placeholderTextColor={colors.mutedText}
              maxLength={BODY_LIMIT}
              multiline
              textAlignVertical="top"
              style={[styles.input, styles.textArea]}
            />
          </View>
          <Text style={styles.counterText}>
            {body.trim().length}/{BODY_LIMIT}
          </Text>
        </View>

        <View style={styles.fieldGroup}>
          <Text style={styles.label}>Image URL</Text>
          <View style={styles.inputWrap}>
            <TextInput
              value={imageUrl}
              onChangeText={setImageUrl}
              placeholder="Optional HTTPS image URL"
              placeholderTextColor={colors.mutedText}
              autoCapitalize="none"
              autoCorrect={false}
              style={styles.input}
            />
          </View>
          <Text style={styles.helperText}>
            Optional. If provided, supported devices will show a rich notification image.
          </Text>
        </View>

        <Pressable
          style={({ pressed }) => [
            styles.submitButton,
            (pressed || isSubmitting) && styles.buttonPressed,
            isSubmitting && styles.buttonDisabled,
          ]}
          onPress={() => {
            void handleSendNotification();
          }}
          disabled={isSubmitting}
        >
          <Text style={styles.submitButtonText}>
            {isSubmitting
              ? "Sending..."
              : audienceMode === "all"
                ? "Send To All Active Users"
                : "Send To Selected User"}
          </Text>
        </Pressable>
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
      lineHeight: 20,
    },
    error: {
      color: colors.danger,
      fontSize: 13,
    },
    section: {
      backgroundColor: colors.surface,
      borderRadius: RADIUS.lg,
      padding: SPACING.lg,
      gap: SPACING.sm,
      ...SHADOWS.sm,
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
    helperText: {
      color: colors.mutedText,
      fontSize: 12,
      lineHeight: 18,
    },
    segmentRow: {
      flexDirection: "row",
      gap: SPACING.sm,
    },
    segmentButton: {
      flex: 1,
      minHeight: CONTROL_SIZE.inputHeight,
      borderRadius: RADIUS.md,
      borderWidth: 1,
      borderColor: outlineColor,
      backgroundColor: colors.surface,
      alignItems: "center",
      justifyContent: "center",
      paddingHorizontal: SPACING.md,
    },
    segmentButtonActive: {
      backgroundColor: colors.primary,
      borderColor: colors.primary,
    },
    segmentButtonText: {
      color: colors.text,
      fontSize: 14,
      fontWeight: "700",
      textAlign: "center",
    },
    segmentButtonTextActive: {
      color: colors.primaryText,
    },
    selectorSection: {
      gap: SPACING.sm,
    },
    fieldGroup: {
      gap: SPACING.xs,
    },
    label: {
      color: colors.text,
      fontSize: 13,
      fontWeight: "700",
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
    textAreaWrap: {
      minHeight: 132,
      paddingVertical: SPACING.md,
      justifyContent: "flex-start",
    },
    textArea: {
      minHeight: 96,
    },
    counterText: {
      color: colors.subtleText,
      fontSize: 11,
      textAlign: "right",
    },
    selectedUserCard: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      gap: SPACING.sm,
      borderRadius: RADIUS.md,
      borderWidth: 1,
      borderColor: colors.accentBorder,
      backgroundColor: colors.accentSoft,
      padding: SPACING.md,
    },
    selectedUserTextWrap: {
      flex: 1,
      gap: 2,
    },
    selectedUserName: {
      color: colors.text,
      fontSize: 15,
      fontWeight: "700",
    },
    selectedUserMeta: {
      color: colors.mutedText,
      fontSize: 12,
    },
    clearSelectionButton: {
      borderRadius: RADIUS.pill,
      borderWidth: 1,
      borderColor: outlineColor,
      backgroundColor: colors.surface,
      paddingHorizontal: SPACING.md,
      paddingVertical: SPACING.sm,
    },
    clearSelectionText: {
      color: colors.text,
      fontSize: 12,
      fontWeight: "700",
    },
    recipientList: {
      gap: 0,
    },
    recipientCard: {
      borderRadius: RADIUS.md,
      backgroundColor: "transparent",
      paddingVertical: SPACING.md,
      gap: 2,
    },
    recipientCardDivider: {
      borderTopWidth: StyleSheet.hairlineWidth,
      borderTopColor: colors.divider,
    },
    recipientCardSelected: {
      backgroundColor: colors.accentSoft,
      paddingHorizontal: SPACING.md,
    },
    recipientName: {
      color: colors.text,
      fontSize: 14,
      fontWeight: "700",
    },
    recipientMeta: {
      color: colors.mutedText,
      fontSize: 12,
    },
    emptyText: {
      color: colors.mutedText,
      fontSize: FONT_SIZE.body,
    },
    submitButton: {
      minHeight: CONTROL_SIZE.inputHeight,
      borderRadius: RADIUS.md,
      backgroundColor: colors.primary,
      borderWidth: 1,
      borderColor: colors.primary,
      alignItems: "center",
      justifyContent: "center",
      paddingHorizontal: SPACING.md,
      paddingVertical: SPACING.md,
      marginTop: SPACING.xs,
    },
    submitButtonText: {
      color: colors.primaryText,
      fontSize: 15,
      fontWeight: "700",
      textAlign: "center",
    },
    buttonPressed: {
      opacity: 0.9,
    },
    buttonDisabled: {
      opacity: 0.65,
    },
  });
};
