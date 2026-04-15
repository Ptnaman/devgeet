import AsyncStorage from "@react-native-async-storage/async-storage";
import Constants from "expo-constants";
import { requireOptionalNativeModule } from "expo-modules-core";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { AppState, Platform, type AppStateStatus } from "react-native";

import { useNetworkStatus } from "@/providers/network-provider";

const AUTO_UPDATE_PREFERENCE_KEY = "app:auto_update_enabled";
const DEFAULT_AUTO_UPDATE_ENABLED = true;
const FOREGROUND_UPDATE_CHECK_COOLDOWN_MS = 10 * 60 * 1000;

const getOtaReadyMessage = () => "Update ready. Tap Update now to install it.";
const getOtaAutoInstallMessage = () => "Update found. Restarting the app to install it.";
const getOtaUnavailableMessage = () =>
  "Install a preview or production build to check for OTA updates on this device.";
const getOtaUpToDateMessage = () => "Your app is already running the latest version.";
const getOtaCheckingMessage = () => "Checking for updates...";
const getOtaPendingMessage = () => "Update available. Tap Update now to install it.";
const getOtaAutoUpdateMessage = () => "Update found. Installing automatically...";
const getOtaDownloadingMessage = () => "Update found. Downloading now...";
const getOtaConnectInternetMessage = () => "Connect to the internet to check for updates.";
const getOtaNativeModuleUnavailableMessage = () =>
  "OTA native module is not available in this build.";
const getOtaNoPreparedUpdateMessage = () => "No update is ready right now.";
const getUpdatingAppMessage = () => "Updating app...";

type UpdatesNativeContext = {
  isUpdatePending?: boolean;
};

type UpdatesCheckResult = {
  isAvailable?: boolean;
};

type UpdatesFetchResult = {
  isNew?: boolean;
  isRollBackToEmbedded?: boolean;
};

type UpdatesNativeModule = {
  isEnabled?: boolean;
  runtimeVersion?: string | null;
  channel?: string | null;
  initialContext?: UpdatesNativeContext | null;
  checkForUpdateAsync: () => Promise<UpdatesCheckResult>;
  fetchUpdateAsync: () => Promise<UpdatesFetchResult>;
  reload: () => Promise<void>;
};

type AppUpdatesContextType = {
  appVersion: string;
  runtimeVersion: string;
  channelName: string;
  isOtaAvailable: boolean;
  isUpdatePending: boolean;
  isCheckingForUpdate: boolean;
  isApplyingUpdate: boolean;
  lastCheckedAt: number | null;
  updateStatusMessage: string;
  autoUpdateEnabled: boolean;
  checkForUpdatesAsync: () => Promise<void>;
  applyUpdateAsync: () => Promise<void>;
  setAutoUpdateEnabled: (enabled: boolean) => Promise<void>;
};

let cachedUpdatesModule: UpdatesNativeModule | null | undefined;

const getOptionalUpdatesModule = () => {
  if (cachedUpdatesModule !== undefined) {
    return cachedUpdatesModule;
  }

  cachedUpdatesModule = requireOptionalNativeModule<UpdatesNativeModule>("ExpoUpdates");
  return cachedUpdatesModule;
};

const updatesModule = getOptionalUpdatesModule();

const canUseOtaUpdates =
  Platform.OS !== "web" &&
  !__DEV__ &&
  Constants.appOwnership !== "expo" &&
  Boolean(updatesModule?.isEnabled);

const AppUpdatesContext = createContext<AppUpdatesContextType | undefined>(undefined);

const appVersion = Constants.expoConfig?.version?.trim() || "1.0.0";

const getRuntimeVersionLabel = () => {
  const resolvedRuntimeVersion = updatesModule?.runtimeVersion?.trim();
  return resolvedRuntimeVersion || appVersion;
};

const getChannelName = () => {
  const resolvedChannel = updatesModule?.channel?.trim();
  return resolvedChannel || "Not assigned";
};

const getUpdateErrorMessage = (error: unknown) =>
  error instanceof Error && error.message.trim()
    ? error.message.trim()
    : "Unable to complete the update request right now.";

const getInitialPendingState = () => Boolean(updatesModule?.initialContext?.isUpdatePending);

