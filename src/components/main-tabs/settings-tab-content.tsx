import Constants from "expo-constants";
import { useRouter } from "expo-router";
import { type ReactNode } from "react";
import {
  Alert,
  Image,
  Linking,
  Pressable,
  Share,
  StyleSheet,
  Switch,
  Text,
  View,
} from "react-native";
import Svg, { Circle, Path } from "react-native-svg";

import { AdminPanelIcon } from "@/components/icons/admin-panel-icon";
import { ArrowRightIcon } from "@/components/icons/arrow-right-icon";
import { MainTabScrollView } from "@/components/main-tabs/main-tab-scroll-view";
import { VerifiedRoleBadge } from "@/components/verified-role-badge";
import { APP_LINKS } from "@/constants/app-links";
import { RADIUS, SHADOWS, SPACING, type ThemeColors } from "@/constants/theme";
import { useAppUpdates } from "@/providers/app-updates-provider";
import { useAuth } from "@/providers/auth-provider";
import { useLyricsReaderPreferences } from "@/providers/lyrics-reader-preferences-provider";
import { useNetworkStatus } from "@/providers/network-provider";
import { useAppTheme, type ThemePreference } from "@/providers/theme-provider";

const THEME_OPTIONS: ThemePreference[] = ["system", "dark", "light"];

function ThemeOptionIcon({
  color,
  option,
}: {
  color: string;
  option: ThemePreference;
}) {
  if (option === "system") {
    return (
      <Svg width={18} height={18} viewBox="0 0 24 24" fill="none">
        <Path
          d="M12 3V6M12 18V21M4.92969 4.92969L7.05078 7.05078M16.9492 16.9492L19.0703 19.0703M3 12H6M18 12H21M4.92969 19.0703L7.05078 16.9492M16.9492 7.05078L19.0703 4.92969"
          stroke={color}
          strokeLinecap="round"
          strokeWidth={1.8}
        />
        <Circle cx="12" cy="12" r="4" stroke={color} strokeWidth={1.8} />
      </Svg>
    );
  }

  if (option === "dark") {
    return (
      <Svg width={18} height={18} viewBox="0 0 24 24" fill="none">
        <Path
          d="M20.5 14.5C19.7 14.8 18.84 15 17.94 15C13.83 15 10.5 11.67 10.5 7.56C10.5 6.66 10.7 5.8 11 5C7.5 5.62 5 8.68 5 12.25C5 16.28 8.22 19.5 12.25 19.5C15.82 19.5 18.88 17 19.5 13.5C19.82 13.83 20.15 14.16 20.5 14.5Z"
          stroke={color}
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={1.8}
        />
      </Svg>
    );
  }

  return (
    <Svg width={18} height={18} viewBox="0 0 24 24" fill="none">
      <Circle cx="12" cy="12" r="4" stroke={color} strokeWidth={1.8} />
      <Path
        d="M12 2.75V5.25M12 18.75V21.25M4.75 12H2.75M21.25 12H19.25M5.96289 5.96289L7.73066 7.73066M18.0371 18.0371L16.2693 16.2693M18.0371 5.96289L16.2693 7.73066M5.96289 18.0371L7.73066 16.2693"
        stroke={color}
        strokeLinecap="round"
        strokeWidth={1.8}
      />
    </Svg>
  );
}

function ShareAppIcon({ color }: { color: string }) {
  return (
    <Svg width={18} height={18} viewBox="0 0 24 24" fill="none">
      <Circle cx="18" cy="5.5" r="2.25" stroke={color} strokeWidth={1.8} />
      <Circle cx="6" cy="12" r="2.25" stroke={color} strokeWidth={1.8} />
      <Circle cx="18" cy="18.5" r="2.25" stroke={color} strokeWidth={1.8} />
      <Path
        d="M8 11.1L15.8 6.3M8 12.9L15.8 17.7"
        stroke={color}
        strokeLinecap="round"
        strokeWidth={1.8}
      />
    </Svg>
  );
}

type SettingItem = {
  key: string;
  title: string;
  subtitle?: string;
  value?: string;
  icon?: ReactNode;
  onPress?: () => void | Promise<void>;
  destructive?: boolean;
  disabled?: boolean;
  showChevron?: boolean;
};

