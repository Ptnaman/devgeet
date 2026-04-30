import { ScrollView, StyleSheet, Text, View } from "react-native";

import { HelpQuestionIcon } from "@/components/icons/help-question-icon";
import { RADIUS, SHADOWS, SPACING, type ThemeColors } from "@/constants/theme";
import { useAuth } from "@/providers/auth-provider";
import { useAppTheme } from "@/providers/theme-provider";

const QUICK_START_STEPS = [
  {
    title: "Search from Home",
    description: "Use the Home tab search bar to quickly find lyrics and open the full post.",
  },
  {
    title: "Browse by category",
    description: "Open Categories to jump into a topic and see all published posts for it.",
  },
  {
    title: "Save bookmarks",
    description: "Tap the bookmark icon on any post to save it and open it later from Bookmarks.",
  },
  {
    title: "Adjust reading settings",
    description: "Use Settings to change the theme, keep the screen awake, and check app updates.",
  },
] as const;

const CORE_FEATURES = [
  {
    title: "Home",
    description: "Search lyrics, open recent posts, and start reading in one place.",
  },
  {
    title: "Categories",
    description: "Browse posts by topic when you want to explore instead of search.",
  },
  {
    title: "Bookmarks",
    description: "Keep your favorite posts saved for quick access anytime.",
  },
  {
    title: "Profile and Settings",
    description: "Manage your account, update your profile, and personalize the app experience.",
  },
] as const;

export default function HelpScreen() {
  const { colors } = useAppTheme();
  const { canManagePosts, isAdmin } = useAuth();
  const styles = createStyles(colors);

  const creatorFeature = canManagePosts
    ? {
        title: isAdmin ? "Admin Panel" : "My Posts",
        description: isAdmin
          ? "Review, publish, and manage creator posts from the Settings creator section."
          : "Create drafts, update your posts, and submit them for approval from the creator tools.",
      }
    : {
        title: "Become an Author",
        description:
          "Complete your profile, then switch to author from your profile to unlock My Posts and a public author page.",
      };

  return (
    <ScrollView
      contentContainerStyle={styles.container}
      showsVerticalScrollIndicator={false}
    >
      <View style={styles.layout}>
        <View style={styles.heroCard}>
          <View style={styles.heroIconWrap}>
            <HelpQuestionIcon color={colors.accent} size={32} />
          </View>
          <Text style={styles.heroTitle}>How to use DevGeet</Text>
          <Text style={styles.heroSubtitle}>
            This guide explains the main tabs, useful actions, and where to manage your account.
          </Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Quick start</Text>
          <View style={styles.groupCard}>
            {QUICK_START_STEPS.map((item, index) => (
              <View
                key={item.title}
                style={[styles.stepRow, index < QUICK_START_STEPS.length - 1 && styles.stepDivider]}
              >
                <View style={styles.stepBadge}>
                  <Text style={styles.stepBadgeText}>{index + 1}</Text>
                </View>
                <View style={styles.stepTextWrap}>
                  <Text style={styles.stepTitle}>{item.title}</Text>
                  <Text style={styles.stepDescription}>{item.description}</Text>
                </View>
              </View>
            ))}
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Main features</Text>
          <View style={styles.featureList}>
            {[...CORE_FEATURES, creatorFeature].map((item) => (
              <View key={item.title} style={styles.featureCard}>
                <Text style={styles.featureTitle}>{item.title}</Text>
                <Text style={styles.featureDescription}>{item.description}</Text>
              </View>
            ))}
          </View>
        </View>

        <View style={styles.noteCard}>
          <Text style={styles.noteTitle}>Need support?</Text>
          <Text style={styles.noteDescription}>
            Open Settings and use the Support section for email, WhatsApp community, and feedback.
          </Text>
        </View>
      </View>
    </ScrollView>
  );
}

const createStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    container: {
      flexGrow: 1,
      padding: SPACING.xl,
      paddingBottom: SPACING.xxl * 2,
      backgroundColor: colors.background,
    },
    layout: {
      width: "100%",
      maxWidth: 560,
      alignSelf: "center",
      gap: SPACING.lg,
    },
    heroCard: {
      borderRadius: RADIUS.lg,
      borderWidth: 1,
      borderColor: colors.accentBorder,
      backgroundColor: colors.accentSoft,
      padding: SPACING.xl,
      gap: SPACING.md,
      ...SHADOWS.sm,
    },
    heroIconWrap: {
      width: 56,
      height: 56,
      borderRadius: 999,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: colors.surface,
    },
    heroTitle: {
      color: colors.text,
      fontSize: 26,
      fontWeight: "700",
    },
    heroSubtitle: {
      color: colors.mutedText,
      fontSize: 14,
      lineHeight: 21,
    },
    section: {
      gap: SPACING.sm,
    },
    sectionTitle: {
      color: colors.text,
      fontSize: 18,
      fontWeight: "700",
    },
    groupCard: {
      borderRadius: RADIUS.lg,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.surface,
      overflow: "hidden",
      ...SHADOWS.sm,
    },
    stepRow: {
      flexDirection: "row",
      alignItems: "flex-start",
      gap: SPACING.md,
      paddingHorizontal: SPACING.lg,
      paddingVertical: SPACING.lg,
    },
    stepDivider: {
      borderBottomWidth: 1,
      borderBottomColor: colors.divider,
    },
    stepBadge: {
      width: 30,
      height: 30,
      borderRadius: 999,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: colors.accentSoft,
    },
    stepBadgeText: {
      color: colors.accent,
      fontSize: 13,
      fontWeight: "700",
    },
    stepTextWrap: {
      flex: 1,
      gap: 4,
    },
    stepTitle: {
      color: colors.text,
      fontSize: 15,
      fontWeight: "700",
    },
    stepDescription: {
      color: colors.mutedText,
      fontSize: 13,
      lineHeight: 20,
    },
    featureList: {
      gap: SPACING.sm,
    },
    featureCard: {
      borderRadius: RADIUS.lg,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.surface,
      padding: SPACING.lg,
      gap: SPACING.xs,
      ...SHADOWS.sm,
    },
    featureTitle: {
      color: colors.text,
      fontSize: 16,
      fontWeight: "700",
    },
    featureDescription: {
      color: colors.mutedText,
      fontSize: 13,
      lineHeight: 20,
    },
    noteCard: {
      borderRadius: RADIUS.lg,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.surfaceSoft,
      padding: SPACING.lg,
      gap: SPACING.xs,
    },
    noteTitle: {
      color: colors.text,
      fontSize: 16,
      fontWeight: "700",
    },
    noteDescription: {
      color: colors.mutedText,
      fontSize: 13,
      lineHeight: 20,
    },
  });