export function AppUpdatesProvider({
  children,
}: {
  children: ReactNode;
}) {
  const { isConnected, showOfflineToast, showToast } = useNetworkStatus();
  const isCheckingRef = useRef(false);
  const isApplyingRef = useRef(false);
  const lastCheckAtRef = useRef(0);
  const hasShownPendingToastRef = useRef(false);
  const autoUpdateEnabledRef = useRef(DEFAULT_AUTO_UPDATE_ENABLED);
  const [autoUpdateEnabled, setAutoUpdateEnabledState] = useState(DEFAULT_AUTO_UPDATE_ENABLED);
  const [hasHydratedAutoUpdatePreference, setHasHydratedAutoUpdatePreference] = useState(false);
  const [isUpdatePending, setIsUpdatePending] = useState(getInitialPendingState);
  const [isCheckingForUpdate, setIsCheckingForUpdate] = useState(false);
  const [isApplyingUpdate, setIsApplyingUpdate] = useState(false);
  const [lastCheckedAt, setLastCheckedAt] = useState<number | null>(null);
  const [updateStatusMessage, setUpdateStatusMessage] = useState(
    canUseOtaUpdates ? getOtaCheckingMessage() : getOtaUnavailableMessage(),
  );

  useEffect(() => {
    const hydrateAutoUpdatePreference = async () => {
      try {
        const storedValue = await AsyncStorage.getItem(AUTO_UPDATE_PREFERENCE_KEY);

        if (storedValue === "true" || storedValue === "false") {
          const isEnabled = storedValue === "true";
          autoUpdateEnabledRef.current = isEnabled;
          setAutoUpdateEnabledState(isEnabled);
        }
      } catch {
        // Keep default auto update preference if persistence fails.
      } finally {
        setHasHydratedAutoUpdatePreference(true);
      }
    };

    void hydrateAutoUpdatePreference();
  }, []);

  const setAutoUpdateEnabled = useCallback(async (enabled: boolean) => {
    autoUpdateEnabledRef.current = enabled;
    setAutoUpdateEnabledState(enabled);

    try {
      await AsyncStorage.setItem(AUTO_UPDATE_PREFERENCE_KEY, enabled ? "true" : "false");
    } catch {
      // Keep in-memory preference even if persistence fails.
    }
  }, []);

  const reloadIntoUpdateAsync = useCallback(
    async ({
      allowWithoutPending = false,
      statusMessage = getUpdatingAppMessage(),
    }: {
      allowWithoutPending?: boolean;
      statusMessage?: string;
    } = {}) => {
      if (!canUseOtaUpdates) {
        setUpdateStatusMessage(getOtaUnavailableMessage());
        return;
      }

      if (!updatesModule) {
        setUpdateStatusMessage(getOtaNativeModuleUnavailableMessage());
        return;
      }

      if (!allowWithoutPending && !isUpdatePending) {
        setUpdateStatusMessage(getOtaNoPreparedUpdateMessage());
        return;
      }

      if (isApplyingRef.current) {
        return;
      }

      try {
        isApplyingRef.current = true;
        setIsApplyingUpdate(true);
        setUpdateStatusMessage(statusMessage);
        await updatesModule.reload();
      } catch (error) {
        setUpdateStatusMessage(getUpdateErrorMessage(error));
        console.warn("Unable to apply OTA update.", error);
      } finally {
        isApplyingRef.current = false;
        setIsApplyingUpdate(false);
      }
    },
    [isUpdatePending],
  );

  const checkForUpdatesAsync = useCallback(
    async (interactive = true) => {
      if (!canUseOtaUpdates) {
        setUpdateStatusMessage(getOtaUnavailableMessage());
        return;
      }

      if (!isConnected) {
        setUpdateStatusMessage(getOtaConnectInternetMessage());
        if (interactive) {
          showOfflineToast();
        }
        return;
      }

      if (!updatesModule) {
        setUpdateStatusMessage(getOtaNativeModuleUnavailableMessage());
        return;
      }

      if (isCheckingRef.current) {
        return;
      }

      const now = Date.now();
      if (!interactive && now - lastCheckAtRef.current < FOREGROUND_UPDATE_CHECK_COOLDOWN_MS) {
        return;
      }

      isCheckingRef.current = true;
      setIsCheckingForUpdate(true);
      lastCheckAtRef.current = now;
      setLastCheckedAt(now);
      setUpdateStatusMessage(getOtaCheckingMessage());

      try {
        const result = await updatesModule.checkForUpdateAsync();

        if (!result.isAvailable) {
          setUpdateStatusMessage(getOtaUpToDateMessage());
          return;
        }

        setUpdateStatusMessage(
          autoUpdateEnabledRef.current ? getOtaAutoUpdateMessage() : getOtaDownloadingMessage(),
        );
        const fetchResult = await updatesModule.fetchUpdateAsync();
        const didPrepareUpdate = fetchResult.isNew || fetchResult.isRollBackToEmbedded;

        if (didPrepareUpdate) {
          setIsUpdatePending(true);

          if (autoUpdateEnabledRef.current) {
            hasShownPendingToastRef.current = true;
            setUpdateStatusMessage(getOtaAutoUpdateMessage());
            showToast(getOtaAutoInstallMessage());
            await reloadIntoUpdateAsync({
              allowWithoutPending: true,
              statusMessage: getUpdatingAppMessage(),
            });
            return;
          }

          hasShownPendingToastRef.current = true;
          setUpdateStatusMessage(getOtaPendingMessage());
          showToast(getOtaReadyMessage());
          return;
        }

        setUpdateStatusMessage(getOtaUpToDateMessage());
      } catch (error) {
        const message = getUpdateErrorMessage(error);
        setUpdateStatusMessage(message);
        console.warn("Unable to check for OTA updates.", error);
      } finally {
        isCheckingRef.current = false;
        setIsCheckingForUpdate(false);
      }
    },
    [isConnected, reloadIntoUpdateAsync, showOfflineToast, showToast],
  );

  const applyUpdateAsync = useCallback(
    async () => {
      await reloadIntoUpdateAsync();
    },
    [reloadIntoUpdateAsync],
  );
  const checkForUpdatesInteractiveAsync = useCallback(
    async () => {
      await checkForUpdatesAsync(true);
    },
    [checkForUpdatesAsync],
  );

  useEffect(() => {
    if (!isUpdatePending || hasShownPendingToastRef.current || autoUpdateEnabled) {
      return;
    }

    hasShownPendingToastRef.current = true;
    setUpdateStatusMessage(getOtaPendingMessage());
    showToast(getOtaReadyMessage());
  }, [autoUpdateEnabled, isUpdatePending, showToast]);

  useEffect(() => {
    if (!isUpdatePending || !hasHydratedAutoUpdatePreference) {
      return;
    }

    if (autoUpdateEnabled) {
      hasShownPendingToastRef.current = true;
      setUpdateStatusMessage(getOtaAutoUpdateMessage());
      void reloadIntoUpdateAsync({
        allowWithoutPending: true,
        statusMessage: getUpdatingAppMessage(),
      });
      return;
    }

    setUpdateStatusMessage(getOtaPendingMessage());
  }, [
    autoUpdateEnabled,
    hasHydratedAutoUpdatePreference,
    isUpdatePending,
    reloadIntoUpdateAsync,
  ]);

  useEffect(() => {
    if (!canUseOtaUpdates || !hasHydratedAutoUpdatePreference) {
      return;
    }

    void checkForUpdatesAsync(false);
  }, [checkForUpdatesAsync, hasHydratedAutoUpdatePreference]);

  useEffect(() => {
    if (!canUseOtaUpdates || !hasHydratedAutoUpdatePreference) {
      return;
    }

    const subscription = AppState.addEventListener("change", (nextState: AppStateStatus) => {
      if (nextState === "active") {
        void checkForUpdatesAsync(false);
      }
    });

    return () => {
      subscription.remove();
    };
  }, [checkForUpdatesAsync, hasHydratedAutoUpdatePreference]);

  const value = useMemo<AppUpdatesContextType>(
    () => ({
      appVersion,
      runtimeVersion: getRuntimeVersionLabel(),
      channelName: getChannelName(),
      isOtaAvailable: canUseOtaUpdates,
      isUpdatePending,
      isCheckingForUpdate,
      isApplyingUpdate,
      lastCheckedAt,
      updateStatusMessage,
      autoUpdateEnabled,
      checkForUpdatesAsync: checkForUpdatesInteractiveAsync,
      applyUpdateAsync,
      setAutoUpdateEnabled,
    }),
    [
      autoUpdateEnabled,
      applyUpdateAsync,
      checkForUpdatesInteractiveAsync,
      isApplyingUpdate,
      isCheckingForUpdate,
      isUpdatePending,
      lastCheckedAt,
      setAutoUpdateEnabled,
      updateStatusMessage,
    ],
  );

  return <AppUpdatesContext.Provider value={value}>{children}</AppUpdatesContext.Provider>;
}

export function useAppUpdates() {
  const context = useContext(AppUpdatesContext);

  if (!context) {
    throw new Error("useAppUpdates must be used inside AppUpdatesProvider.");
  }

  return context;
}
