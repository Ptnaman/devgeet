import AsyncStorage from "@react-native-async-storage/async-storage";
import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";

const KEEP_LYRICS_SCREEN_AWAKE_PREFERENCE_KEY =
  "app:keep_lyrics_screen_awake";
const DEFAULT_KEEP_LYRICS_SCREEN_AWAKE = true;

type LyricsReaderPreferencesContextType = {
  keepLyricsScreenAwakeEnabled: boolean;
  setKeepLyricsScreenAwakeEnabled: (enabled: boolean) => Promise<void>;
};

const LyricsReaderPreferencesContext =
  createContext<LyricsReaderPreferencesContextType | undefined>(undefined);

export function LyricsReaderPreferencesProvider({
  children,
}: {
  children: ReactNode;
}) {
  const [keepLyricsScreenAwakeEnabled, setKeepLyricsScreenAwakeEnabledState] =
    useState(DEFAULT_KEEP_LYRICS_SCREEN_AWAKE);

  useEffect(() => {
    const hydrateKeepLyricsScreenAwakePreference = async () => {
      try {
        const storedValue = await AsyncStorage.getItem(
          KEEP_LYRICS_SCREEN_AWAKE_PREFERENCE_KEY,
        );

        if (storedValue === "true" || storedValue === "false") {
          setKeepLyricsScreenAwakeEnabledState(storedValue === "true");
        }
      } catch {
        // Keep the default preference if persistence fails.
      }
    };

    void hydrateKeepLyricsScreenAwakePreference();
  }, []);

  const setKeepLyricsScreenAwakeEnabled = async (enabled: boolean) => {
    setKeepLyricsScreenAwakeEnabledState(enabled);

    try {
      await AsyncStorage.setItem(
        KEEP_LYRICS_SCREEN_AWAKE_PREFERENCE_KEY,
        enabled ? "true" : "false",
      );
    } catch {
      // Keep the in-memory preference if persistence fails.
    }
  };

  return (
    <LyricsReaderPreferencesContext.Provider
      value={{
        keepLyricsScreenAwakeEnabled,
        setKeepLyricsScreenAwakeEnabled,
      }}
    >
      {children}
    </LyricsReaderPreferencesContext.Provider>
  );
}

export function useLyricsReaderPreferences() {
  const context = useContext(LyricsReaderPreferencesContext);

  if (!context) {
    throw new Error(
      "useLyricsReaderPreferences must be used inside LyricsReaderPreferencesProvider.",
    );
  }

  return context;
}