function SettingRow({
  item,
  isLast = false,
}: {
  item: SettingItem;
  isLast?: boolean;
}) {
  const { colors } = useAppTheme();
  const styles = createStyles(colors);
  const isInteractive = Boolean(item.onPress) && !item.disabled;

  return (
    <Pressable
      style={({ pressed }) => [
        styles.row,
        !isLast && styles.rowDivider,
        pressed && isInteractive && styles.rowPressed,
        item.disabled && styles.rowDisabled,
      ]}
      onPress={item.onPress}
      disabled={!isInteractive}
    >
      <View style={styles.rowContent}>
        <View style={styles.rowMain}>
          {item.icon ? (
            <View style={styles.rowIconWrap}>
              {item.icon}
            </View>
          ) : null}
          <View style={styles.rowTextWrap}>
            <Text
              style={[
                styles.rowTitle,
                item.destructive && styles.rowTitleDestructive,
              ]}
            >
              {item.title}
            </Text>
            {item.subtitle ? (
              <Text style={styles.rowSubtitle} numberOfLines={2}>
                {item.subtitle}
              </Text>
            ) : null}
          </View>
        </View>

        <View style={styles.rowRight}>
          {item.value ? (
            <Text style={styles.rowValue} numberOfLines={1}>
              {item.value}
            </Text>
          ) : null}
          {item.showChevron !== false ? (
            <ArrowRightIcon size={20} color={colors.subtleText} />
          ) : null}
        </View>
      </View>
    </Pressable>
  );
}

function SettingToggleRow({
  isLast = false,
  onValueChange,
  subtitle,
  title,
  value,
}: {
  isLast?: boolean;
  onValueChange: (value: boolean) => void;
  subtitle?: string;
  title: string;
  value: boolean;
}) {
  const { colors } = useAppTheme();
  const styles = createStyles(colors);

  return (
    <View style={[styles.row, !isLast && styles.rowDivider]}>
      <View style={styles.rowContent}>
        <View style={styles.toggleRowMain}>
          <Text style={styles.rowTitle}>{title}</Text>
          {subtitle ? <Text style={styles.rowSubtitle}>{subtitle}</Text> : null}
        </View>

        <View style={styles.toggleWrap}>
          <Switch
            value={value}
            onValueChange={onValueChange}
            trackColor={{
              false: colors.divider,
              true: colors.accent,
            }}
            thumbColor={colors.surface}
            ios_backgroundColor={colors.divider}
          />
        </View>
      </View>
    </View>
  );
}

