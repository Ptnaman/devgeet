import { useEffect, useRef } from "react";
import { usePathname, useRouter } from "expo-router";
import { GlassView } from "expo-glass-effect";
import {
  ActivityIndicator,
  Image,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { NotificationBellIcon } from "@/components/icons/notification-bell-icon";
import { useUserNotifications } from "@/hooks/use-user-notifications";
import { RADIUS, SHADOWS, SPACING, STATIC_COLORS, type ThemeColors } from "@/constants/theme";
import {
  markUserNotificationsAsReadAsync,
  type UserNotificationRecord,
} from "@/lib/user-notifications";
import { useAuth } from "@/providers/auth-provider";
import { useAppTheme } from "@/providers/theme-provider";

type HeaderNotificationsButtonProps = {
  unreadCount: number;
  onPress: () => void;
};

type HeaderNotificationsMenuProps = {
  visible: boolean;
  onClose: () => void;
  notifications: UserNotificationRecord[];
  isLoading: boolean;
};

const formatNotificationDateTime = (value: string) => {
  if (!value) {
    return "";
  }

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return value;
  }

  return parsed.toLocaleString(undefined, {
    day: "2-digit",
    month: "short",
    hour: "numeric",
    minute: "2-digit",
  });
};

export function useHeaderNotifications() {
  return useUserNotifications();
}

export function HeaderNotificationsButton({
  unreadCount,
  onPress,
}: HeaderNotificationsButtonProps) {
  const { colors } = useAppTheme();
  const styles = createStyles(colors);
  const hasUnread = unreadCount > 0;
  const badgeLabel = unreadCount > 99 ? "99+" : `${unreadCount}`;

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={
        unreadCount
          ? `Open notifications. ${unreadCount} unread notifications`
          : "Open notifications"
      }
      hitSlop={4}
      style={({ pressed }) => [
        styles.iconButton,
        hasUnread && styles.iconButtonUnread,
        pressed && styles.buttonPressed,
      ]}
      onPress={onPress}
    >
      <NotificationBellIcon
        size={24}
        color={hasUnread ? colors.accent : colors.text}
        filled={hasUnread}
        fillColor={colors.accentSoft}
      />
      {unreadCount ? (
        <View style={styles.unreadBadge}>
          <Text style={styles.unreadBadgeText}>{badgeLabel}</Text>
        </View>
      ) : null}
    </Pressable>
  );
}

export function HeaderNotificationsMenu({
  visible,
  onClose,
  notifications,
  isLoading,
}: HeaderNotificationsMenuProps) {
  const { colors } = useAppTheme();
  const { user } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const insets = useSafeAreaInsets();
  const previousPathnameRef = useRef(pathname);
  const styles = createStyles(colors);

  useEffect(() => {
    if (!visible || !user?.uid) {
      return;
    }

    const unreadIds = notifications
      .filter((item) => !item.isRead)
      .map((item) => item.id);

    if (!unreadIds.length) {
      return;
    }

    void markUserNotificationsAsReadAsync({
      uid: user.uid,
      notificationIds: unreadIds,
    }).catch(() => {
      // Ignore read-state sync issues in the header UI.
    });
  }, [notifications, user?.uid, visible]);

  useEffect(() => {
    if (visible && previousPathnameRef.current !== pathname) {
      onClose();
    }

    previousPathnameRef.current = pathname;
  }, [onClose, pathname, visible]);

  const openNotificationTarget = (notification: UserNotificationRecord) => {
    onClose();

    if (notification.postId && pathname !== `/post/${notification.postId}`) {
      router.push({
        pathname: "/post/[postId]",
        params: { postId: notification.postId },
      });
    }
  };

  return (
    <Modal
      animationType="fade"
      transparent
      visible={visible}
      onRequestClose={onClose}
    >
      <View style={styles.modalRoot}>
        <View style={styles.backdrop}>
          <GlassView
            style={styles.backdropGlass}
            glassEffectStyle="regular"
            isInteractive={false}
            tintColor={colors.backdropGlassTint}
          />
          <Pressable style={styles.backdropPressable} onPress={onClose} />
        </View>

        <View
          style={[
            styles.menuCard,
            styles.notificationsCard,
            { top: insets.top + 52 },
          ]}
        >
          <View style={styles.notificationsHeader}>
            <View>
              <Text style={styles.menuTitle}>Notifications</Text>
              <Text style={styles.menuSubtitle}>
                Approval updates and account alerts appear here.
              </Text>
            </View>
          </View>

          <View style={styles.menuDivider} />

          {isLoading ? (
            <View style={styles.notificationsState}>
              <ActivityIndicator size="small" color={colors.primary} />
            </View>
          ) : null}

          {!isLoading && !notifications.length ? (
            <View style={styles.notificationsState}>
              <NotificationBellIcon size={20} color={colors.mutedText} />
              <Text style={styles.emptyTitle}>No notifications yet</Text>
              <Text style={styles.emptySubtitle}>
                When your post gets approved, it will show here.
              </Text>
            </View>
          ) : null}

          {!isLoading && notifications.length ? (
            <ScrollView
              style={styles.notificationList}
              contentContainerStyle={styles.notificationListContent}
              showsVerticalScrollIndicator={false}
            >
              {notifications.map((notification) => (
                <Pressable
                  key={notification.id}
                  style={({ pressed }) => [
                    styles.notificationCard,
                    !notification.isRead && styles.notificationCardUnread,
                    pressed && styles.notificationCardPressed,
                  ]}
                  onPress={() => openNotificationTarget(notification)}
                >
                  {notification.imageUrl ? (
                    <Image
                      source={{ uri: notification.imageUrl }}
                      style={styles.notificationImage}
                    />
                  ) : (
                    <View style={styles.notificationImageFallback}>
                      <NotificationBellIcon size={18} color={colors.primary} />
                    </View>
                  )}

                  <View style={styles.notificationBody}>
                    <View style={styles.notificationTitleRow}>
                      <Text style={styles.notificationTitle} numberOfLines={1}>
                        {notification.title}
                      </Text>
                      {!notification.isRead ? <View style={styles.notificationDot} /> : null}
                    </View>
                    <Text style={styles.notificationText} numberOfLines={3}>
                      {notification.body}
                    </Text>
                    {notification.createdAt ? (
                      <Text style={styles.notificationMeta}>
                        {formatNotificationDateTime(notification.createdAt)}
                      </Text>
                    ) : null}
                  </View>
                </Pressable>
              ))}
            </ScrollView>
          ) : null}
        </View>
      </View>
    </Modal>
  );
}

const createStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    iconButton: {
      alignItems: "center",
      justifyContent: "center",
      paddingHorizontal: 6,
      paddingVertical: 6,
      marginRight: 8,
      borderRadius: 999,
    },
    iconButtonUnread: {
      shadowColor: colors.accent,
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.14,
      shadowRadius: 10,
      elevation: 3,
    },
    unreadBadge: {
      position: "absolute",
      top: -2,
      right: -2,
      minWidth: 22,
      height: 22,
      borderRadius: 999,
      backgroundColor: colors.danger,
      borderWidth: 2,
      borderColor: colors.surface,
      alignItems: "center",
      justifyContent: "center",
      paddingHorizontal: 5,
    },
    unreadBadgeText: {
      color: STATIC_COLORS.white,
      fontSize: 10,
      fontWeight: "700",
      lineHeight: 12,
    },
    buttonPressed: {
      backgroundColor: colors.surfaceMuted,
      opacity: 0.92,
    },
    modalRoot: {
      flex: 1,
    },
    backdrop: {
      ...StyleSheet.absoluteFillObject,
    },
    backdropGlass: {
      ...StyleSheet.absoluteFillObject,
      backgroundColor: colors.backdropOverlay,
    },
    backdropPressable: {
      ...StyleSheet.absoluteFillObject,
    },
    menuCard: {
      position: "absolute",
      right: 12,
      borderRadius: RADIUS.card,
      backgroundColor: colors.surface,
      padding: SPACING.md,
      gap: SPACING.xs,
      borderWidth: 1,
      borderColor: colors.border,
      ...SHADOWS.md,
    },
    notificationsCard: {
      width: 320,
      maxHeight: "70%",
    },
    notificationsHeader: {
      gap: 4,
      paddingBottom: SPACING.xs,
    },
    menuTitle: {
      color: colors.text,
      fontSize: 16,
      fontWeight: "700",
    },
    menuSubtitle: {
      color: colors.mutedText,
      fontSize: 12,
      lineHeight: 18,
    },
    menuDivider: {
      height: 1,
      backgroundColor: colors.border,
      marginVertical: SPACING.xs,
    },
    notificationsState: {
      minHeight: 140,
      alignItems: "center",
      justifyContent: "center",
      gap: SPACING.xs,
      paddingHorizontal: SPACING.md,
    },
    emptyTitle: {
      color: colors.text,
      fontSize: 14,
      fontWeight: "700",
    },
    emptySubtitle: {
      color: colors.mutedText,
      fontSize: 12,
      lineHeight: 18,
      textAlign: "center",
    },
    notificationList: {
      flexGrow: 0,
    },
    notificationListContent: {
      gap: SPACING.sm,
    },
    notificationCard: {
      flexDirection: "row",
      alignItems: "flex-start",
      gap: SPACING.sm,
      borderRadius: RADIUS.md,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.surface,
      padding: SPACING.sm,
    },
    notificationCardUnread: {
      borderColor: colors.accentBorder,
      backgroundColor: colors.activeSurface,
    },
    notificationCardPressed: {
      opacity: 0.9,
    },
    notificationImage: {
      width: 56,
      height: 56,
      borderRadius: RADIUS.sm,
      backgroundColor: colors.surfaceSoft,
    },
    notificationImageFallback: {
      width: 56,
      height: 56,
      borderRadius: RADIUS.sm,
      backgroundColor: colors.surfaceSoft,
      alignItems: "center",
      justifyContent: "center",
    },
    notificationBody: {
      flex: 1,
      gap: 4,
    },
    notificationTitleRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: 6,
    },
    notificationTitle: {
      flex: 1,
      color: colors.text,
      fontSize: 14,
      fontWeight: "700",
    },
    notificationText: {
      color: colors.mutedText,
      fontSize: 12,
      lineHeight: 18,
    },
    notificationMeta: {
      color: colors.subtleText,
      fontSize: 11,
    },
    notificationDot: {
      width: 8,
      height: 8,
      borderRadius: 999,
      backgroundColor: colors.primary,
    },
  });
