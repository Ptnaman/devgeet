import { useEffect, useRef, useState, type ComponentType } from "react";
import { usePathname, useRouter } from "expo-router";
import { GlassView } from "expo-glass-effect";
import {
  ActivityIndicator,
  Image,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { AdminPanelIcon } from "@/components/icons/admin-panel-icon";
import { LogoutActionIcon } from "@/components/icons/logout-action-icon";
import { UserAvatarIcon } from "@/components/icons/user-avatar-icon";
import { RADIUS, SHADOWS, SPACING, type ThemeColors } from "@/constants/theme";
import { useAuth } from "@/providers/auth-provider";
import { useAppTheme } from "@/providers/theme-provider";

const getAvatarUri = (...values: (string | null | undefined)[]) => {
  for (const value of values) {
    if (typeof value === "string" && value.trim()) {
      return value.trim();
    }
  }

  return "";
};

type HeaderProfileButtonProps = {
  onPress: () => void;
};

type HeaderProfileMenuProps = {
  visible: boolean;
  onClose: () => void;
};

type MenuActionIconProps = {
  color: string;
  size: number;
};

type MenuActionProps = {
  icon: ComponentType<MenuActionIconProps>;
  label: string;
  onPress: () => void | Promise<void>;
  disabled?: boolean;
  isDestructive?: boolean;
};

function MenuAction({
  icon,
  label,
  onPress,
  disabled = false,
  isDestructive = false,
}: MenuActionProps) {
  const { colors } = useAppTheme();
  const styles = createStyles(colors);
  const Icon = icon;

  return (
    <Pressable
      accessibilityRole="button"
      disabled={disabled}
      style={({ pressed }) => [
        styles.menuAction,
        pressed && !disabled && styles.menuActionPressed,
        disabled && styles.menuActionDisabled,
      ]}
      onPress={onPress}
    >
      <View
        style={[
          styles.menuIconWrap,
          isDestructive && styles.menuIconWrapDanger,
        ]}
      >
        <Icon
          size={18}
          color={isDestructive ? colors.danger : colors.text}
        />
      </View>
      <Text
        style={[
          styles.menuActionText,
          isDestructive && styles.menuActionTextDanger,
        ]}
      >
        {label}
      </Text>
    </Pressable>
  );
}

export function HeaderProfileButton({ onPress }: HeaderProfileButtonProps) {
  const { colors } = useAppTheme();
  const { user, profile } = useAuth();
  const [hasImageError, setHasImageError] = useState(false);
  const avatarUri = getAvatarUri(profile?.photoURL, user?.photoURL);
  const shouldShowPhoto = Boolean(avatarUri) && !hasImageError;
  const styles = createStyles(colors);

  useEffect(() => {
    setHasImageError(false);
  }, [avatarUri]);

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel="Open account menu"
      hitSlop={4}
      style={({ pressed }) => [
        styles.profileButton,
        pressed && styles.buttonPressed,
      ]}
      onPress={onPress}
    >
      {shouldShowPhoto ? (
        <Image
          source={{ uri: avatarUri }}
          style={styles.avatarImage}
          onError={() => setHasImageError(true)}
        />
      ) : (
        <View style={[styles.avatarImage, styles.avatarFallback]}>
          <UserAvatarIcon size={18} color={colors.text} />
        </View>
      )}
    </Pressable>
  );
}

