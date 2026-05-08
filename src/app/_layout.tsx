import Constants from "expo-constants";
import { useFonts } from "expo-font";
import { Stack, usePathname, useRouter } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import { StatusBar } from "expo-status-bar";
import { useEffect, useRef } from "react";
import { BackHandler, Platform, StyleSheet, ToastAndroid, View } from "react-native";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { SafeAreaProvider } from "react-native-safe-area-context";
import "@/lib/firebase";
import "@/global.css";
import {
  APP_FONTS,
  installGlobalTypography,
} from "@/lib/typography";
import { hasNotificationsNativeSupport } from "@/lib/notifications";
import { AppUpdatesProvider } from "@/providers/app-updates-provider";
import { AuthProvider, useAuth } from "@/providers/auth-provider";
import { LyricsReaderPreferencesProvider } from "@/providers/lyrics-reader-preferences-provider";
import { NetworkProvider } from "@/providers/network-provider";
import { NotificationsProvider } from "@/providers/notifications-provider";
import { ThemeProvider, useAppTheme } from "@/providers/theme-provider";

void SplashScreen.preventAutoHideAsync();
installGlobalTypography();

const BACK_EXIT_CONFIRMATION_WINDOW_MS = 2000;
const BACK_EXIT_CONFIRMATION_MESSAGE = "Tap again to exit";

function AppShell() {
  const { colors, resolvedTheme } = useAppTheme();
  const { user } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const styles = createStyles(colors.background);
  const backExitPromptTimestampRef = useRef(0);

  useEffect(() => {
    if (Platform.OS !== "android") {
      return undefined;
    }

    const subscription = BackHandler.addEventListener("hardwareBackPress", () => {
      if (router.canGoBack()) {
        return false;
      }

      if (user && pathname !== "/home") {
        router.replace("/home");
        return true;
      }

      const now = Date.now();
      const elapsedSinceLastPrompt = now - backExitPromptTimestampRef.current;
      if (elapsedSinceLastPrompt <= BACK_EXIT_CONFIRMATION_WINDOW_MS) {
        BackHandler.exitApp();
        return true;
      }

      backExitPromptTimestampRef.current = now;
      ToastAndroid.show(BACK_EXIT_CONFIRMATION_MESSAGE, ToastAndroid.SHORT);
      return true;
    });

    return () => {
      subscription.remove();
    };
  }, [pathname, router, user]);

  return (
    <View style={styles.container}>
      <StatusBar
        style={resolvedTheme === "dark" ? "light" : "dark"}
        backgroundColor={colors.background}
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
  const [fontsLoaded, fontsError] = useFonts({
    [APP_FONTS.regular]: require("../../assets/fonts/GoogleSans-Regular.ttf"),
    [APP_FONTS.medium]: require("../../assets/fonts/GoogleSans-Medium.ttf"),
    [APP_FONTS.bold]: require("../../assets/fonts/GoogleSans-Bold.ttf"),
    [APP_FONTS.italic]: require("../../assets/fonts/GoogleSans-Italic.ttf"),
    [APP_FONTS.mediumItalic]: require("../../assets/fonts/GoogleSans-MediumItalic.ttf"),
    [APP_FONTS.boldItalic]: require("../../assets/fonts/GoogleSans-BoldItalic.ttf"),
  });

  useEffect(() => {
    if (fontsLoaded || fontsError) {
      void SplashScreen.hideAsync();
    }
  }, [fontsError, fontsLoaded]);

  if (!fontsLoaded && !fontsError) {
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
          <LyricsReaderPreferencesProvider>
            <NetworkProvider>
              <AppUpdatesProvider>
                <AuthProvider>
                  {shouldEnableNotifications ? (
                    <NotificationsProvider>
                      <AppShell />
                    </NotificationsProvider>
                  ) : (
                    <AppShell />
                  )}
                </AuthProvider>
              </AppUpdatesProvider>
            </NetworkProvider>
          </LyricsReaderPreferencesProvider>
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

const createStyles = (backgroundColor: string) =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor,
    },
  });
