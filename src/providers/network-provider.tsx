import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import { AppState, Platform, type AppStateStatus } from "react-native";

type NetworkContextType = {
  isConnected: boolean;
  isCheckingConnection: boolean;
  refreshConnection: () => Promise<boolean>;
};

const CHECK_INTERVAL_MS = 15000;
const CHECK_TIMEOUT_MS = 5000;
const NETWORK_PING_URL = "https://www.gstatic.com/generate_204";

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

  const value: NetworkContextType = {
    isConnected,
    isCheckingConnection,
    refreshConnection,
  };

  return <NetworkContext.Provider value={value}>{children}</NetworkContext.Provider>;
}

export function useNetworkStatus() {
  const context = useContext(NetworkContext);

  if (!context) {
    throw new Error("useNetworkStatus must be used inside NetworkProvider.");
  }

  return context;
}
