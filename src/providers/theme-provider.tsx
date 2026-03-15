import AsyncStorage from "@react-native-async-storage/async-storage";
import * as SystemUI from "expo-system-ui";
import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import { Platform, useColorScheme } from "react-native";

import { getThemeColors, type ThemeColors, type ThemeMode } from "@/constants/theme";

const THEME_PREFERENCE_KEY = "app:theme_preference";

export type ThemePreference = ThemeMode | "system";

type ThemeContextType = {
  colors: ThemeColors;
  resolvedTheme: ThemeMode;
  themePreference: ThemePreference;
  setThemePreference: (preference: ThemePreference) => Promise<void>;
};

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

const isThemePreference = (value: string): value is ThemePreference =>
  value === "system" || value === "light" || value === "dark";

const syncWebTheme = (resolvedTheme: ThemeMode) => {
  if (Platform.OS !== "web" || typeof document === "undefined") {
    return;
  }

  document.documentElement.dataset.theme = resolvedTheme;
};

export function ThemeProvider({ children }: { children: ReactNode }) {
  const systemColorScheme = useColorScheme();
  const [themePreference, setThemePreferenceState] = useState<ThemePreference>("system");
  const resolvedTheme: ThemeMode =
    themePreference === "system" ? (systemColorScheme === "dark" ? "dark" : "light") : themePreference;
  const colors = getThemeColors(resolvedTheme);

  useEffect(() => {
    const hydrateThemePreference = async () => {
      try {
        const storedPreference = await AsyncStorage.getItem(THEME_PREFERENCE_KEY);
        if (storedPreference && isThemePreference(storedPreference)) {
          setThemePreferenceState(storedPreference);
        }
      } catch {
        // Ignore local storage errors and keep system preference.
      }
    };

    void hydrateThemePreference();
  }, []);

  useEffect(() => {
    syncWebTheme(resolvedTheme);
    void SystemUI.setBackgroundColorAsync(colors.background).catch(() => {
      // Ignore unsupported runtimes.
    });
  }, [colors.background, resolvedTheme]);

  const setThemePreference = async (preference: ThemePreference) => {
    setThemePreferenceState(preference);

    try {
      await AsyncStorage.setItem(THEME_PREFERENCE_KEY, preference);
    } catch {
      // Keep in-memory preference even if persistence fails.
    }
  };

  const value: ThemeContextType = {
    colors,
    resolvedTheme,
    themePreference,
    setThemePreference,
  };

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useAppTheme() {
  const context = useContext(ThemeContext);

  if (!context) {
    throw new Error("useAppTheme must be used inside ThemeProvider.");
  }

  return context;
}
