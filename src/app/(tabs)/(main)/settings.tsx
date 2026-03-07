import Constants from "expo-constants";
import { useRouter } from "expo-router";
import { useState } from "react";
import { HugeiconsIcon } from "@hugeicons/react-native";
import {
  ArrowRight01Icon,
  Logout03Icon,
  Mail01Icon,
  Settings01Icon,
} from "@hugeicons/core-free-icons";
import {
  Alert,
  Linking,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";

import { COLORS, FONT_SIZE, RADIUS, SHADOWS, SPACING } from "@/constants/theme";
import { useAuth } from "@/providers/auth-provider";

export default function SettingsScreen() {
  const router = useRouter();
  const { user, profile, isAdmin, logout } = useAuth();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isOpeningFeedback, setIsOpeningFeedback] = useState(false);
  const roleLabel = isAdmin ? "Admin" : "User";
  const appName = Constants.expoConfig?.name ?? "DevGeet";
  const appVersion = Constants.expoConfig?.version ?? "1.0.0";
  const accountName = profile?.displayName || user?.displayName || user?.email || "User";
  const accountEmail = profile?.email || user?.email || "No email available";
  const usernameLabel = profile?.username ? `@${profile.username}` : "Set up your profile";
  const avatarLabel = accountName
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((word) => word.charAt(0).toUpperCase())
    .join("") || "U";

  const handleAuthButton = async () => {
    try {
      setIsSubmitting(true);
      await logout();
      router.replace("/login");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleOpenFeedback = async () => {
    const feedbackEmail = "feedback@devgeet.app";
    const subject = encodeURIComponent(`${appName} Feedback (v${appVersion})`);
    const body = encodeURIComponent(
      "Please share your feedback here.\n\nDevice:\nIssue/Feedback:\n",
    );
    const mailtoUrl = `mailto:${feedbackEmail}?subject=${subject}&body=${body}`;

    try {
      setIsOpeningFeedback(true);
      const canOpen = await Linking.canOpenURL(mailtoUrl);
      if (!canOpen) {
        Alert.alert(
          "Feedback",
          `Mail app not available. Please send feedback to ${feedbackEmail}`,
        );
        return;
      }
      await Linking.openURL(mailtoUrl);
    } catch {
      Alert.alert(
        "Feedback",
        `Unable to open mail app. Please send feedback to ${feedbackEmail}`,
      );
    } finally {
      setIsOpeningFeedback(false);
    }
  };

  const supportCards = [
    {
      key: "terms",
      badge: "Legal",
      title: "Terms & Conditions",
      description: "Review how the app should be used and what the rules are.",
      onPress: () => router.push("/terms"),
      cardStyle: styles.utilityCardBlue,
      badgeStyle: styles.utilityBadgeBlue,
    },
    {
      key: "privacy",
      badge: "Privacy",
      title: "Privacy Policy",
      description: "See what user data is stored and how that information is handled.",
      onPress: () => router.push("/privacy"),
      cardStyle: styles.utilityCardGreen,
      badgeStyle: styles.utilityBadgeGreen,
    },
    {
      key: "feedback",
      badge: "Support",
      title: "Send Feedback",
      description: "Open your mail app and share issues, suggestions, or ideas.",
      onPress: handleOpenFeedback,
      cardStyle: styles.utilityCardAmber,
      badgeStyle: styles.utilityBadgeAmber,
      disabled: isOpeningFeedback,
    },
  ];

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <View style={styles.heroCard}>
        <View style={styles.heroGlowPrimary} />
        <View style={styles.heroGlowSecondary} />

        <View style={styles.heroTopRow}>
          <View style={styles.heroPill}>
            <Text style={styles.heroPillText}>Settings Hub</Text>
          </View>
          <View style={styles.heroIconWrap}>
            <HugeiconsIcon icon={Settings01Icon} size={22} color={COLORS.primary} />
          </View>
        </View>

        <Text style={styles.title}>Settings</Text>
        <Text style={styles.subtitle}>
          Manage your account, privacy, and support options from one place.
        </Text>

        <View style={styles.profileSnapshot}>
          <View style={styles.avatarWrap}>
            <Text style={styles.avatarText}>{avatarLabel}</Text>
          </View>

          <View style={styles.profileMeta}>
            <Text style={styles.profileName}>{accountName}</Text>
            <View style={styles.emailRow}>
              <HugeiconsIcon icon={Mail01Icon} size={15} color={COLORS.mutedText} />
              <Text style={styles.profileEmail} numberOfLines={1}>
                {accountEmail}
              </Text>
            </View>
          </View>
        </View>

        <View style={styles.heroStatsRow}>
          <View style={[styles.heroStatCard, styles.heroStatCardBlue]}>
            <Text style={styles.heroStatLabel}>Username</Text>
            <Text style={styles.heroStatValue} numberOfLines={1}>
              {usernameLabel}
            </Text>
          </View>

          <View
            style={[
              styles.heroStatCard,
              isAdmin ? styles.heroStatCardGreen : styles.heroStatCardNeutral,
            ]}
          >
            <Text style={styles.heroStatLabel}>Access</Text>
            <Text style={styles.heroStatValue}>{roleLabel}</Text>
          </View>
        </View>
      </View>

      <View style={styles.sectionBlock}>
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionEyebrow}>Account</Text>
          <Text style={styles.sectionCopy}>Update the details visible on your account.</Text>
        </View>

        <Pressable
          style={({ pressed }) => [
            styles.featureCard,
            pressed && styles.featureCardPressed,
          ]}
          onPress={() => router.push("/profile")}
        >
          <View style={styles.featureHeader}>
            <View>
              <Text style={styles.featureEyebrow}>Profile</Text>
              <Text style={styles.featureTitle}>Edit profile details</Text>
            </View>
            <View style={styles.arrowWrap}>
              <HugeiconsIcon icon={ArrowRight01Icon} size={18} color={COLORS.text} />
            </View>
          </View>

          <Text style={styles.featureDescription}>
            Change your name and username so the account stays current.
          </Text>

          <View style={styles.featureMetaRow}>
            <View style={styles.metaPill}>
              <Text style={styles.metaPillText}>{usernameLabel}</Text>
            </View>
            <View
              style={[
                styles.metaPill,
                isAdmin ? styles.metaPillGreen : styles.metaPillBlue,
              ]}
            >
              <Text style={styles.metaPillText}>{roleLabel} Interface</Text>
            </View>
          </View>
        </Pressable>
      </View>

      <View style={styles.sectionBlock}>
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionEyebrow}>Support & Legal</Text>
          <Text style={styles.sectionCopy}>Quick links for help, policies, and app feedback.</Text>
        </View>

        {supportCards.map((item) => (
          <Pressable
            key={item.key}
            style={({ pressed }) => [
              styles.utilityCard,
              item.cardStyle,
              pressed && styles.utilityCardPressed,
              item.disabled && styles.utilityCardDisabled,
            ]}
            onPress={item.onPress}
            disabled={item.disabled}
          >
            <View style={styles.utilityCardTop}>
              <View style={[styles.utilityBadge, item.badgeStyle]}>
                <Text style={styles.utilityBadgeText}>{item.badge}</Text>
              </View>
              <HugeiconsIcon icon={ArrowRight01Icon} size={18} color={COLORS.text} />
            </View>

            <Text style={styles.utilityTitle}>{item.title}</Text>
            <Text style={styles.utilityDescription}>{item.description}</Text>
          </Pressable>
        ))}
      </View>

      <View style={styles.footerCard}>
        <View style={styles.footerTopRow}>
          <View>
            <Text style={styles.sectionEyebrow}>App Info</Text>
            <Text style={styles.sectionCopy}>Current app details and session controls.</Text>
          </View>
          <View style={styles.versionPill}>
            <Text style={styles.versionPillText}>v{appVersion}</Text>
          </View>
        </View>

        <View style={styles.infoRow}>
          <Text style={styles.infoLabel}>App Name</Text>
          <Text style={styles.infoValue}>{appName}</Text>
        </View>
        <View style={styles.infoRow}>
          <Text style={styles.infoLabel}>Signed In</Text>
          <Text style={styles.infoValue} numberOfLines={1}>
            {accountEmail}
          </Text>
        </View>

        <Text style={styles.helperText}>
          {isAdmin
            ? "Use the Admin Panel button in the top header for management tools."
            : "Standard user settings are active for this account."}
        </Text>

        <Pressable
          style={({ pressed }) => [
            styles.button,
            pressed && styles.buttonPressed,
            isSubmitting && styles.buttonDisabled,
          ]}
          onPress={handleAuthButton}
          disabled={isSubmitting}
        >
          <HugeiconsIcon icon={Logout03Icon} size={18} color={COLORS.primaryText} />
          <Text style={styles.buttonText}>
            {isSubmitting ? "Logging out..." : "Logout"}
          </Text>
        </Pressable>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: SPACING.xl,
    gap: SPACING.lg,
    backgroundColor: COLORS.background,
    paddingBottom: SPACING.xxl * 2,
  },
  heroCard: {
    position: "relative",
    overflow: "hidden",
    borderRadius: RADIUS.lg,
    backgroundColor: COLORS.surface,
    padding: SPACING.lg,
    gap: SPACING.md,
    ...SHADOWS.md,
  },
  heroGlowPrimary: {
    position: "absolute",
    top: -36,
    right: -18,
    width: 140,
    height: 140,
    borderRadius: 999,
    backgroundColor: "#DBEAFE",
  },
  heroGlowSecondary: {
    position: "absolute",
    bottom: -46,
    left: -26,
    width: 120,
    height: 120,
    borderRadius: 999,
    backgroundColor: "#E2E8F0",
  },
  heroTopRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: SPACING.md,
  },
  heroPill: {
    alignSelf: "flex-start",
    borderRadius: 999,
    paddingHorizontal: SPACING.sm,
    paddingVertical: 6,
    backgroundColor: "#EFF6FF",
    borderWidth: 1,
    borderColor: "#BFDBFE",
  },
  heroPillText: {
    color: "#1D4ED8",
    fontSize: 11,
    fontWeight: "700",
  },
  heroIconWrap: {
    width: 44,
    height: 44,
    borderRadius: 14,
    backgroundColor: "#F8FAFC",
    borderWidth: 1,
    borderColor: COLORS.border,
    alignItems: "center",
    justifyContent: "center",
  },
  title: {
    fontSize: 28,
    fontWeight: "800",
    color: COLORS.text,
  },
  subtitle: {
    fontSize: FONT_SIZE.body,
    color: COLORS.mutedText,
    lineHeight: 21,
  },
  profileSnapshot: {
    flexDirection: "row",
    alignItems: "center",
    gap: SPACING.md,
  },
  avatarWrap: {
    width: 58,
    height: 58,
    borderRadius: 999,
    backgroundColor: COLORS.primary,
    alignItems: "center",
    justifyContent: "center",
    ...SHADOWS.sm,
  },
  avatarText: {
    color: COLORS.primaryText,
    fontSize: 18,
    fontWeight: "700",
  },
  profileMeta: {
    flex: 1,
    gap: 4,
  },
  profileName: {
    color: COLORS.text,
    fontSize: 18,
    fontWeight: "700",
  },
  emailRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  profileEmail: {
    flex: 1,
    color: COLORS.mutedText,
    fontSize: 13,
  },
  heroStatsRow: {
    flexDirection: "row",
    gap: SPACING.sm,
  },
  heroStatCard: {
    flex: 1,
    borderRadius: RADIUS.md,
    padding: SPACING.md,
    borderWidth: 1,
    gap: 4,
  },
  heroStatCardBlue: {
    backgroundColor: "#F8FAFC",
    borderColor: "#DCEAFE",
  },
  heroStatCardGreen: {
    backgroundColor: "#ECFDF5",
    borderColor: "#A7F3D0",
  },
  heroStatCardNeutral: {
    backgroundColor: "#F8FAFC",
    borderColor: COLORS.border,
  },
  heroStatLabel: {
    color: COLORS.mutedText,
    fontSize: 11,
    fontWeight: "700",
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  heroStatValue: {
    color: COLORS.text,
    fontSize: 14,
    fontWeight: "700",
  },
  sectionBlock: {
    gap: SPACING.md,
  },
  sectionHeader: {
    gap: 4,
  },
  sectionEyebrow: {
    color: COLORS.text,
    fontSize: 17,
    fontWeight: "700",
  },
  sectionCopy: {
    color: COLORS.mutedText,
    fontSize: 13,
    lineHeight: 20,
  },
  featureCard: {
    borderRadius: RADIUS.lg,
    backgroundColor: COLORS.surface,
    padding: SPACING.lg,
    gap: SPACING.md,
    ...SHADOWS.sm,
  },
  featureCardPressed: {
    opacity: 0.95,
  },
  featureHeader: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: SPACING.md,
  },
  featureEyebrow: {
    color: COLORS.mutedText,
    fontSize: 12,
    fontWeight: "700",
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  featureTitle: {
    marginTop: 2,
    color: COLORS.text,
    fontSize: 18,
    fontWeight: "700",
  },
  arrowWrap: {
    width: 36,
    height: 36,
    borderRadius: 999,
    backgroundColor: "#F8FAFC",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  featureDescription: {
    color: "#334155",
    fontSize: FONT_SIZE.body,
    lineHeight: 21,
  },
  featureMetaRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: SPACING.sm,
  },
  metaPill: {
    borderRadius: 999,
    backgroundColor: "#F8FAFC",
    borderWidth: 1,
    borderColor: COLORS.border,
    paddingHorizontal: SPACING.md,
    paddingVertical: 7,
  },
  metaPillBlue: {
    backgroundColor: "#EFF6FF",
    borderColor: "#BFDBFE",
  },
  metaPillGreen: {
    backgroundColor: "#ECFDF5",
    borderColor: "#A7F3D0",
  },
  metaPillText: {
    color: COLORS.text,
    fontSize: 12,
    fontWeight: "700",
  },
  utilityCard: {
    borderRadius: RADIUS.lg,
    padding: SPACING.lg,
    gap: SPACING.sm,
    borderWidth: 1,
  },
  utilityCardBlue: {
    backgroundColor: "#F8FBFF",
    borderColor: "#DCEAFE",
  },
  utilityCardGreen: {
    backgroundColor: "#F4FCF7",
    borderColor: "#C7EFD8",
  },
  utilityCardAmber: {
    backgroundColor: "#FFF9F0",
    borderColor: "#FDE7C2",
  },
  utilityCardPressed: {
    opacity: 0.95,
  },
  utilityCardDisabled: {
    opacity: 0.65,
  },
  utilityCardTop: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: SPACING.sm,
  },
  utilityBadge: {
    borderRadius: 999,
    paddingHorizontal: SPACING.sm,
    paddingVertical: 6,
  },
  utilityBadgeBlue: {
    backgroundColor: "#DBEAFE",
  },
  utilityBadgeGreen: {
    backgroundColor: "#D1FAE5",
  },
  utilityBadgeAmber: {
    backgroundColor: "#FDE68A",
  },
  utilityBadgeText: {
    color: COLORS.text,
    fontSize: 11,
    fontWeight: "700",
  },
  utilityTitle: {
    color: COLORS.text,
    fontSize: 17,
    fontWeight: "700",
  },
  utilityDescription: {
    color: "#334155",
    fontSize: 13,
    lineHeight: 20,
  },
  footerCard: {
    borderRadius: RADIUS.lg,
    backgroundColor: COLORS.surface,
    padding: SPACING.lg,
    gap: SPACING.md,
    ...SHADOWS.sm,
  },
  footerTopRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: SPACING.md,
  },
  versionPill: {
    borderRadius: 999,
    paddingHorizontal: SPACING.md,
    paddingVertical: 7,
    backgroundColor: COLORS.primary,
  },
  versionPillText: {
    color: COLORS.primaryText,
    fontSize: 12,
    fontWeight: "700",
  },
  infoRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: SPACING.md,
    paddingVertical: SPACING.xs,
  },
  infoLabel: {
    color: COLORS.mutedText,
    fontSize: 13,
  },
  infoValue: {
    color: COLORS.text,
    fontSize: 13,
    fontWeight: "600",
    flex: 1,
    textAlign: "right",
  },
  helperText: {
    color: COLORS.mutedText,
    fontSize: 12,
    lineHeight: 18,
  },
  button: {
    marginTop: SPACING.xs,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: SPACING.sm,
    backgroundColor: COLORS.primary,
    borderRadius: RADIUS.md,
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.md,
    ...SHADOWS.sm,
  },
  buttonPressed: {
    opacity: 0.9,
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  buttonText: {
    color: COLORS.primaryText,
    fontSize: FONT_SIZE.button,
    fontWeight: "600",
  },
});