export function SettingsTabContent() {
  const { colors, themePreference, setThemePreference } = useAppTheme();
  const { keepLyricsScreenAwakeEnabled, setKeepLyricsScreenAwakeEnabled } =
    useLyricsReaderPreferences();
  const { isConnected, showOfflineToast } = useNetworkStatus();
  const router = useRouter();
  const { canManagePosts, isAdmin, profile, role, user } = useAuth();
  const { appVersion } = useAppUpdates();
  const styles = createStyles(colors);

  const appName = Constants.expoConfig?.name ?? "DevGeet";
  const accountName =
    profile?.displayName || user?.displayName || user?.email || "User";
  const accountInitials =
    accountName
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part.charAt(0).toUpperCase())
      .join("") || "U";
  const avatarUri = profile?.photoURL || user?.photoURL || "";

  const openExternal = async (url: string, label: string) => {
    if (!isConnected) {
      showOfflineToast();
      return;
    }

    try {
      await Linking.openURL(url);
    } catch {
      Alert.alert(label, `Unable to open ${label} right now.`);
    }
  };

  const openEmail = async ({
    label,
    subject,
    body,
  }: {
    label: string;
    subject: string;
    body?: string;
  }) => {
    const mailtoUrl = `mailto:${APP_LINKS.email}?subject=${encodeURIComponent(subject)}${
      body ? `&body=${encodeURIComponent(body)}` : ""
    }`;

    try {
      await Linking.openURL(mailtoUrl);
    } catch {
      Alert.alert(label, `Mail app not available. Please write to ${APP_LINKS.email}.`);
    }
  };

  const openPlayStoreFeedback = async () => {
    if (!isConnected) {
      showOfflineToast();
      return;
    }

    try {
      await Linking.openURL(APP_LINKS.playStoreReview);
    } catch {
      try {
        await Linking.openURL(APP_LINKS.playStoreReviewWeb);
      } catch {
        Alert.alert("Feedback", "Unable to open Google Play feedback right now.");
      }
    }
  };

  const handleShareApp = async () => {
    try {
      await Share.share({
        title: appName,
        message: `Download ${appName}: ${APP_LINKS.playStore}`,
        url: APP_LINKS.playStore,
      });
    } catch {
      Alert.alert("Share App", "Unable to open share options right now.");
    }
  };

  const legalItems: SettingItem[] = [
    {
      key: "privacy",
      title: "Privacy Policy",
      onPress: () => openExternal(APP_LINKS.privacy, "Privacy Policy"),
    },
    {
      key: "terms",
      title: "Terms & Conditions",
      onPress: () => openExternal(APP_LINKS.terms, "Terms & Conditions"),
    },
    {
      key: "disclaimer",
      title: "Disclaimer",
      onPress: () => openExternal(APP_LINKS.disclaimer, "Disclaimer"),
    },
  ];

  const supportItems: SettingItem[] = [
    {
      key: "email",
      title: "Email",
      subtitle: APP_LINKS.email,
      onPress: () =>
        openEmail({
          label: "Email",
          subject: `${appName} Support`,
        }),
    },
    {
      key: "whatsapp",
      title: "Join WhatsApp",
      subtitle: "Community support and updates",
      onPress: () => openExternal(APP_LINKS.whatsapp, "Join WhatsApp"),
    },
    {
      key: "feedback",
      title: "Feedback",
      subtitle: "Rate and review on Google Play",
      onPress: openPlayStoreFeedback,
    },
  ];

  const themeLabels: Record<ThemePreference, string> = {
    system: "Automatic",
    dark: "Dark",
    light: "Light",
  };

  return (
    <MainTabScrollView
      tabName="settings"
      contentContainerStyle={styles.container}
      showsVerticalScrollIndicator={false}
    >
      <Pressable
        style={({ pressed }) => [
          styles.profileCard,
          pressed && styles.cardPressed,
        ]}
        onPress={() => router.push("/profile")}
      >
        <View style={styles.avatarWrap}>
          {avatarUri ? (
            <Image source={{ uri: avatarUri }} style={styles.avatarImage} />
          ) : (
            <Text style={styles.avatarText}>{accountInitials}</Text>
          )}
        </View>

          <View style={styles.profileTextWrap}>
            <View style={styles.profileNameRow}>
              <Text style={styles.profileName} numberOfLines={1}>
                {accountName}
              </Text>
              <VerifiedRoleBadge role={role} />
            </View>
            <Text style={styles.profileSubtitle} numberOfLines={1}>
              Open profile and account actions
            </Text>
          </View>

        <ArrowRightIcon size={22} color={colors.subtleText} />
      </Pressable>

      {canManagePosts ? (
        <>
          <Text style={styles.sectionLabel}>Creator</Text>
          <View style={styles.groupCard}>
            <SettingRow
              item={{
                key: "creator-studio",
                title: isAdmin ? "Admin Panel" : "My Posts",
                subtitle: isAdmin
                  ? "Review, publish, and manage all posts"
                  : "Create drafts and submit them for approval",
                icon: <AdminPanelIcon color={colors.accent} size={18} />,
                onPress: () => router.push(isAdmin ? "/admin" : "/admin/posts"),
              }}
              isLast
            />
          </View>
        </>
      ) : null}

      <Text style={styles.sectionLabel}>Appearance</Text>
      <View style={styles.groupCard}>
        {THEME_OPTIONS.map((option, index) => {
          const isSelected = option === themePreference;

          return (
            <Pressable
              key={option}
              style={({ pressed }) => [
                styles.themeOption,
                index > 0 && styles.themeOptionDivider,
                isSelected && styles.themeOptionSelected,
                pressed && styles.rowPressed,
              ]}
              onPress={() => {
                void setThemePreference(option);
              }}
            >
              <View style={styles.themeOptionMain}>
                <View style={styles.themeOptionIconWrap}>
                  <ThemeOptionIcon
                    option={option}
                    color={isSelected ? colors.accent : colors.subtleText}
                  />
                </View>

                <View style={styles.rowTextWrap}>
                  <Text style={styles.rowTitle}>{themeLabels[option]}</Text>
                </View>
              </View>

              <View style={[styles.themeRadio, isSelected && styles.themeRadioSelected]}>
                {isSelected ? <View style={styles.themeRadioDot} /> : null}
              </View>
            </Pressable>
          );
        })}
      </View>

      <Text style={styles.sectionLabel}>Reading</Text>
      <View style={styles.groupCard}>
        <SettingToggleRow
          title="Keep screen awake"
          subtitle="Turn it on for reading expirence."
          value={keepLyricsScreenAwakeEnabled}
          onValueChange={(value) => {
            void setKeepLyricsScreenAwakeEnabled(value);
          }}
          isLast
        />
      </View>

      <Text style={styles.sectionLabel}>Legal</Text>
      <View style={styles.groupCard}>
        {legalItems.map((item, index) => (
          <SettingRow
            key={item.key}
            item={item}
            isLast={index === legalItems.length - 1}
          />
        ))}
      </View>

      <Text style={styles.sectionLabel}>Support</Text>
      <View style={styles.groupCard}>
        {supportItems.map((item, index) => (
          <SettingRow
            key={item.key}
            item={item}
            isLast={index === supportItems.length - 1}
          />
        ))}
      </View>

      <Text style={styles.sectionLabel}>About</Text>
      <View style={styles.groupCard}>
        <SettingRow
          item={{
            key: "share-app",
            title: "Share App",
            subtitle: "Send DevGeet to your friends",
            icon: <ShareAppIcon color={colors.accent} />,
            onPress: handleShareApp,
            showChevron: false,
          }}
          isLast
        />
      </View>
      <View style={styles.groupCard}>
        <SettingRow
          item={{
            key: "about",
            title: "App Updates",
            subtitle: "Tap to update app",
            value: `v${appVersion}`,
            onPress: () => router.push("/app-updates"),
          }}
          isLast
        />
      </View>

    </MainTabScrollView>
  );
}

