import { ArrowRight01Icon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react-native";
import Constants from "expo-constants";
import { useRouter } from "expo-router";
import { useState } from "react";
import {
  Alert,
  Image,
  Linking,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";

import { COLORS, RADIUS, SHADOWS, SPACING } from "@/constants/theme";
import { useAuth } from "@/providers/auth-provider";

const APP_LINKS = {
  home: "https://devgeet.com/",
  terms: "https://devgeet.com/terms/",
  disclaimer: "https://devgeet.com/disclaimer/",
  contact: "https://devgeet.com/contact/",
  privacy: "https://devgeet.com/privacy/",
  whatsapp: "https://chat.whatsapp.com/DHaKK4v5UOJLTCI5JuMwY1",
  email: "naman@devgeet.com",
} as const;

type SettingItem = {
  key: string;
  title: string;
  subtitle?: string;
  value?: string;
  onPress: () => void | Promise<void>;
  destructive?: boolean;
  disabled?: boolean;
};

function SettingRow({
  item,
  isLast = false,
}: {
  item: SettingItem;
  isLast?: boolean;
}) {
  return (
    <Pressable
      style={({ pressed }) => [
        styles.row,
        !isLast && styles.rowDivider,
        pressed && !item.disabled && styles.rowPressed,
        item.disabled && styles.rowDisabled,
      ]}
      onPress={item.onPress}
      disabled={item.disabled}
    >
      <View style={styles.rowContent}>
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

        <View style={styles.rowRight}>
          {item.value ? (
            <Text style={styles.rowValue} numberOfLines={1}>
              {item.value}
            </Text>
          ) : null}
          <HugeiconsIcon
            icon={ArrowRight01Icon}
            size={20}
            color={COLORS.subtleText}
          />
        </View>
      </View>
    </Pressable>
  );
}

export default function SettingsScreen() {
  const router = useRouter();
  const { user, profile, logout } = useAuth();
  const [isSubmitting, setIsSubmitting] = useState(false);

  const appName = Constants.expoConfig?.name ?? "DevGeet";
  const appVersion = Constants.expoConfig?.version ?? "1.0.0";
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
    try {
      await Linking.openURL(url);
    } catch {
      Alert.alert(label, `Unable to open ${label.toLowerCase()} right now.`);
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
      Alert.alert(
        label,
        `Mail app not available. Please write to ${APP_LINKS.email}.`,
      );
    }
  };

  const handleLogout = async () => {
    try {
      setIsSubmitting(true);
      await logout();
      router.replace("/login");
    } finally {
      setIsSubmitting(false);
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
      key: "contact-page",
      title: "Contact Us",
      onPress: () => openExternal(APP_LINKS.contact, "Contact Us"),
    },
    {
      key: "whatsapp",
      title: "Join WhatsApp",
      subtitle: "Community support and updates",
      onPress: () => openExternal(APP_LINKS.whatsapp, "WhatsApp"),
    },
    {
      key: "feedback",
      title: "Feedback",
      subtitle: "Send suggestions, bugs, or improvement ideas",
      onPress: () =>
        openEmail({
          label: "Feedback",
          subject: `${appName} Feedback (v${appVersion})`,
          body: "Hi DevGeet team,\n\nI want to share this feedback:\n\n",
        }),
    },
  ];

  return (
    <ScrollView
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
          <Text style={styles.profileName} numberOfLines={1}>
            {accountName}
          </Text>
          <Text style={styles.profileSubtitle} numberOfLines={1}>
            Edit Profile
          </Text>
        </View>

        <HugeiconsIcon
          icon={ArrowRight01Icon}
          size={22}
          color={COLORS.subtleText}
        />
      </Pressable>

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
            key: "about",
            title: `About ${appName}`,
            value: `v${appVersion}`,
            onPress: () => openExternal(APP_LINKS.home, `About ${appName}`),
          }}
          isLast
        />
      </View>

      <View style={styles.groupCard}>
        <SettingRow
          item={{
            key: "logout",
            title: isSubmitting ? "Logging out..." : "Logout",
            onPress: handleLogout,
            destructive: true,
            disabled: isSubmitting,
          }}
          isLast
        />
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: SPACING.xxl,
    paddingBottom: SPACING.xxl * 2,
    gap: SPACING.md,
    backgroundColor: COLORS.background,
  },
  profileCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: SPACING.sm,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.md,
    borderRadius: RADIUS.card,
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.border,
    ...SHADOWS.sm,
  },
  cardPressed: {
    opacity: 0.92,
  },
  avatarWrap: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: COLORS.surfaceSoft,
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
  },
  avatarImage: {
    width: "100%",
    height: "100%",
  },
  avatarText: {
    color: COLORS.text,
    fontSize: 16,
    fontWeight: "700",
  },
  profileTextWrap: {
    flex: 1,
    gap: 2,
  },
  profileName: {
    color: COLORS.text,
    fontSize: 17,
    fontWeight: "700",
  },
  profileSubtitle: {
    color: COLORS.mutedText,
    fontSize: 12,
  },
  sectionLabel: {
    paddingHorizontal: 2,
    color: COLORS.mutedText,
    fontSize: 14,
    fontWeight: "500",
  },
  groupCard: {
    borderRadius: RADIUS.md,
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.border,
    overflow: "hidden",
    ...SHADOWS.sm,
  },
  row: {
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.lg,
    backgroundColor: COLORS.surface,
  },
  rowDivider: {
    borderBottomWidth: 1,
    borderBottomColor: COLORS.divider,
  },
  rowPressed: {
    backgroundColor: COLORS.surfaceMuted,
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
  rowTextWrap: {
    flex: 1,
    gap: 2,
  },
  rowTitle: {
    color: COLORS.text,
    fontSize: 16,
    fontWeight: "600",
  },
  rowTitleDestructive: {
    color: COLORS.danger,
  },
  rowSubtitle: {
    color: COLORS.mutedText,
    fontSize: 12,
    lineHeight: 16,
  },
  rowRight: {
    flexDirection: "row",
    alignItems: "center",
    gap: SPACING.sm,
    maxWidth: "42%",
  },
  rowValue: {
    color: COLORS.subtleText,
    fontSize: 15,
  },
});
