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

import { RADIUS, SPACING } from "@/constants/theme";
import { useAppUpdates } from "@/providers/app-updates-provider";

const SCREEN_BACKGROUND = "#FFFFFF";
const PRIMARY_TEXT = "#0F0F10";
const SECONDARY_TEXT = "#7A7A7A";
const CARD_BACKGROUND = "#F7F7F7";
const CARD_BORDER = "#EFEFEF";
const TOGGLE_ACTIVE = "#22C55E";

export default function AppUpdatesScreen() {
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
  const styles = createStyles();

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
      <StatusBar style="dark" backgroundColor={SCREEN_BACKGROUND} />
      <ScrollView
        contentContainerStyle={styles.container}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.layout}>
          <View style={styles.body}>
            <View style={styles.heroBlock}>
              <Image
                source={require("../../../assets/images/icon.png")}
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
                      <ActivityIndicator size="small" color={SCREEN_BACKGROUND} />
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
                        false: "#DADADA",
                        true: TOGGLE_ACTIVE,
                      }}
                      thumbColor={SCREEN_BACKGROUND}
                      ios_backgroundColor="#DADADA"
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

const createStyles = () =>
  StyleSheet.create({
    screen: {
      flex: 1,
      backgroundColor: SCREEN_BACKGROUND,
    },
    container: {
      flexGrow: 1,
      backgroundColor: SCREEN_BACKGROUND,
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
      color: PRIMARY_TEXT,
      fontSize: 24,
      lineHeight: 31,
      fontWeight: "600",
      textAlign: "center",
    },
    appVersion: {
      color: SECONDARY_TEXT,
      fontSize: 15,
      lineHeight: 22,
      textAlign: "center",
    },
    statusText: {
      color: SECONDARY_TEXT,
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
      borderColor: CARD_BORDER,
      backgroundColor: CARD_BACKGROUND,
      paddingHorizontal: SPACING.lg,
      paddingVertical: SPACING.lg,
      gap: SPACING.sm,
    },
    cardTextWrap: {
      gap: 6,
    },
    cardTitle: {
      color: PRIMARY_TEXT,
      fontSize: 16,
      fontWeight: "700",
    },
    cardSubtitle: {
      color: SECONDARY_TEXT,
      fontSize: 13,
      lineHeight: 19,
    },
    updateButton: {
      minHeight: 46,
      borderRadius: RADIUS.pill,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: PRIMARY_TEXT,
      paddingHorizontal: SPACING.lg,
    },
    updateButtonText: {
      color: SCREEN_BACKGROUND,
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
