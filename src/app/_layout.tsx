import Constants from "expo-constants";
import { useFonts } from "expo-font";
import { Stack } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import { StatusBar } from "expo-status-bar";
import { useEffect } from "react";
import { Platform, StyleSheet, View } from "react-native";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { SafeAreaProvider } from "react-native-safe-area-context";
import Svg, { Defs, LinearGradient, Rect, Stop } from "react-native-svg";
import "@/lib/firebase";
import "@/global.css";
import { APP_FONTS, installGlobalTypography } from "@/lib/typography";
import { hasNotificationsNativeSupport } from "@/lib/notifications";
import { AuthProvider } from "@/providers/auth-provider";
import { NetworkProvider } from "@/providers/network-provider";
import { NotificationsProvider } from "@/providers/notifications-provider";
import { ThemeProvider, useAppTheme } from "@/providers/theme-provider";

void SplashScreen.preventAutoHideAsync();
installGlobalTypography();

function AppShell() {
  const { colors, resolvedTheme } = useAppTheme();
  const styles = createStyles();

  return (
    <View style={styles.container}>
      <View pointerEvents="none" style={StyleSheet.absoluteFill}>
        <Svg height="100%" width="100%">
          <Defs>
            <LinearGradient id="appBackgroundGradient" x1="0%" y1="0%" x2="100%" y2="100%">
              <Stop offset="0%" stopColor={colors.backgroundGradient[0]} />
              <Stop offset="55%" stopColor={colors.backgroundGradient[1]} />
              <Stop offset="100%" stopColor={colors.backgroundGradient[2]} />
            </LinearGradient>
          </Defs>
          <Rect width="100%" height="100%" fill="url(#appBackgroundGradient)" />
        </Svg>
      </View>
      <StatusBar
        style={resolvedTheme === "dark" ? "light" : "dark"}
        backgroundColor={colors.backgroundGradient[0]}
        translucent={false}
      />
      <Stack
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: "transparent" },
        }}
      >
        <Stack.Screen name="index" />
        <Stack.Screen name="(auth)" />
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="admin" />
      </Stack>
    </View>
  );
}

export default function RootLayout() {
  const [fontsLoaded] = useFonts({
    [APP_FONTS.regular]: require("../../assets/fonts/GoogleSans-Regular.ttf"),
    [APP_FONTS.medium]: require("../../assets/fonts/GoogleSans-Medium.ttf"),
    [APP_FONTS.bold]: require("../../assets/fonts/GoogleSans-Bold.ttf"),
    [APP_FONTS.italic]: require("../../assets/fonts/GoogleSans-Italic.ttf"),
    [APP_FONTS.mediumItalic]: require("../../assets/fonts/GoogleSans-MediumItalic.ttf"),
    [APP_FONTS.boldItalic]: require("../../assets/fonts/GoogleSans-BoldItalic.ttf"),
  });

  useEffect(() => {
    if (fontsLoaded) {
      void SplashScreen.hideAsync();
    }
  }, [fontsLoaded]);

  if (!fontsLoaded) {
    return null;
  }

  const shouldEnableNotifications =
    Platform.OS !== "web" &&
    Constants.appOwnership !== "expo" &&
    hasNotificationsNativeSupport();

  return (
    <GestureHandlerRootView style={styles.root}>
      <SafeAreaProvider>
        <ThemeProvider>
          <NetworkProvider>
            <AuthProvider>
              {shouldEnableNotifications ? (
                <NotificationsProvider>
                  <AppShell />
                </NotificationsProvider>
              ) : (
                <AppShell />
              )}
            </AuthProvider>
          </NetworkProvider>
        </ThemeProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
});

const createStyles = () =>
  StyleSheet.create({
    container: {
      flex: 1,
    },
  });
