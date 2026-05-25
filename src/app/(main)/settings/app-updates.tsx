import { StatusBar } from "expo-status-bar";
import { useEffect } from "react";
import {
  ActivityIndicator,
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  View,
} from "react-native";

import { RADIUS, SPACING, type ThemeColors } from "@/constants/theme";
import { useAppUpdates } from "@/providers/app-updates-provider";
import { useAppTheme } from "@/providers/theme-provider";

export default function AppUpdatesScreen() {
  const { colors, resolvedTheme } = useAppTheme();
  const {
    appVersion,
    isOtaAvailable,
    isUpdatePending,
    isCheckingForUpdate,
    isApplyingUpdate,
    updateStatusMessage,
    autoUpdateEnabled,
    checkForUpdatesAsync,
    applyUpdateAsync,
    setAutoUpdateEnabled,
  } = useAppUpdates();
  const styles = createStyles(colors);

  const showUpdateControls = isUpdatePending;
  const statusTitle = isApplyingUpdate
    ? "Updating..."
    : isCheckingForUpdate
      ? "Checking for Updates..."
      : isUpdatePending
        ? "Update Available"
        : "Already the Latest Version";
  const showStatusMessage = isApplyingUpdate || isCheckingForUpdate || isUpdatePending;
  const isUpdateButtonDisabled = !isOtaAvailable || isApplyingUpdate || autoUpdateEnabled;

  useEffect(() => {
    if (isUpdatePending || !isOtaAvailable) {
      return;
    }

    void checkForUpdatesAsync();
  }, [checkForUpdatesAsync, isOtaAvailable, isUpdatePending]);

  return (
    <View style={styles.screen}>
      <StatusBar
        style={resolvedTheme === "dark" ? "light" : "dark"}
        backgroundColor={colors.background}
      />
      <ScrollView
        contentContainerStyle={styles.container}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.layout}>
          <View style={styles.body}>
            <View style={styles.heroBlock}>
              <Image
                source={require("../../../../assets/images/icon.png")}
                style={styles.appLogo}
              />
              <Text style={styles.statusTitle}>{statusTitle}</Text>
              <Text style={styles.appVersion}>
                {`Current version ${appVersion}`}
              </Text>
              {showStatusMessage ? (
                <Text style={styles.statusText}>{updateStatusMessage}</Text>
              ) : null}
            </View>

            {showUpdateControls ? (
              <View style={styles.controlsBlock}>
                <View style={styles.card}>
                  <View style={styles.cardTextWrap}>
                    <Text style={styles.cardTitle}>Update App</Text>
                    <Text style={styles.cardSubtitle}>A new update is available for your app.</Text>
                  </View>

                  <Pressable
                    style={({ pressed }) => [
                      styles.updateButton,
                      pressed && !isUpdateButtonDisabled && styles.buttonPressed,
                      isUpdateButtonDisabled && styles.buttonDisabled,
                    ]}
                    onPress={() => {
                      void applyUpdateAsync();
                    }}
                    disabled={isUpdateButtonDisabled}
                  >
                    {isApplyingUpdate ? (
                      <ActivityIndicator size="small" color={colors.surface} />
                    ) : (
                      <Text style={styles.updateButtonText}>
                        {autoUpdateEnabled
                          ? "Updating automatically..."
                          : "Update now"}
                      </Text>
                    )}
                  </Pressable>
                </View>

                <View style={styles.card}>
                  <View style={styles.cardTextWrap}>
                    <Text style={styles.cardTitle}>Auto Update</Text>
                    <Text style={styles.cardSubtitle}>Auto-update when a new version is available.</Text>
                  </View>

                  <View style={styles.toggleWrap}>
                    <Switch
                      value={autoUpdateEnabled}
                      onValueChange={(value) => {
                        void setAutoUpdateEnabled(value);
                      }}
                      disabled={!isOtaAvailable || isApplyingUpdate}
                      trackColor={{
                        false: colors.inputBorderHover,
                        true: colors.success,
                      }}
                      thumbColor={colors.surface}
                      ios_backgroundColor={colors.inputBorderHover}
                    />
                  </View>
                </View>
              </View>
            ) : null}
          </View>
        </View>
      </ScrollView>
    </View>
  );
}

const createStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    screen: {
      flex: 1,
      backgroundColor: colors.background,
    },
    container: {
      flexGrow: 1,
      backgroundColor: colors.background,
      paddingHorizontal: SPACING.xl,
      paddingTop: SPACING.md,
      paddingBottom: SPACING.xxl,
    },
    layout: {
      flex: 1,
      width: "100%",
      maxWidth: 440,
      alignSelf: "center",
    },
    body: {
      flex: 1,
      justifyContent: "flex-start",
      gap: SPACING.xl,
    },
    heroBlock: {
      minHeight: 420,
      alignItems: "center",
      justifyContent: "center",
      paddingHorizontal: SPACING.lg,
      paddingTop: SPACING.lg,
      gap: 6,
    },
    appLogo: {
      width: 60,
      height: 60,
      borderRadius: 24,
      marginBottom: SPACING.md,
    },
    statusTitle: {
      color: colors.text,
      fontSize: 24,
      lineHeight: 31,
      fontWeight: "600",
      textAlign: "center",
    },
    appVersion: {
      color: colors.mutedText,
      fontSize: 15,
      lineHeight: 22,
      textAlign: "center",
    },
    statusText: {
      color: colors.mutedText,
      fontSize: 12,
      lineHeight: 18,
      textAlign: "center",
      marginTop: 2,
    },
    controlsBlock: {
      gap: SPACING.md,
      marginTop: -SPACING.lg,
    },
    card: {
      borderRadius: 28,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.surfaceMuted,
      paddingHorizontal: SPACING.lg,
      paddingVertical: SPACING.lg,
      gap: SPACING.sm,
    },
    cardTextWrap: {
      gap: 6,
    },
    cardTitle: {
      color: colors.text,
      fontSize: 16,
      fontWeight: "700",
    },
    cardSubtitle: {
      color: colors.mutedText,
      fontSize: 13,
      lineHeight: 19,
    },
    updateButton: {
      minHeight: 46,
      borderRadius: RADIUS.pill,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: colors.primary,
      paddingHorizontal: SPACING.lg,
    },
    updateButtonText: {
      color: colors.primaryText,
      fontSize: 14,
      fontWeight: "700",
    },
    toggleWrap: {
      alignItems: "flex-end",
    },
    buttonPressed: {
      opacity: 0.9,
    },
    buttonDisabled: {
      opacity: 0.55,
    },
  });
