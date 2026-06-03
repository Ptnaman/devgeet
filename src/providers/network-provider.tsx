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
import { AppState, Platform, StyleSheet, View, type AppStateStatus } from "react-native";

import { NetworkStatusToast } from "@/components/network-status-toast";

type NetworkContextType = {
  isConnected: boolean;
  isCheckingConnection: boolean;
  refreshConnection: () => Promise<boolean>;
  showToast: (message: string) => void;
  showOfflineToast: () => void;
  showOnlineToast: () => void;
};

const CHECK_INTERVAL_ONLINE_MS = 10000;
const CHECK_INTERVAL_OFFLINE_MS = 15000;
const CHECK_TIMEOUT_MS = 5000;
const NETWORK_PING_URL = "https://www.gstatic.com/generate_204";
const FIRESTORE_HEALTHCHECK_URL =
  "https://firestore.googleapis.com/v1/projects/dev-geet/databases/(default)";
const FIREBASE_HEALTHCHECK_URL = "https://firebase.google.com";
const REQUIRED_CONSECUTIVE_FAILED_CHECKS = 2;
const TOAST_HIDE_DELAY_MS = 2200;
const OFFLINE_TOAST_MESSAGE = "No internet connection";
const ONLINE_TOAST_MESSAGE = "You are online";

const NetworkContext = createContext<NetworkContextType | undefined>(undefined);

const getBrowserConnectionState = () => {
  if (typeof navigator === "undefined") {
    return true;
  }

  return navigator.onLine;
};

const withTimeout = async <T,>(promise: Promise<T>, timeoutMs: number) => {
  let timeoutId: ReturnType<typeof setTimeout> | null = null;

  try {
    return await Promise.race<T>([
      promise,
      new Promise<T>((_, reject) => {
        timeoutId = setTimeout(() => {
          reject(new Error("Network check timed out."));
        }, timeoutMs);
      }),
    ]);
  } finally {
    if (timeoutId) {
      clearTimeout(timeoutId);
    }
  }
};

const pingInternet = async () => {
  if (Platform.OS === "web") {
    return getBrowserConnectionState();
  }

  const endpointChecks: Array<{
    url: string;
    method: "GET" | "HEAD";
    isReachable: (statusCode: number) => boolean;
  }> = [
    {
      url: `${NETWORK_PING_URL}?t=${Date.now()}`,
      method: "HEAD",
      isReachable: (statusCode) => statusCode === 204 || (statusCode >= 200 && statusCode < 400),
    },
    {
      url: `${FIRESTORE_HEALTHCHECK_URL}?t=${Date.now()}`,
      method: "GET",
      // Firestore endpoint may return 401/403 without auth, which still means network is reachable.
      isReachable: (statusCode) => statusCode >= 100 && statusCode < 500,
    },
    {
      url: `${FIREBASE_HEALTHCHECK_URL}?t=${Date.now()}`,
      method: "HEAD",
      isReachable: (statusCode) => statusCode >= 200 && statusCode < 400,
    },
  ];

  for (const endpointCheck of endpointChecks) {
    try {
      const response = await withTimeout(
        fetch(endpointCheck.url, {
          method: endpointCheck.method,
          headers: { "Cache-Control": "no-cache" },
        }),
        CHECK_TIMEOUT_MS,
      );

      if (endpointCheck.isReachable(response.status)) {
        return true;
      }
    } catch {
      // Try next endpoint to avoid false offline state from one blocked URL.
    }
  }

  return false;
};

