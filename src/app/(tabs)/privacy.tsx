import { ScrollView, StyleSheet, Text, View } from "react-native";

import { COLORS, FONT_SIZE, RADIUS, SHADOWS, SPACING } from "@/constants/theme";

export default function PrivacyPolicyScreen() {
  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Text style={styles.title}>Privacy Policy</Text>
      <Text style={styles.updatedAt}>Last updated: March 2, 2026</Text>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>1. Data We Collect</Text>
        <Text style={styles.sectionText}>
          We may store basic account information (such as email and profile
          details) to provide app features.
        </Text>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>2. How We Use Data</Text>
        <Text style={styles.sectionText}>
          Data is used to authenticate users, show personalized features (like
          favorites), and improve app reliability.
        </Text>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>3. Data Sharing</Text>
        <Text style={styles.sectionText}>
          Personal data is not sold. Data may be processed by secure service
          providers used to run the app.
        </Text>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>4. Contact</Text>
        <Text style={styles.sectionText}>
          For privacy-related requests, contact us via the Feedback option
          available in Settings.
        </Text>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: SPACING.xl,
    gap: SPACING.lg,
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
    borderRadius: RADIUS.md,
    backgroundColor: COLORS.surface,
    padding: SPACING.md,
    gap: SPACING.xs,
    ...SHADOWS.sm,
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
