import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { AppState, Platform, type AppStateStatus } from "react-native";

import { NetworkStatusToast } from "@/components/network-status-toast";

type NetworkContextType = {
  isConnected: boolean;
  isCheckingConnection: boolean;
  refreshConnection: () => Promise<boolean>;
  showToast: (message: string) => void;
  showOfflineToast: () => void;
  showOnlineToast: () => void;
};

const CHECK_INTERVAL_MS = 15000;
const CHECK_TIMEOUT_MS = 5000;
const NETWORK_PING_URL = "https://www.gstatic.com/generate_204";
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

  try {
    const response = await withTimeout(
      fetch(`${NETWORK_PING_URL}?t=${Date.now()}`, {
        method: "GET",
        headers: { "Cache-Control": "no-cache" },
      }),
      CHECK_TIMEOUT_MS,
    );

    return response.ok || response.status === 204;
  } catch {
    return false;
  }
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
      setIsConnected(nextState);
      return nextState;
    } finally {
      setIsCheckingConnection(false);
    }
  }, []);

  useEffect(() => {
    if (Platform.OS !== "web") {
      void refreshConnection();
      const intervalId = setInterval(() => {
        void refreshConnection();
      }, CHECK_INTERVAL_MS);
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
  }, [refreshConnection]);

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

  const value: NetworkContextType = {
    isConnected,
    isCheckingConnection,
    refreshConnection,
    showToast,
    showOfflineToast,
    showOnlineToast,
  };

  return (
    <NetworkContext.Provider value={value}>
      {children}
      <NetworkStatusToast
        message={toastMessage}
        toastKey={toastKey}
        visible={isToastVisible}
      />
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