const createStyles = (colors: ThemeColors) => StyleSheet.create({
  container: {
    padding: SPACING.xxl,
    paddingBottom: SPACING.xxl * 2,
    gap: SPACING.md,
    backgroundColor: colors.background,
  },
  profileCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: SPACING.sm,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.md,
    borderRadius: RADIUS.card,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    ...SHADOWS.sm,
  },
  cardPressed: {
    opacity: 0.92,
  },
  avatarWrap: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: colors.surfaceSoft,
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
  },
  avatarImage: {
    width: "100%",
    height: "100%",
  },
  avatarText: {
    color: colors.text,
    fontSize: 16,
    fontWeight: "700",
  },
  profileTextWrap: {
    flex: 1,
    gap: 2,
  },
  profileNameRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: SPACING.sm,
  },
  profileName: {
    color: colors.text,
    fontSize: 17,
    fontWeight: "700",
    flexShrink: 1,
  },
  profileSubtitle: {
    color: colors.mutedText,
    fontSize: 12,
  },
  sectionLabel: {
    paddingHorizontal: 2,
    color: colors.mutedText,
    fontSize: 14,
    fontWeight: "500",
  },
  groupCard: {
    borderRadius: RADIUS.md,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    overflow: "hidden",
    ...SHADOWS.sm,
  },
  row: {
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.lg,
    backgroundColor: colors.surface,
  },
  rowDivider: {
    borderBottomWidth: 1,
    borderBottomColor: colors.divider,
  },
  rowPressed: {
    backgroundColor: colors.surfaceMuted,
  },
  rowDisabled: {
    opacity: 0.55,
  },
  rowContent: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: SPACING.md,
  },
  rowMain: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: SPACING.sm,
  },
  rowIconWrap: {
    width: 34,
    height: 34,
    borderRadius: 999,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.surfaceMuted,
  },
  rowTextWrap: {
    flex: 1,
    gap: 2,
  },
  rowTitle: {
    color: colors.text,
    fontSize: 16,
    fontWeight: "600",
  },
  rowTitleDestructive: {
    color: colors.danger,
  },
  rowSubtitle: {
    color: colors.mutedText,
    fontSize: 12,
    lineHeight: 16,
  },
  toggleRowMain: {
    flex: 1,
    gap: 2,
  },
  toggleWrap: {
    marginLeft: SPACING.md,
  },
  rowRight: {
    flexDirection: "row",
    alignItems: "center",
    gap: SPACING.sm,
    maxWidth: "42%",
  },
  rowValue: {
    color: colors.subtleText,
    fontSize: 15,
  },
  themeOption: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: SPACING.md,
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.lg,
    backgroundColor: colors.surface,
  },
  themeOptionMain: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: SPACING.sm,
  },
  themeOptionIconWrap: {
    width: 28,
    height: 28,
    borderRadius: 999,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.surfaceMuted,
  },
  themeOptionDivider: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.divider,
  },
  themeOptionSelected: {
    backgroundColor: colors.activeSurface,
  },
  themeRadio: {
    width: 20,
    height: 20,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: colors.divider,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.surface,
  },
  themeRadioSelected: {
    borderColor: colors.accent,
  },
  themeRadioDot: {
    width: 8,
    height: 8,
    borderRadius: 999,
    backgroundColor: colors.accent,
  },
});
