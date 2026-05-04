import { useCallback, useEffect, useMemo, useState } from "react";
import { Stack, useRouter } from "expo-router";
import {
  ActivityIndicator,
  Alert,
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";

import { NotificationBellIcon } from "@/components/icons/notification-bell-icon";
import { TrashActionIcon } from "@/components/icons/trash-action-icon";
import { RADIUS, SHADOWS, SPACING, type ThemeColors } from "@/constants/theme";
import { useUserNotifications } from "@/hooks/use-user-notifications";
import {
  deleteUserNotificationsAsync,
  formatUserNotificationRelativeTime,
  markUserNotificationsAsReadAsync,
  type UserNotificationRecord,
} from "@/lib/user-notifications";
import { useAuth } from "@/providers/auth-provider";
import { useAppTheme } from "@/providers/theme-provider";

const getTimeLabel = (value: string) => {
  if (!value) {
    return "";
  }

  return formatUserNotificationRelativeTime(value);
};

export default function NotificationsScreen() {
  const { colors } = useAppTheme();
  const { user } = useAuth();
  const router = useRouter();
  const styles = createStyles(colors);
  const { notifications, unreadCount, isLoading } = useUserNotifications({
    category: "all",
  });
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [isDeleting, setIsDeleting] = useState(false);
  const selectedCount = selectedIds.length;
  const isSelectionMode = selectedCount > 0;
  const selectedIdSet = useMemo(() => new Set(selectedIds), [selectedIds]);

  const subtitle = useMemo(() => {
    if (isSelectionMode) {
      return `${selectedCount} selected`;
    }

    if (isLoading) {
      return "Loading notifications...";
    }

    if (!notifications.length) {
      return "No notifications yet.";
    }

    if (!unreadCount) {
      return `${notifications.length} notifications`;
    }

    return `${unreadCount} unread of ${notifications.length}`;
  }, [isLoading, isSelectionMode, notifications.length, selectedCount, unreadCount]);

  useEffect(() => {
    if (!selectedIds.length) {
      return;
    }

    const availableIdSet = new Set(notifications.map((item) => item.id));
    setSelectedIds((currentIds) => {
      const nextIds = currentIds.filter((id) => availableIdSet.has(id));
      return nextIds.length === currentIds.length ? currentIds : nextIds;
    });
  }, [notifications, selectedIds.length]);

  const toggleSelection = useCallback((notificationId: string) => {
    setSelectedIds((currentIds) => {
      if (currentIds.includes(notificationId)) {
        return currentIds.filter((id) => id !== notificationId);
      }

      return [...currentIds, notificationId];
    });
  }, []);

  const handleDeleteSelectedNotifications = useCallback(async () => {
    if (!user?.uid || !selectedIds.length || isDeleting) {
      return;
    }

    setIsDeleting(true);
    try {
      await deleteUserNotificationsAsync({
        uid: user.uid,
        notificationIds: selectedIds,
      });
      setSelectedIds([]);
    } catch {
      Alert.alert(
        "Unable to delete notifications",
        "Please try again in a moment.",
      );
    } finally {
      setIsDeleting(false);
    }
  }, [isDeleting, selectedIds, user?.uid]);

  const handleConfirmDeleteSelected = useCallback(() => {
    if (!selectedIds.length || isDeleting) {
      return;
    }

    Alert.alert(
      "Delete selected notifications?",
      `${selectedIds.length} notification${selectedIds.length === 1 ? "" : "s"} will be removed.`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: () => {
            void handleDeleteSelectedNotifications();
          },
        },
      ],
    );
  }, [handleDeleteSelectedNotifications, isDeleting, selectedIds.length]);

  const handleOpenNotification = useCallback(
    (notification: UserNotificationRecord) => {
      if (user?.uid && !notification.isRead) {
        void markUserNotificationsAsReadAsync({
          uid: user.uid,
          notificationIds: [notification.id],
        }).catch(() => {
          // Ignore read-state write issues.
        });
      }

      if (notification.postId) {
        router.push({
          pathname: "/post/[postId]",
          params: { postId: notification.postId },
        });
      }
    },
    [router, user?.uid],
  );

  const handlePressNotification = useCallback(
    (notification: UserNotificationRecord) => {
      if (isSelectionMode) {
        toggleSelection(notification.id);
        return;
      }

      handleOpenNotification(notification);
    },
    [handleOpenNotification, isSelectionMode, toggleSelection],
  );

  const handleLongPressNotification = useCallback(
    (notificationId: string) => {
      toggleSelection(notificationId);
    },
    [toggleSelection],
  );

  return (
    <>
      <Stack.Screen
        options={{
          headerRight: () =>
            isSelectionMode ? (
              <Pressable
                style={({ pressed }) => [
                  styles.headerDeleteButton,
                  pressed && styles.headerDeleteButtonPressed,
                  isDeleting && styles.headerDeleteButtonDisabled,
                ]}
                onPress={handleConfirmDeleteSelected}
                disabled={isDeleting}
                accessibilityRole="button"
                accessibilityLabel={`Delete ${selectedCount} selected notification${selectedCount === 1 ? "" : "s"}`}
              >
                <TrashActionIcon size={18} color={colors.danger} />
              </Pressable>
            ) : null,
        }}
      />

      <ScrollView
        contentContainerStyle={styles.container}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.headerCard}>
          <Text style={styles.headerTitle}>Notifications</Text>
          <Text style={styles.headerSubtitle}>{subtitle}</Text>
        </View>

        {isLoading ? (
          <View style={styles.loadingWrap}>
            <ActivityIndicator size="small" color={colors.primary} />
          </View>
        ) : null}

        {!isLoading && !notifications.length ? (
          <View style={styles.emptyCard}>
            <View style={styles.emptyIconWrap}>
              <NotificationBellIcon size={22} color={colors.mutedText} />
            </View>
            <Text style={styles.emptyTitle}>No notifications yet</Text>
            <Text style={styles.emptyText}>
              New updates and approvals will appear here.
            </Text>
          </View>
        ) : null}

        {!isLoading
          ? notifications.map((notification) => {
              const timeLabel = getTimeLabel(notification.createdAt);
              const isSelected = selectedIdSet.has(notification.id);

              return (
                <Pressable
                  key={notification.id}
                  style={({ pressed }) => [
                    styles.card,
                    !notification.isRead && styles.cardUnread,
                    isSelected && styles.cardSelected,
                    pressed && styles.cardPressed,
                  ]}
                  onPress={() => {
                    handlePressNotification(notification);
                  }}
                  onLongPress={() => {
                    handleLongPressNotification(notification.id);
                  }}
                  delayLongPress={220}
                >
                  {notification.imageUrl ? (
                    <Image source={{ uri: notification.imageUrl }} style={styles.cardImage} />
                  ) : (
                    <View style={styles.cardImageFallback}>
                      <NotificationBellIcon
                        size={20}
                        color={notification.isRead ? colors.subtleText : colors.primary}
                      />
                    </View>
                  )}

                  <View style={styles.cardBody}>
                    <View style={styles.cardTopRow}>
                      <Text style={styles.cardTitle} numberOfLines={1}>
                        {notification.title}
                      </Text>
                      <View style={styles.cardMetaWrap}>
                        {isSelected ? (
                          <View style={styles.selectedPill}>
                            <Text style={styles.selectedPillText}>Selected</Text>
                          </View>
                        ) : null}
                        {timeLabel ? (
                          <Text style={styles.cardTime} numberOfLines={1}>
                            {timeLabel}
                          </Text>
                        ) : null}
                        {!notification.isRead ? <View style={styles.unreadDot} /> : null}
                      </View>
                    </View>
                    <Text style={styles.cardText} numberOfLines={2}>
                      {notification.body || "-"}
                    </Text>
                  </View>
                </Pressable>
              );
            })
          : null}
      </ScrollView>
    </>
  );
}

const createStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    container: {
      padding: SPACING.xl,
      paddingBottom: SPACING.xxl * 2,
      gap: SPACING.md,
      backgroundColor: colors.background,
    },
    headerCard: {
      borderRadius: RADIUS.md,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.surface,
      paddingHorizontal: SPACING.lg,
      paddingVertical: SPACING.md,
      gap: 4,
      ...SHADOWS.sm,
    },
    headerTitle: {
      color: colors.text,
      fontSize: 18,
      fontWeight: "700",
    },
    headerSubtitle: {
      color: colors.mutedText,
      fontSize: 12,
      lineHeight: 18,
    },
    loadingWrap: {
      minHeight: 120,
      alignItems: "center",
      justifyContent: "center",
    },
    emptyCard: {
      borderRadius: RADIUS.card,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.surface,
      paddingHorizontal: SPACING.lg,
      paddingVertical: SPACING.xl,
      alignItems: "center",
      gap: SPACING.sm,
      ...SHADOWS.sm,
    },
    emptyIconWrap: {
      width: 56,
      height: 56,
      borderRadius: 999,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: colors.surfaceMuted,
      borderWidth: 1,
      borderColor: colors.border,
    },
    emptyTitle: {
      color: colors.text,
      fontSize: 16,
      fontWeight: "700",
    },
    emptyText: {
      color: colors.mutedText,
      fontSize: 13,
      lineHeight: 20,
      textAlign: "center",
    },
    card: {
      borderRadius: RADIUS.card,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.surface,
      paddingHorizontal: SPACING.lg,
      paddingVertical: SPACING.md,
      flexDirection: "row",
      alignItems: "flex-start",
      gap: SPACING.md,
      ...SHADOWS.sm,
    },
    cardUnread: {
      borderColor: colors.accentBorder,
      backgroundColor: colors.activeSurface,
    },
    cardSelected: {
      borderColor: colors.accent,
      backgroundColor: colors.accentSoft,
    },
    cardPressed: {
      opacity: 0.9,
    },
    cardImage: {
      width: 54,
      height: 54,
      borderRadius: 999,
      backgroundColor: colors.surfaceSoft,
    },
    cardImageFallback: {
      width: 54,
      height: 54,
      borderRadius: 999,
      backgroundColor: colors.surfaceMuted,
      borderWidth: 1,
      borderColor: colors.border,
      alignItems: "center",
      justifyContent: "center",
    },
    cardBody: {
      flex: 1,
      gap: 6,
      paddingTop: 2,
    },
    cardTopRow: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      gap: SPACING.sm,
    },
    cardTitle: {
      flex: 1,
      color: colors.text,
      fontSize: 17,
      fontWeight: "700",
      lineHeight: 22,
    },
    cardMetaWrap: {
      flexDirection: "row",
      alignItems: "center",
      gap: 7,
      flexShrink: 0,
    },
    selectedPill: {
      borderRadius: 999,
      borderWidth: 1,
      borderColor: colors.accentBorder,
      backgroundColor: colors.accentSoft,
      paddingHorizontal: 8,
      paddingVertical: 3,
    },
    selectedPillText: {
      color: colors.accent,
      fontSize: 10,
      fontWeight: "700",
      lineHeight: 12,
      textTransform: "uppercase",
    },
    cardTime: {
      color: colors.subtleText,
      fontSize: 12,
      fontWeight: "500",
    },
    unreadDot: {
      width: 8,
      height: 8,
      borderRadius: 999,
      backgroundColor: colors.danger,
    },
    cardText: {
      color: colors.mutedText,
      fontSize: 14,
      lineHeight: 22,
    },
    headerDeleteButton: {
      width: 36,
      height: 36,
      borderRadius: 10,
      borderWidth: 1,
      borderColor: colors.dangerBorder,
      backgroundColor: colors.dangerSoft,
      alignItems: "center",
      justifyContent: "center",
      marginRight: 2,
    },
    headerDeleteButtonPressed: {
      opacity: 0.86,
    },
    headerDeleteButtonDisabled: {
      opacity: 0.56,
    },
  });
