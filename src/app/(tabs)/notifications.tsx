import { useMemo, useState } from "react";
import { useRouter } from "expo-router";
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
import { useUserNotifications } from "@/hooks/use-user-notifications";
import { RADIUS, SHADOWS, SPACING, type ThemeColors } from "@/constants/theme";
import {
  deleteUserNotificationsAsync,
  formatUserNotificationRelativeTime,
  markUserNotificationsAsReadAsync,
  type UserNotificationRecord,
} from "@/lib/user-notifications";
import { useAuth } from "@/providers/auth-provider";
import { useNetworkStatus } from "@/providers/network-provider";
import { useAppTheme } from "@/providers/theme-provider";

function NotificationsSection({
  title,
  notifications,
  onPressNotification,
}: {
  title: string;
  notifications: UserNotificationRecord[];
  onPressNotification: (notification: UserNotificationRecord) => void;
}) {
  const { colors } = useAppTheme();
  const styles = createStyles(colors);

  if (!notifications.length) {
    return null;
  }

  return (
    <View style={styles.section}>
      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>{title}</Text>
      </View>

      <View style={styles.sectionList}>
        {notifications.map((notification, index) => (
          <View key={notification.id}>
            <Pressable
              style={({ pressed }) => [
                styles.notificationRow,
                pressed ? styles.notificationRowPressed : undefined,
              ]}
              onPress={() => onPressNotification(notification)}
            >
              {notification.imageUrl ? (
                <Image
                  source={{ uri: notification.imageUrl }}
                  style={styles.notificationImage}
                />
              ) : (
                <View style={styles.notificationImageFallback}>
                  <NotificationBellIcon size={18} color={colors.accent} />
                </View>
              )}

              <View style={styles.notificationBody}>
                <View style={styles.notificationTitleRow}>
                  <Text style={styles.notificationTitle} numberOfLines={2}>
                    {notification.title}
                  </Text>
                  {!notification.isRead ? <View style={styles.notificationDot} /> : null}
                </View>

                <Text style={styles.notificationText} numberOfLines={3}>
                  {notification.body}
                </Text>

                <Text style={styles.notificationMeta}>
                  {formatUserNotificationRelativeTime(notification.createdAt)}
                </Text>
              </View>
            </Pressable>

            {index < notifications.length - 1 ? <View style={styles.notificationSeparator} /> : null}
          </View>
        ))}
      </View>
    </View>
  );
}

export default function NotificationsScreen() {
  const router = useRouter();
  const { colors } = useAppTheme();
  const { user } = useAuth();
  const { isConnected, showOfflineToast, showToast } = useNetworkStatus();
  const { notifications, isLoading } = useUserNotifications();
  const [isRemovingAll, setIsRemovingAll] = useState(false);
  const styles = createStyles(colors);

  const importantNotifications = useMemo(
    () => notifications.filter((item) => !item.isRead),
    [notifications],
  );
  const otherNotifications = useMemo(
    () => notifications.filter((item) => item.isRead),
    [notifications],
  );

  const openNotification = async (notification: UserNotificationRecord) => {
    if (user?.uid && !notification.isRead) {
      void markUserNotificationsAsReadAsync({
        uid: user.uid,
        notificationIds: [notification.id],
      }).catch(() => {
        // Ignore read sync issues; opening the target matters more.
      });
    }

    if (notification.postId) {
      router.push({
        pathname: "/post/[postId]",
        params: { postId: notification.postId },
      });
    }
  };

  const handleRemoveAll = async () => {
    if (!user?.uid || !notifications.length) {
      return;
    }

    if (!isConnected) {
      showOfflineToast();
      return;
    }

    try {
      setIsRemovingAll(true);
      await deleteUserNotificationsAsync({
        uid: user.uid,
        notificationIds: notifications.map((item) => item.id),
      });
      showToast("Removed all notifications");
    } catch {
      Alert.alert(
        "Notifications",
        "Unable to remove notifications right now.",
      );
    } finally {
      setIsRemovingAll(false);
    }
  };

  const confirmRemoveAll = () => {
    if (!notifications.length || isRemovingAll) {
      return;
    }

    Alert.alert(
      "Remove all notifications?",
      "This will permanently remove every notification from your account.",
      [
        {
          text: "Cancel",
          style: "cancel",
        },
        {
          text: isRemovingAll ? "Removing..." : "Remove all",
          style: "destructive",
          onPress: () => {
            void handleRemoveAll();
          },
        },
      ],
    );
  };

  return (
    <View style={styles.screen}>
      <ScrollView
        contentContainerStyle={styles.container}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.pageHeader}>
          <Text style={styles.pageTitle}>All Notifications</Text>
          <Pressable
            accessibilityRole="button"
            disabled={!notifications.length || isRemovingAll}
            style={({ pressed }) => [
              styles.removeAllButton,
              (!notifications.length || isRemovingAll) && styles.removeAllButtonDisabled,
              pressed && notifications.length > 0 && !isRemovingAll
                ? styles.removeAllButtonPressed
                : undefined,
            ]}
            onPress={confirmRemoveAll}
          >
            <Text style={styles.removeAllButtonText}>
              {isRemovingAll ? "Removing..." : "Remove all"}
            </Text>
          </Pressable>
        </View>

        {isLoading ? (
          <View style={styles.stateCard}>
            <ActivityIndicator size="large" color={colors.primary} />
          </View>
        ) : null}

        {!isLoading && !notifications.length ? (
          <View style={styles.emptyState}>
            <View style={styles.emptyIconWrap}>
              <NotificationBellIcon size={24} color={colors.mutedText} />
            </View>
            <Text style={styles.emptyTitle}>No notifications yet</Text>
            <Text style={styles.emptySubtitle}>
              New approvals and account updates will appear here.
            </Text>
          </View>
        ) : null}

        {!isLoading && notifications.length ? (
          <>
            <NotificationsSection
              title="Important"
              notifications={importantNotifications}
              onPressNotification={openNotification}
            />
            <NotificationsSection
              title="Earlier"
              notifications={otherNotifications}
              onPressNotification={openNotification}
            />
          </>
        ) : null}
      </ScrollView>
    </View>
  );
}

const createStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    screen: {
      flex: 1,
      backgroundColor: colors.background,
    },
    container: {
      padding: SPACING.xl,
      gap: SPACING.lg,
      backgroundColor: colors.background,
      paddingBottom: SPACING.xxl * 2,
    },
    pageHeader: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      gap: SPACING.md,
    },
    pageTitle: {
      flex: 1,
      color: colors.text,
      fontSize: 20,
      fontWeight: "700",
    },
    removeAllButton: {
      borderRadius: RADIUS.pill,
      paddingHorizontal: SPACING.md,
      paddingVertical: 10,
      backgroundColor: colors.dangerSoft,
      borderWidth: 1,
      borderColor: colors.dangerBorder,
    },
    removeAllButtonPressed: {
      opacity: 0.85,
    },
    removeAllButtonDisabled: {
      opacity: 0.55,
    },
    removeAllButtonText: {
      color: colors.danger,
      fontSize: 12,
      fontWeight: "700",
    },
    stateCard: {
      minHeight: 220,
      alignItems: "center",
      justifyContent: "center",
      gap: SPACING.sm,
      borderRadius: RADIUS.card,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.surface,
      padding: SPACING.xl,
      ...SHADOWS.sm,
    },
    emptyIconWrap: {
      width: 58,
      height: 58,
      borderRadius: 999,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: colors.surfaceSoft,
    },
    emptyState: {
      minHeight: 420,
      alignItems: "center",
      justifyContent: "center",
      gap: SPACING.sm,
      paddingHorizontal: SPACING.xl,
    },
    emptyTitle: {
      color: colors.text,
      fontSize: 17,
      fontWeight: "700",
    },
    emptySubtitle: {
      color: colors.mutedText,
      fontSize: 13,
      lineHeight: 19,
      textAlign: "center",
    },
    section: {
      gap: SPACING.sm,
    },
    sectionHeader: {
      paddingHorizontal: 2,
    },
    sectionTitle: {
      color: colors.text,
      fontSize: 17,
      fontWeight: "700",
    },
    sectionList: {
      gap: 0,
    },
    notificationRow: {
      flexDirection: "row",
      alignItems: "flex-start",
      gap: SPACING.md,
      paddingVertical: SPACING.md,
      paddingHorizontal: 2,
    },
    notificationRowPressed: {
      opacity: 0.82,
    },
    notificationSeparator: {
      height: 1,
      backgroundColor: colors.border,
      marginLeft: 78,
    },
    notificationImage: {
      width: 60,
      height: 60,
      borderRadius: RADIUS.sm,
      backgroundColor: colors.surfaceSoft,
    },
    notificationImageFallback: {
      width: 60,
      height: 60,
      borderRadius: RADIUS.sm,
      backgroundColor: colors.surfaceSoft,
      alignItems: "center",
      justifyContent: "center",
    },
    notificationBody: {
      flex: 1,
      gap: 6,
    },
    notificationTitleRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: 8,
    },
    notificationTitle: {
      flex: 1,
      color: colors.text,
      fontSize: 15,
      fontWeight: "700",
      lineHeight: 20,
    },
    notificationText: {
      color: colors.mutedText,
      fontSize: 13,
      lineHeight: 19,
    },
    notificationMeta: {
      color: colors.subtleText,
      fontSize: 12,
      fontWeight: "600",
    },
    notificationDot: {
      width: 10,
      height: 10,
      borderRadius: 999,
      backgroundColor: colors.danger,
    },
  });
