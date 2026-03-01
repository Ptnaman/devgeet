import { getApp, getApps, initializeApp, type FirebaseApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import type { Analytics } from "firebase/analytics";
import { getFirestore } from "firebase/firestore";
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

export const auth = getAuth(firebaseApp);
export const firestore = getFirestore(firebaseApp);

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
