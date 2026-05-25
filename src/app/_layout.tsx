import "@/global.css";
import "@/lib/firebase";
import { hasNotificationsNativeSupport } from "@/lib/notifications";
import { APP_FONTS, installGlobalTypography } from "@/lib/typography";
import { AppUpdatesProvider } from "@/providers/app-updates-provider";
import { AuthProvider } from "@/providers/auth-provider";
import { LyricsReaderPreferencesProvider } from "@/providers/lyrics-reader-preferences-provider";
import { MainTabDataProvider } from "@/providers/main-tab-data-provider";
import { NetworkProvider } from "@/providers/network-provider";
import { NotificationsProvider } from "@/providers/notifications-provider";
import { ThemeProvider, useAppTheme } from "@/providers/theme-provider";
import Constants from "expo-constants";
import { useFonts } from "expo-font";
import { Stack, useRouter } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import { StatusBar } from "expo-status-bar";
import { useEffect } from "react";
import { BackHandler, Platform, StyleSheet, View } from "react-native";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { SafeAreaProvider } from "react-native-safe-area-context";

void SplashScreen.preventAutoHideAsync();
installGlobalTypography();

function AppShell() {
  const { colors, resolvedTheme } = useAppTheme();
  const router = useRouter();
  const styles = createStyles(colors.background);
  const detailScreenOptions = {
    headerShown: true,
    headerStyle: { backgroundColor: colors.surface },
    headerTintColor: colors.text,
    headerShadowVisible: false,
    contentStyle: { backgroundColor: colors.background },
  } as const;

  useEffect(() => {
    if (Platform.OS === "android") {
      const backHandler = BackHandler.addEventListener(
        "hardwareBackPress",
        () => {
          if (router.canGoBack()) {
            router.back();
            return true;
          }
          return false;
        },
      );

      return () => backHandler.remove();
    }
  }, [router]);

  return (
    <View style={styles.container}>
      <StatusBar
        style={resolvedTheme === "dark" ? "light" : "dark"}
      />
      <MainTabDataProvider>
        <Stack
          initialRouteName="(auth)"
          screenOptions={{
            headerShown: false,
            contentStyle: { backgroundColor: colors.background },
          }}
        >
          <Stack.Screen name="(auth)" options={{ headerShown: false }} />
          <Stack.Screen name="(main)" options={{ headerShown: false }} />
          <Stack.Screen name="admin" options={{ headerShown: false }} />
          <Stack.Screen
            name="post/[postId]"
            options={{
              title: "Post Details",
              ...detailScreenOptions,
            }}
          />
          <Stack.Screen
            name="category/[categorySlug]"
            options={{
              title: "Category Posts",
              ...detailScreenOptions,
            }}
          />
        </Stack>
      </MainTabDataProvider>
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
