import { useEffect, useRef, useState } from "react";
import { usePathname } from "expo-router";
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
  backgroundColor?: string;
  badgeMode?: "count" | "dot";
  accessibilityLabel?: string;
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

export function HeaderNotificationsButton({
  unreadCount,
  onPress,
  backgroundColor,
  badgeMode = "count",
  accessibilityLabel,
}: HeaderNotificationsButtonProps) {
  const { colors } = useAppTheme();
  const styles = createStyles(colors, backgroundColor);
  const hasUnread = unreadCount > 0;
  const showCountBadge = hasUnread && badgeMode === "count";
  const showDotBadge = hasUnread && badgeMode === "dot";
  const highlightBell = hasUnread && badgeMode === "count";
  const badgeLabel = unreadCount > 99 ? "99+" : `${unreadCount}`;

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={
        accessibilityLabel ??
        (unreadCount
          ? `Open creator notifications. ${unreadCount} unread notifications`
          : "Open creator notifications")
      }
      hitSlop={6}
      style={({ hovered, pressed }) => [
        styles.iconButton,
        (hovered || pressed) && styles.iconButtonActive,
      ]}
      onPress={onPress}
    >
      <NotificationBellIcon
        size={22}
        color={highlightBell ? colors.accent : colors.text}
        filled={highlightBell}
        fillColor={colors.accentSoft}
        showAlertDot={showDotBadge}
        alertDotColor={colors.danger}
        alertDotStrokeColor={colors.surface}
      />
      {showCountBadge ? (
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
  const pathname = usePathname();
  const insets = useSafeAreaInsets();
  const previousPathnameRef = useRef(pathname);
  const [selectedNotification, setSelectedNotification] = useState<UserNotificationRecord | null>(null);
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

  useEffect(() => {
    if (!visible) {
      setSelectedNotification(null);
    }
  }, [visible]);

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
              <Text style={styles.menuTitle}>Creator Notifications</Text>
              <Text style={styles.menuSubtitle}>
                Post approvals and creator-access updates appear here.
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
                Creator approvals and publishing updates will appear here.
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
                  onPress={() => setSelectedNotification(notification)}
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

        {selectedNotification ? (
          <View style={styles.detailsOverlay}>
            <Pressable
              style={styles.detailsBackdrop}
              onPress={() => setSelectedNotification(null)}
            />
            <View style={styles.detailsCard}>
              <View style={styles.detailsHeader}>
                <Text style={styles.detailsTitle}>{selectedNotification.title}</Text>
                {selectedNotification.createdAt ? (
                  <Text style={styles.detailsMeta}>
                    {formatNotificationDateTime(selectedNotification.createdAt)}
                  </Text>
                ) : null}
              </View>

              <ScrollView
                style={styles.detailsBodyScroll}
                contentContainerStyle={styles.detailsBodyContent}
                showsVerticalScrollIndicator={false}
              >
                {selectedNotification.imageUrl ? (
                  <Image
                    source={{ uri: selectedNotification.imageUrl }}
                    style={styles.detailsImage}
                  />
                ) : null}
                <Text style={styles.detailsBody}>{selectedNotification.body}</Text>
              </ScrollView>

              <Pressable
                accessibilityRole="button"
                style={({ pressed }) => [
                  styles.detailsCloseButton,
                  pressed && styles.detailsCloseButtonPressed,
                ]}
                onPress={() => setSelectedNotification(null)}
              >
                <Text style={styles.detailsCloseButtonText}>Close</Text>
              </Pressable>
            </View>
          </View>
        ) : null}
      </View>
    </Modal>
  );
}

const createStyles = (colors: ThemeColors, buttonBackgroundColor?: string) =>
  StyleSheet.create({
    iconButton: {
      width: 40,
      height: 40,
      borderRadius: 999,
      backgroundColor: "transparent",
      alignItems: "center",
      justifyContent: "center",
    },
    iconButtonActive: {
      backgroundColor: buttonBackgroundColor ?? colors.surfaceMuted,
    },
    unreadBadge: {
      position: "absolute",
      top: -2,
      right: -2,
      minWidth: 20,
      height: 20,
      borderRadius: 999,
      backgroundColor: colors.danger,
      borderWidth: 2,
      borderColor: colors.surface,
      alignItems: "center",
      justifyContent: "center",
      paddingHorizontal: 4,
      zIndex: 1,
    },
    unreadBadgeText: {
      color: STATIC_COLORS.white,
      fontSize: 10,
      fontWeight: "700",
      lineHeight: 12,
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
    detailsOverlay: {
      ...StyleSheet.absoluteFillObject,
      alignItems: "center",
      justifyContent: "center",
      paddingHorizontal: SPACING.lg,
      zIndex: 2,
    },
    detailsBackdrop: {
      ...StyleSheet.absoluteFillObject,
      backgroundColor: colors.overlay,
    },
    detailsCard: {
      width: "100%",
      maxWidth: 420,
      maxHeight: "72%",
      borderRadius: RADIUS.card,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.surface,
      padding: SPACING.lg,
      gap: SPACING.md,
      ...SHADOWS.md,
    },
    detailsHeader: {
      gap: 6,
    },
    detailsTitle: {
      color: colors.text,
      fontSize: 18,
      fontWeight: "700",
      lineHeight: 24,
    },
    detailsMeta: {
      color: colors.subtleText,
      fontSize: 12,
      fontWeight: "600",
    },
    detailsBodyScroll: {
      flexGrow: 0,
    },
    detailsBodyContent: {
      gap: SPACING.md,
    },
    detailsImage: {
      width: "100%",
      height: 180,
      borderRadius: RADIUS.md,
      backgroundColor: colors.surfaceSoft,
    },
    detailsBody: {
      color: colors.text,
      fontSize: 14,
      lineHeight: 22,
    },
    detailsCloseButton: {
      alignSelf: "flex-end",
      minWidth: 88,
      borderRadius: RADIUS.pill,
      backgroundColor: colors.primary,
      paddingHorizontal: SPACING.md,
      paddingVertical: 10,
      alignItems: "center",
      justifyContent: "center",
    },
    detailsCloseButtonPressed: {
      opacity: 0.88,
    },
    detailsCloseButtonText: {
      color: colors.primaryText,
      fontSize: 13,
      fontWeight: "700",
    },
  });
