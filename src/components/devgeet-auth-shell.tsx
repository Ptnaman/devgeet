import type { ReactNode } from "react";
import { useRouter } from "expo-router";
import { StyleSheet, View } from "react-native";

import { AuthScreenShell } from "@/components/auth-screen-shell";

type DevGeetAuthShellProps = {
  title: string;
  subtitle: string;
  headerLabel?: string;
  children: ReactNode;
};

export function DevGeetAuthShell({
  title,
  subtitle,
  headerLabel = "Account Access",
  children,
}: DevGeetAuthShellProps) {
  const router = useRouter();

  return (
    <AuthScreenShell
      eyebrow={headerLabel}
      title={title}
      subtitle={subtitle}
      onBack={() => {
        if (router.canGoBack()) {
          router.back();
          return;
        }

        router.replace("/auth-choice");
      }}
      showTopBar
      topBarShadow
      topAligned
      layoutStyle={styles.layout}
      scrollContentStyle={styles.scrollContent}
    >
      <View style={styles.form}>{children}</View>
    </AuthScreenShell>
  );
}

export const devgeetAuthStyles = StyleSheet.create({
  form: {
    gap: 16,
  },
  inputStack: {
    gap: 16,
  },
  nameRow: {
    flexDirection: "row",
    gap: 12,
  },
  nameField: {
    flex: 1,
  },
  optionsRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    minHeight: 24,
  },
  checkboxButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  checkbox: {
    width: 18,
    height: 18,
    borderRadius: 5,
    borderWidth: 1,
    borderColor: "#9CA3AF",
    alignItems: "center",
    justifyContent: "center",
  },
  checkboxSelected: {
    borderColor: "#6D28D9",
    backgroundColor: "#6D28D9",
  },
  optionText: {
    color: "#4B5563",
    fontSize: 13,
  },
  linkText: {
    color: "#6D28D9",
    fontSize: 14,
    fontWeight: "600",
  },
  primaryButton: {
    minHeight: 54,
    overflow: "hidden",
    borderRadius: 14,
    marginTop: 2,
  },
  primaryButtonDisabled: {
    opacity: 0.5,
  },
  primaryButtonPressed: {
    opacity: 0.9,
  },
  primaryGradient: {
    minHeight: 54,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingHorizontal: 16,
  },
  primaryButtonText: {
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: "700",
  },
  divider: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginTop: 2,
  },
  dividerLine: {
    height: 1,
    flex: 1,
    backgroundColor: "#E5E7EB",
  },
  dividerText: {
    color: "#6B7280",
    fontSize: 12,
  },
  googleButton: {
    backgroundColor: "#FFFFFF",
  },
  googleButtonText: {
    color: "#111827",
  },
  feedback: {
    color: "#B91C1C",
    fontSize: 13,
    lineHeight: 18,
    textAlign: "center",
  },
  successFeedback: {
    color: "#15803D",
    fontSize: 13,
    lineHeight: 18,
    textAlign: "center",
  },
  accountRow: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    gap: 6,
    paddingTop: 2,
  },
  accountPrompt: {
    color: "#4B5563",
    fontSize: 14,
  },
  scrollContent: {
    paddingTop: 12,
  },
});

const styles = StyleSheet.create({
  scrollContent: {
    paddingTop: 8,
  },
  layout: {
    gap: 16,
    paddingVertical: 0,
  },
  form: {
    width: "100%",
  },
});