export function HeaderProfileMenu({
  visible,
  onClose,
}: HeaderProfileMenuProps) {
  const { colors } = useAppTheme();
  const router = useRouter();
  const pathname = usePathname();
  const insets = useSafeAreaInsets();
  const { user, profile, canManagePosts, isAdmin, logout } = useAuth();
  const [hasImageError, setHasImageError] = useState(false);
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const previousPathnameRef = useRef(pathname);
  const avatarUri = getAvatarUri(profile?.photoURL, user?.photoURL);
  const shouldShowPhoto = Boolean(avatarUri) && !hasImageError;
  const accountName =
    profile?.displayName || user?.displayName || profile?.email || user?.email || "User";
  const accountEmail = profile?.email || user?.email || "";
  const adminEntryPath = isAdmin ? "/admin" : "/admin/posts";
  const styles = createStyles(colors);

  useEffect(() => {
    setHasImageError(false);
  }, [avatarUri]);

  useEffect(() => {
    if (visible && previousPathnameRef.current !== pathname) {
      onClose();
    }

    previousPathnameRef.current = pathname;
  }, [onClose, pathname, visible]);

  const handleClose = () => {
    if (!isLoggingOut) {
      onClose();
    }
  };

  const openProfile = () => {
    handleClose();
    if (pathname !== "/profile") {
      router.push("/profile");
    }
  };

  const openAdmin = () => {
    handleClose();
    if (pathname !== adminEntryPath) {
      router.push(adminEntryPath);
    }
  };

  const handleLogout = async () => {
    try {
      setIsLoggingOut(true);
      await logout();
      onClose();
      router.replace("/login");
    } finally {
      setIsLoggingOut(false);
    }
  };

  return (
    <Modal
      animationType="fade"
      transparent
      visible={visible}
      onRequestClose={handleClose}
    >
      <View style={styles.modalRoot}>
        <View style={styles.backdrop}>
          <GlassView
            style={styles.backdropGlass}
            glassEffectStyle="regular"
            isInteractive={false}
            tintColor="rgba(255, 255, 255, 0.08)"
          />
          <Pressable style={styles.backdropPressable} onPress={handleClose} />
        </View>

        <View
          style={[
            styles.menuCard,
            { top: insets.top + 52 },
          ]}
        >
          <View style={styles.menuHeader}>
            <View style={styles.menuAvatar}>
              {shouldShowPhoto ? (
                <Image source={{ uri: avatarUri }} style={styles.menuAvatarImage} />
              ) : (
                <View style={[styles.menuAvatarImage, styles.avatarFallback]}>
                  <UserAvatarIcon size={20} color={colors.text} />
                </View>
              )}
            </View>

            <View style={styles.menuMeta}>
              <Text style={styles.menuTitle} numberOfLines={1}>
                {accountName}
              </Text>
              {accountEmail ? (
                <Text style={styles.menuSubtitle} numberOfLines={1}>
                  {accountEmail}
                </Text>
              ) : null}
            </View>
          </View>

          <View style={styles.menuDivider} />

          <MenuAction
            icon={UserAvatarIcon}
            label="Edit Profile"
            onPress={openProfile}
            disabled={isLoggingOut}
          />

          {canManagePosts ? (
            <MenuAction
              icon={AdminPanelIcon}
              label={isAdmin ? "Admin Panel" : "Post Manager"}
              onPress={openAdmin}
              disabled={isLoggingOut}
            />
          ) : (
            null
          )}

          <MenuAction
            icon={LogoutActionIcon}
            label={isLoggingOut ? "Logging out..." : "Logout"}
            onPress={handleLogout}
            disabled={isLoggingOut}
            isDestructive
          />

          {isLoggingOut ? (
            <View style={styles.logoutLoader}>
              <ActivityIndicator size="small" color={colors.danger} />
            </View>
          ) : null}
        </View>
      </View>
    </Modal>
  );
}

const createStyles = (colors: ThemeColors) => StyleSheet.create({
  profileButton: {
    width: 36,
    height: 36,
    borderRadius: 999,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 8,
    ...SHADOWS.sm,
  },
  avatarImage: {
    width: "100%",
    height: "100%",
    borderRadius: 999,
  },
  avatarFallback: {
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.surfaceSoft,
  },
  buttonPressed: {
    opacity: 0.85,
  },
  modalRoot: {
    flex: 1,
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
  },
  backdropGlass: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(17, 24, 39, 0.12)",
  },
  backdropPressable: {
    ...StyleSheet.absoluteFillObject,
  },
  menuCard: {
    position: "absolute",
    right: 12,
    width: 240,
    borderRadius: RADIUS.card,
    backgroundColor: colors.surface,
    padding: SPACING.md,
    gap: SPACING.xs,
    borderWidth: 1,
    borderColor: colors.border,
    ...SHADOWS.md,
  },
  menuHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: SPACING.sm,
    paddingBottom: SPACING.xs,
  },
  menuAvatar: {
    width: 42,
    height: 42,
    borderRadius: 999,
    overflow: "hidden",
    backgroundColor: colors.surfaceSoft,
  },
  menuAvatarImage: {
    width: "100%",
    height: "100%",
    borderRadius: 999,
  },
  menuMeta: {
    flex: 1,
    gap: 2,
  },
  menuTitle: {
    color: colors.text,
    fontSize: 15,
    fontWeight: "700",
  },
  menuSubtitle: {
    color: colors.mutedText,
    fontSize: 12,
  },
  menuDivider: {
    height: 1,
    backgroundColor: colors.border,
    marginVertical: SPACING.xs,
  },
  menuAction: {
    flexDirection: "row",
    alignItems: "center",
    gap: SPACING.sm,
    borderRadius: RADIUS.md,
    paddingHorizontal: SPACING.sm,
    paddingVertical: 10,
  },
  menuActionPressed: {
    backgroundColor: colors.surfaceMuted,
  },
  menuActionDisabled: {
    opacity: 0.7,
  },
  menuIconWrap: {
    width: 32,
    height: 32,
    borderRadius: 999,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.surfaceSoft,
  },
  menuIconWrapDanger: {
    backgroundColor: colors.dangerSoft,
  },
  menuActionText: {
    color: colors.text,
    fontSize: 14,
    fontWeight: "600",
  },
  menuActionTextDanger: {
    color: colors.danger,
  },
  logoutLoader: {
    paddingTop: SPACING.xs,
    alignItems: "center",
  },
});