export function NetworkProvider({ children }: { children: ReactNode }) {
  const [isConnected, setIsConnected] = useState(
    Platform.OS === "web" ? getBrowserConnectionState() : true,
  );
  const [isCheckingConnection, setIsCheckingConnection] = useState(Platform.OS !== "web");
  const [isToastVisible, setIsToastVisible] = useState(false);
  const [toastKey, setToastKey] = useState(0);
  const [toastMessage, setToastMessage] = useState("");
  const toastTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const previousConnectionRef = useRef<boolean | null>(null);
  const isConnectedRef = useRef(isConnected);
  const consecutiveFailedChecksRef = useRef(0);

  useEffect(() => {
    isConnectedRef.current = isConnected;
  }, [isConnected]);

  const clearToastTimer = useCallback(() => {
    if (toastTimeoutRef.current) {
      clearTimeout(toastTimeoutRef.current);
      toastTimeoutRef.current = null;
    }
  }, []);

  const showToast = useCallback((message: string) => {
    clearToastTimer();
    setToastMessage(message);
    setIsToastVisible(true);
    setToastKey((current) => current + 1);
    toastTimeoutRef.current = setTimeout(() => {
      setIsToastVisible(false);
    }, TOAST_HIDE_DELAY_MS);
  }, [clearToastTimer]);

  const showOfflineToast = useCallback(() => {
    showToast(OFFLINE_TOAST_MESSAGE);
  }, [showToast]);

  const showOnlineToast = useCallback(() => {
    showToast(ONLINE_TOAST_MESSAGE);
  }, [showToast]);

  const refreshConnection = useCallback(async () => {
    setIsCheckingConnection(true);

    try {
      const nextState = await pingInternet();

      if (nextState) {
        consecutiveFailedChecksRef.current = 0;
        setIsConnected(true);
        return true;
      }

      consecutiveFailedChecksRef.current += 1;
      const shouldMarkOffline =
        consecutiveFailedChecksRef.current >= REQUIRED_CONSECUTIVE_FAILED_CHECKS;
      const stabilizedState = shouldMarkOffline ? false : isConnectedRef.current;

      setIsConnected(stabilizedState);
      return stabilizedState;
    } finally {
      setIsCheckingConnection(false);
    }
  }, []);

  useEffect(() => {
    if (Platform.OS !== "web") {
      void refreshConnection();
      const nextIntervalMs = isConnected
        ? CHECK_INTERVAL_ONLINE_MS
        : CHECK_INTERVAL_OFFLINE_MS;
      const intervalId = setInterval(() => {
        void refreshConnection();
      }, nextIntervalMs);
      const subscription = AppState.addEventListener("change", (nextState: AppStateStatus) => {
        if (nextState === "active") {
          void refreshConnection();
        }
      });

      return () => {
        clearInterval(intervalId);
        subscription.remove();
      };
    }

    const syncBrowserState = () => {
      setIsConnected(getBrowserConnectionState());
      setIsCheckingConnection(false);
    };

    syncBrowserState();
    window.addEventListener("online", syncBrowserState);
    window.addEventListener("offline", syncBrowserState);

    return () => {
      window.removeEventListener("online", syncBrowserState);
      window.removeEventListener("offline", syncBrowserState);
    };
  }, [isConnected, refreshConnection]);

  useEffect(() => {
    if (previousConnectionRef.current === null) {
      previousConnectionRef.current = isConnected;

      if (!isConnected) {
        showOfflineToast();
      }

      return;
    }

    if (previousConnectionRef.current !== isConnected) {
      if (isConnected) {
        showOnlineToast();
      } else {
        showOfflineToast();
      }
    }

    previousConnectionRef.current = isConnected;
  }, [isConnected, showOfflineToast, showOnlineToast]);

  useEffect(() => {
    return () => {
      clearToastTimer();
    };
  }, [clearToastTimer]);

  const value = useMemo<NetworkContextType>(
    () => ({
      isConnected,
      isCheckingConnection,
      refreshConnection,
      showToast,
      showOfflineToast,
      showOnlineToast,
    }),
    [
      isCheckingConnection,
      isConnected,
      refreshConnection,
      showOfflineToast,
      showOnlineToast,
      showToast,
    ],
  );

  return (
    <NetworkContext.Provider value={value}>
      <View style={styles.root}>
        {children}
        <NetworkStatusToast
          message={toastMessage}
          toastKey={toastKey}
          visible={isToastVisible}
        />
      </View>
    </NetworkContext.Provider>
  );
}

export function useNetworkStatus() {
  const context = useContext(NetworkContext);

  if (!context) {
    throw new Error("useNetworkStatus must be used inside NetworkProvider.");
  }

  return context;
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    overflow: "visible",
  },
});
