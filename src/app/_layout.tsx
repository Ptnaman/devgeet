import "@/global.css";
import "@/lib/firebase";
import { hasNotificationsNativeSupport } from "@/lib/notifications";
import { APP_FONTS, installGlobalTypography } from "@/lib/typography";
import { AppUpdatesProvider } from "@/providers/app-updates-provider";
import { AuthProvider } from "@/providers/auth-provider";
import { LyricsReaderPreferencesProvider } from "@/providers/lyrics-reader-preferences-provider";
import { MainTabDataProvider } from "@/providers/main-tab-data-provider";
import { NetworkProvider, useNetworkStatus } from "@/providers/network-provider";
import { NotificationsProvider } from "@/providers/notifications-provider";
import { ThemeProvider, useAppTheme } from "@/providers/theme-provider";
import { GoogleSans_400Regular } from "@expo-google-fonts/google-sans/400Regular";
import { GoogleSans_400Regular_Italic } from "@expo-google-fonts/google-sans/400Regular_Italic";
import { GoogleSans_500Medium } from "@expo-google-fonts/google-sans/500Medium";
import { GoogleSans_500Medium_Italic } from "@expo-google-fonts/google-sans/500Medium_Italic";
import { GoogleSans_700Bold } from "@expo-google-fonts/google-sans/700Bold";
import { GoogleSans_700Bold_Italic } from "@expo-google-fonts/google-sans/700Bold_Italic";
import Constants from "expo-constants";
import { useFonts } from "expo-font";
import { Stack, usePathname, useRouter } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import { StatusBar } from "expo-status-bar";
import { useEffect, useRef } from "react";
import { BackHandler, Platform, StyleSheet, View } from "react-native";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { SafeAreaProvider } from "react-native-safe-area-context";

void SplashScreen.preventAutoHideAsync();
installGlobalTypography();

const EXIT_CONFIRMATION_WINDOW_MS = 2000;
const MAIN_TAB_ROOT_PATHS = new Set(["/", "/categories", "/favorite", "/settings"]);

function AppShell() {
  const { colors, resolvedTheme } = useAppTheme();
  const { showToast } = useNetworkStatus();
  const pathname = usePathname();
  const router = useRouter();
  const lastExitBackPressAtRef = useRef(0);
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
          if (!MAIN_TAB_ROOT_PATHS.has(pathname) && router.canGoBack()) {
            router.back();
            return true;
          }

          const pressedAt = Date.now();
          if (pressedAt - lastExitBackPressAtRef.current <= EXIT_CONFIRMATION_WINDOW_MS) {
            BackHandler.exitApp();
            return true;
          }

          lastExitBackPressAtRef.current = pressedAt;
          showToast("Press back again to exit");
          return true;
        },
      );

      return () => {
        lastExitBackPressAtRef.current = 0;
        backHandler.remove();
      };
    }
  }, [pathname, router, showToast]);

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
    [APP_FONTS.regular]: GoogleSans_400Regular,
    [APP_FONTS.medium]: GoogleSans_500Medium,
    [APP_FONTS.bold]: GoogleSans_700Bold,
    [APP_FONTS.italic]: GoogleSans_400Regular_Italic,
    [APP_FONTS.mediumItalic]: GoogleSans_500Medium_Italic,
    [APP_FONTS.boldItalic]: GoogleSans_700Bold_Italic,
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
