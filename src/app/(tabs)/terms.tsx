import { ScrollView, StyleSheet, Text, View } from "react-native";

import { COLORS, FONT_SIZE, RADIUS, SPACING } from "@/constants/theme";

export default function TermsScreen() {
  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Text style={styles.title}>Terms & Conditions</Text>
      <Text style={styles.updatedAt}>Last updated: March 2, 2026</Text>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>1. Acceptance of Terms</Text>
        <Text style={styles.sectionText}>
          By using DevGeet, you agree to use the app lawfully and responsibly.
        </Text>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>2. Content Usage</Text>
        <Text style={styles.sectionText}>
          Content is provided for personal use. Do not copy, re-publish, or
          distribute app content without permission.
        </Text>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>3. Account Responsibility</Text>
        <Text style={styles.sectionText}>
          You are responsible for activity performed from your account and for
          keeping your credentials secure.
        </Text>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>4. Updates</Text>
        <Text style={styles.sectionText}>
          These terms may be updated over time. Continued usage means you accept
          the latest version of the terms.
        </Text>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: SPACING.xl,
    gap: SPACING.md,
    backgroundColor: COLORS.background,
  },
  title: {
    color: COLORS.text,
    fontSize: FONT_SIZE.title,
    fontWeight: "700",
  },
  updatedAt: {
    color: COLORS.mutedText,
    fontSize: 12,
  },
  section: {
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: RADIUS.md,
    backgroundColor: COLORS.surface,
    padding: SPACING.md,
    gap: SPACING.xs,
  },
  sectionTitle: {
    color: COLORS.text,
    fontSize: 15,
    fontWeight: "700",
  },
  sectionText: {
    color: COLORS.mutedText,
    fontSize: FONT_SIZE.body,
    lineHeight: 21,
  },
});
