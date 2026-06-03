import AsyncStorage from "@react-native-async-storage/async-storage";
import { getApp, getApps, initializeApp, type FirebaseApp } from "firebase/app";
import * as FirebaseAuth from "firebase/auth";
import {
  browserLocalPersistence,
  browserSessionPersistence,
  getAuth,
  initializeAuth,
  inMemoryPersistence,
  type Auth,
  type Persistence,
} from "firebase/auth";
import type { Analytics } from "firebase/analytics";
import {
  getFirestore,
  initializeFirestore,
  persistentLocalCache,
} from "firebase/firestore";
import { getFunctions } from "firebase/functions";
import { Platform } from "react-native";

const firebaseConfig = {
  apiKey: "AIzaSyCq85PXmRHdg2zoKu8dvR7JHmJTsUg8RPo",
  authDomain: "dev-geet.firebaseapp.com",
  projectId: "dev-geet",
  storageBucket: "dev-geet.firebasestorage.app",
  messagingSenderId: "180784231307",
  appId: "1:180784231307:web:11eefcc4cbb53cae1f358e",
  measurementId: "G-L7219Q02D8",
};

export const firebaseApp: FirebaseApp = getApps().length
  ? getApp()
  : initializeApp(firebaseConfig);

const getNativePersistence = (): Persistence | undefined => {
  const maybeFactory = (
    FirebaseAuth as unknown as {
      getReactNativePersistence?: (storage: typeof AsyncStorage) => Persistence;
    }
  ).getReactNativePersistence;

  if (typeof maybeFactory === "function") {
    return maybeFactory(AsyncStorage);
  }

  return undefined;
};

export const getAuthPersistenceForRememberMe = (remember: boolean): Persistence => {
  if (Platform.OS === "web") {
    return remember ? browserLocalPersistence : browserSessionPersistence;
  }

  if (!remember) {
    return inMemoryPersistence;
  }

  return getNativePersistence() ?? inMemoryPersistence;
};

const createAuthInstance = (): Auth => {
  if (Platform.OS === "web") {
    return getAuth(firebaseApp);
  }

  const nativePersistence = getNativePersistence();

  try {
    if (!nativePersistence) {
      return getAuth(firebaseApp);
    }

    return initializeAuth(firebaseApp, { persistence: nativePersistence });
  } catch {
    return getAuth(firebaseApp);
  }
};

export const auth = createAuthInstance();

const createFirestoreInstance = () => {
  if (Platform.OS === "web") {
    try {
      return initializeFirestore(firebaseApp, {
        localCache: persistentLocalCache(),
      });
    } catch {
      return getFirestore(firebaseApp);
    }
  }

  try {
    return initializeFirestore(firebaseApp, {
      // React Native networks/proxies can block Firestore's default stream transport.
      // These settings reduce "Could not reach Cloud Firestore backend" timeouts.
      experimentalAutoDetectLongPolling: true,
    });
  } catch {
    return getFirestore(firebaseApp);
  }
};

export const firestore = createFirestoreInstance();
export const functions = getFunctions(firebaseApp, "us-central1");

let analytics: Analytics | null = null;

const initializeAnalytics = async () => {
  if (Platform.OS !== "web") {
    return;
  }

  try {
    const { getAnalytics, isSupported } = await import("firebase/analytics");
    if (await isSupported()) {
      analytics = getAnalytics(firebaseApp);
    }
  } catch {
    // Ignore analytics setup errors on unsupported runtimes.
  }
};

void initializeAnalytics();

export const getFirebaseAnalytics = () => analytics;
