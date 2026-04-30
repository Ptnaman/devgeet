import { useMemo } from "react";
import { useRouter } from "expo-router";
import {
  ActivityIndicator,
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";

import { NotificationBellIcon } from "@/components/icons/notification-bell-icon";
import { RADIUS, SHADOWS, SPACING, type ThemeColors } from "@/constants/theme";
import { useUserNotifications } from "@/hooks/use-user-notifications";
import {
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

  const subtitle = useMemo(() => {
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
  }, [isLoading, notifications.length, unreadCount]);

  const handleOpenNotification = (notification: UserNotificationRecord) => {
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
  };

  return (
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

            return (
              <Pressable
                key={notification.id}
                style={({ pressed }) => [
                  styles.card,
                  !notification.isRead && styles.cardUnread,
                  pressed && styles.cardPressed,
                ]}
                onPress={() => handleOpenNotification(notification)}
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
  });
